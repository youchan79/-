import React from 'react';
import type { Chart, Element } from '../lib/api.ts';

export const ELEMENT_STYLE: Record<Element, { text: string; soft: string; bar: string; name: string }> = {
  목: { text: 'text-wood', soft: 'bg-wood-soft', bar: 'bg-wood', name: '나무' },
  화: { text: 'text-fire', soft: 'bg-fire-soft', bar: 'bg-fire', name: '불' },
  토: { text: 'text-earth', soft: 'bg-earth-soft', bar: 'bg-earth', name: '흙' },
  금: { text: 'text-metal', soft: 'bg-metal-soft', bar: 'bg-metal', name: '쇠' },
  수: { text: 'text-water', soft: 'bg-water-soft', bar: 'bg-water', name: '물' },
};

const ORDER: Element[] = ['목', '화', '토', '금', '수'];

function Glyph({ hanja, ko, element, sub }: { hanja: string; ko: string; element: Element; sub: string }) {
  const s = ELEMENT_STYLE[element];
  return (
    <div className={`flex aspect-[4/5] flex-col items-center justify-center rounded-2xl ${s.soft}`}>
      <span className={`hanja text-[34px] font-semibold leading-none ${s.text}`}>{hanja}</span>
      <span className={`mt-1.5 text-[13px] font-medium ${s.text}`}>
        {ko}
        {element}
      </span>
      <span className="mt-0.5 text-[11px] text-muted">{sub}</span>
    </div>
  );
}

export function PillarTable({ chart }: { chart: Chart }) {
  const cols = chart.pillars;
  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
        {cols.map((p) => (
          <div key={p.key} className="text-center text-[13px] text-muted">
            {p.label}
          </div>
        ))}
        {cols.map((p) => (
          <Glyph key={p.key + 'g'} hanja={p.gan} ko={p.ganKo} element={p.ganElement} sub={p.ganTenGod} />
        ))}
        {cols.map((p) => (
          <Glyph key={p.key + 'z'} hanja={p.zhi} ko={p.zhiKo} element={p.zhiElement} sub={p.zhiTenGod} />
        ))}
      </div>
      {!chart.timeKnown && <p className="mt-3 text-[13px] text-muted">태어난 시간을 몰라 시주는 빼고 봤어요.</p>}
    </div>
  );
}

export function ElementBars({ counts }: { counts: Record<Element, number> }) {
  const total = ORDER.reduce((a, e) => a + counts[e], 0) || 1;
  return (
    <div className="space-y-3">
      {ORDER.map((e) => {
        const s = ELEMENT_STYLE[e];
        return (
          <div key={e} className="flex items-center gap-3">
            <span className={`w-14 shrink-0 text-[15px] font-medium ${s.text}`}>
              {e} <span className="text-[13px] font-normal text-muted">{s.name}</span>
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-field">
              <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${(counts[e] / total) * 100}%` }} />
            </div>
            <span className="w-6 text-right text-[18px] font-bold tabular-nums">{counts[e]}</span>
          </div>
        );
      })}
    </div>
  );
}
