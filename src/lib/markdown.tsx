import React from 'react';

/** 근거 위치 표시 (p.3, 12:30) */
export function RefChip({ value, onClick }: { value: string; onClick?: () => void }) {
  if (!value) return null;
  // 버튼 안(퀴즈 보기, 플래시카드)에도 들어가므로 span으로 만든다.
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if (!onClick) return;
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      }}
      className="mx-1 inline-flex h-[22px] translate-y-[-1px] cursor-pointer items-center rounded-md bg-soft-2 px-1.5 align-middle text-[12px] font-medium text-muted hover:text-ink"
    >
      {value}
    </span>
  );
}

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|[([](p\.\d+|\d{1,2}:\d{2}(?::\d{2})?)[)\]]/g;

export function inline(text: string, key = 'i', onRef?: (ref: string) => void): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(
        <strong key={`${key}-${i++}`} className="font-semibold">
          {m[1]}
        </strong>,
      );
    } else if (m[2] !== undefined) {
      out.push(
        <code key={`${key}-${i++}`} className="rounded bg-soft px-1 py-0.5 text-[0.9em]">
          {m[2]}
        </code>,
      );
    } else if (m[3] !== undefined) {
      const ref = m[3];
      out.push(<RefChip key={`${key}-${i++}`} value={ref} onClick={onRef ? () => onRef(ref) : undefined} />);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** 학습 자료용 마크다운 렌더러. HTML은 렌더링하지 않는다. */
export function Markdown({ text, onRef, size = 'base' }: { text: string; onRef?: (ref: string) => void; size?: 'base' | 'sm' }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  const pText = size === 'sm' ? 'text-[15px] leading-[1.7]' : 'text-[16px] leading-[1.8]';
  let k = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    // 표
    if (line.startsWith('|') && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const key = `t${k++}`;
      blocks.push(
        <div key={key} className="no-scrollbar -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[420px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-line">
                {head.map((c, j) => (
                  <th key={j} className="px-3 py-3 font-semibold">
                    {inline(c, `${key}h${j}`, onRef)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-line/70">
                  {r.map((c, j) => (
                    <td key={j} className={`px-3 py-3 ${j === 0 ? 'font-semibold' : 'text-sub'}`}>
                      {inline(c, `${key}-${ri}-${j}`, onRef)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const key = `h${k++}`;
      blocks.push(
        h[1].length <= 2 ? (
          <h3 key={key} className="pt-3 text-[19px] font-semibold tracking-tight">
            {inline(h[2], key, onRef)}
          </h3>
        ) : (
          <h4 key={key} className="pt-2 text-[17px] font-semibold tracking-tight">
            {inline(h[2], key, onRef)}
          </h4>
        ),
      );
      i++;
      continue;
    }
    if (/^([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^([-*•]|\d+[.)])\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*•]|\d+[.)])\s+/, ''));
        i++;
      }
      const key = `l${k++}`;
      const Tag = ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag key={key} className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-6 ${pText}`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `${key}-${j}`, onRef)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*•]\s|\d+[.)]\s|\|)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    if (!para.length) {
      para.push(line);
      i++;
    }
    const key = `p${k++}`;
    blocks.push(
      <p key={key} className={pText}>
        {inline(para.join(' '), key, onRef)}
      </p>,
    );
  }
  return <div className="space-y-3">{blocks}</div>;
}
