import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import { api, type DocDetail } from '../../lib/api.ts';
import { useApp } from '../../lib/app.tsx';
import { Button, Modal, Spinner } from '../../components/ui.tsx';

const ITEMS = [
  ['summary', '요약'],
  ['quiz', '퀴즈'],
  ['flashcards', '플래시카드'],
  ['mindmap', '마인드맵'],
  ['memorize', '암기'],
  ['concepts', '개념'],
] as const;
type Item = (typeof ITEMS)[number][0];

function Box({ on, disabled, label, onClick }: { on: boolean; disabled?: boolean; label: string; onClick?: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={on} className="flex items-center gap-2.5 py-1.5 text-left text-[15px] disabled:text-muted">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-solid bg-solid text-on-solid' : 'border-line'} ${disabled ? 'opacity-50' : ''}`}>
        {on && <Check size={13} strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

/** 자료 공유: 링크를 받은 사람이 볼 학습 자료를 고르고 링크를 만든다. 원본은 나가지 않는다. */
export function ShareModal({ doc, onClose }: { doc: DocDetail; onClose: () => void }) {
  const { showToast } = useApp();
  const [items, setItems] = useState<Item[]>(ITEMS.map(([k]) => k));
  const [token, setToken] = useState<string | null>(null);
  const [saved, setSaved] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ share: { token: string; items: Item[] } | null }>(`/api/docs/${doc.id}/share`)
      .then((r) => {
        if (r.share) {
          setToken(r.share.token);
          setItems(r.share.items);
          setSaved(r.share.items);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [doc.id]);

  const url = token ? `${location.origin}/share/${token}` : '';
  const changed = token && (items.length !== saved.length || items.some((i) => !saved.includes(i)));

  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ share: { token: string; items: Item[] } }>(`/api/docs/${doc.id}/share`, { items });
      setToken(r.share.token);
      setSaved(r.share.items);
      if (token) showToast('공유할 항목을 바꿨어요.');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = () => void navigator.clipboard.writeText(url).then(() => showToast('링크를 복사했어요.'), () => showToast('복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.'));

  return (
    <Modal open onClose={onClose} width={460}>
      <h2 className="text-[20px] font-semibold">공유하기</h2>
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mt-5 flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-soft">
              <Link2 size={19} />
            </span>
            <div>
              <div className="text-[15px] font-medium">링크를 받은 사람</div>
              <p className="mt-0.5 text-[14px] leading-[1.55] text-sub">로그인하지 않아도 아래에서 고른 학습 자료를 볼 수 있어요. 올린 원본 파일과 AI 튜터 대화는 공유되지 않아요.</p>
            </div>
          </div>

          <div className="mt-5 text-[14px] font-medium">공유할 항목</div>
          <div className="mt-1 grid grid-cols-2 gap-x-4">
            <Box on={false} disabled label="원본 (공유 안 됨)" />
            {ITEMS.map(([k, label]) => (
              <Box key={k} on={items.includes(k)} label={label} onClick={() => setItems((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))} />
            ))}
          </div>

          {token ? (
            <div className="mt-5">
              <div className="flex items-center gap-2 rounded-xl border border-line py-1.5 pl-4 pr-1.5">
                <input readOnly value={url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 bg-transparent text-[14px] text-sub outline-none" aria-label="공유 링크" />
                <Button size="sm" onClick={copy}>
                  <Copy size={15} /> 복사
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-[14px] text-muted underline underline-offset-4 hover:text-red"
                  onClick={async () => {
                    if (!window.confirm('링크를 끊을까요? 이미 받은 사람도 더는 볼 수 없어요.')) return;
                    await api(`/api/docs/${doc.id}/share`, undefined, { method: 'DELETE' }).catch(() => {});
                    setToken(null);
                    setSaved([]);
                    showToast('링크를 끊었어요.');
                  }}
                >
                  링크 끊기
                </button>
                {changed && (
                  <Button size="sm" variant="outline" disabled={busy || !items.length} onClick={() => void save()}>
                    바꾼 항목 저장
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 flex justify-end">
              <Button disabled={busy || !items.length} onClick={() => void save()}>
                {busy ? <Spinner className="h-4 w-4" /> : '공유 링크 만들기'}
              </Button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
