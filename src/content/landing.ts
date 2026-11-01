/*
 * 랜딩의 대학 로고 줄과 사용자 리뷰 섹션에 들어갈 내용.
 * 비어 있으면 같은 자리에 빈 틀(자리 표시)이 나온다. 실제로 확인한 것만 넣는다.
 * - 대학 로고: 실제 이용자가 있는 학교, 로고 사용이 가능한 이미지 (public/schools/ 아래에 두고 경로를 적는다)
 * - 리뷰: 스터디AI 사용자가 실제로 남긴 리뷰
 */

export interface SchoolLogo {
  name: string;
  src: string; // 예: '/schools/korea.png'
}

export interface Review {
  title: string;
  body: string;
  source: string; // 예: '앱스토어 리뷰', '설문 응답'
}

export const SCHOOL_LOGOS: SchoolLogo[] = [];

export const REVIEWS: Review[] = [];
