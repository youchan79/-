import React, { useEffect, useState } from 'react';
import { won } from '../lib/api.ts';
import { Button, Card, CardTitle, Page } from '../components/ui.tsx';

interface DayRow {
  date: string;
  visit: number;
  preview: number;
  signup: number;
  checkout_start: number;
  purchase: number;
  revenue: number;
  purchases: number;
  renewals: number;
  renewal_revenue: number;
  failed: number;
  ai_cost: number;
  reports: number;
  chats: number;
}

interface Stats {
  days: DayRow[];
  activeSubs: number;
  autoRenewing: number;
  unitCost: Record<string, { n: number; avg: number }>;
  plan: { price: number };
}

function readKey() {
  try {
    return localStorage.getItem('adminKey') ?? '';
  } catch {
    return '';
  }
}

function Big({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-field px-4 py-3.5">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 text-[22px] font-bold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

export default function Admin() {
  const [key, setKey] = useState(readKey);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [adSpend, setAdSpend] = useState('');

  const load = async (k: string) => {
    setError('');
    const res = await fetch('/api/admin/stats?days=28', { headers: { 'x-admin-key': k } });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || '불러오지 못했습니다.');
      setStats(null);
      return;
    }
    try {
      localStorage.setItem('adminKey', k);
    } catch {
      /* 무시 */
    }
    setStats(json);
  };

  useEffect(() => {
    if (key) void load(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stats) {
    return (
      <Page>
        <div className="px-4 pt-10">
          <Card>
            <CardTitle>관리자</CardTitle>
            <input
              className="mb-3 h-14 w-full rounded-2xl bg-field px-4 text-[17px] outline-none"
              type="password"
              placeholder="ADMIN_KEY"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            {error && <p className="mb-3 text-[14px] text-danger">{error}</p>}
            <Button onClick={() => void load(key)}>보기</Button>
          </Card>
        </div>
      </Page>
    );
  }

  const last7 = stats.days.slice(0, 7);
  const rev7 = last7.reduce((a, d) => a + d.revenue, 0);
  const ai7 = last7.reduce((a, d) => a + d.ai_cost, 0);
  const spend = Number(adSpend.replace(/\D/g, '')) || 0;
  const roas = spend ? Math.round((rev7 / spend) * 100) : null;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 pb-16 pt-6">
      <h1 className="px-1 pb-4 text-[24px] font-bold tracking-tight">매출과 퍼널</h1>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Big label="최근 7일 실제 결제 매출" value={won(rev7)} sub="오늘 포함, KST 기준" />
        <Big label="이용 중인 구독자" value={`${stats.activeSubs}명`} sub={`자동 갱신 예정 ${stats.autoRenewing}명`} />
        <Big label="풀이 1건 평균 AI 원가" value={stats.unitCost.report ? `${stats.unitCost.report.avg.toFixed(1)}원` : '-'} />
        <Big label="상담 1회 평균 AI 원가" value={stats.unitCost.chat ? `${stats.unitCost.chat.avg.toFixed(1)}원` : '-'} />
      </div>

      <Card className="mt-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[15px] text-sub">최근 7일 광고비</span>
          <input
            className="h-11 w-40 rounded-xl bg-field px-3 text-[16px] tabular-nums outline-none"
            inputMode="numeric"
            placeholder="메타 광고비"
            value={adSpend}
            onChange={(e) => setAdSpend(e.target.value)}
          />
          <span className="text-[15px] text-sub">실제 ROAS</span>
          <span className="text-[24px] font-bold tabular-nums text-primary">{roas === null ? '-' : `${roas}%`}</span>
          <span className="text-[13px] text-muted">7일 AI 원가 {won(Math.round(ai7))}</span>
        </div>
      </Card>

      <Card className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-right text-[14px] tabular-nums">
          <thead className="text-[12px] text-muted">
            <tr className="border-b border-line">
              <th className="py-2 text-left font-medium">날짜</th>
              <th className="font-medium">방문</th>
              <th className="font-medium">미리보기</th>
              <th className="font-medium">가입</th>
              <th className="font-medium">결제 시작</th>
              <th className="font-medium">첫 결제</th>
              <th className="font-medium">미리보기→결제</th>
              <th className="font-medium">갱신</th>
              <th className="font-medium">실패</th>
              <th className="font-medium">매출</th>
              <th className="font-medium">AI 원가</th>
            </tr>
          </thead>
          <tbody>
            {stats.days.map((d) => (
              <tr key={d.date} className="border-b border-line/60">
                <td className="py-2.5 text-left text-sub">{d.date.slice(5)}</td>
                <td>{d.visit}</td>
                <td>{d.preview}</td>
                <td>{d.signup}</td>
                <td>{d.checkout_start}</td>
                <td className="font-semibold">{d.purchase}</td>
                <td className="text-muted">{pct(d.purchase, d.preview)}</td>
                <td>{d.renewals}</td>
                <td className={d.failed ? 'text-danger' : 'text-muted'}>{d.failed}</td>
                <td className="font-semibold">{d.revenue.toLocaleString('ko-KR')}</td>
                <td className="text-muted">{Math.round(d.ai_cost).toLocaleString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-left text-[12px] text-muted">
          방문, 미리보기, 가입, 결제 시작, 첫 결제는 그날의 고유 방문자 수입니다. 매출은 승인된 결제 금액 합계(첫 결제와 갱신 포함)입니다.
        </p>
      </Card>
    </div>
  );
}
