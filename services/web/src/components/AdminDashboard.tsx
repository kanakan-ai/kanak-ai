import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/v1';

interface RecentEvent { id: string; userIdentifier: string | null; properties: Record<string, unknown>; occurredAt: string }
interface EventGroup { last24h: number; recent: RecentEvent[] }
interface DailyCount { day: string; event: string; count: number }
interface OpsSummary {
  api: { status: string; env: string; uptimeSeconds: number; version: string };
  database: { status: string };
  latency: { sampleCount: number; avgMs: number; p50Ms: number; p95Ms: number };
  events: { authSignInSuccess: EventGroup; documentUploadAccepted: EventGroup; dailyCounts: DailyCount[] };
}

function formatTime(iso: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)); }

function DailyChart({ event, label, counts }: { event: string; label: string; counts: DailyCount[] }) {
  const series = counts.filter((c) => c.event === event);
  const max = Math.max(1, ...series.map((c) => c.count));
  return (
    <div className="admin-chart">
      <p className="admin-chart-label">{label}</p>
      <div className="admin-chart-bars">
        {series.map((point) => (
          <div className="admin-chart-bar" key={point.day} title={`${point.day}: ${point.count}`}>
            <span className="admin-chart-bar-fill" style={{ height: `${(point.count / max) * 100}%` }} />
            <span className="admin-chart-bar-value">{point.count}</span>
          </div>
        ))}
        {series.length === 0 && <p className="status-message">No events in the last 7 days.</p>}
      </div>
    </div>
  );
}

function EventTable({ title, group }: { title: string; group: EventGroup }) {
  return (
    <section className="admin-card">
      <div className="admin-card-header"><h2>{title}</h2><span className="admin-badge">{group.last24h} in 24h</span></div>
      {group.recent.length === 0 ? <p className="status-message">No events recorded yet.</p> : (
        <table className="admin-table">
          <thead><tr><th>When</th><th>User</th><th>Details</th></tr></thead>
          <tbody>
            {group.recent.map((event) => (
              <tr key={event.id}>
                <td>{formatTime(event.occurredAt)}</td>
                <td>{event.userIdentifier ?? '—'}</td>
                <td>{Object.entries(event.properties).map(([key, value]) => `${key}: ${value}`).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function AdminDashboard() {
  const { token, logout } = useAuth();
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, [token]);

  async function load() {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/ops-summary`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error();
      setSummary(await response.json());
      setError(null);
    } catch {
      setError('We could not load the ops summary.');
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="brand"><span className="brand-mark">K</span><span>Kanak AI Admin</span></div>
        <div className="admin-header-actions">
          <span className="admin-badge">ADMIN ONLY · {summary?.api.env ?? '…'}</span>
          <button className="text-button" onClick={() => void load()}>Refresh</button>
          <button className="sign-out" onClick={() => void logout()}>Sign out</button>
        </div>
      </header>
      <main className="page-content">
        <p className="eyebrow">Internal — not visible to customers</p>
        <h1>Ops health</h1>
        {error && <div className="notice error">{error}<button className="text-button" onClick={() => void load()}>Try again</button></div>}
        {!summary ? <p className="status-message">Loading ops summary…</p> : (
          <>
            <div className="admin-kpi-grid">
              <div className="admin-kpi"><p>API status</p><strong className={summary.api.status === 'ok' ? 'ok' : 'warn'}>{summary.api.status === 'ok' ? 'Healthy' : 'Degraded'}</strong><span>{Math.round(summary.api.uptimeSeconds / 60)} min uptime</span></div>
              <div className="admin-kpi"><p>Database</p><strong className={summary.database.status === 'ok' ? 'ok' : 'warn'}>{summary.database.status === 'ok' ? 'Healthy' : 'Down'}</strong></div>
              <div className="admin-kpi"><p>p50 latency</p><strong>{summary.latency.p50Ms}ms</strong><span>{summary.latency.sampleCount} samples</span></div>
              <div className="admin-kpi"><p>p95 latency</p><strong>{summary.latency.p95Ms}ms</strong><span>avg {summary.latency.avgMs}ms</span></div>
            </div>
            <section className="admin-card">
              <h2>Events, last 7 days</h2>
              <div className="admin-chart-row">
                <DailyChart event="auth_sign_in_success" label="Sign-ins" counts={summary.events.dailyCounts} />
                <DailyChart event="document_upload_accepted" label="Uploads accepted" counts={summary.events.dailyCounts} />
              </div>
            </section>
            <EventTable title="Recent sign-ins" group={summary.events.authSignInSuccess} />
            <EventTable title="Recent uploads" group={summary.events.documentUploadAccepted} />
          </>
        )}
      </main>
    </div>
  );
}
