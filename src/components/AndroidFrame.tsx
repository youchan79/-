import { useEffect, useState, ReactNode } from "react";
import { 
  Wifi, 
  Battery 
} from "lucide-react";

interface AndroidFrameProps {
  children: ReactNode;
}

export function AndroidFrame({ children }: AndroidFrameProps) {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    // Live ticking clock in Korean format
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "오후" : "오전";
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      setCurrentTime(`${ampm} ${hours}:${minutes}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#F1F3F5] text-[#191F28] flex flex-col items-center justify-center p-3 md:p-6 font-sans antialiased overflow-x-hidden selection:bg-[#3182F6]/25">
      
      {/* Centered Smartphone Device Viewport Container */}
      <div className="relative w-[390px] h-[812px] rounded-[52px] border-[12px] border-[#191F28] shadow-2xl bg-white overflow-hidden flex flex-col">
        
        {/* Dynamic Island Camera Notch */}
        <div className="absolute top-0 inset-x-0 h-6 z-50 flex justify-center items-center pointer-events-none">
          <div className="w-2.5 h-2.5 bg-[#000000] rounded-full absolute top-[7px]" />
        </div>
        
        {/* Physical Button Accents */}
        <div className="absolute -left-[15px] top-[140px] w-[3px] h-[60px] bg-[#191F28] rounded-l-md" />
        <div className="absolute -left-[15px] top-[210px] w-[3px] h-[60px] bg-[#191F28] rounded-l-md" />
        <div className="absolute -right-[15px] top-[180px] w-[3px] h-[90px] bg-[#191F28] rounded-r-md" />

        {/* Device Screen Main Wrapper */}
        <div className="w-full h-full flex flex-col relative bg-[#F9FAFB] overflow-hidden">
          
          {/* Native Status Bar */}
          <div className="h-10 px-5 pt-3 flex justify-between items-center text-[#191F28] select-none text-xs font-bold z-40 bg-[#F9FAFB]">
            <span>{currentTime}</span>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] tracking-tighter text-[#4E5968] font-semibold mr-0.5">LTE</span>
              <Wifi className="w-3.5 h-3.5" />
              <Battery className="w-[18px] h-[9px] text-[#191F28]" />
            </div>
          </div>

          {/* Immersive App Container with Overflow Hidden (So children handle scroll and tabs stay fixed) */}
          <div className="flex-1 flex flex-col relative min-h-0 bg-[#F2F4F6] overflow-hidden">
            {children}
          </div>

          {/* Native Gesture Navigation Indicator Bar */}
          <div className="h-5 w-full flex justify-center items-center pointer-events-none bg-white z-40">
            <div className="w-28 h-1 bg-[#191F28] rounded-full opacity-30" />
          </div>
        </div>

      </div>
    </div>
  );
}
