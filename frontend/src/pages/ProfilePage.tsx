import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMe, updateMe, getMyStorage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLang } from '../i18n/LangProvider';
import { User, Shield, Clock, HardDrive, Key, Mail, Check, X } from 'lucide-react';

export default function ProfilePage() {
  const { updateUser, logout } = useAuth();
  const { toast } = useToast();
  const { lang } = useLang();
  const qc = useQueryClient();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { data: storage } = useQuery({ queryKey: ['storage'], queryFn: getMyStorage, refetchInterval: 30_000 });

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [sessionHours, setSessionHours] = useState<number | ''>('');
  const [editingField, setEditingField] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => {
      updateUser(user);
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success(lang === 'ru' ? 'Сохранено' : 'Saved');
      setEditingField(null);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || (lang === 'ru' ? 'Ошибка' : 'Error'));
    },
  });

  if (!me) return null;

  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
  const inputStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' };

  const Section = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <div className="rounded-xl p-5 mb-4" style={cardStyle}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} style={{ color: 'var(--accent)' }} />
        <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{title}</span>
      </div>
      {children}
    </div>
  );

  const Field = ({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) => (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{value}</span>
        {children}
      </div>
    </div>
  );

  const saveUsername = () => {
    if (!username.trim()) return;
    saveMutation.mutate({ username: username.trim() });
  };

  const saveEmail = () => {
    saveMutation.mutate({ email: email.trim() || '' });
  };

  const savePassword = () => {
    if (newPwd !== confirmPwd) { toast.error('Passwords do not match'); return; }
    if (newPwd.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    saveMutation.mutate({ current_password: currentPwd, password: newPwd });
  };

  const saveSession = () => {
    if (!sessionHours || sessionHours < 1) return;
    saveMutation.mutate({ session_lifetime_hours: Number(sessionHours) });
  };

  const sessionOptions = [
    { label: '1 hour', hours: 1 },
    { label: '6 hours', hours: 6 },
    { label: '24 hours', hours: 24 },
    { label: '7 days', hours: 168 },
    { label: '30 days', hours: 720 },
    { label: '1 year', hours: 8760 },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-mono text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
        {lang === 'ru' ? 'Профиль' : 'Profile'}
      </h1>

      {/* Account info */}
      <Section icon={User} title={lang === 'ru' ? 'Аккаунт' : 'Account'}>
        <Field label={lang === 'ru' ? 'Имя пользователя' : 'Username'} value={me.username}>
          <button onClick={() => { setUsername(me.username); setEditingField('username'); }}
            className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--accent)' }}>
            {lang === 'ru' ? 'Изменить' : 'Edit'}
          </button>
        </Field>
        {editingField === 'username' && (
          <div className="mt-2 flex gap-2">
            <input value={username} onChange={e => setUsername(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg font-mono text-sm outline-none"
              style={inputStyle} placeholder="new username" />
            <button onClick={saveUsername} className="p-1.5 rounded-lg" style={{ background: '#1a3a2a' }}><Check size={14} style={{ color: '#4ade80' }} /></button>
            <button onClick={() => setEditingField(null)} className="p-1.5 rounded-lg" style={{ background: '#2d1515' }}><X size={14} style={{ color: '#f87171' }} /></button>
          </div>
        )}

        <Field label="Email" value={me.email || (lang === 'ru' ? 'не указан' : 'not set')}>
          <button onClick={() => { setEmail(me.email || ''); setEditingField('email'); }}
            className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--accent)' }}>
            {lang === 'ru' ? 'Изменить' : 'Edit'}
          </button>
        </Field>
        {editingField === 'email' && (
          <div className="mt-2 flex gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg font-mono text-sm outline-none"
              style={inputStyle} placeholder="user@example.com" />
            <button onClick={saveEmail} className="p-1.5 rounded-lg" style={{ background: '#1a3a2a' }}><Check size={14} style={{ color: '#4ade80' }} /></button>
            <button onClick={() => setEditingField(null)} className="p-1.5 rounded-lg" style={{ background: '#2d1515' }}><X size={14} style={{ color: '#f87171' }} /></button>
          </div>
        )}

        <Field label={lang === 'ru' ? 'Роль' : 'Role'} value={me.is_admin ? (lang === 'ru' ? 'Администратор' : 'Administrator') : (lang === 'ru' ? 'Пользователь' : 'User')} />
        <Field label={lang === 'ru' ? 'Зарегистрирован' : 'Registered'} value={new Date(me.created_at).toLocaleDateString()} />
      </Section>

      {/* Password */}
      <Section icon={Key} title={lang === 'ru' ? 'Пароль' : 'Password'}>
        {editingField !== 'password' ? (
          <button onClick={() => setEditingField('password')}
            className="text-sm font-mono px-4 py-2 rounded-lg transition-opacity"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
            {lang === 'ru' ? 'Сменить пароль' : 'Change password'}
          </button>
        ) : (
          <div className="space-y-3">
            {[
              { label: lang === 'ru' ? 'Текущий пароль' : 'Current password', value: currentPwd, set: setCurrentPwd },
              { label: lang === 'ru' ? 'Новый пароль' : 'New password', value: newPwd, set: setNewPwd },
              { label: lang === 'ru' ? 'Подтверждение' : 'Confirm new', value: confirmPwd, set: setConfirmPwd },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                <input type="password" value={f.value} onChange={e => f.set(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none"
                  style={inputStyle} placeholder="••••••••" />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={savePassword} disabled={saveMutation.isPending}
                className="px-4 py-1.5 rounded-lg font-mono text-sm disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#000' }}>
                {lang === 'ru' ? 'Сохранить' : 'Save'}
              </button>
              <button onClick={() => setEditingField(null)}
                className="px-4 py-1.5 rounded-lg font-mono text-sm"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Session */}
      <Section icon={Clock} title={lang === 'ru' ? 'Время жизни сессии' : 'Session lifetime'}>
        <p className="text-xs font-mono mb-3" style={{ color: 'var(--text-muted)' }}>
          {lang === 'ru' ? 'Текущее значение:' : 'Current:'}{' '}
          <span style={{ color: 'var(--accent)' }}>
            {me.session_lifetime_hours < 24
              ? `${me.session_lifetime_hours}h`
              : me.session_lifetime_hours < 168
              ? `${Math.round(me.session_lifetime_hours / 24)}d`
              : me.session_lifetime_hours < 720
              ? `${Math.round(me.session_lifetime_hours / 24)}d`
              : me.session_lifetime_hours < 8760
              ? `${Math.round(me.session_lifetime_hours / 24 / 30)}mo`
              : '1yr'}
          </span>
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {sessionOptions.map(o => (
            <button key={o.hours}
              onClick={() => { setSessionHours(o.hours); saveMutation.mutate({ session_lifetime_hours: o.hours }); }}
              className="px-3 py-1.5 rounded-lg font-mono text-xs transition-all"
              style={{
                background: me.session_lifetime_hours === o.hours ? 'var(--accent)' : 'var(--bg-secondary)',
                color: me.session_lifetime_hours === o.hours ? '#000' : 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
              }}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="number" min={1} max={8760}
            value={sessionHours}
            onChange={e => setSessionHours(e.target.value ? Number(e.target.value) : '')}
            className="w-28 px-3 py-1.5 rounded-lg font-mono text-sm outline-none"
            style={inputStyle}
            placeholder={lang === 'ru' ? 'часов' : 'hours'}
          />
          <button onClick={saveSession} disabled={!sessionHours}
            className="px-3 py-1.5 rounded-lg font-mono text-sm disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#000' }}>
            {lang === 'ru' ? 'Применить' : 'Apply'}
          </button>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? '(1–8760 часов)' : '(1–8760 hours)'}
          </span>
        </div>
      </Section>

      {/* Storage */}
      {storage && (
        <Section icon={HardDrive} title={lang === 'ru' ? 'Хранилище' : 'Storage'}>
          <div className="mb-2 flex justify-between text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            <span>{storage.used_mb.toFixed(2)} MB {lang === 'ru' ? 'из' : 'of'} {storage.limit_mb} MB</span>
            <span>{storage.percent}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${storage.percent}%`,
                background: storage.percent > 90 ? '#ef4444' : storage.percent > 70 ? '#f59e0b' : 'var(--accent)',
              }}
            />
          </div>
        </Section>
      )}

      {/* Danger zone */}
      <Section icon={Shield} title={lang === 'ru' ? 'Опасная зона' : 'Danger zone'}>
        <button
          onClick={() => { if (confirm(lang === 'ru' ? 'Выйти из аккаунта?' : 'Sign out?')) logout(); }}
          className="px-4 py-2 rounded-lg font-mono text-sm"
          style={{ background: '#2d1515', color: '#f87171', border: '1px solid #7f1d1d' }}>
          {lang === 'ru' ? 'Выйти из аккаунта' : 'Sign out'}
        </button>
      </Section>
    </div>
  );
}
