/**
 * Sign In Component
 * Email OTP authentication flow
 */

import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function SignIn() {
  const { startEmailAuth, verifyEmailAuth } = useAuth();
  
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiryMinutes, setExpiryMinutes] = useState(5);

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await startEmailAuth(email);
      setExpiryMinutes(Math.floor(result.expiresInSeconds / 60));
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await verifyEmailAuth(email, code);
      // Auth context will update user state, causing redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
      setIsLoading(false);
    }
  }

  function handleBackToEmail() {
    setStep('email');
    setCode('');
    setError(null);
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a0a0a',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
      }}>
        {/* Logo / Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '3rem',
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Kanak AI
          </h1>
          <p style={{
            fontSize: '1rem',
            color: '#a0a0a0',
          }}>
            Your trusted life-admin vault
          </p>
        </div>

        {/* Sign In Card */}
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: '12px',
          padding: '2rem',
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            marginBottom: '0.5rem',
            color: '#ffffff',
          }}>
            {step === 'email' ? 'Sign In' : 'Verify Code'}
          </h2>
          
          <p style={{
            fontSize: '0.875rem',
            color: '#a0a0a0',
            marginBottom: '1.5rem',
          }}>
            {step === 'email' 
              ? 'Enter your email to receive a verification code'
              : `We sent a code to ${email}`
            }
          </p>

          {/* Error Display */}
          {error && (
            <div style={{
              backgroundColor: '#2a1a1a',
              border: '1px solid #ff4444',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: '#ff6666',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          {/* Email Step */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: '#e0e0e0',
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    color: '#ffffff',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#2a2a2a'}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#ffffff',
                  background: isLoading || !email 
                    ? '#333333' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading || !email ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && email) {
                    e.currentTarget.style.opacity = '0.9';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                {isLoading ? 'Sending...' : 'Send Code'}
              </button>
            </form>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <form onSubmit={handleCodeSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: '#e0e0e0',
                }}>
                  Verification Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  placeholder="000000"
                  disabled={isLoading}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1.5rem',
                    fontWeight: '600',
                    letterSpacing: '0.5rem',
                    textAlign: 'center',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #2a2a2a',
                    borderRadius: '8px',
                    color: '#ffffff',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#2a2a2a'}
                />
                <p style={{
                  fontSize: '0.75rem',
                  color: '#666',
                  marginTop: '0.5rem',
                }}>
                  Code expires in {expiryMinutes} minutes
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#ffffff',
                  background: isLoading || code.length !== 6
                    ? '#333333'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading || code.length !== 6 ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s',
                  marginBottom: '0.75rem',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && code.length === 6) {
                    e.currentTarget.style.opacity = '0.9';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                {isLoading ? 'Verifying...' : 'Verify'}
              </button>

              <button
                type="button"
                onClick={handleBackToEmail}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#a0a0a0',
                  background: 'transparent',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.color = '#667eea';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#2a2a2a';
                  e.currentTarget.style.color = '#a0a0a0';
                }}
              >
                Use Different Email
              </button>
            </form>
          )}
        </div>

        {/* Dev Hint */}
        {import.meta.env.DEV && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: '#666',
            textAlign: 'center',
          }}>
            <strong style={{ color: '#888' }}>Dev Mode:</strong> Use code <code style={{
              padding: '0.125rem 0.375rem',
              backgroundColor: '#0a0a0a',
              borderRadius: '4px',
              color: '#00ff88',
            }}>000000</code> to sign in
          </div>
        )}
      </div>
    </div>
  );
}
