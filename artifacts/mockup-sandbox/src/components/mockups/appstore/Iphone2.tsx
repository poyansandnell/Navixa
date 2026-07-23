export default function Iphone2() {
  return (
    <div
      style={{ width: 1290, height: 2796 }}
      className="relative overflow-hidden bg-[#0A0A0A] flex flex-col items-center justify-center"
    >
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }} />

      {/* Top content */}
      <div className="absolute top-[280px] left-0 right-0 flex flex-col items-center px-16 z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-600/20 border border-amber-500/30 mb-8">
          <span className="text-amber-400 font-bold text-[15px] tracking-[0.15em] uppercase">NAVIXA</span>
        </div>
        
        <h1 className="text-white text-center font-['Inter'] font-black leading-[0.9] mb-6">
          <div className="text-[82px]">
            <span className="relative inline-block">
              Utmana
              <span className="absolute bottom-[-8px] left-0 right-0 h-[6px] bg-amber-500"></span>
            </span>
          </div>
          <div className="text-[82px] mt-3">dina vänner</div>
        </h1>
        
        <p className="text-gray-400 text-[22px] font-['Inter'] font-medium text-center max-w-[600px]">
          Skapa privata matcher med unik kod
        </p>
      </div>

      {/* iPhone frame */}
      <div className="absolute top-[720px] left-1/2 -translate-x-1/2 z-20" style={{ transform: 'scale(2.4)', transformOrigin: 'top center' }}>
        <div className="relative" style={{ width: 428, height: 926 }}>
          {/* Phone bezel */}
          <div className="absolute inset-0 rounded-[60px] bg-[#1a1a1a] shadow-2xl" style={{
            boxShadow: '0 0 0 12px #0f0f0f, 0 40px 80px rgba(0,0,0,0.5)'
          }}>
            {/* Dynamic Island */}
            <div className="absolute top-[24px] left-1/2 -translate-x-1/2 w-[120px] h-[37px] bg-black rounded-full z-50"></div>
            
            {/* Screen content */}
            <div className="absolute inset-[12px] rounded-[48px] overflow-hidden bg-[#0A1628]">
              {/* Status bar */}
              <div className="h-[54px] px-8 flex items-center justify-between pt-2">
                <span className="text-white text-[17px] font-semibold">9:41</span>
                <div className="flex items-center gap-1">
                  <div className="w-[18px] h-[12px] border-2 border-white rounded-sm"></div>
                  <div className="w-[16px] h-[12px] bg-white rounded-[3px]"></div>
                </div>
              </div>

              {/* Header */}
              <div className="px-6 py-5 border-b border-[#1a2f4a]">
                <button className="text-amber-400 font-semibold text-base mb-4">← Tillbaka</button>
                <h2 className="text-white font-black text-3xl mb-1">Privat match</h2>
                <p className="text-gray-400 text-sm">Dela koden med din motståndare</p>
              </div>

              {/* Invite code section */}
              <div className="px-6 py-8 flex flex-col items-center">
                <div className="w-full bg-[#0d1d35] rounded-2xl border-2 border-[#1a2f4a] p-8 mb-6">
                  <div className="text-center mb-6">
                    <div className="text-gray-400 text-xs font-semibold tracking-wider mb-3">MATCHKOD</div>
                    <div className="text-white font-black text-6xl tracking-[0.2em] mb-2 font-mono">
                      B7X9K4
                    </div>
                    <div className="text-gray-500 text-xs mt-3">Giltig i 24 timmar</div>
                  </div>

                  {/* QR code mockup */}
                  <div className="w-40 h-40 mx-auto bg-white rounded-xl p-3 mb-6">
                    <div className="w-full h-full relative">
                      <div className="absolute inset-0 grid grid-cols-8 gap-[2px]">
                        {Array.from({ length: 64 }).map((_, i) => (
                          <div
                            key={i}
                            className={`${Math.random() > 0.5 ? 'bg-black' : 'bg-white'}`}
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-center text-gray-400 text-xs">
                    Scanna QR-koden eller dela länken
                  </div>
                </div>

                {/* Big share button */}
                <button className="w-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl py-5 px-6 flex items-center justify-center gap-3 shadow-lg shadow-amber-600/30 mb-4 active:scale-[0.98] transition-transform">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 5.12548 15.0077 5.24917 15.0227 5.37061L8.08259 9.20024C7.54305 8.46211 6.67194 8 5.7 8C3.93269 8 2.5 9.43269 2.5 11.2C2.5 12.9673 3.93269 14.4 5.7 14.4C6.67194 14.4 7.54305 13.9379 8.08259 13.1998L15.0227 17.0294C15.0077 17.1508 15 17.2745 15 17.4C15 19.0569 16.3431 20.4 18 20.4C19.6569 20.4 21 19.0569 21 17.4C21 15.7431 19.6569 14.4 18 14.4C17.0281 14.4 16.157 14.8621 15.6174 15.6002L8.67734 11.7706C8.69229 11.6492 8.7 11.5255 8.7 11.4C8.7 11.2745 8.69229 11.1508 8.67734 11.0294L15.6174 7.19976C16.157 7.93789 17.0281 8.4 18 8.4V8Z" fill="currentColor"/>
                  </svg>
                  <span className="text-white font-black text-xl">Dela matchkod</span>
                </button>

                <button className="w-full bg-[#0d1d35] border-2 border-[#1a2f4a] rounded-2xl py-4 px-6 text-gray-300 font-bold text-base">
                  Kopiera länk
                </button>
              </div>

              {/* Info cards */}
              <div className="px-6 pb-6 space-y-3">
                <div className="bg-[#0d1d35]/50 rounded-xl p-4 border border-[#1a2f4a]">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
                        <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm mb-1">Rated match</div>
                      <div className="text-gray-400 text-xs">Resultatet påverkar din rating</div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0d1d35]/50 rounded-xl p-4 border border-[#1a2f4a]">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-amber-400">
                        <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm mb-1">1 drag per dag</div>
                      <div className="text-gray-400 text-xs">Ta din tid och tänk strategiskt</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom glow */}
      <div className="absolute bottom-0 left-0 right-0 h-[600px] bg-gradient-to-t from-orange-600/10 via-transparent to-transparent pointer-events-none"></div>
    </div>
  );
}
