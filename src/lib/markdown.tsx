import React from 'react';

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <strong key={`${key}-b${i++}`} className="font-semibold text-ink">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last).replace(/\*\*/g, ''));
  return out;
}

/** AI 풀이용 최소 마크다운 렌더러 (##, ###, 목록, 굵게). HTML은 렌더링하지 않는다. */
export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let para: string[] = [];
  let list: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (para.length) {
      const key = `p${k++}`;
      blocks.push(
        <p key={key} className="text-[16px] leading-[1.75] text-sub">
          {inline(para.join(' '), key)}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const key = `l${k++}`;
      blocks.push(
        <ul key={key} className="space-y-2">
          {list.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[16px] leading-[1.7] text-sub">
              <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{inline(item, `${key}-${i}`)}</span>
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      const key = `h${k++}`;
      blocks.push(
        h[1].length <= 2 ? (
          <h2 key={key} className="pt-6 text-[20px] font-bold tracking-tight text-ink first:pt-0">
            {h[2].replace(/\*\*/g, '')}
          </h2>
        ) : (
          <h3 key={key} className="pt-2 text-[17px] font-bold tracking-tight text-ink">
            {h[2].replace(/\*\*/g, '')}
          </h3>
        ),
      );
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(line) || /^\d+[.)]\s+(.*)$/.exec(line);
    if (li) {
      flushPara();
      list.push(li[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return <div className="space-y-3">{blocks}</div>;
}
