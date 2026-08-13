/**
 * Authentication Context Provider
 * Manages user session, token storage, and auth state
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/v1';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  appleLinked: boolean;
  plan: string;
  role: string;
  darkMode: boolean;
  pushEnabled: boolean;
  weeklyDigest: boolean;
  createdAt: string;
}

interface SessionResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: User;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  startEmailAuth: (email: string, preferMagicLink?: boolean) => Promise<{ expiresInSeconds: number }>;
  verifyEmailAuth: (email: string, code: string) => Promise<void>;
  startPhoneAuth: (phone: string) => Promise<{ expiresInSeconds: number }>;
  verifyPhoneAuth: (phone: string, code: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'kanak_access_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      // Fetch user profile
      fetchUser(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  async function fetchUser(authToken: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token invalid, clear it
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function startEmailAuth(email: string, preferMagicLink = false): Promise<{ expiresInSeconds: number }> {
    const response = await fetch(`${API_BASE_URL}/auth/email/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, preferMagicLink }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to start email authentication');
    }

    const data = await response.json();
    return { expiresInSeconds: data.expiresInSeconds };
  }

  async function verifyEmailAuth(email: string, code: string): Promise<void> {
    await storeSession(await requestSession('/auth/email/verify', { email, code }));
  }

  async function requestSession(path: string, body: object): Promise<SessionResponse> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify code');
    }

    return response.json();
  }

  async function storeSession(data: SessionResponse): Promise<void> {
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
  }

  async function startPhoneAuth(phone: string): Promise<{ expiresInSeconds: number }> {
    const response = await fetch(`${API_BASE_URL}/auth/phone/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
    if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to send verification code'); }
    const data = await response.json(); return { expiresInSeconds: data.expiresInSeconds };
  }

  async function verifyPhoneAuth(phone: string, code: string): Promise<void> { await storeSession(await requestSession('/auth/phone/verify', { phone, code })); }

  async function signInWithApple(): Promise<void> { await storeSession(await requestSession('/auth/apple', { identityToken: 'mock-apple-web-user' })); }

  async function logout(): Promise<void> {
    if (!token) return;
    const tokenToRevoke = token;
    // End the local session first. Server revocation can be slow in the M1 mock
    // implementation because session hashes are deliberately one-way bcrypt values.
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenToRevoke}`,
        },
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
  }

  async function refreshUser(): Promise<void> {
    if (token) {
      await fetchUser(token);
    }
  }

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user,
    isLoading,
    startEmailAuth,
    verifyEmailAuth,
    startPhoneAuth,
    verifyPhoneAuth,
    signInWithApple,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
