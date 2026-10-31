import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { won, type AppConfig } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { navigate } from '../lib/router.tsx';
import { BizInfo } from './Subscription.tsx';

type Doc = { title: string; sections: Array<[string, string[]]> };

function terms(c: AppConfig): Doc {
  const b = c.business;
  const m = c.plans.monthly;
  const y = c.plans.yearly;
  return {
    title: '이용약관',
    sections: [
      ['제1조 목적', [`이 약관은 ${b.name}(이하 "회사")가 운영하는 ${c.serviceName}(이하 "서비스")의 이용 조건과 절차, 회사와 회원의 권리와 의무를 정합니다.`]],
      ['제2조 서비스 내용', [
        '서비스는 회원이 올린 강의 자료(PDF, PPT, Word, 이미지, 유튜브 링크, 강의 녹음, 메모)를 인공지능으로 분석해 요약, 퀴즈, 플래시카드, 마인드맵, 암기 목록, 개념 정리, 모의고사와 질의응답을 제공합니다.',
        '인공지능이 만든 결과물은 틀릴 수 있으며, 회원은 중요한 내용을 원 자료와 대조해 확인해야 합니다.',
      ]],
      ['제3조 요금과 결제', [
        `기본 플랜은 무료이며 매주 파일 ${c.free.weeklyFiles}회, 유튜브 ${c.free.weeklyYoutube}회 분석과 하루 ${c.free.dailyTutor}회의 AI 튜터 질문을 제공합니다.`,
        `Pro 월간은 ${won(m.price)}(부가세 포함)이며 결제일로부터 매월 같은 날 자동 결제됩니다. Pro 연간은 ${won(y.price)}(부가세 포함)를 한 번 결제하고 1년 동안 이용합니다.`,
        '결제는 결제대행사 페이앱을 통해 처리되며, 회사는 카드 번호를 저장하지 않습니다.',
        '요금이 바뀌면 시행 30일 전까지 알리며, 이미 구독 중인 회원에게는 동의를 받은 뒤에 적용합니다.',
      ]],
      ['제4조 해지', ['회원은 언제든지 설정 > 구독에서 월간 구독을 해지할 수 있습니다. 해지하면 다음 결제일부터 결제되지 않고, 이미 결제한 기간이 끝날 때까지 Pro를 이용할 수 있습니다.']],
      ['제5조 청약철회와 환불', ['청약철회와 환불은 환불 정책을 따릅니다.']],
      ['제6조 회원이 올린 자료', [
        '회원이 올린 자료의 권리는 회원 또는 원 저작권자에게 있습니다. 회원은 자신이 이용할 권한이 있는 자료만 올려야 합니다.',
        '회사는 서비스 제공 목적 외에 회원의 자료를 이용하지 않으며, 인공지능 학습에 사용하지 않습니다.',
      ]],
      ['제7조 이용 제한', ['비정상적인 대량 이용, 계정 공유, 서비스 운영을 방해하는 행위가 확인되면 이용을 제한할 수 있습니다.']],
      ['제8조 분쟁 해결', [`문의와 불만은 고객센터(${b.email})로 접수하며, 분쟁은 관련 법령과 상관례에 따릅니다.`]],
    ],
  };
}

function privacy(c: AppConfig): Doc {
  const b = c.business;
  return {
    title: '개인정보 처리방침',
    sections: [
      ['1. 수집하는 개인정보', [
        '회원가입: 이메일, 비밀번호(암호화하여 저장)',
        '결제: 휴대폰 번호, 결제 승인 정보 (카드 번호는 결제대행사가 처리)',
        '서비스 이용: 회원이 올린 자료와 그 분석 결과, AI 튜터 대화, 학습 기록',
        '자동 수집: 접속 기록, 쿠키, 광고 식별자(메타 픽셀)',
      ]],
      ['2. 이용 목적', ['자료 분석과 학습 자료 제공, 유료 결제와 정기결제 처리, 고객 문의 응대, 서비스 개선과 광고 성과 측정']],
      ['3. 보유 기간', ['회원 탈퇴 시 지체 없이 파기합니다. 단, 관련 법령에 따라 계약·결제 기록은 5년, 소비자 불만 처리 기록은 3년, 접속 기록은 3개월 동안 보관합니다.']],
      ['4. 처리 위탁과 국외 이전', [
        '주식회사 유디아이디(페이앱): 결제 처리',
        'Google LLC(미국): 자료 분석과 학습 자료 생성을 위해 회원이 올린 자료와 질문을 처리 시점에 암호화 통신으로 전송합니다. 전송된 자료는 인공지능 학습에 쓰이지 않는 유료 API로 처리합니다.',
        'Meta Platforms, Inc.(미국): 광고 성과 측정을 위해 쿠키 정보와 암호화(해시)된 이메일을 전송합니다.',
      ]],
      ['5. 이용자의 권리', [`언제든지 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 설정 > 계정에서 직접 탈퇴하거나 ${b.email}로 요청해 주세요.`]],
      ['6. 개인정보 보호책임자', [`${b.privacyOfficer} (${b.email})`]],
    ],
  };
}

function refund(c: AppConfig): Doc {
  const b = c.business;
  return {
    title: '환불 정책',
    sections: [
      ['청약철회', [
        '결제 후 7일 이내이고 결제 이후 Pro 전용 기능(무료 한도를 넘는 업로드, 추가 학습 자료 생성, 무제한 질문)을 쓰지 않았다면 전액 환불합니다.',
        'Pro 전용 기능을 이용한 경우 디지털 콘텐츠 제공이 시작된 것으로 보아 전자상거래법 제17조 제2항에 따라 청약철회가 제한될 수 있습니다.',
      ]],
      ['월간 구독', ['매월 자동 결제된 금액도 결제일로부터 7일 이내이고 그 기간에 Pro 전용 기능을 쓰지 않았다면 환불합니다. 해지하면 다음 결제일부터 결제되지 않습니다.']],
      ['연간 구독', ['결제 후 7일이 지난 뒤 해지를 원하면, 이용한 개월 수를 월간 요금으로 계산한 금액과 위약금(잔여 금액의 10%)을 뺀 나머지를 환불합니다.']],
      ['서비스 장애', ['회사 사정으로 서비스를 이용하지 못한 경우 그 기간만큼 환불하거나 기간을 연장합니다.']],
      ['환불 방법', [`${b.email}로 가입 이메일과 함께 요청해 주세요. 영업일 기준 3일 이내에 처리하며, 카드 취소는 카드사 사정에 따라 3~7영업일이 걸릴 수 있습니다.`]],
    ],
  };
}

export default function Legal({ kind }: { kind: 'terms' | 'privacy' | 'refund' }) {
  const { config } = useApp();
  if (!config) return null;
  const doc = kind === 'terms' ? terms(config) : kind === 'privacy' ? privacy(config) : refund(config);
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-[760px] px-5 pb-16 pt-6">
        <button type="button" onClick={() => (history.length > 1 ? history.back() : navigate('/'))} className="inline-flex h-9 items-center gap-1 rounded-full border border-line px-3.5 text-[14px] hover:bg-soft">
          <ChevronLeft size={16} /> 돌아가기
        </button>
        <h1 className="mt-8 text-[30px] font-semibold tracking-tight">{doc.title}</h1>
        <div className="mt-8 space-y-8">
          {doc.sections.map(([h, ps]) => (
            <section key={h}>
              <h2 className="text-[17px] font-semibold">{h}</h2>
              <div className="mt-2 space-y-2">
                {ps.map((p) => (
                  <p key={p} className="text-[15px] leading-[1.75] text-sub">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <footer className="mt-16 border-t border-line pt-6 text-[13px] leading-[1.8] text-muted">
          <BizInfo />
        </footer>
      </div>
    </div>
  );
}
