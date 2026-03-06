import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importCSV } from '../api';
import EntityTypeBadge from '../components/ui/EntityTypeBadge';
import { useLang } from '../i18n/LangProvider';
import { getPersonDisplayName } from '../utils';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import type { Entity } from '../types';

export default function ImportPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [imported, setImported] = useState<Entity[] | null>(null);
  const { t } = useLang();

  const mutation = useMutation({
    mutationFn: importCSV,
    onSuccess: (data) => {
      setImported(data);
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const handleFile = (f: File) => {
    setFile(f);
    setImported(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = (e.target?.result as string).split('\n').filter(Boolean);
      setPreview(lines.slice(0, 6).map(l => l.split(',')));
    };
    reader.readAsText(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.csv')) handleFile(f);
  };

  const reset = () => {
    setFile(null);
    setPreview([]);
    setImported(null);
    mutation.reset();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-mono font-semibold text-[#e8edf5]">{t.imp_title}</h1>
        <p className="text-sm text-[#4a5568] font-mono mt-1">{t.imp_subtitle}</p>
      </div>

      {/* Format info */}
      <div className="bg-[#111318] border border-[#1e2330] rounded-xl p-5 mb-6">
        <h2 className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest mb-3">{t.imp_format}</h2>
        <div className="bg-[#181c24] rounded-lg p-4 font-mono text-xs text-[#e8edf5] overflow-x-auto mb-3">
          <div className="text-[#4a5568] mb-1">{'# CSV format:'}</div>
          <div>type,value,metadata,extra_field</div>
          <div className="text-[#4a5568]">person,John Doe,"{'{\"dob\":\"1990-01-01\"}'}"</div>
          <div className="text-[#4a5568]">email,user@example.com,,</div>
          <div className="text-[#4a5568]">domain,example.com,,</div>
        </div>
        <p className="text-[11px] font-mono text-[#4a5568]">{t.imp_format_hint}</p>
      </div>

      {!imported ? (
        <>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-[#262d3d] hover:border-[#00d4ff60] rounded-xl p-10 text-center cursor-pointer transition-colors group mb-6"
          >
            <Upload size={28} className="mx-auto mb-3 text-[#4a5568] group-hover:text-[#00d4ff] transition-colors" />
            <p className="font-mono text-sm text-[#7a8ba8]">{t.imp_drop}</p>
            <p className="font-mono text-xs text-[#4a5568] mt-1">{t.imp_drop_hint}</p>
            {file && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-[#1e2330] rounded-lg">
                <FileText size={14} className="text-[#00d4ff]" />
                <span className="text-sm font-mono text-[#e8edf5]">{file.name}</span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-[#111318] border border-[#1e2330] rounded-xl p-5 mb-6">
              <h2 className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest mb-4">{t.imp_preview}</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={`border-b border-[#1e2330] last:border-0 ${i === 0 ? 'text-[#4a5568]' : ''}`}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-2 text-xs font-mono text-[#e8edf5] max-w-[200px] truncate">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {mutation.isError && (
            <div className="flex items-center gap-3 p-4 bg-[#ff444415] border border-[#ff444440] rounded-xl mb-6">
              <AlertCircle size={16} className="text-[#ff4444] flex-shrink-0" />
              <p className="font-mono text-sm text-[#ff4444]">{t.imp_error}</p>
            </div>
          )}

          {file && (
            <button
              onClick={() => mutation.mutate(file)}
              disabled={mutation.isPending}
              className="w-full py-3 bg-[#00d4ff] text-[#0a0c0f] font-mono text-sm font-semibold rounded-lg hover:bg-[#00b8e0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending ? t.imp_importing : t.imp_submit(file.name)}
            </button>
          )}
        </>
      ) : (
        /* Success */
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-[#00ff8815] border border-[#00ff8840] rounded-xl">
            <CheckCircle size={18} className="text-[#00ff88] flex-shrink-0" />
            <p className="font-mono text-sm text-[#00ff88]">{t.imp_success(imported.length)}</p>
          </div>

          <div className="bg-[#111318] border border-[#1e2330] rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody>
                {imported.slice(0, 20).map(entity => {
                  const displayName = entity.type === 'person'
                    ? getPersonDisplayName(entity)
                    : entity.value;
                  return (
                    <tr key={entity.id} className="border-b border-[#1e2330] last:border-0">
                      <td className="px-4 py-2.5">
                        <EntityTypeBadge type={entity.type} size="sm" />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-sm text-[#e8edf5]">{displayName}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {imported.length > 20 && (
              <div className="px-4 py-2.5 text-xs font-mono text-[#4a5568] border-t border-[#1e2330]">
                +{imported.length - 20} more
              </div>
            )}
          </div>

          <button
            onClick={reset}
            className="w-full py-3 border border-[#262d3d] hover:border-[#3a4460] text-[#7a8ba8] font-mono text-sm rounded-lg transition-colors"
          >
            {t.imp_reset}
          </button>
        </div>
      )}
    </div>
  );
}
