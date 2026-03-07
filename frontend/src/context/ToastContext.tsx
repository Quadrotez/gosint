import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastCtx = createContext<ToastContextType>({
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const success = useCallback((m: string) => toast(m, 'success'), [toast]);
  const error = useCallback((m: string) => toast(m, 'error'), [toast]);
  const info = useCallback((m: string) => toast(m, 'info'), [toast]);

  const icons = { success: CheckCircle, error: AlertCircle, info: Info };
  const colors = {
    success: { bg: '#00ff8810', border: '#00ff8840', text: '#00ff88', icon: '#00ff88' },
    error:   { bg: '#ff444410', border: '#ff444440', text: '#ff6666', icon: '#ff4444' },
    info:    { bg: '#00d4ff10', border: '#00d4ff40', text: '#00d4ff', icon: '#00d4ff' },
  };

  return (
    <ToastCtx.Provider value={{ toast, success, error, info }}>
      {children}
      {/* Toast container */}
      <div
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          pointerEvents: 'none',
          maxWidth: '360px',
          width: 'calc(100vw - 2rem)',
        }}
      >
        {toasts.map(t => {
          const Icon = icons[t.type];
          const c = colors[t.type];
          return (
            <div
              key={t.id}
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                pointerEvents: 'all',
                animation: 'slideInToast 0.2s ease',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Icon size={16} style={{ color: c.icon, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontFamily: 'monospace', fontSize: '13px', color: c.text, flex: 1, lineHeight: 1.4 }}>
                {t.message}
              </span>
              <button
                onClick={() => remove(t.id)}
                style={{ color: c.text, opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 1 }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes slideInToast {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
