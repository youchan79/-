import React, { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Download, FileText, Minus, Plus, Search } from 'lucide-react';
import { pdfjs } from '../../lib/pdf.ts';
import { Markdown } from '../../lib/markdown.tsx';
import type { DocDetail } from '../../lib/api.ts';
import { IconButton, Spinner } from '../../components/ui.tsx';

export interface SourceHandle {
  goTo: (ref: string) => void;
}

const toSeconds = (ref: string) => {
  const parts = ref.split(':').map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
};

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[52px] shrink-0 items-center gap-1.5 overflow-x-auto px-3 no-scrollbar">{children}</div>;
}

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex h-9 shrink-0 items-center rounded-full border border-line px-1 ${className}`}>{children}</div>;
}

/* ---------- PDF ---------- */

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const PdfPane = forwardRef<SourceHandle, { doc: DocDetail; onCollapse?: () => void }>(function PdfPane({ doc, onCollapse }, ref) {
  const url = `/api/docs/${doc.id}/file`;
  const scroller = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [width, setWidth] = useState(600);
  const [page, setPage] = useState(1);
  const [sizes, setSizes] = useState<Array<{ w: number; h: number }>>([]);

  useEffect(() => {
    let destroyed = false;
    const task = pdfjs.getDocument({ url, withCredentials: true });
    task.promise.then(
      async (d: any) => {
        if (destroyed) return;
        const s: Array<{ w: number; h: number }> = [];
        for (let i = 1; i <= d.numPages; i++) {
          const vp = (await d.getPage(i)).getViewport({ scale: 1 });
          s.push({ w: vp.width, h: vp.height });
        }
        setSizes(s);
        setPdf(d);
      },
      () => {
        if (!destroyed) setError(true);
      },
    );
    return () => {
      destroyed = true;
      void task.destroy();
    };
  }, [url]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - 40));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scaleFor = (i: number) => (zoom === 'fit' ? width / (sizes[i]?.w || 600) : zoom);

  const goToPage = (n: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-page="${n}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useImperativeHandle(ref, () => ({
    goTo: (r: string) => {
      const m = /^p\.(\d+)$/.exec(r);
      if (m) goToPage(Number(m[1]));
    },
  }));

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const pages = [...el.querySelectorAll<HTMLElement>('[data-page]')];
    const top = el.scrollTop + 80;
    let cur = 1;
    for (const p of pages) if (p.offsetTop <= top) cur = Number(p.dataset.page);
    setPage(cur);
  };

  const total = sizes.length;
  const zoomLabel = zoom === 'fit' ? '맞춤' : `${Math.round(zoom * 100)}%`;

  return (
    <div className="flex h-full flex-col">
      <Toolbar>
        <Pill className="max-w-[150px] gap-1.5 px-3 text-[14px]">
          <FileText size={15} className="shrink-0 text-muted" />
          <span className="truncate">{doc.fileName || doc.title}</span>
        </Pill>
        <Pill>
          <IconButton className="h-7 w-7" onClick={() => goToPage(Math.max(1, page - 1))} disabled={page <= 1}>
            <ChevronLeft size={16} />
          </IconButton>
          <span className="px-1.5 text-[14px] tabular-nums">
            {page} <span className="text-muted">/ {total || '-'}</span>
          </span>
          <IconButton className="h-7 w-7" onClick={() => goToPage(Math.min(total, page + 1))} disabled={page >= total}>
            <ChevronRight size={16} />
          </IconButton>
        </Pill>
        <Pill>
          <IconButton
            className="h-7 w-7"
            onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z === 'fit' ? 1 : z) - 1)])}
            aria-label="축소"
          >
            <Minus size={15} />
          </IconButton>
          <button type="button" className="min-w-[46px] text-center text-[13px] tabular-nums" onClick={() => setZoom('fit')}>
            {zoomLabel}
          </button>
          <IconButton
            className="h-7 w-7"
            onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z === 'fit' ? 1 : z) + 1)])}
            aria-label="확대"
          >
            <Plus size={15} />
          </IconButton>
        </Pill>
        <a href={url} download={doc.fileName ?? undefined} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-sub hover:bg-soft" aria-label="다운로드">
          <Download size={16} />
        </a>
        {onCollapse && (
          <IconButton className="ml-auto shrink-0 border border-line" onClick={onCollapse} aria-label="원문 접기">
            <ChevronLeft size={16} />
          </IconButton>
        )}
      </Toolbar>
      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto bg-soft/60 px-5 pb-10 pt-2">
        {error && <p className="py-10 text-center text-[14px] text-muted">PDF를 불러오지 못했어요.</p>}
        {!pdf && !error && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}
        {pdf &&
          sizes.map((s, i) => (
            <PdfPage key={i} pdf={pdf} index={i + 1} width={Math.round(s.w * scaleFor(i))} height={Math.round(s.h * scaleFor(i))} scale={scaleFor(i)} />
          ))}
      </div>
    </div>
  );
});

function PdfPage({ pdf, index, width, height, scale }: { pdf: any; index: number; width: number; height: number; scale: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let task: any;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(index);
      if (cancelled || !canvas.current) return;
      const dpr = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale: scale * dpr });
      const c = canvas.current;
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      task = page.render({ canvasContext: c.getContext('2d')!, viewport: vp });
      await task.promise.catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel?.();
    };
  }, [visible, pdf, index, scale]);

  return (
    <div ref={box} data-page={index} className="mx-auto mb-4 bg-white shadow-card" style={{ width, height }}>
      <canvas ref={canvas} style={{ width, height }} />
    </div>
  );
}

/* ---------- 원문 텍스트 ([p.N], [mm:ss] 표시 포함) ---------- */

function splitByMarker(text: string) {
  const parts: Array<{ marker: string | null; body: string }> = [];
  const re = /^\[(p\.\d+|\d{1,2}:\d{2}(?::\d{2})?)\]\s?/gm;
  let last = 0;
  let marker: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last || marker) parts.push({ marker, body: text.slice(last, m.index).trim() });
    marker = m[1];
    last = m.index + m[0].length;
  }
  parts.push({ marker, body: text.slice(last).trim() });
  return parts.filter((p) => p.body || p.marker);
}

function TextBody({ text, onSeek, scrollRef }: { text: string; onSeek?: (ref: string) => void; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const parts = useMemo(() => splitByMarker(text), [text]);
  const timeline = parts.some((p) => p.marker && !p.marker.startsWith('p.'));
  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 pb-12 pt-2">
      {timeline ? (
        <div className="space-y-3">
          {parts.map((p, i) => (
            <div key={i} data-ref={p.marker ?? undefined} className="flex gap-3">
              {p.marker ? (
                <button type="button" onClick={() => onSeek?.(p.marker!)} className="mt-[3px] h-6 shrink-0 rounded-md bg-soft px-1.5 text-[12px] tabular-nums text-muted hover:text-ink">
                  {p.marker}
                </button>
              ) : (
                <span className="w-[46px] shrink-0" />
              )}
              <p className="text-[15px] leading-[1.75] text-sub">{p.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {parts.map((p, i) => (
            <section key={i} data-ref={p.marker ?? undefined} className="rounded-2xl border border-line bg-canvas p-5">
              {p.marker && <div className="mb-2 text-[12px] font-medium text-muted">{p.marker}</div>}
              <Markdown text={p.body} size="sm" />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function scrollToRef(container: HTMLDivElement | null, ref: string) {
  const el = container?.querySelector<HTMLElement>(`[data-ref="${CSS.escape(ref)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.animate([{ backgroundColor: 'rgba(47,107,255,0.12)' }, { backgroundColor: 'transparent' }], { duration: 1400 });
}

const TextPane = forwardRef<SourceHandle, { doc: DocDetail; onCollapse?: () => void }>(function TextPane({ doc, onCollapse }, ref) {
  const scroll = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({ goTo: (r) => scrollToRef(scroll.current, r) }));
  return (
    <div className="flex h-full flex-col">
      <Toolbar>
        <Pill className="max-w-[260px] gap-1.5 px-3 text-[14px]">
          <FileText size={15} className="shrink-0 text-muted" />
          <span className="truncate">{doc.fileName || doc.title}</span>
        </Pill>
        {doc.kind !== 'memo' && doc.fileCount > 0 && (
          <a href={`/api/docs/${doc.id}/file`} download={doc.fileName ?? undefined} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-sub hover:bg-soft" aria-label="다운로드">
            <Download size={16} />
          </a>
        )}
        {onCollapse && (
          <IconButton className="ml-auto shrink-0 border border-line" onClick={onCollapse} aria-label="원문 접기">
            <ChevronLeft size={16} />
          </IconButton>
        )}
      </Toolbar>
      {doc.sourceText ? <TextBody text={doc.sourceText} scrollRef={scroll} /> : <Waiting />}
    </div>
  );
});

function Waiting() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[14px] text-muted">
      <Spinner />
      원문을 받아 적고 있어요
    </div>
  );
}

/* ---------- 유튜브 ---------- */

const YoutubePane = forwardRef<SourceHandle, { doc: DocDetail; onCollapse?: () => void }>(function YoutubePane({ doc, onCollapse }, ref) {
  const vid = new URL(doc.sourceUrl!).searchParams.get('v');
  const [start, setStart] = useState(0);
  const [nonce, setNonce] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const seek = (r: string) => {
    if (/^\d/.test(r)) {
      setStart(toSeconds(r));
      setNonce((n) => n + 1);
    }
  };
  useImperativeHandle(ref, () => ({
    goTo: (r) => {
      seek(r);
      scrollToRef(scroll.current, r);
    },
  }));
  return (
    <div className="flex h-full flex-col">
      <Toolbar>
        <Pill className="max-w-[300px] gap-1.5 px-3 text-[14px]">
          <span className="truncate">{doc.title}</span>
        </Pill>
        {onCollapse && (
          <IconButton className="ml-auto shrink-0 border border-line" onClick={onCollapse} aria-label="원문 접기">
            <ChevronLeft size={16} />
          </IconButton>
        )}
      </Toolbar>
      <div className="px-5">
        <div className="aspect-video overflow-hidden rounded-2xl bg-black">
          <iframe
            key={nonce}
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${vid}?start=${start}${nonce ? '&autoplay=1' : ''}`}
            title={doc.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="mb-1 mt-4 text-[13px] font-medium text-muted">자막</div>
      </div>
      {doc.sourceText ? <TextBody text={doc.sourceText} onSeek={seek} scrollRef={scroll} /> : <Waiting />}
    </div>
  );
});

/* ---------- 녹음 ---------- */

const AudioPane = forwardRef<SourceHandle, { doc: DocDetail; onCollapse?: () => void }>(function AudioPane({ doc, onCollapse }, ref) {
  const audio = useRef<HTMLAudioElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const seek = (r: string) => {
    if (audio.current && /^\d/.test(r)) {
      audio.current.currentTime = toSeconds(r);
      void audio.current.play();
    }
  };
  useImperativeHandle(ref, () => ({
    goTo: (r) => {
      seek(r);
      scrollToRef(scroll.current, r);
    },
  }));
  return (
    <div className="flex h-full flex-col">
      <Toolbar>
        <Pill className="max-w-[300px] gap-1.5 px-3 text-[14px]">
          <span className="truncate">{doc.title}</span>
        </Pill>
        <a href={`/api/docs/${doc.id}/file`} download className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-sub hover:bg-soft" aria-label="다운로드">
          <Download size={16} />
        </a>
        {onCollapse && (
          <IconButton className="ml-auto shrink-0 border border-line" onClick={onCollapse} aria-label="원문 접기">
            <ChevronLeft size={16} />
          </IconButton>
        )}
      </Toolbar>
      <div className="px-5">
        <audio ref={audio} controls preload="metadata" src={`/api/docs/${doc.id}/file`} className="w-full" />
        <div className="mb-1 mt-4 flex items-center gap-1.5 text-[13px] font-medium text-muted">
          <Search size={13} /> 자막에서 찾아 다시 듣기
        </div>
      </div>
      {doc.sourceText ? <TextBody text={doc.sourceText} onSeek={seek} scrollRef={scroll} /> : <Waiting />}
    </div>
  );
});

/* ---------- 사진 ---------- */

const ImagePane = forwardRef<SourceHandle, { doc: DocDetail; onCollapse?: () => void }>(function ImagePane({ doc, onCollapse }, ref) {
  const scroll = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({ goTo: (r) => scrollToRef(scroll.current, r) }));
  return (
    <div className="flex h-full flex-col">
      <Toolbar>
        <Pill className="gap-1.5 px-3 text-[14px]">사진 {doc.fileCount}장</Pill>
        {onCollapse && (
          <IconButton className="ml-auto shrink-0 border border-line" onClick={onCollapse} aria-label="원문 접기">
            <ChevronLeft size={16} />
          </IconButton>
        )}
      </Toolbar>
      <div ref={scroll} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-soft/60 px-5 pb-10 pt-2">
        {Array.from({ length: doc.fileCount }, (_, i) => (
          <div key={i} data-ref={`p.${i + 1}`}>
            <div className="mb-1.5 text-[12px] text-muted">p.{i + 1}</div>
            <img src={`/api/docs/${doc.id}/file?i=${i}`} alt={`사진 ${i + 1}`} className="w-full rounded-xl bg-white shadow-card" />
          </div>
        ))}
      </div>
    </div>
  );
});

export const SourcePane = forwardRef<SourceHandle, { doc: DocDetail; onCollapse?: () => void }>(function SourcePane(props, ref) {
  const k = props.doc.kind;
  if (k === 'pdf') return <PdfPane ref={ref} {...props} />;
  if (k === 'youtube') return <YoutubePane ref={ref} {...props} />;
  if (k === 'audio') return <AudioPane ref={ref} {...props} />;
  if (k === 'image') return <ImagePane ref={ref} {...props} />;
  return <TextPane ref={ref} {...props} />;
});

