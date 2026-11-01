import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { won, type AppConfig } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { navigate } from '../lib/router.tsx';
import { BizInfo } from './Subscription.tsx';

type Doc = { title: string; sections: Array<[string, string[]]> };

function terms(c: AppConfig): Doc {
  const b = c.business;
  const plan = c.plans.lifetime;
  return {
    title: '이용약관',
    sections: [
      ['제1조 목적', [`이 약관은 ${b.owner}(이하 "판매자")가 운영하는 ${c.serviceName}(이하 "서비스")의 이용 조건과 절차, 판매자와 회원의 권리와 의무를 정합니다.`]],
      ['제2조 서비스 내용', [
        '서비스는 회원이 올린 강의 자료(PDF, PPT, Word, 사진, 유튜브 자막, 강의 녹음, 메모)를 인공지능으로 분석해 요약, 퀴즈, 플래시카드, 마인드맵, 암기 목록, 개념 정리, 모의고사와 질의응답을 제공합니다.',
        '인공지능이 만든 결과물은 틀릴 수 있으며, 회원은 중요한 내용을 원 자료와 대조해 확인해야 합니다.',
      ]],
      ['제3조 요금과 결제', [
        `기본 플랜은 무료이며 매주 파일 ${c.free.weeklyFiles}회, 유튜브 ${c.free.weeklyYoutube}회 분석과 하루 ${c.free.dailyTutor}회의 AI 튜터 질문을 제공합니다.`,
        `Pro 평생 이용권은 ${won(plan.price)}(부가세 포함)를 한 번 결제하는 상품이며 자동 결제(정기결제)가 없습니다. 결제한 회원은 서비스가 운영되는 동안 별도 기간 제한 없이 Pro 기능을 이용할 수 있습니다.`,
        '결제는 결제대행사 페이앱을 통해 처리되며, 판매자는 카드 번호를 저장하지 않습니다.',
      ]],
      ['제4조 서비스 변경과 종료', [
        '판매자는 서비스의 일부를 바꾸거나 개선할 수 있으며, 회원에게 불리한 중요한 변경은 시행 30일 전까지 알립니다.',
        '판매자가 서비스를 종료하는 경우 종료 30일 전까지 서비스 화면과 이메일로 알리고, 회원이 올린 자료를 내려받을 수 있는 기간을 둡니다.',
      ]],
      ['제5조 청약철회와 환불', ['청약철회와 환불은 환불 정책을 따릅니다.']],
      ['제6조 회원이 올린 자료', [
        '회원이 올린 자료의 권리는 회원 또는 원 저작권자에게 있습니다. 회원은 자신이 이용할 권한이 있는 자료만 올려야 합니다.',
        '판매자는 서비스 제공 목적 외에 회원의 자료를 이용하지 않으며, 인공지능 학습에 사용하지 않습니다.',
      ]],
      ['제7조 공정 이용', ['계정 공유, 자동화 프로그램(매크로)을 이용한 대량 요청, 서비스 운영을 방해하는 행위가 확인되면 관련 법령과 이 약관에 따라 이용을 제한할 수 있습니다.']],
      ['제8조 분쟁 해결', [`문의와 불만은 고객센터(${b.email}, ${b.phone})로 접수하며, 분쟁은 관련 법령과 상관례에 따릅니다.`]],
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
      ['2. 이용 목적', ['자료 분석과 학습 자료 제공, 유료 결제 처리, 고객 문의 응대, 서비스 개선과 광고 성과 측정']],
      ['3. 보유 기간', ['회원 탈퇴 시 지체 없이 파기합니다. 단, 관련 법령에 따라 계약·결제 기록은 5년, 소비자 불만 처리 기록은 3년, 접속 기록은 3개월 동안 보관합니다.']],
      ['4. 처리 위탁과 국외 이전', [
        '주식회사 유디아이디(페이앱): 결제 처리',
        'Anthropic, PBC(미국): 자료 분석, 학습 자료 생성, AI 튜터 답변을 위해 회원이 올린 자료와 질문을 처리 시점에 암호화 통신으로 전송합니다. Anthropic은 API로 받은 자료를 모델 학습에 사용하지 않습니다.',
        'Meta Platforms, Inc.(미국): 광고 성과 측정을 위해 쿠키 정보와 암호화(해시)된 이메일을 전송합니다.',
      ]],
      ['5. 이용자의 권리', [`언제든지 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 설정 > 계정에서 직접 탈퇴하거나 ${b.email}로 요청해 주세요.`]],
      ['6. 개인정보 보호책임자', [`${b.privacyOfficer} (${b.email}, ${b.phone})`]],
    ],
  };
}

function refund(c: AppConfig): Doc {
  const b = c.business;
  return {
    title: '환불 정책',
    sections: [
      ['제1조 목적과 적용 범위', [
        `이 환불 정책은 ${c.serviceName}가 판매하는 유료 상품(Pro 평생 이용권)의 청약철회(환불)와 과오납금 처리 기준을 정합니다. 결제대행사 페이앱을 통한 모든 결제 수단에 적용되며, 관련 법령이 보장하는 소비자의 권리를 제한하지 않습니다.`,
      ]],
      ['제2조 전액 환불', [
        '결제일로부터 7일 이내이고 결제 이후 유료 기능(무료 한도를 넘는 업로드, 추가 학습 자료 생성, 무제한 AI 튜터 등)을 이용하지 않았다면 전액 환불합니다. 관련 법령이 더 유리한 기준을 정한 경우 그 기준을 따릅니다.',
        '판매자의 책임 있는 사유(시스템 오류, 중복 결제 등)로 서비스를 전혀 이용하지 못한 경우 전액 환불합니다.',
      ]],
      ['제3조 청약철회가 제한되는 경우', [
        '유료 기능을 이용해 디지털 콘텐츠의 제공이 시작된 경우, 전자상거래 등에서의 소비자보호에 관한 법률 제17조 제2항 제5호와 제6항의 요건을 갖춘 범위에서 청약철회가 제한될 수 있습니다. 제공이 시작되지 않은 부분에는 이 제한을 적용하지 않습니다.',
        '서비스 설명, 광고, 계약 내용과 다르게 제공된 경우처럼 법령이 정한 사유가 있으면 관련 규정이 우선합니다.',
        '약관의 공정 이용 규정을 위반해(계정 공유, 매크로 이용 등) 이용이 정당하게 제한된 경우 관련 법령과 약관에 따라 환불이 제한될 수 있습니다.',
      ]],
      ['제4조 환불 절차', [
        `가입 이메일과 주문번호를 적어 ${b.email}로 요청해 주세요. 판매자는 결제와 이용 기록을 먼저 확인하고, 처리에 꼭 필요한 범위에서만 추가 자료를 요청합니다.`,
        '추가 자료 확인을 이유로 법정 환불 기한을 늘리거나, 판매자가 증명해야 할 사항을 회원에게 넘기지 않습니다.',
        '환불이 승인되면 영업일 기준 3일 이내에 페이앱을 통해 결제를 취소하며, 카드 취소는 카드사 사정에 따라 3~7영업일이 걸릴 수 있습니다.',
      ]],
      ['제5조 과오납금 환불', [
        '과오납금이 생기면 회원에게 환불합니다.',
        '판매자의 고의나 중대한 과실 없이 회원의 잘못(중복 결제 등)으로 과오납금이 생긴 경우, 환불에 실제로 드는 비용(결제 수수료 등)을 합리적인 범위에서 뺀 뒤 환불할 수 있습니다.',
      ]],
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
