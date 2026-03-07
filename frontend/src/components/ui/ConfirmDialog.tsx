import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export default function ConfirmDialog({
  open, message, onConfirm, onCancel,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = true,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-6"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: danger ? '#ff444420' : 'var(--accent-dim)' }}>
            <AlertTriangle size={18} style={{ color: danger ? '#ff4444' : 'var(--accent)' }} />
          </div>
          <p className="font-mono text-sm pt-1.5" style={{ color: 'var(--text-primary)' }}>{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border font-mono text-sm transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); onCancel(); }}
            className="px-4 py-2 rounded-lg font-mono text-sm transition-colors"
            style={{
              background: danger ? '#ff4444' : 'var(--accent)',
              color: '#fff',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
