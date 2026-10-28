# 자사 · AI 자기소개서 작업실

경험을 정리하고, 지원 기업과 문항을 분석해, 내 경험으로 자기소개서를 쓰고 다듬는 웹 서비스입니다.

| 단계 | 하는 일 |
| --- | --- |
| 1. 경험 정리 | 이력서 PDF·메모를 넣으면 AI가 경험을 상황·과제·행동·결과(STAR)로 나눠 정리. 직접 추가·수정도 가능 |
| 2. 기업·문항 분석 | 회사·직무·문항(＋채용공고)을 넣으면 Google 검색으로 최근 소식과 인재상을 찾아 문항 의도와 작성 방향을 정리, 출처 링크 포함 |
| 3. 쓰고 다듬기 | 고른 경험으로 초안 생성(실시간 출력), AI와 대화하며 첨삭(‘원고에 반영’ 버튼), 인사담당자·실무자 두 관점의 점수와 고칠 문장 |

공통: 공백 포함/제외 글자 수, 자동 저장, 휴대폰 화면 지원. AI는 경험에 없는 수치나 성과를 지어내지 않고 ○○ 로 비워 두도록 지시되어 있습니다.

## 바로 실행하기 (로컬 모드)

Node.js 22 이상이 필요합니다.

```bash
cd jasa
npm install
cp .env.example .env      # .env 를 열어 GEMINI_API_KEY 만 넣으면 됩니다
npm run dev               # http://localhost:3000
```

- Gemini API 키는 <https://aistudio.google.com/apikey> 에서 무료로 발급받을 수 있습니다.
- 로그인 설정이 없으면 **로컬 모드**로 동작합니다: 로그인 없이 모든 기능을 쓸 수 있고, 작성한 내용은 그 브라우저에만 저장됩니다.
- 모델은 기본으로 `gemini-flash-latest`(항상 최신 Flash 모델)를 씁니다. 바꾸려면 `.env` 의 `GEMINI_MODEL`.

배포용으로 실행할 때:

```bash
npm run build
npm start                 # PORT 환경 변수의 포트로 실행
```

## 로그인 켜기 (Supabase)

로그인을 켜면 작성 내용이 계정에 저장되어 어느 기기에서든 이어 쓸 수 있고, 무료 회원의 하루 AI 사용 횟수(`FREE_DAILY_LIMIT`, 기본 10회)가 적용됩니다.

1. <https://supabase.com> 에서 프로젝트를 만듭니다.
2. 대시보드 **SQL Editor** 에 [`supabase/schema.sql`](supabase/schema.sql) 전체를 붙여 넣고 실행합니다.
3. 프로젝트 설정의 API 키 화면에서 아래 값을 `.env` 에 넣습니다.
   - `SUPABASE_URL`: 프로젝트 URL
   - `SUPABASE_ANON_KEY`: anon(또는 publishable) 키
   - `SUPABASE_SERVICE_ROLE_KEY`: service_role(또는 secret) 키. **서버에만 두고 절대 공개하지 마세요.**
4. **Authentication → URL Configuration** 의 Site URL 을 서비스 주소(예: `http://localhost:3000`)로 맞춥니다. 가입 확인 메일의 링크가 이 주소로 돌아옵니다.
5. 서버를 다시 시작하면 이메일·비밀번호 로그인이 켜집니다.

## 결제 켜기 (토스페이먼츠)

로그인 설정이 있어야 동작합니다. 프로 요금제(`PRO_PRICE`, 기본 9,900원)를 결제하면 30일 동안 AI를 제한 없이 씁니다. 자동 결제는 없습니다.

1. <https://developers.tosspayments.com> 에 가입하고 **API 키** 메뉴의 **결제위젯 연동 키**를 확인합니다.
2. `.env` 에 `TOSS_CLIENT_KEY`(클라이언트 키), `TOSS_SECRET_KEY`(시크릿 키)를 넣습니다.
3. 테스트 키(`test_…`)로는 실제 돈이 나가지 않으니, 결제 흐름을 먼저 확인하세요. 실제 판매는 토스페이먼츠 가맹점 계약 후 라이브 키로 바꾸면 됩니다.

서버는 결제 전에 주문(금액·주인)을 기록해 두고, 승인 요청이 오면 주문과 대조한 뒤에만 토스페이먼츠에 승인을 요청합니다. 브라우저에서 금액을 바꿔도 통하지 않습니다.

## 이름·문구 바꾸기

서비스 이름은 [`src/brand.ts`](src/brand.ts) 한 곳에서 바꿉니다. 브라우저 탭 제목은 `index.html` 의 `<title>` 입니다.

## 구조

```
server.ts            Express 서버 (개발 중에는 Vite 를 함께 띄움)
server/ai.ts         Gemini 호출과 프롬프트 (경험 정리·기업 분석·초안·첨삭·피드백)
server/account.ts    로그인 확인, 하루 사용량, 프로 기간
server/payments.ts   토스페이먼츠 주문·승인
server/api.ts        API 경로와 입력 검사
src/                 화면 (React + Tailwind CSS)
supabase/schema.sql  데이터베이스 테이블과 권한
```

API 키(Gemini, Supabase service role, 토스 시크릿 키)는 모두 서버에서만 쓰이고 브라우저로 내려가지 않습니다. `.env` 는 `.gitignore` 에 들어 있어 저장소에 올라가지 않습니다.
