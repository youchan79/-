# 스터디AI 인수인계 (클라우드 세션 → PC 세션, 2026-11-01)

비밀 값(키)과 개인정보는 이 문서에 없다. 아래 "환경 변수"에 어디서 가져오는지만 적었다.

## 목표와 일정

- 유니브AI 구조를 따라 만든 AI 학습 서비스 **스터디AI**를 메타 광고로 판매한다.
- MVP 11/2, 광고 시작 11/5, 최종 판단 12/25.

## 저장소

- `youchan79/-`, 작업 브랜치 `ccr-eed69f99-nfucy9`, 드래프트 PR #5 (main으로).
- 구조와 기능 설명은 `README.md`, 배포와 메타 픽셀은 `DEPLOY.md`.

## 지금 상태 (완료)

- Express + Vite + React 19 + Tailwind v4, SQLite(`node:sqlite`, Node 22.13 이상), 업로드는 `DATA_DIR`.
- AI는 Claude Haiku 5.5 (`claude-haiku-5-5`): PDF·사진 읽기, 요약/퀴즈/플래시카드/마인드맵/암기/개념, 시험지, 튜터(웹 검색). 원가는 `/admin`에 기록. 실측 4쪽 PDF로 8개 탭 전부 약 15원.
- 결제는 유니브AI와 같은 요금제: **Pro 월간 9,900원**(페이앱 정기결제, 매달 자동 결제, 언제든 해지·기간 끝까지 이용)과 **Pro 연간 82,800원**(단건 1년치, 자동 갱신 없음 — 페이앱 정기결제 주기에 '연'이 없음). 결제통보 검증 후 Pro, 갱신 통보마다 연장, 자동 결제 실패·승인 취소 시 Pro 종료. 키가 없으면 개발용 가짜 결제창. (11/1에 평생 이용권에서 바꿈, 브랜치 `feat/pricing-subscription`)
- 약관, 개인정보처리방침, 환불 정책(유니브AI 기준을 월간·연간 구독에 맞춤). 사업자 정보는 `BIZ_*` 환경 변수.
- 메타 픽셀 + 전환 API(Purchase는 브라우저·서버 같은 event_id).
- 배포 파일: `Dockerfile`, `render.yaml`(Render 블루프린트), `railway.json`. `APP_URL`이 비어 있으면 Render/Railway가 주는 공개 주소를 쓴다.
- 실제 Claude 키로 브라우저 전체 흐름 테스트 통과(가입 → PDF → 8개 탭 → 튜터 → 시험 → 가짜 결제 → Pro → 유튜브 스크립트 → 개념에서 세트 1개씩 생성).

## PC에서 실행

```bash
git clone https://github.com/youchan79/- studyai
cd studyai
git checkout ccr-eed69f99-nfucy9
npm install
copy .env.example .env      # PowerShell은 cp .env.example .env
npm run dev                 # http://localhost:3000, 관리자 /admin (개발 키 dev-admin)
```

키를 비워 두면 가짜 AI와 가짜 결제창으로 전부 돈다. 타입 검사 `npm run lint`, 운영 빌드 `npm run build && npm start`.

## 환경 변수 (값은 채팅에 적지 말고 직접 붙여 넣기)

| 변수 | 어디서 |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys. 이전 키가 채팅에 노출됐으므로 **새로 발급**하고 이전 키는 삭제 |
| `CLAUDE_MODEL` | `claude-haiku-5-5` |
| `PAYAPP_USERID` | 페이앱 판매자 로그인 아이디 (사용자에게 확인) |
| `PAYAPP_LINKKEY`, `PAYAPP_LINKVAL`, `PAYAPP_REQUESTKEY` | seller.payapp.kr → 설정 → 연동 정보의 연동 KEY, 연동 VALUE, 결제 KEY |
| `BIZ_NAME` | `스터디AI` |
| `BIZ_OWNER`, `BIZ_ADDRESS`, `BIZ_PHONE`, `BIZ_EMAIL`, `BIZ_PRIVACY_OFFICER` | 사용자에게 받은 판매자 정보 (인수인계 메시지에 있음) |
| `META_PIXEL_ID`, `META_CAPI_TOKEN` | 아직 없음. `DEPLOY.md` 2번 |

## 진행 중

- **Render 배포**: Railway는 신규 가입이 막혀 Render로 바꿨다. PC 세션 "페이앱 ID/PW 확인"에 Ego 브라우저로 블루프린트를 만들어 달라고 넘겨 둠(값 입력, Apply, 주소 확인). 그 세션의 결과부터 확인한다.

## 다음 할 일 (순서대로)

1. Render 주소에서 `/api/config`가 200인지, `aiMode: claude`, 결제가 `payapp`인지 확인.
2. 실제 결제 테스트: 페이앱 판매자 사이트에서 정기결제 이용 확인 → 배포 주소에서 가입 → 월간 9,900원 결제 → 구독 페이지 "Pro 월간 이용 중 · 다음 결제일" → 구독 해지(판매자 사이트 정기결제 목록에서 해지 확인) → 결제 취소 → 기본 플랜으로 돌아오는지.
3. 메타 픽셀 ID와 전환 API 토큰을 만들어 Render 환경 변수에 넣고, 이벤트 테스트로 PageView/CompleteRegistration/InitiateCheckout/Purchase 확인.
4. 디자인·색·문구 수정 (배포 전에 바꾸기로 한 부분).
5. PR #5 머지 후 `render.yaml`의 `branch`를 `main`으로.

## 정해진 것

- 요금은 유니브AI와 같다: 기본 무료(매주 PDF 2·유튜브 2, 월요일 0시 갱신), Pro 월 9,900원 / 연 82,800원(36,000원 절약). 값은 `PLAN_MONTHLY_PRICE`, `PLAN_YEARLY_PRICE`.
- 해지는 다음 결제부터 멈추고 기간 끝까지 Pro. 페이앱 해지 API가 실패하면 해지로 표시하지 않는다(유니브AI의 '해지했는데 또 결제됨' 불만을 피하려고).
- 환불은 유니브AI 기준(7일 이내 미사용 전액, 월간 7일 경과 시 제한, 연간 중도 해지는 남은 기간 비율)을 우리 말로 옮김.
- 유니브AI의 로고, 대학 로고, 앱스토어 리뷰, 가입자 수는 가져오지 않음. 대신 자체 로고 마크, 전공 배지 줄, 활용 예시 카드, 월 9,900원 문구.
- 유튜브 자동 자막은 유튜브 차단 우회가 필요해서 넣지 않음. 스크립트 붙여넣기, 또는 `GEMINI_API_KEY`(선택)로 자동 받아쓰기.

## 알아 둘 것

- 많이 쓰는 Pro 사용자의 원가가 걱정되면 `PRO_MONTHLY_UPLOADS`로 최근 30일 업로드 상한(기본 0 = 없음).
- 예전에 평생 이용권을 산 사람이 있으면 기간 제한 없는 Pro로 그대로 인정된다(`plan = lifetime`).
- 아이폰 HEIC, 예전 PPT/DOC는 받지 않는다.
- Render는 디스크(`/data`) 때문에 유료 Starter(월 7달러 + 디스크 0.25달러)가 필요하다. 무료 인스턴스는 재배포 때 DB가 지워진다.
- 클라우드 세션의 `.env`와 테스트 스크립트는 넘어오지 않는다. 키는 위 표대로 새로 넣는다.
