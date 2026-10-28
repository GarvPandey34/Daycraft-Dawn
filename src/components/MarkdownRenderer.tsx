import React from 'react';
import { CheckSquare, Square } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onToggleChecklist?: (lineIndex: number, newChecked: boolean) => void;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onToggleChecklist,
  className = '',
}) => {
  if (!content.trim()) {
    return <p className="text-xs italic opacity-50">No content entered yet.</p>;
  }

  const lines = content.split('\n');

  const renderInline = (text: string): React.ReactNode => {
    // Process code `code`
    // Process bold **text**
    // Process italic *text*
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Code span
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        parts.push(
          <code
            key={keyIdx++}
            className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-black/5 border border-black/10"
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Bold **bold**
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        parts.push(
          <strong key={keyIdx++} className="font-bold">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Italic *italic*
      const italicMatch = remaining.match(/^\*([^*]+)\*/);
      if (italicMatch) {
        parts.push(
          <em key={keyIdx++} className="italic">
            {italicMatch[1]}
          </em>
        );
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Plain character
      const nextSpecial = remaining.search(/[`*]/);
      if (nextSpecial === -1) {
        parts.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        parts.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return parts;
  };

  return (
    <div className={`space-y-2 text-sm leading-relaxed ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // 1. Headers: #, ##, ###
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-sm font-bold mt-3 mb-1">
              {renderInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-base font-bold mt-4 mb-1">
              {renderInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-lg font-bold mt-4 mb-1.5 border-b pb-1" style={{ borderColor: 'var(--border)' }}>
              {renderInline(trimmed.slice(2))}
            </h2>
          );
        }

        // 2. Interactive Checklists: - [ ] or - [x]
        const uncheckedMatch = trimmed.match(/^-\s*\[\s*\]\s*(.*)$/i);
        if (uncheckedMatch) {
          return (
            <div
              key={idx}
              onClick={() => onToggleChecklist?.(idx, true)}
              className="flex items-start gap-2 py-0.5 cursor-pointer group select-none hover:opacity-80"
            >
              <Square className="w-4 h-4 mt-0.5 opacity-60 group-hover:opacity-100 shrink-0 text-amber-600" />
              <span className="text-xs">{renderInline(uncheckedMatch[1])}</span>
            </div>
          );
        }

        const checkedMatch = trimmed.match(/^-\s*\[x\]\s*(.*)$/i);
        if (checkedMatch) {
          return (
            <div
              key={idx}
              onClick={() => onToggleChecklist?.(idx, false)}
              className="flex items-start gap-2 py-0.5 cursor-pointer group select-none hover:opacity-80"
            >
              <CheckSquare className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
              <span className="text-xs line-through opacity-60">{renderInline(checkedMatch[1])}</span>
            </div>
          );
        }

        // 3. Blockquotes: > quote
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              className="pl-3 py-1 my-1 border-l-3 italic text-xs rounded-r"
              style={{
                borderColor: 'var(--accent)',
                backgroundColor: 'var(--bg-surface-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {renderInline(trimmed.slice(2))}
            </blockquote>
          );
        }

        // 4. Bullet lists: - item or * item
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 text-xs">
              <span className="font-bold text-amber-500">•</span>
              <span>{renderInline(trimmed.slice(2))}</span>
            </div>
          );
        }

        // 5. Empty line spacing
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // 6. Normal paragraph
        return (
          <p key={idx} className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
};
