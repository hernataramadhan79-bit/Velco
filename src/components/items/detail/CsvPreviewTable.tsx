import React, { useMemo } from 'react';

export const CsvPreviewTable: React.FC<{ content: string }> = ({ content }) => {
  const { headers, rows } = useMemo(() => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string) => {
      const res: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          res.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      res.push(cur.trim());
      return res;
    };

    const h = parseLine(lines[0]);
    const r = lines.slice(1, 100).map(parseLine);
    return { headers: h, rows: r };
  }, [content]);

  if (headers.length === 0) {
    return <div className="text-slate-400 italic py-4 text-center">Empty CSV file</div>;
  }

  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-2xs">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-white/[0.08] text-xs font-mono">
        <thead className="bg-slate-50 dark:bg-white/[0.04]">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider w-10">
              #
            </th>
            {headers.map((hdr, idx) => (
              <th
                key={idx}
                className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider"
              >
                {hdr}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-white/[0.05] bg-white dark:bg-[#101014]">
          {rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className={rIdx % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/50 dark:bg-white/[0.02]'}
            >
              <td className="px-3 py-1.5 text-[10px] text-slate-400 dark:text-zinc-500 select-none">
                {rIdx + 1}
              </td>
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3 py-1.5 text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
