import { AppstoreShell } from './Iphone6';

export default function Iphone8() {
  return (
    <AppstoreShell
      headline={<>Gå med i{' '}<span className="relative inline-block">flottan<span className="absolute bottom-[-8px] left-0 right-0 h-[6px] bg-amber-500"></span></span></>}
      sub="Skapa ett konto och utmana världen — helt gratis"
    >
      <div className="absolute inset-[12px] rounded-[48px] overflow-hidden bg-[#0A1628] flex flex-col">
        <div className="h-[54px] px-8 flex items-center justify-between pt-2 shrink-0">
          <span className="text-white text-[17px] font-semibold">9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-[18px] h-[12px] border-2 border-white rounded-sm"></div>
            <div className="w-[16px] h-[12px] bg-white rounded-[3px]"></div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-10 -mt-2">
          <div className="w-[130px] h-[130px] rounded-full bg-[#f2704e] flex items-center justify-center">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="3" />
              <line x1="12" y1="22" x2="12" y2="8" />
              <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
            </svg>
          </div>
          <div className="h-10" />
          <div className="text-white text-[28px] font-bold text-center leading-tight font-['Inter']">
            Gå med i flottan
          </div>
          <div className="h-3" />
          <div className="text-gray-400 text-[16px] text-center leading-snug max-w-[300px]">
            Skapa ett konto eller hoppa in direkt som gäst.
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 pb-5 shrink-0">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-2 rounded-full ${i === 3 ? 'w-6 bg-teal-400' : 'w-2 bg-[#233a5c]'}`}></div>
          ))}
        </div>
        <div className="px-6 pb-10 shrink-0 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-1 pb-1">
            <div className="w-[20px] h-[20px] rounded-md bg-teal-400 flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0A1628" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <span className="text-gray-400 text-[13px]">Jag accepterar användarvillkoren och integritetspolicyn</span>
          </div>
          <div className="h-[52px] rounded-2xl bg-[#f2704e] flex items-center justify-center">
            <span className="text-white font-bold text-[17px]">Skapa konto</span>
          </div>
          <div className="h-[52px] rounded-2xl bg-[#13294a] flex items-center justify-center">
            <span className="text-white font-bold text-[17px]">Logga in</span>
          </div>
        </div>
      </div>
    </AppstoreShell>
  );
}
