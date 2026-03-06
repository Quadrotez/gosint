import React from 'react';

interface Props {
  content: string;
  className?: string;
}

// Simple inline markdown renderer (no external deps)
function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      result.push(
        <pre key={key++} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 my-2 overflow-x-auto">
          <code className="text-xs font-mono text-[var(--text-muted)]">{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Heading h1
    if (line.startsWith('# ')) {
      result.push(<h1 key={key++} className="text-lg font-mono font-bold text-[var(--text-primary)] mt-3 mb-1">{inlineFormat(line.slice(2))}</h1>);
      i++; continue;
    }
    // Heading h2
    if (line.startsWith('## ')) {
      result.push(<h2 key={key++} className="text-base font-mono font-semibold text-[var(--text-primary)] mt-3 mb-1">{inlineFormat(line.slice(3))}</h2>);
      i++; continue;
    }
    // Heading h3
    if (line.startsWith('### ')) {
      result.push(<h3 key={key++} className="text-sm font-mono font-semibold text-[var(--accent)] mt-2 mb-1">{inlineFormat(line.slice(4))}</h3>);
      i++; continue;
    }

    // HR
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/) || line.match(/^___+$/)) {
      result.push(<hr key={key++} className="border-[var(--border)] my-3" />);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      result.push(
        <blockquote key={key++} className="border-l-2 border-[var(--accent)] pl-3 my-2 text-sm text-[var(--text-muted)] italic">
          {inlineFormat(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }

    // Unordered list
    if (line.match(/^[-*+] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*+] /)) {
        items.push(lines[i].slice(2));
        i++;
      }
      result.push(
        <ul key={key++} className="list-disc list-inside my-2 space-y-1">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm text-[var(--text-secondary)] font-mono">{inlineFormat(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      result.push(
        <ol key={key++} className="list-decimal list-inside my-2 space-y-1">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm text-[var(--text-secondary)] font-mono">{inlineFormat(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      result.push(<div key={key++} className="h-2" />);
      i++; continue;
    }

    // Normal paragraph
    result.push(
      <p key={key++} className="text-sm text-[var(--text-secondary)] font-mono leading-relaxed">
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  return result;
}

function inlineFormat(text: string): React.ReactNode {
  // Process inline markdown: bold, italic, code, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns = [
    { re: /\*\*([^*]+)\*\*/, render: (m: string) => <strong key={key++} className="font-bold text-[var(--text-primary)]">{m}</strong> },
    { re: /__([^_]+)__/, render: (m: string) => <strong key={key++} className="font-bold text-[var(--text-primary)]">{m}</strong> },
    { re: /\*([^*]+)\*/, render: (m: string) => <em key={key++} className="italic text-[var(--text-muted)]">{m}</em> },
    { re: /_([^_]+)_/, render: (m: string) => <em key={key++} className="italic text-[var(--text-muted)]">{m}</em> },
    { re: /`([^`]+)`/, render: (m: string) => <code key={key++} className="bg-[var(--bg-secondary)] px-1 py-0.5 rounded text-xs font-mono text-[var(--accent)]">{m}</code> },
    { re: /\[([^\]]+)\]\(([^)]+)\)/, render: (_m: string, _full: string, match: RegExpMatchArray) => (
      <a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline hover:opacity-80">{match[1]}</a>
    )},
  ];

  // Simplified inline parser
  const segments: React.ReactNode[] = [];
  let str = text;

  while (str.length > 0) {
    let earliest = -1;
    let earliestMatch: RegExpMatchArray | null = null;
    let earliestRender: ((m: string, full: string, match: RegExpMatchArray) => React.ReactNode) | null = null;

    for (const { re, render } of patterns) {
      const match = str.match(re);
      if (match && match.index !== undefined) {
        if (earliest === -1 || match.index < earliest) {
          earliest = match.index;
          earliestMatch = match;
          earliestRender = render as any;
        }
      }
    }

    if (!earliestMatch || earliest === -1) {
      segments.push(str);
      break;
    }

    if (earliest > 0) {
      segments.push(str.slice(0, earliest));
    }
    segments.push(earliestRender!(earliestMatch[1], earliestMatch[0], earliestMatch));
    str = str.slice(earliest + earliestMatch[0].length);
  }

  return <>{segments}</>;
}

export default function MarkdownRenderer({ content, className = '' }: Props) {
  if (!content) return null;
  return (
    <div className={`markdown-content ${className}`}>
      {parseMarkdown(content)}
    </div>
  );
}
