function OnboardingScreen({
  icon,
  title,
  subtitle,
  activeDot,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
  activeDot: number;
}) {
  return (
    <div className="absolute inset-[12px] rounded-[48px] overflow-hidden bg-[#0A1628] flex flex-col">
      {/* Status bar */}
      <div className="h-[54px] px-8 flex items-center justify-between pt-2 shrink-0">
        <span className="text-white text-[17px] font-semibold">9:41</span>
        <div className="flex items-center gap-1">
          <div className="w-[18px] h-[12px] border-2 border-white rounded-sm"></div>
          <div className="w-[16px] h-[12px] bg-white rounded-[3px]"></div>
        </div>
      </div>

      {/* Skip */}
      <div className="px-6 flex justify-end shrink-0">
        <span className="text-gray-400 text-[15px]">Hoppa över</span>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-10 -mt-6">
        <div className="w-[130px] h-[130px] rounded-full bg-[#13294a] flex items-center justify-center">
          {icon}
        </div>
        <div className="h-12" />
        <div className="text-white text-[30px] font-bold text-center leading-tight font-['Inter']">
          {title}
        </div>
        <div className="h-4" />
        <div className="text-gray-400 text-[16px] text-center leading-snug max-w-[300px]">
          {subtitle}
        </div>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 pb-5 shrink-0">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-2 rounded-full ${i === activeDot ? 'w-6 bg-teal-400' : 'w-2 bg-[#233a5c]'}`}
          ></div>
        ))}
      </div>

      {/* Button */}
      <div className="px-6 pb-10 shrink-0">
        <div className="h-[52px] rounded-2xl bg-[#f2704e] flex items-center justify-center">
          <span className="text-white font-bold text-[17px]">Nästa</span>
        </div>
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute top-[720px] left-1/2 -translate-x-1/2 z-20" style={{ transform: 'scale(2.4)', transformOrigin: 'top center' }}>
      <div className="relative" style={{ width: 428, height: 926 }}>
        <div className="absolute inset-0 rounded-[60px] bg-[#1a1a1a] shadow-2xl" style={{
          boxShadow: '0 0 0 12px #0f0f0f, 0 40px 80px rgba(0,0,0,0.5)'
        }}>
          <div className="absolute top-[24px] left-1/2 -translate-x-1/2 w-[120px] h-[37px] bg-black rounded-full z-50"></div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AppstoreShell({
  headline,
  sub,
  children,
}: {
  headline: React.ReactNode;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ width: 1290, height: 2796 }}
      className="relative overflow-hidden bg-[#0A0A0A] flex flex-col items-center justify-center"
    >
      <div className="absolute top-[240px] left-0 right-0 flex flex-col items-center px-16 z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-600/20 border border-amber-500/30 mb-8">
          <span className="text-amber-400 font-bold text-[15px] tracking-[0.15em] uppercase">NAVIXA</span>
        </div>
        <h1 className="text-white text-center font-['Inter'] font-black leading-[1.0] mb-6 text-[88px] max-w-[1100px]">
          {headline}
        </h1>
        <p className="text-gray-400 text-[22px] font-['Inter'] font-medium text-center max-w-[700px]">
          {sub}
        </p>
      </div>
      <PhoneFrame>{children}</PhoneFrame>
      <div className="absolute bottom-0 left-0 right-0 h-[600px] bg-gradient-to-t from-amber-600/10 via-transparent to-transparent pointer-events-none"></div>
    </div>
  );
}

export default function Iphone6() {
  return (
    <AppstoreShell
      headline={<>Kom igång på{' '}<span className="relative inline-block">sekunder<span className="absolute bottom-[-8px] left-0 right-0 h-[6px] bg-amber-500"></span></span></>}
      sub="Möt riktiga spelare i snabba strategiska matcher"
    >
      <OnboardingScreen
        icon={
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        }
        title={<>Sänk flottor över<br />hela världen</>}
        subtitle="Möt riktiga spelare i snabba strategiska matcher"
        activeDot={0}
      />
    </AppstoreShell>
  );
}
