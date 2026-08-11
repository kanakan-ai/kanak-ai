/**
 * Kanak AI Web App
 * M1-T1: Minimal health check / placeholder page
 * Full UI will be implemented in M1-T7
 */

import { useState, useEffect } from 'react';

interface HealthStatus {
  status: string;
  service: string;
  version: string;
  env: string;
  timestamp: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/v1';

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkHealth() {
      try {
        const response = await fetch(`${API_BASE_URL.replace('/v1', '')}/health`);
        if (!response.ok) {
          throw new Error(`API health check failed: ${response.status}`);
        }
        const data = await response.json();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    checkHealth();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a0a0a',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '600px',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: '700',
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Kanak AI
        </h1>
        
        <p style={{
          fontSize: '1.25rem',
          color: '#a0a0a0',
          marginBottom: '3rem',
        }}>
          Your trusted life-admin vault + action engine
        </p>

        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'left',
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            marginBottom: '1rem',
            color: '#ffffff',
          }}>
            M1-T1: Foundation Status
          </h2>

          {loading && (
            <p style={{ color: '#a0a0a0' }}>Checking API connection...</p>
          )}

          {error && (
            <div style={{
              backgroundColor: '#2a1a1a',
              border: '1px solid #ff4444',
              borderRadius: '8px',
              padding: '1rem',
              color: '#ff6666',
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {health && (
            <div style={{ color: '#a0a0a0' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '1rem',
              }}>
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#00ff88',
                  marginRight: '0.75rem',
                }} />
                <span style={{ color: '#00ff88', fontWeight: '600' }}>
                  All systems operational
                </span>
              </div>
              
              <table style={{ width: '100%', borderSpacing: '0.5rem' }}>
                <tbody>
                  <tr>
                    <td style={{ color: '#666' }}>Service:</td>
                    <td style={{ color: '#fff' }}>{health.service}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#666' }}>Version:</td>
                    <td style={{ color: '#fff' }}>{health.version}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#666' }}>Environment:</td>
                    <td style={{ color: '#fff' }}>{health.env}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#666' }}>Status:</td>
                    <td style={{ color: '#00ff88' }}>{health.status}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{
          marginTop: '2rem',
          fontSize: '0.875rem',
          color: '#666',
        }}>
          Phase 1 · Milestone 1 · Task 1<br />
          Auth, upload, and vault UI coming in M1-T2 through M1-T7
        </p>
      </div>
    </div>
  );
}

export default App;
