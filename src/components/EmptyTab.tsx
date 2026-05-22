import { motion } from "motion/react";
import { Coins, Image as ImageIcon, Gift, User, LucideIcon } from "lucide-react";

interface EmptyTabProps {
  tabKey: "rewards" | "wallpaper" | "recommend" | "profile";
}

const tabConfigs: Record<
  "rewards" | "wallpaper" | "recommend" | "profile",
  { title: string; subtitle: string; icon: LucideIcon }
> = {
  rewards: {
    title: "혜택 모아보기",
    subtitle: "매일 새롭게 업데이트되는 캐시 슬라이드 적립 미션",
    icon: Coins,
  },
  wallpaper: {
    title: "월페이퍼 교환소",
    subtitle: "포인트를 모아 나만의 스타일로 홈 테마를 꾸며보세요",
    icon: ImageIcon,
  },
  recommend: {
    title: "친구 초대 혜택",
    subtitle: "초대코드를 공유하고 함께 500P 추가 보상을 받으세요",
    icon: Gift,
  },
  profile: {
    title: "내 정보 관리",
    subtitle: "사용자 프로필, 출금 가능한 포인트, 미션 거래 명세서",
    icon: User,
  },
};

export function EmptyTab({ tabKey }: EmptyTabProps) {
  const config = tabConfigs[tabKey];
  const IconComponent = config.icon;

  return (
    <div className="flex flex-col items-center justify-center flex-1 h-full min-h-[500px] px-6 text-center select-none bg-[#F9FAFB]">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center space-y-6"
      >
        {/* Animated Icon Ring */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing ring background */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.08, 0.15] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute w-24 h-24 bg-[#3182F6] rounded-full"
          />
          <div className="relative w-18 h-18 bg-white text-[#3182F6] rounded-full flex items-center justify-center shadow-md border border-[#F2F4F6]">
            <IconComponent className="w-8 h-8 stroke-[2.2]" />
          </div>
        </div>

        {/* Labels */}
        <div className="space-y-3 px-4">
          <span className="inline-block px-3 py-1 bg-[#3182F6]/8 text-[#3182F6] text-xs font-bold rounded-full tracking-wider">
            준비 중인 서비스
          </span>
          <h2 className="text-xl font-bold text-[#191F28] tracking-tight md:text-2xl">
            {config.title}
          </h2>
          <p className="text-sm text-[#8B95A1] max-w-[240px] leading-relaxed mx-auto">
            {config.subtitle}
          </p>
        </div>

        {/* Minimal Toss Box label "Soon" */}
        <div className="bg-[#E5E8EB]/50 px-5 py-3 rounded-2xl flex items-center space-x-2 border border-[#E5E8EB]/10">
          <span className="w-2 h-2 rounded-full bg-[#3182F6] animate-pulse" />
          <span className="text-sm font-semibold text-[#4E5968] tracking-tight">곧 만나요</span>
        </div>
      </motion.div>
    </div>
  );
}
