import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/v1';

interface OnboardingProps {
  onGetStarted: () => void;
}

// PATCH /v1/me is not implemented yet, so this stays in localStorage per user id
// rather than server-side (see docs/M1-T7-verification.md).
function onboardingKey(userId: string) {
  return `kanak_onboarding_seen:${userId}`;
}

/**
 * Vault's empty-state content. Renders every time the vault has zero documents
 * (first sign-in, after skipping earlier, or after deleting everything) — but
 * the Journey A step-A1 funnel event (metrics.md: onboarding_completed) fires
 * only once per account, the first time this is ever shown.
 */
export function Onboarding({ onGetStarted }: OnboardingProps) {
  const { token, user } = useAuth();

  useEffect(() => {
    if (!user || !token) return;
    const key = onboardingKey(user.id);
    if (localStorage.getItem(key) === '1') return;
    localStorage.setItem(key, '1');
    void fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: [{ event: 'onboarding_completed', client: 'web' }] }),
    }).catch(() => {});
  }, [user, token]);

  return (
    <main className="page-content narrow">
      <header className="page-header simple">
        <p className="eyebrow">Your documents</p>
        <h1>Get started</h1>
        <p className="page-subtitle">
          Kanak AI keeps your renewals, policies, and important dates in one calm, private place —
          add your first personal document to see it in action.
        </p>
      </header>

      <section className="surface-form">
        <h2>How upload works</h2>
        <ol className="onboarding-steps">
          <li>Choose the document type</li>
          <li>Upload a PDF from your device</li>
          <li>We extract key fields for your vault</li>
        </ol>
        <p className="page-subtitle">
          We may not auto-detect every format — picking the type helps parsing accuracy.
          Personal / household documents only.
        </p>
      </section>

      <button className="button primary full" style={{ marginTop: 20 }} onClick={onGetStarted}>
        Choose type &amp; upload
      </button>

      <section className="upload-note" style={{ marginTop: 20 }}>
        <span className="status-pill parsing" style={{ justifySelf: 'start' }}>Coming later</span>
        <strong>Email auto-scan</strong>
        <span>Connect Gmail/Outlook to find policies automatically — not available yet (Phase 2). No inbox connection in this release.</span>
      </section>

      <p className="mock-hint">Privacy: originals stay in your vault; you can export or delete anytime in Settings.</p>
    </main>
  );
}
