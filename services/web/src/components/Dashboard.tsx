/**
 * Dashboard Component
 * Protected home page showing user profile
 * M1-T3: Added upload navigation
 */

import { useAuth } from '../contexts/AuthContext';

interface DashboardProps {
  onNavigateToUpload?: () => void;
}

export function Dashboard({ onNavigateToUpload }: DashboardProps) {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
  }

  if (!user) return null;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '3rem',
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Kanak AI
          </h1>

          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#a0a0a0',
              backgroundColor: 'transparent',
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
            Sign Out
          </button>
        </div>

        {/* Success Message */}
        <div style={{
          backgroundColor: '#1a2a1a',
          border: '1px solid #00ff88',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
          }}>
            <span style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#00ff88',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '1rem',
              fontSize: '1rem',
            }}>
              ✓
            </span>
            <div>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#00ff88',
                marginBottom: '0.25rem',
              }}>
                Sign-in successful!
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: '#a0a0a0',
                margin: 0,
              }}>
                Welcome to your Kanak AI vault
              </p>
            </div>
          </div>
        </div>

        {/* User Profile Card */}
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: '12px',
          padding: '2rem',
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            marginBottom: '1.5rem',
            color: '#ffffff',
          }}>
            Your Profile
          </h2>

          <table style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: '0 1rem',
          }}>
            <tbody>
              <tr>
                <td style={{
                  color: '#666',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  paddingRight: '2rem',
                  verticalAlign: 'top',
                }}>
                  Email
                </td>
                <td style={{
                  color: '#fff',
                  fontSize: '1rem',
                }}>
                  {user.email}
                </td>
              </tr>
              <tr>
                <td style={{
                  color: '#666',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  paddingRight: '2rem',
                  verticalAlign: 'top',
                }}>
                  User ID
                </td>
                <td style={{
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                }}>
                  {user.id}
                </td>
              </tr>
              <tr>
                <td style={{
                  color: '#666',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  paddingRight: '2rem',
                  verticalAlign: 'top',
                }}>
                  Plan
                </td>
                <td style={{
                  color: '#fff',
                  fontSize: '1rem',
                  textTransform: 'capitalize',
                }}>
                  {user.plan}
                </td>
              </tr>
              <tr>
                <td style={{
                  color: '#666',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  paddingRight: '2rem',
                  verticalAlign: 'top',
                }}>
                  Role
                </td>
                <td style={{
                  color: '#fff',
                  fontSize: '1rem',
                  textTransform: 'capitalize',
                }}>
                  {user.role}
                </td>
              </tr>
              <tr>
                <td style={{
                  color: '#666',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  paddingRight: '2rem',
                  verticalAlign: 'top',
                }}>
                  Apple ID
                </td>
                <td style={{
                  color: user.appleLinked ? '#00ff88' : '#666',
                  fontSize: '1rem',
                }}>
                  {user.appleLinked ? 'Linked' : 'Not linked'}
                </td>
              </tr>
              <tr>
                <td style={{
                  color: '#666',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  paddingRight: '2rem',
                  verticalAlign: 'top',
                }}>
                  Member Since
                </td>
                <td style={{
                  color: '#fff',
                  fontSize: '1rem',
                }}>
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Coming Soon */}
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          backgroundColor: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: '12px',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <button
              onClick={onNavigateToUpload}
              style={{
                padding: '1rem 2rem',
                fontSize: '1rem',
                fontWeight: '600',
                color: '#ffffff',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              📄 Upload Document
            </button>
            <p style={{
              fontSize: '0.875rem',
              color: '#666',
              margin: 0,
              textAlign: 'center',
            }}>
              Vault view, alerts, and assistant features coming in M1-T4 through M1-T7
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
