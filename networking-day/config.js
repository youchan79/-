// 오늘의 5명 설정 파일
// firebase가 null이면 시연 모드(예시 프로필 34명, 이 기기에만 저장)로 동작합니다.
// 실제 행사에서는 Firebase 콘솔의 [프로젝트 설정 > 내 앱 > SDK 설정 및 구성]에서
// firebaseConfig 값을 복사해 아래 firebase: null 자리에 붙여넣으세요. (README.md 3단계)
window.ND_CONFIG = {
  eventId: 'physical-ai-networking-day-2026',
  maxLikes: 5,   // 대화하고 싶은 사람을 이만큼 고르면 스와이프가 끝납니다
  capacity: 35,  // 운영자 화면에 표시하는 최대 인원

  firebase: null,
  // firebase: {
  //   apiKey: '...',
  //   authDomain: '...',
  //   projectId: '...',
  //   storageBucket: '...',
  //   messagingSenderId: '...',
  //   appId: '...',
  // },
};
