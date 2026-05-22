import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ErrandJob } from "../types";
import { Check, Loader2, Sparkles, MapPin, Clock, Coins, ShieldAlert, Award, ArrowRight, CheckCircle2 } from "lucide-react";
import { CountUpText } from "./CountUpText";

// Requirement 4: High fidelity virtual SVG path track map
const LivePathMap: React.FC = () => {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] my-3 overflow-hidden">
      <p className="text-xs text-[#8B95A1] mb-3 font-semibold">동네보안관 헬퍼가 요청자님께 이동 중입니다</p>
      <div className="relative w-full h-32 bg-[#F9FAFB] rounded-xl flex items-center justify-center">
        <svg className="w-full h-full px-6" viewBox="0 0 300 100">
          {/* 전체 가이드 점선 */}
          <path
            d="M 40 50 Q 150 10 260 50"
            fill="none"
            stroke="#E5E8EB"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* 부드럽게 흐르는 빛 애니메이션 */}
          <path
            d="M 40 50 Q 150 10 260 50"
            fill="none"
            stroke="#3182F6"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="15 150"
            className="animate-[dash_2.5s_linear_infinite]"
          />
          {/* 출발지 핀 (헬퍼) */}
          <circle cx="40" cy="50" r="7" fill="#3182F6" className="animate-pulse" />
          {/* 도착지 핀 (나) */}
          <circle cx="260" cy="50" r="7" fill="#00B06B" />
        </svg>
        <style>{`
          @keyframes dash {
            to {
              stroke-dashoffset: -165;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

// Requirement 3 helper: Get total starting time to calculate timer gauge percentage
const getTotalLimit = (job: ErrandJob) => {
  if (job.id === "job-1") return 240;
  if (job.id === "job-2") return 480;
  if (job.id === "job-3") return 180;
  if (job.id === "job-4") return 600;
  if (job.id === "job-5") return 120;
  if (job.id === "job-6") return 150;
  if (job.id === "job-7") return 300;
  if (job.id === "job-8") return 900;
  return 900; // Fallback
};

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedJob: ErrandJob | null;
  onAcceptJob: (jobId: string) => void;
  onPlaceManualBid: (jobId: string, bidAmount: number) => void;
  onStartPayment?: (job: ErrandJob) => void; // Link to Toss Multi-step Payment modal
}

export function BottomSheet({ 
  isOpen, 
  onClose, 
  selectedJob, 
  onAcceptJob, 
  onPlaceManualBid,
  onStartPayment
}: BottomSheetProps) {
  const [bidValue, setBidValue] = useState<number>(0);
  const [viewState, setViewState] = useState<"detail" | "bidding_action" | "matched_success">("detail");
  const [biddingProcess, setBiddingProcess] = useState(false);

  useEffect(() => {
    if (selectedJob) {
      setViewState("detail");
      setBidValue(Math.max(3000, selectedJob.currentPrice - 1000));
    }
  }, [selectedJob, isOpen]);

  if (!selectedJob) return null;

  // Render countdown format: minutes & seconds
  const formatTime = (secs: number) => {
    if (secs <= 0) return "종료됨";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}분 ${s}초`;
  };

  const handleManualBidSubmit = () => {
    setBiddingProcess(true);
    setTimeout(() => {
      onPlaceManualBid(selectedJob.id, bidValue);
      setBiddingProcess(false);
      setViewState("detail");
    }, 1200);
  };

  const handleInstantAccept = () => {
    setBiddingProcess(true);
    setTimeout(() => {
      onAcceptJob(selectedJob.id);
      setBiddingProcess(false);
      setViewState("matched_success");
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!biddingProcess && viewState !== "matched_success") onClose();
            }}
            className="absolute inset-0 bg-black/60 cursor-pointer"
          />

          {/* Bottom Sheet Modal Panel */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 24, stiffness: 200 }}
            className="relative bg-white pb-8 px-6 rounded-t-[28px] shadow-2xl z-50 overflow-hidden select-none"
          >
            {/* Grab Handle */}
            <div className="w-12 h-1 bg-[#E5E8EB] rounded-full mx-auto my-3.5" />

            {viewState === "detail" && (
              <div className="space-y-4 py-2">
                {/* Header Tag / Action Header */}
                <div className="flex justify-between items-center">
                  {selectedJob.status === "bidding" ? (
                    <span className="px-3 py-1 bg-[#3182F6]/10 text-[#3182F6] text-[11px] font-bold rounded-full uppercase tracking-tighter">
                      {selectedJob.category} · 역경매 진행중
                    </span>
                  ) : selectedJob.status === "matched" ? (
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-600 text-[11px] font-bold rounded-full uppercase tracking-tighter animate-pulse">
                      {selectedJob.category} · 실시간 매칭 완료
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[11px] font-bold rounded-full uppercase tracking-tighter">
                      {selectedJob.category} · 안심정산 완료
                    </span>
                  )}
                  
                  {selectedJob.status === "bidding" ? (
                    <div className="flex items-center space-x-1.5 text-[#F04452]">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-extrabold tracking-tight">
                        {formatTime(selectedJob.timeLeft)} 남음
                      </span>
                    </div>
                  ) : selectedJob.status === "matched" ? (
                    <div className="flex items-center space-x-1.5 text-amber-500 font-bold text-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse mr-1" />
                      <span>헬퍼 이동중</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-emerald-500 font-bold text-xs">
                      <Check className="w-4 h-4" />
                      <span>대금 지급 완료</span>
                    </div>
                  )}
                </div>

                {/* Real-time Dynamic Gauge Bar inside detail sheet if status is bidding */}
                {selectedJob.status === "bidding" && (
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full bg-[#E5E8EB] h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          selectedJob.timeLeft <= 180 ? "bg-[#F04452] animate-pulse" : "bg-[#3182F6]"
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, (selectedJob.timeLeft / getTotalLimit(selectedJob)) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#8B95A1] font-bold">
                      <span>경매 진행률</span>
                      <span className={selectedJob.timeLeft <= 180 ? "text-[#F04452] animate-pulse font-extrabold" : "text-[#3182F6]"}>
                        {selectedJob.timeLeft <= 180 ? "⚠️ 마감 임박 (3분 이내)" : "안심 최저가 입찰 경쟁 중"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Errand Title */}
                <div className="space-y-1.5 pt-1">
                  <h2 className="text-xl font-extrabold text-[#191F28] tracking-tight leading-snug">
                    {selectedJob.title}
                  </h2>
                  <div className="flex items-center space-x-1.5 text-[#8B95A1] text-xs font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-[#B0B8C1]" />
                    <span>{selectedJob.location} 내 위치와 인접</span>
                  </div>
                </div>

                {/* Live Path Map Overlay if Matched */}
                {selectedJob.status === "matched" && <LivePathMap />}

                {/* Description Body Card */}
                <div className="bg-[#F9FAFB] p-4.5 rounded-[20px] border border-black/5 text-xs text-[#4E5968] leading-relaxed font-medium space-y-2">
                  <p>{selectedJob.detail}</p>
                  
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-[#8B95A1] font-bold">
                    <span>매칭 수수료 면제 대상</span>
                    <span className="text-[#3182F6] flex items-center">
                      무료 혜택 적용됨 <Sparkles className="w-3 h-3 ml-1 fill-current" />
                    </span>
                  </div>
                </div>

                {/* Starting Price vs Current Lowest Bid Price Row */}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="p-4 bg-gray-50 rounded-2xl space-y-0.5 border border-black/5">
                    <span className="text-[10px] font-bold text-[#8B95A1] block">시작가</span>
                    <span className="text-sm font-bold text-[#8B95A1] line-through">
                      {selectedJob.startPrice.toLocaleString()}원
                    </span>
                  </div>

                  <div className={`p-4 rounded-2xl space-y-0.5 border relative overflow-hidden ${
                    selectedJob.status === "completed" 
                      ? "bg-emerald-50/50 border-emerald-100 text-emerald-600" 
                      : "bg-[#3182F6]/5 border-[#3182F6]/10 text-[#3182F6]"
                  }`}>
                    <span className="text-[10px] font-bold block animate-fade">
                      {selectedJob.status === "completed" ? "최종 지급 금액 (안심 페이)" : "현재 매칭 최저가 (경매가)"}
                    </span>
                    <div className="text-base font-extrabold tracking-tight flex items-center space-x-1">
                      <CountUpText value={selectedJob.currentPrice} suffix="원" />
                      {selectedJob.status === "completed" && (
                        <Check className="w-4 h-4 text-emerald-500 stroke-[3px]" />
                      )}
                    </div>
                    {selectedJob.status === "bidding" && (
                      /* Pulsing micro-dot indicator */
                      <span className="absolute top-3 right-3 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3182F6] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3182F6]"></span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Choice buttons depending on status */}
                {selectedJob.status === "bidding" && (
                  <>
                    <p className="text-[11px] text-[#8B95A1] font-bold text-center tracking-tight">
                      현재까지 파트너들이 총 <span className="text-[#191F28] font-extrabold">{selectedJob.bidsCount}회</span> 더 낮은 수임 제안을 제출했습니다.
                    </p>
                    <div className="flex gap-2.5 pt-2">
                      <button
                        onClick={() => setViewState("bidding_action")}
                        className="flex-1 py-4 bg-[#F2F4F6] text-[#4E5968] font-bold rounded-2xl hover:bg-[#E5E8EB] active:scale-97 cursor-pointer text-xs"
                      >
                        내가 더 낮게 입찰 제안
                      </button>

                      <button
                        disabled={biddingProcess}
                        onClick={handleInstantAccept}
                        className="flex-1 py-4 bg-[#3182F6] text-white font-extrabold rounded-2xl hover:bg-[#1b64d6] active:scale-97 cursor-pointer text-xs flex items-center justify-center space-x-1.5 shadow-sm shadow-[#3182F6]/10"
                      >
                        {biddingProcess ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <span>이 가격에 수락하기</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {selectedJob.status === "matched" && (
                  <div className="pt-2 space-y-2">
                    <button
                      onClick={() => onStartPayment?.(selectedJob)}
                      className="w-full py-4.5 bg-[#3182F6] hover:bg-[#1b64d6] active:scale-97 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-md shadow-[#3182F6]/15 cursor-pointer transition-colors"
                    >
                      <Coins className="w-4 h-4 stroke-[2.5px]" />
                      <span>토스페이 안심 정산 완료하기</span>
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full py-3.5 hover:bg-gray-50 active:scale-97 text-[#8B95A1] font-bold rounded-2xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <span>상세 창 닫기</span>
                    </button>
                  </div>
                )}

                {selectedJob.status === "completed" && (
                  <div className="pt-2">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-xs font-semibold text-emerald-800 text-center mb-3">
                      🎉 토스 안심 페이 정산이 완료된 심부름입니다.
                    </div>
                    <button
                      onClick={onClose}
                      className="w-full py-4 bg-[#F2F4F6] text-[#4E5968] font-extrabold rounded-2xl text-xs active:scale-97 cursor-pointer text-center"
                    >
                      완료 및 닫기
                    </button>
                  </div>
                )}
              </div>
            )}

            {viewState === "bidding_action" && (
              <div className="space-y-6 py-3">
                <div className="space-y-1">
                  <span className="text-xs text-[#8B95A1] font-bold block">역경매 특가 매칭 제시</span>
                  <h3 className="text-lg font-bold text-[#191F28] tracking-tight">
                    얼마에 심부름을 해결해 주시겠어요?
                  </h3>
                  <p className="text-xs text-[#8B95A1] leading-relaxed">
                    현재 최저가인 <span className="text-[#3182F6] font-bold">{selectedJob.currentPrice.toLocaleString()}원</span>보다 낮아야 경쟁 주도권을 가집니다.
                  </p>
                </div>

                {/* Bidding Amount Controller Slider */}
                <div className="bg-gray-50 p-4.5 rounded-[20px] border border-black/5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[#8B95A1] font-bold">나의 입찰 제안 가격</span>
                    <span className="text-lg font-black text-[#3182F6]">
                      {bidValue.toLocaleString()}원
                    </span>
                  </div>

                  <input
                    type="range"
                    min={Math.max(1000, selectedJob.currentPrice - 6000)}
                    max={selectedJob.currentPrice - 100}
                    step={100}
                    value={bidValue}
                    onChange={(e) => setBidValue(Number(e.target.value))}
                    className="w-full accent-[#3182F6] cursor-pointer"
                  />

                  <div className="flex justify-between items-center text-[10px] text-[#8B95A1] font-bold">
                    <span>최소 입찰 1,000원</span>
                    <span>경쟁 우위 확보 가능 ({Math.round(((selectedJob.currentPrice - bidValue) / selectedJob.currentPrice) * 100)}% 세이브)</span>
                  </div>
                </div>

                <div className="bg-[#E8F3FF] p-3 rounded-xl flex items-center space-x-2 text-[11px] text-[#3182F6] font-bold">
                  <ShieldAlert className="w-4 h-4 text-[#3182F6]" />
                  <span>제시한 최저가로 매칭 시, 의뢰 고객 알림 메시지가 실시간 전송됩니다.</span>
                </div>

                <div className="flex gap-2.5">
                  <button
                    onClick={() => setViewState("detail")}
                    className="py-4 px-6 bg-[#F2F4F6] text-[#4E5968] font-bold rounded-2xl hover:bg-[#E5E8EB] cursor-pointer text-xs"
                  >
                    이전으로
                  </button>

                  <button
                    onClick={handleManualBidSubmit}
                    disabled={biddingProcess || bidValue >= selectedJob.currentPrice}
                    className="flex-1 py-4 bg-[#3182F6] text-white font-extrabold rounded-2xl hover:bg-[#1b64d6] disabled:bg-[#E5E8EB] disabled:text-[#B0B8C1] disabled:cursor-not-allowed cursor-pointer text-xs flex items-center justify-center"
                  >
                    {biddingProcess ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "최저가 경쟁 입찰 등록"
                    )}
                  </button>
                </div>
              </div>
            )}

            {viewState === "matched_success" && (
              <div className="flex flex-col items-center text-center py-6 space-y-6">
                {/* Visual Splash Award Circle */}
                <div className="relative flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.25, 1] }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="w-20 h-20 bg-[#3182F6] rounded-full flex items-center justify-center shadow-lg shadow-[#3182F6]/30"
                  >
                    <Check className="w-10 h-10 text-white stroke-[3px]" />
                  </motion.div>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-1.5 -right-1.5 text-yellow-400"
                  >
                    <Sparkles className="w-5 h-5 fill-current animate-bounce" />
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-[#191F28] tracking-tight">
                    심부름 비딩 매칭 완료!
                  </h3>
                  <p className="text-base font-semibold text-[#4E5968] leading-relaxed px-2">
                    <span className="text-[#3182F6] font-extrabold">
                      {selectedJob.currentPrice.toLocaleString()}원
                    </span>
                    에 일감이 매칭되었습니다.<br />의뢰 고객과 실시간 소통하여 심부름을 수행하세요!
                  </p>
                </div>

                {/* Meta details */}
                <div className="w-full bg-[#F9FAFB] p-4 rounded-[20px] border border-black/5 divide-y divide-gray-100 text-xs font-semibold text-[#4E5968] space-y-2 text-left">
                  <div className="flex justify-between pb-2 first:pt-0 pt-2 text-[11px]">
                    <span className="text-[#8B95A1]">의뢰 일감</span>
                    <span className="text-[#191F28] font-bold">{selectedJob.title}</span>
                  </div>
                  <div className="flex justify-between pt-2 pb-2 text-[11px]">
                    <span className="text-[#8B95A1]">최종 수임료</span>
                    <span className="text-[#3182F6] font-extrabold">{selectedJob.currentPrice.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between pt-2 text-[11px]">
                    <span className="text-[#8B95A1]">고객 안심 핀</span>
                    <span className="text-emerald-500 flex items-center">
                      <Award className="w-3.5 h-3.5 mr-1" /> Toss 안심 배상 보험 가입됨
                    </span>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full py-4.5 bg-[#3182F6] text-white font-extrabold text-xs rounded-2xl hover:bg-[#1b64d6] transition-all cursor-pointer shadow-md"
                >
                  내 활동 탭에서 확인하기
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
