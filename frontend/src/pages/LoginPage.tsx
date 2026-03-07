import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authLogin, getPublicSettings } from '../api';
import type { SiteSettings } from '../types';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/');
    getPublicSettings().then(setSettings).catch(() => null);
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      const res = await authLogin(username.trim(), password);
      login(res.access_token, res.user);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm p-8 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {/* Logo / Title */}
        <div className="text-center mb-8">
          {settings?.site_icon_b64 && (
            <img src={settings.site_icon_b64} alt="icon" className="w-12 h-12 mx-auto mb-3 rounded" />
          )}
          <h1 className="font-mono text-xl font-semibold" style={{ color: 'var(--accent)' }}>
            {settings?.site_title ?? 'OSINT Graph Platform'}
          </h1>
          <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>Username</label>
            <input
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
              placeholder="username"
            />
          </div>
          <div>
            <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs font-mono px-3 py-2 rounded-lg" style={{ background: '#2d1515', color: '#f87171', border: '1px solid #7f1d1d' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-2 rounded-lg font-mono text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {settings?.registration_enabled !== false && (
          <p className="text-center text-xs font-mono mt-5" style={{ color: 'var(--text-muted)' }}>
            No account?{' '}
            <Link to="/register" style={{ color: 'var(--accent)' }}>Register</Link>
          </p>
        )}
      </div>
    </div>
  );
}
