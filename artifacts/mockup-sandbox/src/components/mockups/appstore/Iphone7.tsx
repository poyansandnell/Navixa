import { AppstoreShell } from './Iphone6';

export default function Iphone7() {
  const en = new URLSearchParams(window.location.search).get('lang') === 'en';
  return (
    <AppstoreShell
      headline={en ? <>A journey to the{' '}<span className="relative inline-block">top<span className="absolute bottom-[-8px] left-0 right-0 h-[6px] bg-amber-500"></span></span></> : <>En resa mot{' '}<span className="relative inline-block">toppen<span className="absolute bottom-[-8px] left-0 right-0 h-[6px] bg-amber-500"></span></span></>}
      sub={en ? "Win matches, improve your rating, and reach higher divisions" : "Vinn matcher, förbättra din rating och nå högre divisioner"}
    >
      <div className="absolute inset-[12px] rounded-[48px] overflow-hidden bg-[#0A1628] flex flex-col">
        <div className="h-[54px] px-8 flex items-center justify-between pt-2 shrink-0">
          <span className="text-white text-[17px] font-semibold">9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-[18px] h-[12px] border-2 border-white rounded-sm"></div>
            <div className="w-[16px] h-[12px] bg-white rounded-[3px]"></div>
          </div>
        </div>
        <div className="px-6 flex justify-end shrink-0">
          <span className="text-gray-400 text-[15px]">{en ? "Skip" : "Hoppa över"}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-10 -mt-6">
          <div className="w-[130px] h-[130px] rounded-full bg-[#13294a] flex items-center justify-center">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div className="h-12" />
          <div className="text-white text-[30px] font-bold text-center leading-tight font-['Inter']">
            {en ? <>Climb the<br />world rankings</> : <>Klättra i<br />världsrankingen</>}
          </div>
          <div className="h-4" />
          <div className="text-gray-400 text-[16px] text-center leading-snug max-w-[300px]">
            {en ? "Win matches, improve your rating, and reach higher divisions" : "Vinn matcher, förbättra din rating och nå högre divisioner"}
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 pb-5 shrink-0">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-2 rounded-full ${i === 1 ? 'w-6 bg-teal-400' : 'w-2 bg-[#233a5c]'}`}></div>
          ))}
        </div>
        <div className="px-6 pb-10 shrink-0">
          <div className="h-[52px] rounded-2xl bg-[#f2704e] flex items-center justify-center">
            <span className="text-white font-bold text-[17px]">{en ? "Next" : "Nästa"}</span>
          </div>
        </div>
      </div>
    </AppstoreShell>
  );
}
