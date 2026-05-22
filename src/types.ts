export type CategoryType = "심부름" | "짐옮기기" | "생활수리" | "벌레잡기" | "기타";

export interface ErrandJob {
  id: string;
  title: string;
  location: string;
  startPrice: number;
  currentPrice: number;
  originalPrice: number; // For reverse matching comparison animations
  timeLeft: number;     // countdown seconds
  detail: string;
  category: CategoryType;
  status: "bidding" | "matched" | "completed";
  bidsCount: number;
  isUserCreated?: boolean;
  isUserAssigned?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "partner";
  text: string;
  timestamp: string;
}

export interface UserProfile {
  name: string;
  points: number;
  rating: number;
  completedErrandsCount: number;
}
