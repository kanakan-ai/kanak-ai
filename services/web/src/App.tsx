/**
 * Kanak AI Web App
 * M1-T2: Email authentication with sign-in flow
 * M1-T3: Document upload navigation
 * M1-T4: Vault and document detail screens
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SignIn } from './components/SignIn';
import { Dashboard } from './components/Dashboard';
import { Upload } from './components/Upload';
import { Vault } from './components/Vault';
import { DocumentDetail } from './components/DocumentDetail';

type Screen = 'vault' | 'upload' | 'document-detail' | 'dashboard';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('vault');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        color: '#6c757d',
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
            onClick={() => setCurrentScreen('vault')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#17a2b8',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#17a2b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
            }}
          >
            ← Back to Vault
          </button>
        </div>
        <Upload onUploadComplete={() => setCurrentScreen('vault')} />
      </div>
    );
  }

  if (currentScreen === 'document-detail' && selectedDocumentId) {
    return (
      <DocumentDetail
        documentId={selectedDocumentId}
        onBack={() => {
          setSelectedDocumentId(null);
          setCurrentScreen('vault');
        }}
      />
    );
  }

  if (currentScreen === 'dashboard') {
    return <Dashboard onNavigateToUpload={() => setCurrentScreen('upload')} />;
  }

  // Default: Vault screen
  return (
    <Vault
      onNavigateToUpload={() => setCurrentScreen('upload')}
      onNavigateToDetail={(documentId) => {
        setSelectedDocumentId(documentId);
        setCurrentScreen('document-detail');
      }}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
