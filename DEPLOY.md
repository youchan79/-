# 배포와 메타 픽셀 설정

## 1. Railway에 올리기 (약 15분)

Railway는 GitHub 저장소를 연결하면 자동으로 빌드하고 주소를 만들어 준다. 이 저장소에는 `Dockerfile`과 `railway.json`이 들어 있어서 따로 설정할 빌드 명령이 없다.

1. **가입**: https://railway.com 에서 GitHub 계정으로 로그인한다. 처음에는 무료 체험 크레딧이 있고, 이후 Hobby 플랜(월 5달러 수준)이면 충분하다.
2. **프로젝트 만들기**: `New Project` → `Deploy from GitHub repo` → `youchan79/-` 선택.
   - 브랜치는 PR을 머지하기 전이면 `ccr-eed69f99-nfucy9`, 머지한 뒤면 `main`. 서비스의 `Settings` → `Source`에서 바꿀 수 있다.
3. **볼륨 붙이기 (필수)**: 서비스를 오른쪽 클릭 또는 `Settings` → `Volumes` → `Add Volume`, 마운트 경로는 `/data`.
   볼륨이 없으면 재배포할 때마다 가입자, 자료, 결제 기록이 모두 지워진다.
4. **환경 변수 넣기**: 서비스의 `Variables` 탭 → `Raw Editor`에 아래를 붙여 넣고 값을 채운다.

   ```
   NODE_ENV=production
   DATA_DIR=/data
   SESSION_SECRET=아무_긴_랜덤_문자열_40자_이상
   ADMIN_KEY=관리자_화면_비밀번호
   ANTHROPIC_API_KEY=Claude_API_키
   CLAUDE_MODEL=claude-haiku-5-5
   SERVICE_NAME=스터디AI
   BIZ_NAME=스터디AI
   BIZ_OWNER=판매자_이름
   BIZ_ADDRESS=주소
   BIZ_PHONE=연락처
   BIZ_EMAIL=이메일
   BIZ_PRIVACY_OFFICER=개인정보_보호책임자_이름
   # 아래는 받는 대로 추가
   PAYAPP_USERID=
   PAYAPP_LINKKEY=
   PAYAPP_LINKVAL=
   PAYAPP_REQUESTKEY=
   META_PIXEL_ID=
   META_CAPI_TOKEN=
   ```

   페이앱과 픽셀 값이 비어 있어도 서버는 뜬다. 그동안 결제 버튼만 막힌다.
5. **주소 만들기**: `Settings` → `Networking` → `Generate Domain`. `https://무엇.up.railway.app` 주소가 생기면
   `Variables`에 `APP_URL=https://무엇.up.railway.app` 를 추가한다. 변수를 바꾸면 자동으로 다시 배포된다.
   페이앱 결제통보가 이 주소의 `/api/payapp/feedback`으로 오기 때문에 `APP_URL`은 꼭 실제 주소여야 한다.
6. **확인**
   - `https://주소/` 랜딩, `https://주소/home` 앱이 열리는지
   - `https://주소/admin` 에서 `ADMIN_KEY`로 들어가지는지
   - 페이앱 키를 넣은 뒤: 직접 9,900원 결제 → 구독 페이지에서 "평생 Pro 이용 중"으로 바뀌는지 → 페이앱 판매자 사이트에서 결제 취소 → 다시 기본 플랜으로 돌아오는지

나중에 자체 도메인(예: studyai.kr)을 쓰려면 `Settings` → `Networking` → `Custom Domain`에 넣고, 도메인 업체의 DNS에 Railway가 알려 주는 CNAME을 추가한 뒤 `APP_URL`을 그 도메인으로 바꾼다.

## 2. 메타 픽셀 ID 만들기 (약 10분)

1. https://business.facebook.com 에 들어가 비즈니스 포트폴리오를 만든다 (이미 있으면 건너뛴다).
2. 왼쪽 메뉴 `이벤트 관리자`(Events Manager) → `데이터 소스 연결` → `웹` → 이름(예: 스터디AI) 입력 → `픽셀 만들기`.
3. 웹사이트 주소를 물으면 Railway 주소를 넣고, 설치 방법은 `코드 직접 설치`를 골라 창을 닫는다. 코드는 이미 앱에 들어 있다.
4. 데이터 소스 목록의 숫자 15~16자리가 **픽셀 ID**다. Railway 변수 `META_PIXEL_ID`에 넣는다.
5. (권장) **전환 API 토큰**: 이벤트 관리자 → 방금 만든 픽셀 → `설정` 탭 → `전환 API` → `액세스 토큰 생성`. 나온 값을 `META_CAPI_TOKEN`에 넣는다. 브라우저 광고 차단이나 iOS에서 빠지는 구매를 서버가 대신 보낸다.
6. **테스트**: 이벤트 관리자 → 픽셀 → `이벤트 테스트` 탭 → 테스트 코드(TEST12345 같은 값)를 `META_TEST_EVENT_CODE`에 잠깐 넣고, 사이트에서 가입 → 결제를 해 본다. `PageView`, `CompleteRegistration`, `InitiateCheckout`, `Purchase`가 들어오면 성공. 확인한 뒤 `META_TEST_EVENT_CODE`는 지운다.
7. 광고는 `Purchase`(구매)를 전환 이벤트로 최적화한다. 결제가 아직 안 되면 처음 며칠은 `CompleteRegistration`(가입)으로 시작해도 된다.

자체 도메인을 붙인 뒤에는 비즈니스 설정 → `브랜드 가치 보호` → `도메인`에서 도메인 인증을 해 두면 iOS 사용자의 구매 측정이 안정된다.
