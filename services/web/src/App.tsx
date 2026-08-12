/**
 * Kanak AI Web App
 * M1-T2: Email authentication with sign-in flow
 * M1-T3: Document upload navigation
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SignIn } from './components/SignIn';
import { Dashboard } from './components/Dashboard';
import { Upload } from './components/Upload';

type Screen = 'dashboard' | 'upload';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        color: '#a0a0a0',
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignIn />;
  }

  // Authenticated screens
  if (currentScreen === 'upload') {
    return (
      <div>
        {/* Back button */}
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 1000,
        }}>
          <button
            onClick={() => setCurrentScreen('dashboard')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#a0a0a0',
              backgroundColor: '#1a1a2e',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#667eea';
              e.currentTarget.style.color = '#667eea';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2a2a';
              e.currentTarget.style.color = '#a0a0a0';
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
        <Upload onUploadComplete={() => setCurrentScreen('dashboard')} />
      </div>
    );
  }

  return <Dashboard onNavigateToUpload={() => setCurrentScreen('upload')} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
