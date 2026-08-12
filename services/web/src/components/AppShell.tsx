import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

type Screen = 'vault' | 'upload' | 'document-detail';

interface AppShellProps {
  screen: Screen;
  onNavigate: (screen: 'vault' | 'upload') => void;
  children: ReactNode;
}

export function AppShell({ screen, onNavigate, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const initials = user?.email?.slice(0, 1).toUpperCase() ?? 'K';

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Main navigation">
        <button className="brand" onClick={() => onNavigate('vault')} aria-label="Kanak AI Vault">
          <span className="brand-mark">K</span><span>Kanak AI</span>
        </button>
        <nav className="primary-nav">
          <button className={screen === 'vault' || screen === 'document-detail' ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate('vault')}>
            <span aria-hidden="true">▣</span> Vault
          </button>
          <button className="nav-link" disabled title="Available in a future milestone"><span aria-hidden="true">◌</span> Ask</button>
          <button className="nav-link" disabled title="Available in a future milestone"><span aria-hidden="true">⚙</span> Settings</button>
        </nav>
        <div className="account-panel">
          <span className="account-avatar" aria-hidden="true">{initials}</span>
          <span className="account-email">{user?.email}</span>
          <button className="sign-out" onClick={() => void logout()}>Sign out</button>
        </div>
      </aside>
      <div className="app-main">
        <header className="mobile-header">
          <button className="brand" onClick={() => onNavigate('vault')} aria-label="Kanak AI Vault"><span className="brand-mark">K</span><span>Kanak AI</span></button>
          <button className="sign-out" onClick={() => void logout()}>Sign out</button>
        </header>
        {children}
        <nav className="mobile-nav" aria-label="Main navigation">
          <button className={screen === 'vault' || screen === 'document-detail' ? 'nav-link active' : 'nav-link'} onClick={() => onNavigate('vault')}>▣<span>Vault</span></button>
          <button className="nav-link" disabled>◌<span>Ask</span></button>
          <button className="nav-link" disabled>⚙<span>Settings</span></button>
        </nav>
      </div>
    </div>
  );
}
