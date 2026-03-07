import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authRegister, getPublicSettings } from '../api';
import type { SiteSettings } from '../types';

export default function RegisterPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/');
    getPublicSettings().then(s => {
      setSettings(s);
      if (!s.registration_enabled) navigate('/login');
    }).catch(() => null);
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await authRegister(username.trim(), password, email.trim() || undefined);
      login(res.access_token, res.user);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm p-8 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="text-center mb-8">
          {settings?.site_icon_b64 && (
            <img src={settings.site_icon_b64} alt="icon" className="w-12 h-12 mx-auto mb-3 rounded" />
          )}
          <h1 className="font-mono text-xl font-semibold" style={{ color: 'var(--accent)' }}>
            {settings?.site_title ?? 'OSINT Graph Platform'}
          </h1>
          <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>Create an account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Username', value: username, set: setUsername, type: 'text', placeholder: 'username', required: true },
            { label: 'Email (optional)', value: email, set: setEmail, type: 'email', placeholder: 'user@example.com', required: false },
            { label: 'Password', value: password, set: setPassword, type: 'password', placeholder: '••••••••', required: true },
            { label: 'Confirm password', value: confirm, set: setConfirm, type: 'password', placeholder: '••••••••', required: true },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
              <input
                type={f.type}
                value={f.value}
                required={f.required}
                onChange={e => f.set(e.target.value)}
                className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                placeholder={f.placeholder}
              />
            </div>
          ))}

          {error && (
            <p className="text-xs font-mono px-3 py-2 rounded-lg" style={{ background: '#2d1515', color: '#f87171', border: '1px solid #7f1d1d' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password || !confirm}
            className="w-full py-2 rounded-lg font-mono text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-xs font-mono mt-5" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
