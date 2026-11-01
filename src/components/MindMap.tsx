import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Maximize, Minus, Move, Plus } from 'lucide-react';
import type { MindNode } from '../lib/api.ts';

interface LNode {
  id: string;
  label: string;
  depth: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hasChildren: boolean;
  open: boolean;
  parent?: LNode;
}

const NODE_H = 38;
const SLOT = 54;
const GAP_X = 72;

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, bold: boolean) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx!.font = `${bold ? 600 : 500} 14px Pretendard, sans-serif`;
  return measureCtx!.measureText(text).width;
}

function layout(root: MindNode, open: Set<string>) {
  const nodes: LNode[] = [];
  const heightOf = (n: MindNode, id: string): number => {
    const kids = n.children ?? [];
    if (!kids.length || !open.has(id)) return SLOT;
    return kids.reduce((a, c, i) => a + heightOf(c, `${id}.${i}`), 0);
  };
  const place = (n: MindNode, id: string, depth: number, x: number, top: number, parent?: LNode) => {
    const total = heightOf(n, id);
    const w = Math.round(textWidth(n.label, depth === 0) + 30);
    const node: LNode = { id, label: n.label, depth, x, y: top + total / 2, w, h: NODE_H, hasChildren: !!n.children?.length, open: open.has(id), parent };
    nodes.push(node);
    if (node.hasChildren && node.open) {
      let t = top;
      n.children!.forEach((c, i) => {
        const cid = `${id}.${i}`;
        place(c, cid, depth + 1, x + w + GAP_X, t, node);
        t += heightOf(c, cid);
      });
    }
  };
  place(root, '0', 0, 0, 0);
  return nodes;
}

export function MindMap({ root }: { root: MindNode }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(['0']));
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const nodes = useMemo(() => layout(root, open), [root, open]);

  const bounds = useMemo(() => {
    const minY = Math.min(...nodes.map((n) => n.y - n.h / 2));
    const maxY = Math.max(...nodes.map((n) => n.y + n.h / 2));
    const maxX = Math.max(...nodes.map((n) => n.x + n.w + 28));
    return { minY, maxY, maxX };
  }, [nodes]);

  const fit = () => {
    const el = box.current;
    if (!el) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
    const bw = bounds.maxX + 40;
    const bh = bounds.maxY - bounds.minY + 40;
    const k = Math.min(1.2, Math.max(0.35, Math.min(W / bw, H / bh)));
    setView({ k, x: (W - bw * k) / 2 + 20 * k, y: H / 2 - ((bounds.minY + bounds.maxY) / 2) * k });
  };

  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, nodes.length]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) [...n].filter((x) => x === id || x.startsWith(id + '.')).forEach((x) => n.delete(x));
      else n.add(id);
      return n;
    });

  const zoom = (f: number) => {
    const el = box.current!;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setView((v) => {
      const k = Math.min(2.5, Math.max(0.3, v.k * f));
      return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
    });
  };

  const download = () => {
    const s = svg.current;
    if (!s) return;
    const clone = s.cloneNode(true) as SVGSVGElement;
    const css = getComputedStyle(document.documentElement);
    const pad = 30;
    clone.setAttribute('viewBox', `${-pad} ${bounds.minY - pad} ${bounds.maxX + pad * 2} ${bounds.maxY - bounds.minY + pad * 2}`);
    clone.setAttribute('width', String(bounds.maxX + pad * 2));
    clone.setAttribute('height', String(bounds.maxY - bounds.minY + pad * 2));
    clone.querySelector('g')?.removeAttribute('transform');
    let src = new XMLSerializer().serializeToString(clone);
    src = src.replace(/var\((--c-[\w-]+)\)/g, (_, v) => css.getPropertyValue(v).trim() || '#000');
    const bg = css.getPropertyValue('--c-canvas').trim();
    src = src.replace('<g', `<rect x="${-pad}" y="${bounds.minY - pad}" width="100%" height="100%" fill="${bg}"/><g`);
    const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${root.label}-마인드맵.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const btn = 'flex h-11 w-11 items-center justify-center rounded-full border border-line bg-canvas text-sub shadow-card hover:text-ink';

  return (
    <div className="relative h-full min-h-[520px] w-full overflow-hidden">
      <div
        ref={box}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-node]')) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
        }}
        onPointerUp={() => (drag.current = null)}
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) {
            setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
            return;
          }
          const rect = box.current!.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          setView((v) => {
            const k = Math.min(2.5, Math.max(0.3, v.k * (e.deltaY < 0 ? 1.1 : 0.9)));
            return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
          });
        }}
      >
        <svg ref={svg} className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {nodes
              .filter((n) => n.parent)
              .map((n) => {
                const p = n.parent!;
                const x1 = p.x + p.w + (p.hasChildren ? 22 : 0);
                const y1 = p.y;
                const x2 = n.x;
                const y2 = n.y;
                const mx = (x1 + x2) / 2;
                return <path key={`e${n.id}`} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="var(--c-soft-2)" strokeWidth={1.6} />;
              })}
            {nodes.map((n) => {
              const root = n.depth === 0;
              return (
                <g key={n.id} data-node transform={`translate(${n.x},${n.y - n.h / 2})`}>
                  <rect
                    width={n.w}
                    height={n.h}
                    rx={root ? 10 : 9}
                    fill={root ? 'var(--c-solid)' : 'var(--c-soft)'}
                    stroke={root ? 'none' : 'var(--c-line)'}
                    style={{ cursor: n.hasChildren ? 'pointer' : 'default' }}
                    onClick={() => n.hasChildren && toggle(n.id)}
                  />
                  <text
                    x={n.w / 2}
                    y={n.h / 2 + 5}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={root ? 600 : 500}
                    fill={root ? 'var(--c-on-solid)' : 'var(--c-ink)'}
                    style={{ pointerEvents: 'none', fontFamily: 'Pretendard, sans-serif' }}
                  >
                    {n.label}
                  </text>
                  {n.hasChildren && (
                    <g transform={`translate(${n.w + 11},${n.h / 2})`} style={{ cursor: 'pointer' }} onClick={() => toggle(n.id)}>
                      <circle r={9} fill="var(--c-canvas)" stroke="var(--c-line)" />
                      <path d={n.open ? 'M2,-3.5 L-2,0 L2,3.5' : 'M-2,-3.5 L2,0 L-2,3.5'} fill="none" stroke="var(--c-muted)" strokeWidth={1.5} strokeLinecap="round" />
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <button type="button" className={`${btn} absolute right-3 top-3`} onClick={download} aria-label="이미지로 저장">
        <Download size={18} />
      </button>
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <button type="button" className={btn} onClick={() => setOpen(new Set(nodes.length > 1 ? ['0'] : []))} aria-label="접기" title="가지 모두 접기">
          <Move size={17} />
        </button>
        <button type="button" className={btn} onClick={() => zoom(1.2)} aria-label="확대">
          <Plus size={18} />
        </button>
        <button type="button" className={btn} onClick={() => zoom(1 / 1.2)} aria-label="축소">
          <Minus size={18} />
        </button>
        <button type="button" className={btn} onClick={fit} aria-label="화면에 맞추기">
          <Maximize size={17} />
        </button>
      </div>
    </div>
  );
}

export function expandAll(root: MindNode) {
  const ids: string[] = [];
  const walk = (n: MindNode, id: string) => {
    if (n.children?.length) {
      ids.push(id);
      n.children.forEach((c, i) => walk(c, `${id}.${i}`));
    }
  };
  walk(root, '0');
  return ids;
}
