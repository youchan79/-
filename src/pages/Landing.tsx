import React, { useState } from 'react';
import { api, won } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { navigate } from '../lib/router.tsx';
import { Button, Card, Footer, Page, Spinner, TopBar } from '../components/ui.tsx';

function formatDigits(d: string) {
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T | null; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-2xl bg-field p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`h-12 rounded-xl text-[16px] transition-colors ${value === v ? 'bg-card font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-muted'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[14px] font-medium text-sub">{label}</div>
      {children}
    </div>
  );
}

export default function Landing() {
  const { config } = useApp();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | null>(null);
  const [calendar, setCalendar] = useState<'solar' | 'lunar'>('solar');
  const [leap, setLeap] = useState(false);
  const [digits, setDigits] = useState('');
  const [time, setTime] = useState('');
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const ready = !!gender && digits.length === 8 && (timeUnknown || !!time);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) {
      setError(!gender ? '성별을 선택해 주세요.' : digits.length !== 8 ? '생년월일 8자리를 입력해 주세요.' : '태어난 시간을 입력하거나 "모름"을 눌러 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
      const res = await api<{ id: string }>('/api/readings', {
        name,
        gender,
        calendar,
        leap,
        date,
        time: timeUnknown ? null : time,
      });
      navigate(`/r/${res.id}`);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  const input = 'h-14 w-full rounded-2xl bg-field px-4 text-[17px] text-ink outline-none ring-primary placeholder:text-muted focus:ring-2';
  const price = config ? won(config.plan.price) : '';

  return (
    <Page>
      <TopBar />
      <div className="px-4">
        <div className="px-1 pb-6 pt-4">
          <p className="text-[15px] font-semibold text-primary">AI 사주 풀이</p>
          <h1 className="mt-2 text-[28px] font-bold leading-[1.3] tracking-[-0.03em]">
            생년월일만 넣으면
            <br />
            내 사주 전체 풀이가 나와요
          </h1>
          <p className="mt-3 text-[16px] leading-[1.6] text-sub">
            성격부터 재물, 연애, 직업, 내년 운세까지.
            <br />
            궁금한 건 AI 상담사에게 바로 물어보세요.
          </p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-5">
            <Field label="이름">
              <input className={input} placeholder="이름 또는 별명 (선택)" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="성별">
              <Segmented<'M' | 'F'> value={gender} onChange={setGender} options={[['F', '여성'], ['M', '남성']]} />
            </Field>
            <Field label="생년월일">
              <div className="space-y-2">
                <Segmented<'solar' | 'lunar'>
                  value={calendar}
                  onChange={(v) => {
                    setCalendar(v);
                    if (v === 'solar') setLeap(false);
                  }}
                  options={[['solar', '양력'], ['lunar', '음력']]}
                />
                <input
                  className={input}
                  inputMode="numeric"
                  autoComplete="bday"
                  placeholder="예: 19950315"
                  value={formatDigits(digits)}
                  onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 8))}
                />
                {calendar === 'lunar' && (
                  <label className="flex items-center gap-2 px-1 py-1 text-[15px] text-sub">
                    <input type="checkbox" className="h-5 w-5 accent-[#3182f6]" checked={leap} onChange={(e) => setLeap(e.target.checked)} />
                    윤달이에요
                  </label>
                )}
              </div>
            </Field>
            <Field label="태어난 시간">
              <div className="flex gap-2">
                <input
                  className={`${input} flex-1 disabled:opacity-40`}
                  type="time"
                  value={timeUnknown ? '' : time}
                  disabled={timeUnknown}
                  onChange={(e) => setTime(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setTimeUnknown(!timeUnknown)}
                  className={`h-14 shrink-0 rounded-2xl px-5 text-[16px] ${timeUnknown ? 'bg-primary-soft font-semibold text-primary' : 'bg-field text-muted'}`}
                >
                  모름
                </button>
              </div>
            </Field>
            {error && <p className="text-[14px] text-danger">{error}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner /> : '무료로 내 사주 보기'}
            </Button>
          </form>
        </Card>

        <Card className="mt-3">
          <h2 className="text-[19px] font-bold tracking-tight">구독하면 이렇게 볼 수 있어요</h2>
          <ul className="mt-4 space-y-4">
            {[
              ['8가지 전체 풀이', '성격, 재물, 연애, 직업, 건강, 내년 운세, 대운, 조언'],
              [`AI 상담 하루 ${config?.plan.chatDailyLimit ?? 20}번`, '내 사주를 아는 상담사에게 바로 질문'],
              ['가족과 연인 사주도', `한 달에 ${config?.plan.reportMonthlyLimit ?? 10}명까지 전체 풀이`],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[14px] font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  <div className="text-[16px] font-semibold">{t}</div>
                  <div className="text-[14px] text-muted">{d}</div>
                </div>
              </li>
            ))}
          </ul>
          {config && (
            <div className="mt-5 flex items-baseline justify-between rounded-2xl bg-field px-4 py-3.5">
              <span className="text-[15px] text-sub">{config.billingMode === 'auto' ? '월 구독' : `${config.plan.days}일 이용권`}</span>
              <span>
                <span className="text-[22px] font-bold tabular-nums">{price}</span>
                <span className="ml-1 text-[13px] text-muted">VAT 포함</span>
              </span>
            </div>
          )}
          <p className="mt-2 px-1 text-[13px] text-muted">
            {config?.billingMode === 'auto' ? '언제든 내 정보에서 해지할 수 있어요.' : '자동으로 결제되지 않아요.'}
          </p>
        </Card>
      </div>
      <Footer />
    </Page>
  );
}
