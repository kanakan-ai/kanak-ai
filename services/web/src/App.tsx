/**
 * Kanak AI Web App
 * M1-T2: Email authentication with sign-in flow
 * M1-T3: Document upload navigation
 * M1-T4: Vault and document detail screens
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SignIn } from './components/SignIn';
import { Upload } from './components/Upload';
import { Vault } from './components/Vault';
import { DocumentDetail } from './components/DocumentDetail';
import { AppShell } from './components/AppShell';
import { AdminDashboard } from './components/AdminDashboard';

type Screen = 'vault' | 'upload' | 'document-detail';

// Admin console: role-gated, never linked from customer nav (STEERING.md rule 7).
const isAdminPath = window.location.pathname.startsWith('/admin');

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('vault');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b1720',
        color: '#dbe8ee',
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignIn />;
  }

  if (isAdminPath) {
    // Non-admins get no indication an admin route exists — sent straight back to their vault.
    if (user?.role !== 'admin') {
      window.location.replace('/');
      return null;
    }
    return <AdminDashboard />;
  }

  const navigate = (screen: 'vault' | 'upload') => {
    setSelectedDocumentId(null);
    setCurrentScreen(screen);
  };
  let content;
  if (currentScreen === 'upload') content = <Upload onUploadComplete={() => navigate('vault')} onBack={() => navigate('vault')} />;
  else if (currentScreen === 'document-detail' && selectedDocumentId) content = <DocumentDetail documentId={selectedDocumentId} onBack={() => navigate('vault')} />;
  else content = <Vault onNavigateToUpload={() => navigate('upload')} onNavigateToDetail={(documentId) => { setSelectedDocumentId(documentId); setCurrentScreen('document-detail'); }} />;
  return <AppShell screen={currentScreen} onNavigate={navigate}>{content}</AppShell>;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
