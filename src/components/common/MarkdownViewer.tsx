import React, { useState } from 'react';
import { Copy, Check, ExternalLink, CheckSquare, Square } from 'lucide-react';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

interface TableData {
  headers: string[];
  alignments: ('left' | 'center' | 'right')[];
  rows: string[][];
}

type Block =
  | { type: 'code'; code: string; language?: string }
  | { type: 'table'; data: TableData }
  | { type: 'heading'; level: number; text: string }
  | { type: 'hr' }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'task'; items: { checked: boolean; text: string; indent: number }[] }
  | { type: 'ul'; items: { text: string; indent: number }[] }
  | { type: 'ol'; items: { num: string; text: string; indent: number }[] }
  | { type: 'paragraph'; lines: string[] };

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2.5 rounded-xl border border-slate-700/80 bg-slate-950 text-xs font-mono shadow-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800/80 text-slate-400 text-[10px]">
        <span className="uppercase font-semibold tracking-wider text-indigo-400">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto text-slate-200 leading-relaxed text-[11px]">
        <pre className="font-mono">{code}</pre>
      </div>
    </div>
  );
};

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={`space-y-2 leading-relaxed text-xs break-words ${className}`}>
      {blocks.map((block, idx) => renderBlock(block, `block-${idx}`))}
    </div>
  );
};

function renderBlock(block: Block, key: string): React.ReactNode {
  switch (block.type) {
    case 'code':
      return <CodeBlock key={key} code={block.code} language={block.language} />;

    case 'table': {
      const { headers, alignments, rows } = block.data;
      return (
        <div
          key={key}
          className="my-2.5 overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs"
        >
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold">
                {headers.map((h, idx) => {
                  const align = alignments[idx] || 'left';
                  const alignClass =
                    align === 'center'
                      ? 'text-center'
                      : align === 'right'
                      ? 'text-right'
                      : 'text-left';
                  return (
                    <th
                      key={idx}
                      className={`px-3 py-2 border-r last:border-r-0 border-slate-200/60 dark:border-slate-700/60 ${alignClass}`}
                    >
                      {formatInline(h)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {row.map((cell, cIdx) => {
                    const align = alignments[cIdx] || 'left';
                    const alignClass =
                      align === 'center'
                        ? 'text-center'
                        : align === 'right'
                        ? 'text-right'
                        : 'text-left';
                    return (
                      <td
                        key={cIdx}
                        className={`px-3 py-1.5 border-r last:border-r-0 border-slate-200/40 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 ${alignClass}`}
                      >
                        {formatInline(cell)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'heading': {
      const text = formatInline(block.text);
      if (block.level === 1) {
        return (
          <h1
            key={key}
            className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-3.5 mb-1.5 pb-1 border-b border-slate-200/80 dark:border-slate-800"
          >
            {text}
          </h1>
        );
      }
      if (block.level === 2) {
        return (
          <h2
            key={key}
            className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-3 mb-1"
          >
            {text}
          </h2>
        );
      }
      if (block.level === 3) {
        return (
          <h3
            key={key}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-2 mb-0.5"
          >
            {text}
          </h3>
        );
      }
      return (
        <h4
          key={key}
          className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 mt-1.5 mb-0.5"
        >
          {text}
        </h4>
      );
    }

    case 'hr':
      return <hr key={key} className="border-t border-slate-200 dark:border-slate-800 my-3" />;

    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="border-l-3 border-indigo-500/80 pl-3 py-1.5 my-2 text-slate-600 dark:text-slate-300 italic bg-indigo-50/40 dark:bg-indigo-950/25 rounded-r-lg space-y-1 text-xs"
        >
          {block.lines.map((l, lIdx) => (
            <div key={lIdx} className="leading-relaxed">
              {formatInline(l)}
            </div>
          ))}
        </blockquote>
      );

    case 'task':
      return (
        <div key={key} className="my-1.5 space-y-1">
          {block.items.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 ${item.indent > 0 ? 'ml-5' : 'ml-1'}`}
            >
              <span className="shrink-0 mt-0.5">
                {item.checked ? (
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/10" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                )}
              </span>
              <span
                className={`flex-1 leading-relaxed text-xs ${
                  item.checked
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {formatInline(item.text)}
              </span>
            </div>
          ))}
        </div>
      );

    case 'ul':
      return (
        <ul key={key} className="my-1.5 space-y-1 text-xs">
          {block.items.map((item, idx) => (
            <li
              key={idx}
              className={`flex items-start gap-2 ${item.indent > 0 ? 'ml-5' : 'ml-1'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0 mt-1.5" />
              <span className="flex-1 leading-relaxed text-slate-800 dark:text-slate-200">
                {formatInline(item.text)}
              </span>
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol key={key} className="my-1.5 space-y-1 text-xs">
          {block.items.map((item, idx) => (
            <li
              key={idx}
              className={`flex items-start gap-1.5 ${item.indent > 0 ? 'ml-5' : 'ml-1'}`}
            >
              <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 shrink-0 min-w-4 text-right">
                {item.num}.
              </span>
              <span className="flex-1 leading-relaxed text-slate-800 dark:text-slate-200">
                {formatInline(item.text)}
              </span>
            </li>
          ))}
        </ol>
      );

    case 'paragraph':
      return (
        <p key={key} className="my-1 leading-relaxed text-slate-800 dark:text-slate-200">
          {block.lines.map((l, lIdx) => (
            <React.Fragment key={lIdx}>
              {lIdx > 0 && <br />}
              {formatInline(l)}
            </React.Fragment>
          ))}
        </p>
      );
  }
}

function parseTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((c) => c.trim());
}

function parseTableAlignments(sepLine: string): ('left' | 'center' | 'right')[] {
  const cells = parseTableRow(sepLine);
  return cells.map((cell) => {
    const trimmed = cell.trim();
    const hasLeft = trimmed.startsWith(':');
    const hasRight = trimmed.endsWith(':');
    if (hasLeft && hasRight) return 'center';
    if (hasRight) return 'right';
    return 'left';
  });
}

function parseMarkdownBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  const TABLE_SEP_REGEX = /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/;
  const TASK_REGEX = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/;
  const BULLET_REGEX = /^(\s*)[-*+]\s+(.*)$/;
  const NUM_REGEX = /^(\s*)(\d+)[.)]\s+(.*)$/;
  const HR_REGEX = /^([-*_]){3,}$/;
  const HEADING_REGEX = /^(#{1,6})\s+(.*)$/;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Block (including unclosed blocks during streaming)
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++; // skip closing ```
      }
      blocks.push({
        type: 'code',
        language,
        code: codeLines.join('\n'),
      });
      continue;
    }

    // 2. Table
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP_REGEX.test(lines[i + 1])) {
      const headers = parseTableRow(line);
      const alignments = parseTableAlignments(lines[i + 1]);
      i += 2; // skip header and separator lines
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        const row = parseTableRow(lines[i]);
        while (row.length < headers.length) row.push('');
        rows.push(row);
        i++;
      }
      blocks.push({
        type: 'table',
        data: { headers, alignments, rows },
      });
      continue;
    }

    // 3. Headings (# to ######)
    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // 4. Horizontal Rule (---, ***, ___)
    if (HR_REGEX.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 5. Blockquote (> ...)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        lines: quoteLines,
      });
      continue;
    }

    // 6. Task List Checkboxes (- [ ] or - [x])
    if (TASK_REGEX.test(line)) {
      const items: { checked: boolean; text: string; indent: number }[] = [];
      while (i < lines.length) {
        const tMatch = lines[i].match(TASK_REGEX);
        if (!tMatch) break;
        items.push({
          indent: tMatch[1].length,
          checked: tMatch[2].toLowerCase() === 'x',
          text: tMatch[3],
        });
        i++;
      }
      blocks.push({ type: 'task', items });
      continue;
    }

    // 7. Unordered List (- or * or +)
    if (BULLET_REGEX.test(line)) {
      const items: { text: string; indent: number }[] = [];
      while (i < lines.length) {
        if (TASK_REGEX.test(lines[i])) break;
        const bMatch = lines[i].match(BULLET_REGEX);
        if (!bMatch) break;
        items.push({
          indent: bMatch[1].length,
          text: bMatch[2],
        });
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // 8. Ordered List (1. 2. etc)
    if (NUM_REGEX.test(line)) {
      const items: { num: string; text: string; indent: number }[] = [];
      while (i < lines.length) {
        const nMatch = lines[i].match(NUM_REGEX);
        if (!nMatch) break;
        items.push({
          indent: nMatch[1].length,
          num: nMatch[2],
          text: nMatch[3],
        });
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // 9. Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // 10. Normal Paragraph (gather lines until blank line or special block)
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !HEADING_REGEX.test(lines[i]) &&
      !HR_REGEX.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('>') &&
      !TASK_REGEX.test(lines[i]) &&
      !BULLET_REGEX.test(lines[i]) &&
      !NUM_REGEX.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && TABLE_SEP_REGEX.test(lines[i + 1]))
    ) {
      pLines.push(lines[i]);
      i++;
    }

    if (pLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        lines: pLines,
      });
    }
  }

  return blocks;
}

function formatInline(text: string, depth = 0): React.ReactNode {
  if (!text) return null;
  if (depth > 2) return text;

  const INLINE_REGEX =
    /(`[^`\n]+`)|(\[([^\]]+)\]\(((?:https?:\/\/|file:\/\/|#)[^\s)]+)\))|(https?:\/\/[^\s<)]+)|(?:\*\*\*|___)(.+?)(?:\*\*\*|___)|(?:\*\*|__)(.+?)(?:\*\*|__)|(?:\*|_)(.+?)(?:\*|_)|(~~.+?~~)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];

    // 1. Inline Code
    if (match[1]) {
      const codeContent = match[1].slice(1, -1);
      elements.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 text-indigo-600 dark:text-indigo-300 font-mono text-[11px] border border-slate-200/70 dark:border-slate-700/70 font-semibold"
        >
          {codeContent}
        </code>
      );
    }
    // 2. Markdown Link [label](url)
    else if (match[2]) {
      const linkLabel = match[3];
      const linkUrl = match[4];
      elements.push(
        <a
          key={match.index}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-medium cursor-pointer"
        >
          <span>{formatInline(linkLabel, depth + 1)}</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0 inline" />
        </a>
      );
    }
    // 3. Plain URL
    else if (match[5]) {
      const url = match[5];
      elements.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
        >
          {url}
        </a>
      );
    }
    // 4. Bold + Italic (***text*** or ___text___)
    else if (match[6]) {
      elements.push(
        <strong key={match.index} className="font-bold text-slate-900 dark:text-slate-100">
          <em className="italic">{formatInline(match[6], depth + 1)}</em>
        </strong>
      );
    }
    // 5. Bold (**text** or __text__)
    else if (match[7]) {
      elements.push(
        <strong key={match.index} className="font-semibold text-slate-900 dark:text-slate-100">
          {formatInline(match[7], depth + 1)}
        </strong>
      );
    }
    // 6. Italic (*text* or _text_)
    else if (match[8]) {
      elements.push(
        <em key={match.index} className="italic text-slate-800 dark:text-slate-200">
          {formatInline(match[8], depth + 1)}
        </em>
      );
    }
    // 7. Strikethrough (~~text~~)
    else if (match[9]) {
      const struckText = match[9].slice(2, -2);
      elements.push(
        <del key={match.index} className="line-through text-slate-400 dark:text-slate-500">
          {formatInline(struckText, depth + 1)}
        </del>
      );
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length > 0 ? elements : text;
}
