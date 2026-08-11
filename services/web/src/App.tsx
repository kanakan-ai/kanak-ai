/**
 * Kanak AI Web App
 * M1-T2: Email authentication with sign-in flow
 */

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SignIn } from './components/SignIn';
import { Dashboard } from './components/Dashboard';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

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

  return isAuthenticated ? <Dashboard /> : <SignIn />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
