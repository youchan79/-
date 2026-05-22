/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { ErrandJob, CategoryType, ChatMessage, UserProfile } from "./types";
import { AndroidFrame } from "./components/AndroidFrame";
import { BottomSheet } from "./components/BottomSheet";
import { CountUpText } from "./components/CountUpText";
import { 
  Bell, 
  ChevronRight, 
  MapPin, 
  Clock, 
  Sparkles, 
  Coins, 
  HelpCircle, 
  Plus, 
  MessageCircle, 
  User as UserIcon, 
  Home as HomeIcon, 
  Send, 
  ClipboardCheck, 
  Navigation, 
  Check, 
  AlertCircle,
  TrendingDown,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// 8 initial Korean high-fidelity mock data representing urgent odd-jobs
const INITIAL_JOBS: ErrandJob[] = [
  { 
    id: "job-1", 
    title: "화장실 휴지 급구 (급해요!)", 
    location: "역삼역 3번출구 150m", 
    startPrice: 15000, 
    currentPrice: 12000, 
    originalPrice: 12000,
    timeLeft: 240, 
    detail: "화장실 안에 휴지가 정말 똑 떨어졌습니다. 주변 편의점에서 롤휴지 3개 이상만 사다 문앞에 놔주시면 됩니다. 노크 2번만 해주시면 나가서 챙기겠습니다.", 
    category: "심부름", 
    status: "bidding", 
    bidsCount: 3 
  },
  { 
    id: "job-2", 
    title: "생수 2L 6개입 4층 문앞 전송 (엘베 없음)", 
    location: "도보 300m 단독주택", 
    startPrice: 20000, 
    currentPrice: 17500, 
    originalPrice: 17500,
    timeLeft: 480, 
    detail: "생수 배달이 평지에서 멈췄어요. 4층 계단 지옥이라 들고 올라가기에 힘이 부쳐 요청합니다. 무거우니 손쉬운 짐끌개나 캐리어 지참 추천해 드립니다.", 
    category: "짐옮기기", 
    status: "bidding", 
    bidsCount: 2 
  },
  { 
    id: "job-3", 
    title: "싱크대 배수구 벌레 퇴치 및 마개 교체", 
    location: "강남역 서희스타힐스", 
    startPrice: 35000, 
    currentPrice: 31000, 
    originalPrice: 31000,
    timeLeft: 180, 
    detail: "배수구 틈새에 초파리랑 날벌레가 나와서 너무 고통받고 있어요. 벌레약 뿌려주시고 냄새 안 나는 차단 트랩 및 다이소 스테인리스 마개로 교체 바랍니다.", 
    category: "벌레잡기", 
    status: "bidding", 
    bidsCount: 4 
  },
  { 
    id: "job-4", 
    title: "이케아 옷장 문짝 댐퍼 조립 보조", 
    location: "역삼 래미안 펜타즈", 
    startPrice: 40000, 
    currentPrice: 38000, 
    originalPrice: 38000,
    timeLeft: 600, 
    detail: "조립 설명서를 보는데 도저히 나사 조이고 수평 맞추는 걸 혼자 할 수 없어 보조해 주실 분 급구합니다. 십자 드라이버는 구비되어 있지만 전동 공구 있으시면 좋습니다.", 
    category: "생활수리", 
    status: "bidding", 
    bidsCount: 1 
  },
  { 
    id: "job-5", 
    title: "스타벅스 아이스 아메리카노 벤티 2잔 배달", 
    location: "도보 120m 오피스텔 7층", 
    startPrice: 12000, 
    currentPrice: 9500, 
    originalPrice: 9500,
    timeLeft: 120, 
    detail: "급한 회의 준비로 자리를 뜰 수 없습니다. 근처 아크플레이스점 스타벅스에서 벤티 사이즈 2잔 (기본) 픽업하셔서 문앞에 비대면 전달해주세요.", 
    category: "심부름", 
    status: "bidding", 
    bidsCount: 5 
  },
  { 
    id: "job-6", 
    title: "침실 구석에 침입한 대형 나방 생포 요청", 
    location: "도보 450m 프루지오", 
    startPrice: 25000, 
    currentPrice: 22000, 
    originalPrice: 22000,
    timeLeft: 150, 
    detail: "창문 틈으로 주먹 만한 갈색 날개 나방이 날아들어 커튼 뒤에 숨었습니다. 나방 포획하고 안전하게 방생해 주실 용사 서포터님만 모십니다.", 
    category: "벌레잡기", 
    status: "bidding", 
    bidsCount: 3 
  },
  { 
    id: "job-7", 
    title: "약국 소화제 시럽 및 해열 진통제 신속 구매", 
    location: "강남역 2번출구 인근 오피스텔", 
    startPrice: 18000, 
    currentPrice: 16000, 
    originalPrice: 16000,
    timeLeft: 300, 
    detail: "체한 데다가 미열이 나 너무 어지러워서 바깥으로 한 걸음도 걸어 나갈 수 없어요. 해열 소화제 가루약 또는 참 시럽 구매하셔서 초인종 눌러주시고 두고 가세요.", 
    category: "심부름", 
    status: "bidding", 
    bidsCount: 2 
  },
  { 
    id: "job-8", 
    title: "공동현관 비밀번호 설정 패널 접촉 불량 임시수리", 
    location: "도보 500m 원룸텔", 
    startPrice: 60000, 
    currentPrice: 55000, 
    originalPrice: 55000,
    timeLeft: 900, 
    detail: "공동 현관문 도어락이 종종 지익 소리가 나며 눌리지 않는 증상입니다. 배선 접촉 상태 간단히 확인하고 임시 조치해 주실 맥가이버님 찾습니다.", 
    category: "생활수리", 
    status: "bidding", 
    bidsCount: 1 
  }
];

// Suggested optimized routes dataset
const RECOMMENDED_ROUTE = {
  title: "역삼 허브 동선 묶어 처리",
  elements: ["스타벅스 커피 배달", "화장실 휴지 급구"],
  totalProfit: 38000,
  walkingMin: 12,
  pins: [
    { x: 45, y: 70, label: "출발" },
    { x: 55, y: 50, label: "1. 스타벅스" },
    { x: 75, y: 45, label: "2. 휴지 편의점" },
    { x: 65, y: 25, label: "3. 최종 전달" }
  ]
};

// Simulated messages dataset
const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  { id: "msg-1", sender: "partner", text: "안녕하세요 서포터님! 역경매에 낙찰되셔서 감사해요. 물건은 언제쯤 매장에 도착하시나요?", timestamp: "오후 12:56" },
  { id: "msg-2", sender: "user", text: "안녕하세요! 매장에 거의 도착했습니다. 구매해서 3분 뒤 배달 시작하겠습니다.", timestamp: "오후 12:57" },
  { id: "msg-3", sender: "partner", text: "네! 문 앞에 고리 걸개에 두고 벨 눌러주시면 바로 가져갈게요.", timestamp: "오후 12:57" }
];

export default function App() {
  // Navigation & Screen Control
  const [activeTab, setActiveTab] = useState<"home" | "request" | "ai_map" | "profile">("home");
  const [selectedJob, setSelectedJob] = useState<ErrandJob | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // Core Simulation States
  const [jobs, setJobs] = useState<ErrandJob[]>(INITIAL_JOBS);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: "수민",
    points: 23000,
    rating: 4.9,
    completedErrandsCount: 14
  });

  // Recent update logs to simulate real-time notification overlays
  const [recentNotification, setRecentNotification] = useState<string | null>(null);
  // Track currently pulsing job ID for prices ticking down
  const [pulseJobId, setPulseJobId] = useState<string | null>(null);

  // Chat simulator state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [typedMessage, setTypedMessage] = useState("");
  const [activeActivityToggle, setActiveActivityToggle] = useState<"requested" | "helped">("helped");

  // Registration Form state flow
  const [formStep, setFormStep] = useState(1);
  const [reqCategory, setReqCategory] = useState<CategoryType>("심부름");
  const [reqTitle, setReqTitle] = useState("");
  const [reqLocation, setReqLocation] = useState("도보 180m 근처 오피스텔");
  const [reqDetail, setReqDetail] = useState("");
  const [reqStartPrice, setReqStartPrice] = useState(30000);
  const [reqDuration, setReqDuration] = useState(15);

  const minWithdrawal = 5000;

  // Real-time Countdown interval & Reverse-auction price updater
  useEffect(() => {
    const timer = setInterval(() => {
      // 1. Tick down time on bidding errands
      setJobs(prevJobs => 
        prevJobs.map(job => {
          if (job.status === "bidding" && job.timeLeft > 0) {
            return { ...job, timeLeft: job.timeLeft - 1 };
          }
          return job;
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Background bid decrease loop (5-8 seconds)
  useEffect(() => {
    const bidCycle = setInterval(() => {
      // Choose a random available job to bid down
      const activeBiddingJobs = jobs.filter(j => j.status === "bidding" && j.timeLeft > 10);
      if (activeBiddingJobs.length === 0) return;

      const randomIndex = Math.floor(Math.random() * activeBiddingJobs.length);
      const chosenJob = activeBiddingJobs[randomIndex];

      // Reduce price by a random step (e.g. 500 ~ 2000 KRW)
      const priceReduction = Math.floor(Math.random() * 4 + 1) * 500;
      const targetNewPrice = Math.max(2000, chosenJob.currentPrice - priceReduction);

      if (targetNewPrice < chosenJob.currentPrice) {
        setJobs(prevJobs => 
          prevJobs.map(job => {
            if (job.id === chosenJob.id) {
              return { 
                ...job, 
                originalPrice: job.currentPrice,
                currentPrice: targetNewPrice, 
                bidsCount: job.bidsCount + 1 
              };
            }
            return job;
          })
        );

        // Flash visual pulse dot on this row
        setPulseJobId(chosenJob.id);
        setRecentNotification(`[역경매 발생] "${chosenJob.title}"의 최저가 입찰이 ${targetNewPrice.toLocaleString()}원으로 인하되었습니다!`);
        
        // Clear pulse and banners after 3 seconds
        setTimeout(() => {
          setPulseJobId(null);
        }, 3000);
        setTimeout(() => {
          setRecentNotification(null);
        }, 4500);
      }
    }, 6500);

    return () => clearInterval(bidCycle);
  }, [jobs]);

  // Handle manually triggered bid simulation from left testing panel
  const triggerManualBiddingDown = () => {
    const biddingErrands = jobs.filter(j => j.status === "bidding");
    if (biddingErrands.length === 0) {
      setRecentNotification("현재 역경매가 유효하게 진행 중인 일감이 존재하지 않습니다.");
      return;
    }
    const target = biddingErrands[Math.floor(Math.random() * biddingErrands.length)];
    const deduction = 1500;
    const nextLimitPrice = Math.max(3000, target.currentPrice - deduction);

    setJobs(prev => 
      prev.map(j => {
        if (j.id === target.id) {
          return {
            ...j,
            originalPrice: j.currentPrice,
            currentPrice: nextLimitPrice,
            bidsCount: j.bidsCount + 1
          };
        }
        return j;
      })
    );
    setPulseJobId(target.id);
    setRecentNotification(`동기화 제어: "${target.title}" 의뢰 금액이 ${deduction.toLocaleString()}원 낮아졌습니다.`);
    setTimeout(() => setPulseJobId(null), 2500);
  };

  // State handlers inside app let users do mock operations
  // 1. Reset
  const handleResetAll = () => {
    setJobs(INITIAL_JOBS);
    setUserProfile({
      name: "수민",
      points: 23000,
      rating: 4.9,
      completedErrandsCount: 14
    });
    setChatMessages(INITIAL_CHAT_MESSAGES);
    setReqTitle("");
    setReqDetail("");
    setFormStep(1);
    setRecentNotification("모바일 앱 시뮬레이터 상태가 리셋되었습니다.");
  };

  // 2. Add points from panel
  const handleAddPoints = (pts: number) => {
    setUserProfile(prev => ({
      ...prev,
      points: prev.points + pts
    }));
    setRecentNotification(`시뮬레이터 잔액이 +${pts.toLocaleString()}원 증가했습니다.`);
  };

  // 3. User registers a new errand
  const handleCreateErrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;

    const newJob: ErrandJob = {
      id: `user-job-${Date.now()}`,
      title: reqTitle,
      location: reqLocation,
      startPrice: reqStartPrice,
      currentPrice: reqStartPrice,
      originalPrice: reqStartPrice,
      timeLeft: reqDuration * 60,
      detail: reqDetail || "추가 세부 사항이 없습니다. 신속한 연락바랍니다.",
      category: reqCategory,
      status: "bidding",
      bidsCount: 0,
      isUserCreated: true
    };

    setJobs(prev => [newJob, ...prev]);
    setRecentNotification(`새로운 역경매 일감이 등록되었습니다! (시작가: ${reqStartPrice.toLocaleString()}원)`);
    
    // Reset Form & Redirect to Home
    setReqTitle("");
    setReqDetail("");
    setFormStep(1);
    setActiveTab("home");
  };

  // 4. Accept / win errand
  const handleAcceptJob = (jobId: string) => {
    setJobs(prev => 
      prev.map(j => {
        if (j.id === jobId) {
          return { ...j, status: "matched", isUserAssigned: true };
        }
        return j;
      })
    );
    
    // Increment stats
    setUserProfile(prev => ({
      ...prev,
      completedErrandsCount: prev.completedErrandsCount + 1
    }));
  };

  // 5. Bid further low on existing errand
  const handlePlaceManualBid = (jobId: string, bidAmount: number) => {
    setJobs(prev => 
      prev.map(j => {
        if (j.id === jobId) {
          return { 
            ...j, 
            originalPrice: j.currentPrice, 
            currentPrice: bidAmount, 
            bidsCount: j.bidsCount + 1 
          };
        }
        return j;
      })
    );
    setRecentNotification(`내가 직접 최저가 입찰 제안을 등록했습니다: ${bidAmount.toLocaleString()}원`);
  };

  // 6. Withdraw user points
  const [showWithdrawLog, setShowWithdrawLog] = useState(false);
  const handleWithdrawPoints = () => {
    if (userProfile.points < minWithdrawal) return;
    const amt = userProfile.points;
    setUserProfile(prev => ({ ...prev, points: 0 }));
    setShowWithdrawLog(true);
  };

  // 7. Simulated chat reply
  const handleSendChatMessage = () => {
    if (!typedMessage.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      sender: "user",
      text: typedMessage,
      timestamp: "방금 전"
    };

    setChatMessages(prev => [...prev, userMsg]);
    setTypedMessage("");

    // Setup an interactive automatic custom customer reply after 1.5s
    setTimeout(() => {
      const answers = [
        "빠른 진행 정말 감사해요! 안전하게만 잘 도착해주세요 ㅎㅎ",
        "네 알겠습니다! 조심히 오시고 도착하셔서 문자 하나 남겨주시면 좋습니다.",
        "감사합니다. Toss 안심 보험이 연동되어 있어 너무 마음이 놓이네요!"
      ];
      const botMsg: ChatMessage = {
        id: `msg-b-${Date.now()}`,
        sender: "partner",
        text: answers[Math.floor(Math.random() * answers.length)],
        timestamp: "방금 전"
      };
      setChatMessages(prev => [...prev, botMsg]);
    }, 1500);
  };

  // Helper calculation for urgent indicator
  const getSpeedNotice = (price: number, duration: number) => {
    const ratio = price / duration;
    if (ratio > 2000) return { label: "매우 급함", style: "text-[#F04452] bg-red-50 border-red-100", eta: "예상 매칭 속도 2분 이내" };
    if (ratio > 1000) return { label: "급함", style: "text-amber-600 bg-amber-50 border-amber-100", eta: "예상 매칭 속도 5분 내외" };
    return { label: "보통", style: "text-[#4E5968] bg-gray-50 border-gray-100", eta: "예상 매칭 속도 10분 내외" };
  };

  const currentBiddingJobsCount = jobs.filter(j => j.status === "bidding").length;

  return (
    <AndroidFrame>
      {/* Real-time floating Notification Banner */}
      <AnimatePresence>
        {recentNotification && (
          <motion.div
            initial={{ opacity: 0, y: -25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -25 }}
            className="absolute top-12 inset-x-4 bg-[#191F28] text-white py-3 px-4.5 rounded-2xl text-xs font-bold shadow-xl z-50 flex items-center space-x-2 border border-white/5 opacity-98 leading-snug"
          >
            <TrendingDown className="w-4 h-4 text-[#3182F6] shrink-0" />
            <span className="flex-1">{recentNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content View Switcher */}
      {activeTab === "home" && (
        <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar bg-[#F2F4F6] pb-24 select-none">
          <div className="px-5 pt-5 pb-3">
            
            {/* Top Bar Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black text-[#191F28] tracking-tight">
                  급해요
                </span>
                <span className="px-1.5 py-0.5 bg-[#F04452] text-white text-[9px] font-extrabold rounded-md animate-pulse">
                  실시간
                </span>
              </div>
              
              <div className="relative p-2.5 bg-white/80 backdrop-blur-xs rounded-full cursor-pointer hover:bg-white active:scale-95 transition-all">
                <Bell className="w-4.5 h-4.5 text-[#4E5968]" />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#F04452] rounded-full" />
              </div>
            </div>

            {/* Core Summary Big Header Title */}
            <div className="mb-6 space-y-1 sm:px-1">
              <p className="text-[#8B95A1] text-xs font-bold uppercase tracking-wider">나의 동네 일자리 현황</p>
              <h2 className="text-[#191F28] text-xl font-extrabold tracking-tight leading-snug">
                지금 내 주변에 <span className="text-[#3182F6] font-black">{currentBiddingJobsCount}개</span>의<br />
                급한 일감이 입찰되고 있어요.
              </h2>
            </div>

            {/* Tiny quick routing card banner linking to Tab 3 for AI matching */}
            <div 
              onClick={() => setActiveTab("ai_map")}
              className="bg-white p-4 rounded-[22px] border border-black/5 mb-5 flex items-center justify-between cursor-pointer hover:border-[#3182F6]/30 hover:bg-[#3182F6]/2 transition-all shadow-xs"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-[#E8F3FF] rounded-2xl text-[#3182F6]">
                  <Navigation className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#191F28] tracking-tight">
                    근처 일감 묶어 수락하고 수익 높이기
                  </h4>
                  <p className="text-[10px] text-[#8B95A1] font-semibold mt-0.5">
                    동선 최적화 AI 매칭 제안 바로보기
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4.5 h-4.5 text-[#B0B8C1]" />
            </div>

            {/* List of Bid jobs feed cards */}
            <div className="space-y-3">
              {jobs.map((job) => {
                const isPulsed = pulseJobId === job.id;
                const isUserMade = job.isUserCreated;

                return (
                  <motion.div
                    key={job.id}
                    layoutId={`job-card-frame-${job.id}`}
                    onClick={() => {
                      setSelectedJob(job);
                      setIsBottomSheetOpen(true);
                    }}
                    className={`bg-white rounded-[24px] p-5 border cursor-pointer transition-all ${
                      job.status !== "bidding"
                        ? "opacity-60 border-gray-100"
                        : isPulsed
                        ? "border-[#3182F6] ring-2 ring-[#3182F6]/10 shadow-md bg-blue-50/10"
                        : isUserMade
                        ? "border-emerald-200 bg-emerald-50/5 hover:border-emerald-300"
                        : "border-black/5 hover:border-[#3182F6]/25 hover:shadow-md"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[#8B95A1] text-[10px] font-bold uppercase tracking-wider">
                            {job.category}
                          </span>
                          <span className="text-[9px] text-gray-400 font-semibold">•</span>
                          <span className="text-[#8B95A1] text-[10px] font-bold">
                            {job.location}
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-[#191F28] tracking-tight leading-snug">
                          {job.title}
                        </h4>
                      </div>

                      {/* Display user created label indicator */}
                      {isUserMade && (
                        <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md">
                          내가 요청한 일
                        </span>
                      )}
                    </div>

                    {/* Footer Row: price, countdown timer */}
                    <div className="flex justify-between items-center pt-3 border-t border-gray-50 mt-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-semibold text-[#8B95A1]">현재 역경매가</span>
                        <div className="flex items-baseline space-x-1">
                          <span className={`text-base font-extrabold transition-all ${isPulsed ? "text-[#F04452] scale-102" : "text-[#3182F6]"}`}>
                            {job.currentPrice.toLocaleString()}원
                          </span>
                        </div>
                        {isPulsed && (
                          <motion.span 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-[9px] text-[#F04452] font-semibold bg-red-50 px-1 py-0.2 rounded"
                          >
                            입찰다운
                          </motion.span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1.5 text-[#F04452] bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">
                        <Clock className="w-3 h-3 text-[#F04452] animate-pulse" />
                        <span className="text-[10px] font-bold tracking-tighter">
                          {job.timeLeft > 0 ? (
                            `${Math.floor(job.timeLeft / 60)}분 ${job.timeLeft % 60}초`
                          ) : (
                            "대기 시간 종료"
                          )}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "request" && (
        <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar bg-white pb-24 select-none">
          
          <form onSubmit={handleCreateErrand} className="px-5 pt-6 pb-4 flex flex-col flex-1">
            
            {/* Header Form Indicator */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-bold text-[#8B95A1]">역경매 의뢰서 만들기</span>
              <span className="text-xs font-extrabold text-[#3182F6]">단계 {formStep} / 3</span>
            </div>

            {/* Stepper Viewports */}
            {formStep === 1 && (
              <div className="space-y-6 flex-1">
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold text-[#191F28] tracking-tight">
                    어떤 종류의 소일거리를<br />의뢰하시겠어요?
                  </h2>
                  <p className="text-xs text-[#8B95A1]">카테고리를 누르시면 전용 가격 알고리즘이 추천됩니다.</p>
                </div>

                {/* Vertical visual grids/chips representing Category Choice */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {(["심부름", "짐옮기기", "생활수리", "벌레잡기", "기타"] as CategoryType[]).map((cat) => {
                    const isSelected = reqCategory === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setReqCategory(cat)}
                        className={`p-4.5 rounded-2xl text-left border cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-[#3182F6]/5 border-[#3182F6] text-[#3182F6]" 
                            : "bg-[#F9FAFB] border-black/5 hover:border-gray-200 text-[#4E5968]"
                        }`}
                      >
                        <span className="text-xs font-bold block">{cat}</span>
                        <span className="text-[10px] text-[#8B95A1] font-semibold block mt-1.5">
                          {cat === "심부름" && "구매대행, 커피배달"}
                          {cat === "짐옮기기" && "무거운 문앞 택배"}
                          {cat === "생활수리" && "문짝, 수전, 가구조립"}
                          {cat === "벌레잡기" && "나방, 모기 생포"}
                          {cat === "기타" && "그 외 긴급 편의 지원"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => setFormStep(2)}
                    className="w-full py-4 bg-[#3182F6] text-white font-extrabold rounded-2xl text-xs flex items-center justify-center space-x-1 shadow-sm"
                  >
                    <span>수정하기 및 다음 단계로</span>
                  </button>
                </div>
              </div>
            )}

            {formStep === 2 && (
              <div className="space-y-6 flex-1">
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold text-[#191F28] tracking-tight">
                    무엇을 도와드릴까요?
                  </h2>
                  <p className="text-xs text-[#8B95A1]">의뢰 내용을 구체적으로 적으시면 서포터 매칭이 더 원활해집니다.</p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#8B95A1] block">의뢰 제목 (핵심 요건)</label>
                    <input
                      type="text"
                      required
                      placeholder="예시) 싱크대 수전 교체 보조 급합니다"
                      value={reqTitle}
                      onChange={(e) => setReqTitle(e.target.value)}
                      className="w-full p-4.5 bg-[#F9FAFB] border border-black/5 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#3182F6] text-[#191F28]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#8B95A1] block">전달받을 비대면 위치</label>
                    <input
                      type="text"
                      placeholder="예시) 도보 150m 센트럴 아파트 104동 앞"
                      value={reqLocation}
                      onChange={(e) => setReqLocation(e.target.value)}
                      className="w-full p-4.5 bg-[#F9FAFB] border border-black/5 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#3182F6] text-[#191F28]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#8B95A1] block">상세 요구 사항 (의뢰 설명)</label>
                    <textarea
                      placeholder="요구 사항을 상세히 기재해 주세요. (조심해야 할 사항 등)"
                      rows={3}
                      value={reqDetail}
                      onChange={(e) => setReqDetail(e.target.value)}
                      className="w-full p-4 pb-12 bg-[#F9FAFB] border border-black/5 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#3182F6] text-[#191F28]"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-4">
                  <button
                    type="button"
                    onClick={() => setFormStep(1)}
                    className="py-4 px-6 bg-[#F2F4F6] text-[#4E5968] font-bold rounded-2xl text-xs cursor-pointer"
                  >
                    이전으로
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormStep(3)}
                    disabled={!reqTitle.trim()}
                    className="flex-1 py-4 bg-[#3182F6] text-white font-extrabold rounded-2xl text-xs disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed cursor-pointer"
                  >
                    다음 단계 (조건 설정)
                  </button>
                </div>
              </div>
            )}

            {formStep === 3 && (
              <div className="space-y-5 flex-1">
                <div className="space-y-1">
                  <h2 className="text-xl font-extrabold text-[#191F28] tracking-tight">
                    역경매 조건을<br />설정해 주세요
                  </h2>
                  <p className="text-xs text-[#8B95A1]">높은 시작가와 짧은 진행 시간일수록 매칭 확률이 증가합니다.</p>
                </div>

                {/* Start Price Slider Control */}
                <div className="bg-[#F9FAFB] p-4.5 rounded-[22px] border border-black/5 space-y-3 pt-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#4E5968] font-bold">얼마부터 시작할까요?</span>
                    <span className="text-base font-extrabold text-[#3182F6]">
                      {reqStartPrice.toLocaleString()}원
                    </span>
                  </div>

                  <input
                    type="range"
                    min={10000}
                    max={100000}
                    step={5000}
                    value={reqStartPrice}
                    onChange={(e) => setReqStartPrice(Number(e.target.value))}
                    className="w-full accent-[#3182F6] cursor-pointer"
                  />

                  <div className="flex justify-between text-[10px] text-[#8B95A1] font-bold">
                    <span>1만 원</span>
                    <span>추천 평균가 3.5만 원</span>
                    <span>10만 원</span>
                  </div>
                </div>

                {/* Duration Slider Control */}
                <div className="bg-[#F9FAFB] p-4.5 rounded-[22px] border border-black/5 space-y-3 pt-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#4E5968] font-bold">얼마 동안 진행할까요?</span>
                    <span className="text-base font-extrabold text-[#F04452]">
                      {reqDuration}분 동안 경쟁 유보
                    </span>
                  </div>

                  <input
                    type="range"
                    min={5}
                    max={30}
                    step={1}
                    value={reqDuration}
                    onChange={(e) => setReqDuration(Number(e.target.value))}
                    className="w-full accent-[#F04452] cursor-pointer"
                  />

                  <div className="flex justify-between text-[10px] text-[#8B95A1] font-bold">
                    <span>5분 (매우 다급함)</span>
                    <span>30분 (시간 여유)</span>
                  </div>
                </div>

                {/* Live Urgency calculation indicator block */}
                {(() => {
                  const notice = getSpeedNotice(reqStartPrice, reqDuration);
                  return (
                    <div className={`p-4 rounded-2xl border text-xs font-semibold leading-relaxed flex items-start space-x-2.5 ${notice.style}`}>
                      <Info className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-extrabold">급함 정도: {notice.label}</p>
                        <p className="text-[11px] opacity-85 mt-0.5">{notice.eta} (현재 책정한 요율 기준)</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-2.5 pt-4">
                  <button
                    type="button"
                    onClick={() => setFormStep(2)}
                    className="py-4 px-6 bg-[#F2F4F6] text-[#4E5968] font-bold rounded-2xl text-xs cursor-pointer"
                  >
                    이전으로
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-4 bg-[#3182F6] text-white font-extrabold rounded-2xl text-xs cursor-pointer hover:bg-[#1b64d6] transition-colors"
                  >
                    의뢰 등록 완료하기
                  </button>
                </div>
              </div>
            )}

          </form>
        </div>
      )}

      {activeTab === "ai_map" && (
        <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar bg-[#F2F4F6] pb-24 select-none">
          <div className="px-5 pt-5 pb-3">
            
            {/* Top Info Banner Header */}
            <div className="space-y-1 mb-5 sm:px-1">
              <span className="px-2.5 py-0.5 bg-[#3182F6]/10 text-[#3182F6] text-[10px] font-extrabold rounded-md block w-fit">
                AI 동선 최적화 서비스
              </span>
              <h2 className="text-[#191F28] text-xl font-extrabold tracking-tight pt-1">
                근처 일감 묶어 수락하기
              </h2>
              <p className="text-xs text-[#8B95A1] font-medium leading-relaxed">
                도보 이동 거리를 계산하여 동선 낭비 없이 고효율로 추천합니다.
              </p>
            </div>

            {/* High fidelity visual mock map grid drawing */}
            <div className="h-48 rounded-[24px] bg-[#E5E8EB]/80 border border-black/5 p-4 relative overflow-hidden shadow-inner flex items-center justify-center">
              
              {/* Map grid lines background */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#B0B8C1_1px,transparent_1px),linear-gradient(to_bottom,#B0B8C1_1px,transparent_1px)] bg-[size:40px_40px] opacity-15" />
              
              {/* Route line connectors */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <path
                  d="M 120 140 Q 180 110 240 100 T 200 40"
                  fill="none"
                  stroke="#3182F6"
                  strokeWidth="3.2"
                  strokeDasharray="6,4"
                  className="animate-pulse"
                />
              </svg>

              {/* Pins markers representation */}
              {RECOMMENDED_ROUTE.pins.map((pin, ix) => (
                <div 
                  key={ix}
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm ${
                    pin.label.includes("출발") ? "bg-[#3182F6]" : "bg-[#F04452]"
                  }`}>
                    {pin.label.substring(0, 1)}
                  </div>
                  <span className="bg-[#191F28] text-white text-[8px] px-1 py-0.5 rounded-sm font-semibold tracking-tighter mt-1 shadow-xs select-none">
                    {pin.label}
                  </span>
                </div>
              ))}

              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs py-1 px-2 rounded-lg border border-black/5 text-[9px] font-bold text-[#4E5968] flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>역삼 퓨전 GPS 오차범위 2m 이내</span>
              </div>
            </div>

            {/* Recommended Route elements detail card */}
            <div className="bg-white p-5 rounded-[24px] border border-black/5 my-4.5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-3.5 border-b border-gray-50">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#3182F6] tracking-tight uppercase">오늘의 매칭 코스</span>
                  <h3 className="text-base font-extrabold text-[#191F28] tracking-tight">
                    {RECOMMENDED_ROUTE.title}
                  </h3>
                </div>

                <div className="text-right">
                  <span className="text-xs text-[#8B95A1] font-semibold block">총 도출 수익</span>
                  <span className="text-base font-extrabold text-[#3182F6]">
                    {RECOMMENDED_ROUTE.totalProfit.toLocaleString()}원
                  </span>
                </div>
              </div>

              {/* Steps timeline listed cleanly */}
              <div className="space-y-4">
                <div className="flex items-start space-x-3 text-xs">
                  <div className="w-5 h-5 bg-[#3182F6]/10 text-[#3182F6] text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-[#191F28]">스타벅스 아메리카노 픽업 및 긴급 이송</p>
                    <p className="text-[10px] text-[#8B95A1] font-medium leading-normal">
                      인접 매장 픽업 후 오피스텔 우편함 배치 (이동: 도보 4분)
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 text-xs">
                  <div className="w-5 h-5 bg-amber-500/10 text-amber-600 text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-[#191F28]">문앞에 롤 롤휴지 전달하기</p>
                    <p className="text-[10px] text-[#8B95A1] font-medium leading-normal">
                      스타벅스 배달 장소에서 도보 200m 거리 주택 비대면 (이동: 도보 2분)
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Summary Row Info banner */}
              <div className="p-3 bg-gray-50 rounded-xl flex justify-between items-center text-[10px] text-[#4E5968] font-bold">
                <span>코스 전체 총 거리: 약 540m</span>
                <span className="text-[#3182F6]">시뮬레이션 예상 소요: {RECOMMENDED_ROUTE.walkingMin}분</span>
              </div>

              {/* Action Button: Accepts both errands and updates count */}
              <button
                onClick={() => {
                  // Direct score upgrade simulation
                  setUserProfile(prev => ({
                    ...prev,
                    points: prev.points + RECOMMENDED_ROUTE.totalProfit,
                    completedErrandsCount: prev.completedErrandsCount + 2
                  }));
                  setRecentNotification(`AI 패키지 매칭: 수락됨! 보상 +${RECOMMENDED_ROUTE.totalProfit.toLocaleString()}원이 적지 계좌에 안전하게 적립되었습니다.`);
                }}
                className="w-full py-4.5 bg-[#3182F6] hover:bg-[#1b64d6] text-white text-xs font-bold rounded-2xl flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-[#3182F6]/10"
              >
                <span>이 최적 동선 한 번에 수락하기</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {activeTab === "profile" && (
        <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar bg-[#F2F4F6] pb-24 select-none">
          <div className="px-5 pt-5 pb-3">
            
            {/* Top User Header Card */}
            <div className="bg-white p-5 rounded-[24px] border border-black/5 shadow-sm space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-tr from-[#3182F6] to-[#60A5FA] rounded-full flex items-center justify-center text-white text-lg font-black shadow-inner">
                  {userProfile.name[0]}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-base font-extrabold text-[#191F28]">
                      {userProfile.name} 서포터님
                    </h3>
                  </div>

                  <p className="text-[11px] text-[#8B95A1] font-bold">
                    평가 만족도 {userProfile.rating}★ · 역경매 완료 {userProfile.completedErrandsCount}회
                  </p>
                </div>
              </div>

              {/* Points panel */}
              <div className="pt-3.5 border-t border-gray-100 flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-[#8B95A1] block uppercase">내 지갑 가용 잔액</span>
                  <span className="text-xl font-black text-[#3182F6] tracking-tight">
                    {userProfile.points.toLocaleString()}원
                  </span>
                </div>

                <button
                  onClick={handleWithdrawPoints}
                  disabled={userProfile.points < minWithdrawal}
                  className={`py-2 px-4.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                    userProfile.points >= minWithdrawal
                      ? "bg-[#3182F6] text-white hover:bg-[#1b64d6]"
                      : "bg-[#F2F4F6] text-[#B0B8C1] cursor-not-allowed"
                  }`}
                >
                  출금하기
                </button>
              </div>

              {/* Show withdrawal instructions */}
              {userProfile.points < minWithdrawal && (
                <p className="text-[10px] text-[#8B95A1] font-semibold text-center tracking-tight">
                  심부름을 수락하여 포인트를 모으면 즉시 이체할 수 있습니다. (최소 5천원)
                </p>
              )}
            </div>

            {/* Custom Withdraw Action modal logs */}
            {showWithdrawLog && (
              <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl border border-emerald-200 mt-3 text-xs space-y-1">
                <p className="font-bold flex items-center">
                  <Check className="w-4 h-4 mr-1 text-emerald-600" /> 가상 송금 프로세스 시작됨
                </p>
                <p className="text-[11px] opacity-90">선택하신 은행의 본인 계좌로 수수료 제로 즉시 이체가 승인되었습니다.</p>
                <button 
                  onClick={() => setShowWithdrawLog(false)}
                  className="mt-1 text-xs text-[#3182F6] font-bold block underline"
                >
                  명세서 닫기
                </button>
              </div>
            )}

            {/* Toggle tabs on User Activities */}
            <div className="flex bg-[#E5E8EB]/50 p-1.5 rounded-2xl border border-black/5 mt-5">
              <button
                onClick={() => setActiveActivityToggle("helped")}
                className={`flex-1 py-2 font-bold text-xs rounded-xl cursor-pointer ${
                  activeActivityToggle === "helped" ? "bg-white text-[#191F28]" : "text-[#8B95A1]"
                }`}
              >
                내가 도와준 일 (채팅 시뮬레이션)
              </button>
              <button
                onClick={() => setActiveActivityToggle("requested")}
                className={`flex-1 py-2 font-bold text-xs rounded-xl cursor-pointer ${
                  activeActivityToggle === "requested" ? "bg-white text-[#191F28]" : "text-[#8B95A1]"
                }`}
              >
                내가 요청한 일
              </button>
            </div>

            {/* Simulated Live Chat interaction panel beneath toggle */}
            {activeActivityToggle === "helped" ? (
              <div className="bg-white rounded-[24px] border border-black/5 mt-4 p-4.5 shadow-sm space-y-4">
                
                {/* Active Partner header info */}
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-extrabold text-[#191F28]">실시간 상담방 (역삼 오피스 고객)</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#E5E8EB] bg-[#4E5968] py-0.5 px-2 rounded-full">Toss Safe</span>
                </div>

                {/* Animated Chat Log Scrollable mock */}
                <div className="space-y-2.5 h-48 overflow-y-auto pr-1 no-scrollbar text-xs">
                  {chatMessages.map((msg) => {
                    const isMe = msg.sender === "user";
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 ${
                          isMe 
                            ? "bg-[#3182F6] text-white font-bold rounded-tr-sm" 
                            : "bg-[#F2F4F6] text-[#191F28] font-medium rounded-tl-sm"
                        }`}>
                          <p className="leading-relaxed">{msg.text}</p>
                          <span className="text-[8px] opacity-75 mt-1 block text-right">{msg.timestamp}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Simulated quick message chips */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {[
                    "지금 출발하고 있습니다!",
                    "물건 구매해서 도보로 가고 있어요.",
                    "집 앞에 잘 보관해 두었습니다!"
                  ].map((phrase, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTypedMessage(phrase)}
                      className="px-2.5 py-1 text-[10px] font-bold bg-[#E8F3FF] text-[#3182F6] border border-[#3182F6]/5 rounded-full shrink-0 hover:bg-blue-100 transition-colors"
                    >
                      {phrase}
                    </button>
                  ))}
                </div>

                {/* Chat input block */}
                <div className="flex items-center space-x-2 pt-2 border-t border-gray-50">
                  <input
                    type="text"
                    placeholder="고객에게 안심 메시지 전송..."
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSendChatMessage(); }}
                    className="flex-1 p-3 bg-gray-50 border border-black/5 rounded-xl text-xs font-medium focus:outline-none focus:border-[#3182F6]"
                  />
                  <button
                    onClick={handleSendChatMessage}
                    className="p-3 bg-[#3182F6] text-white rounded-xl hover:bg-[#1b64d6] cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {jobs.filter(j => j.isUserCreated).length === 0 ? (
                  <div className="bg-white p-8 text-center rounded-[24px] border border-black/5 text-xs text-[#8B95A1] space-y-2">
                    <p className="font-bold">내가 등록한 의뢰가 아직 없습니다.</p>
                    <button
                      onClick={() => setActiveTab("request")}
                      className="text-[#3182F6] font-bold text-xs underline"
                    >
                      첫 의뢰서 작성해보기
                    </button>
                  </div>
                ) : (
                  jobs.filter(j => j.isUserCreated).map((job) => (
                    <div key={job.id} className="bg-white p-5 rounded-[24px] border border-black/5 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-[#8B95A1] bg-[#F2F4F6] px-2 py-0.5 rounded-md">
                          진행 상황: 역경매 입찰 대기중
                        </span>
                        <span className="text-xs font-bold text-[#3182F6]">
                          {job.currentPrice.toLocaleString()}원
                        </span>
                      </div>
                      
                      <h4 className="text-sm font-bold text-[#191F28]">{job.title}</h4>
                      <p className="text-xs text-[#8B95A1] font-semibold">인접 매칭 입찰 횟수: {job.bidsCount}회</p>
                    </div>
                  ))
                )}
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* Floating Bottom Nav bar representing standard system screens */}
      <div className="absolute bottom-0 inset-x-0 h-20 bg-white/94 backdrop-blur-md border-t border-gray-100 flex items-center justify-around px-2 z-40 select-none">
        
        <button
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activeTab === "home" ? "text-[#3182F6]" : "text-[#B0B8C1] hover:text-[#8B95A1]"
          }`}
        >
          <HomeIcon className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-bold mt-1 tracking-tight">홈 피드</span>
        </button>

        <button
          onClick={() => {
            setFormStep(1);
            setActiveTab("request");
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activeTab === "request" ? "text-[#3182F6]" : "text-[#B0B8C1] hover:text-[#8B95A1]"
          }`}
        >
          <Plus className="w-[22px] h-[22px] bg-[#3182F6]/5 rounded-lg p-0.5" />
          <span className="text-[10px] font-bold mt-1 tracking-tight">의뢰하기</span>
        </button>

        <button
          onClick={() => setActiveTab("ai_map")}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activeTab === "ai_map" ? "text-[#3182F6]" : "text-[#B0B8C1] hover:text-[#8B95A1]"
          }`}
        >
          <Navigation className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-bold mt-1 tracking-tight">동선Optimizer</span>
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activeTab === "profile" ? "text-[#3182F6]" : "text-[#B0B8C1] hover:text-[#8B95A1]"
          }`}
        >
          <MessageCircle className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-bold mt-1 tracking-tight">내 활동</span>
        </button>

      </div>

      {/* Slide Up Bottom Sheet Detail Modal */}
      <BottomSheet 
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        selectedJob={selectedJob}
        onAcceptJob={handleAcceptJob}
        onPlaceManualBid={handlePlaceManualBid}
      />

    </AndroidFrame>
  );
}
