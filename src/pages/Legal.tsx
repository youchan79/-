import React from 'react';
import { won, type AppConfig } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { Card, Footer, Page, TopBar } from '../components/ui.tsx';

type Doc = { title: string; sections: Array<[string, string[]]> };

function terms(c: AppConfig): Doc {
  const b = c.business;
  const p = c.plan;
  const auto = c.billingMode === 'auto';
  return {
    title: '이용약관',
    sections: [
      ['제1조 목적', [`이 약관은 ${b.name}(이하 "회사")가 운영하는 ${c.serviceName}(이하 "서비스")의 이용 조건과 절차, 회사와 회원의 권리와 의무를 정합니다.`]],
      ['제2조 서비스 내용', [
        '서비스는 회원이 입력한 생년월일시를 바탕으로 사주 원국을 계산하고, 인공지능을 활용해 사주 풀이와 상담 답변을 제공합니다.',
        '사주 원국과 일간 설명 등 일부 내용은 무료로, 전체 풀이와 상담은 유료 이용권 구매 후 제공합니다.',
      ]],
      ['제3조 이용 요금과 결제', [
        auto
          ? `유료 이용권은 ${p.days}일 단위 정기결제 상품이며 요금은 ${won(p.price)}(부가세 포함)입니다. 첫 결제일부터 ${p.days}일마다 등록한 카드로 자동 결제됩니다.`
          : `유료 이용권은 ${p.days}일 이용권이며 요금은 ${won(p.price)}(부가세 포함)입니다. 자동으로 다시 결제되지 않습니다.`,
        '결제는 결제대행사(토스페이먼츠)를 통해 처리되며, 회사는 카드번호 전체를 저장하지 않습니다.',
        '요금이 바뀌면 시행 30일 전까지 서비스 화면 또는 이메일로 알립니다. 이미 구독 중인 회원에게는 동의를 받은 뒤에 적용합니다.',
      ]],
      ['제4조 해지', [
        auto
          ? '회원은 언제든지 내 정보 화면에서 구독을 해지할 수 있습니다. 해지하면 다음 결제일부터 결제되지 않고, 이미 결제한 기간이 끝날 때까지 서비스를 이용할 수 있습니다.'
          : '이용권은 기간이 끝나면 자동으로 종료됩니다.',
      ]],
      ['제5조 청약철회와 환불', ['청약철회와 환불은 환불정책을 따릅니다.']],
      ['제6조 이용 한도', [
        `상담은 하루 ${p.chatDailyLimit}회, 전체 풀이는 30일에 ${p.reportMonthlyLimit}건까지 이용할 수 있습니다. 비정상적인 대량 이용이 확인되면 이용을 제한할 수 있습니다.`,
      ]],
      ['제7조 콘텐츠의 성격', [
        '사주 풀이와 상담 답변은 명리학 해석을 바탕으로 인공지능이 만든 참고용 콘텐츠이며, 미래를 보장하거나 의료, 법률, 투자 판단을 대신하지 않습니다.',
        '회원이 풀이 내용을 근거로 내린 결정의 결과에 대해 회사는 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.',
      ]],
      ['제8조 회원의 의무', ['회원은 타인의 정보를 동의 없이 입력하거나 계정을 다른 사람과 공유해서는 안 됩니다.']],
      ['제9조 분쟁 해결', [`서비스 이용과 관련한 문의와 불만은 고객센터(${b.email}, ${b.phone})로 접수하며, 분쟁은 관련 법령과 상관례에 따릅니다.`]],
    ],
  };
}

function privacy(c: AppConfig): Doc {
  const b = c.business;
  return {
    title: '개인정보처리방침',
    sections: [
      ['1. 수집하는 개인정보', [
        '회원가입: 이메일, 비밀번호(암호화하여 저장)',
        '사주 풀이: 이름 또는 별명, 성별, 생년월일, 태어난 시간',
        '결제: 결제 승인 정보와 카드사 마스킹 번호 (카드번호 전체는 결제대행사가 보관)',
        '자동 수집: 접속 기록, 쿠키, 광고 식별자(메타 픽셀)',
      ]],
      ['2. 이용 목적', ['사주 계산과 풀이 제공, 상담 답변 생성, 유료 결제와 정기결제 처리, 고객 문의 응대, 광고 성과 측정과 서비스 개선']],
      ['3. 보유 기간', [
        '회원 탈퇴 시까지 보유하고 지체 없이 파기합니다.',
        '단, 관련 법령에 따라 계약과 결제 기록은 5년, 소비자 불만과 분쟁 처리 기록은 3년, 접속 기록은 3개월 동안 보관합니다.',
      ]],
      ['4. 처리 위탁과 국외 이전', [
        '토스페이먼츠(주): 결제 처리',
        'Google LLC(미국): 사주 풀이와 상담 답변 생성을 위해 사주 정보와 질문 내용을 이용 시점에 암호화 통신으로 전송합니다.',
        'Meta Platforms, Inc.(미국): 광고 성과 측정을 위해 쿠키 정보와 암호화(해시)된 이메일을 전송합니다.',
        '국외 이전을 원하지 않으면 서비스 이용을 중단하고 탈퇴를 요청할 수 있습니다. 이 경우 유료 서비스 이용이 제한됩니다.',
      ]],
      ['5. 이용자의 권리', [`언제든지 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 요청은 ${b.email}로 보내 주세요.`]],
      ['6. 개인정보 보호책임자', [`${b.privacyOfficer} (${b.email})`]],
    ],
  };
}

function refund(c: AppConfig): Doc {
  const b = c.business;
  const auto = c.billingMode === 'auto';
  return {
    title: '환불정책',
    sections: [
      ['청약철회', [
        '결제 후 7일 이내이고 전체 풀이를 열람하거나 상담을 이용하지 않았다면 전액 환불합니다.',
        '전체 풀이를 열람하거나 상담을 이용한 경우, 디지털 콘텐츠의 제공이 시작된 것으로 보아 전자상거래법 제17조 제2항에 따라 청약철회가 제한됩니다. 이 내용은 결제 전에 안내합니다.',
      ]],
      ...(auto
        ? ([
            ['정기결제', [
              '자동 갱신된 결제도 갱신일로부터 7일 이내이고 그 기간에 이용 기록이 없으면 전액 환불합니다.',
              '구독을 해지하면 다음 결제일부터 결제되지 않으며, 남은 기간 동안은 계속 이용할 수 있습니다.',
            ]],
          ] as Array<[string, string[]]>)
        : []),
      ['서비스 장애', ['회사 사정으로 서비스를 이용하지 못한 경우 이용하지 못한 기간만큼 환불하거나 기간을 연장합니다.']],
      ['환불 방법', [`${b.email}로 가입 이메일과 함께 요청해 주세요. 영업일 기준 3일 이내에 처리하며, 카드 취소는 카드사 사정에 따라 3~7영업일이 걸릴 수 있습니다.`]],
    ],
  };
}

export default function Legal({ kind }: { kind: 'terms' | 'privacy' | 'refund' }) {
  const { config } = useApp();
  if (!config) return null;
  const doc = kind === 'terms' ? terms(config) : kind === 'privacy' ? privacy(config) : refund(config);
  return (
    <Page>
      <TopBar />
      <div className="px-4">
        <h1 className="px-1 pb-4 pt-2 text-[26px] font-bold tracking-[-0.03em]">{doc.title}</h1>
        <Card>
          <div className="space-y-6">
            {doc.sections.map(([h, ps]) => (
              <div key={h}>
                <h2 className="text-[17px] font-bold tracking-tight">{h}</h2>
                <div className="mt-2 space-y-1.5">
                  {ps.map((p) => (
                    <p key={p} className="text-[15px] leading-[1.7] text-sub">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Footer />
    </Page>
  );
}
