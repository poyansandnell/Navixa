export default function Iphone5() {
  const en = new URLSearchParams(window.location.search).get('lang') === 'en';
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
      <div className="absolute top-[260px] left-0 right-0 flex flex-col items-center px-16 z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-600/20 border border-amber-500/30 mb-8">
          <span className="text-amber-400 font-bold text-[15px] tracking-[0.15em] uppercase">NAVIXA</span>
        </div>
        
        <h1 className="text-white text-center font-['Inter'] font-black leading-[0.9] mb-6">
          <div className="text-[84px]">
            <span className="relative inline-block">
              {en ? "Tournaments" : "Turneringar"}
              <span className="absolute bottom-[-8px] left-0 right-0 h-[6px] bg-amber-500"></span>
            </span>
          </div>
          <div className="text-[84px] mt-3">{en ? "every week" : "varje vecka"}</div>
        </h1>
        
        <p className="text-gray-400 text-[22px] font-['Inter'] font-medium text-center max-w-[600px]">
          {en ? "Qualify, win prizes and become a champion" : "Kvala in, vinn priser och bli mästare"}
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
              <div className="px-6 py-5 bg-gradient-to-b from-amber-900/20 to-transparent border-b border-[#1a2f4a]">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-white font-black text-3xl">{en ? "Weekly Cup" : "Veckans Cup"}</h2>
                  <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/50 rounded-full">
                    <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">{en ? "Live now" : "Live nu"}</span>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">{en ? "Quarterfinals in progress" : "Kvartsfinaler pågår"}</p>
              </div>

              {/* Tournament info banner */}
              <div className="mx-6 mt-6 p-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-between shadow-lg shadow-amber-600/20">
                <div>
                  <div className="text-amber-100 text-xs font-bold uppercase tracking-wider mb-1">{en ? "Prize pool" : "Prispott"}</div>
                  <div className="text-white font-black text-2xl">5,000 {en ? "Coins" : "Mynt"}</div>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <svg width="24" height="24" viewBox="0 0 24 24" className="text-white">
                    <path fill="currentColor" d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                  </svg>
                </div>
              </div>

              {/* Tournament Bracket */}
              <div className="px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white font-black text-xl">{en ? "Playoff bracket" : "Slutspelsträd"}</h3>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <div className="w-2 h-2 rounded-full bg-[#1a2f4a]"></div>
                    <div className="w-2 h-2 rounded-full bg-[#1a2f4a]"></div>
                  </div>
                </div>

                {/* Bracket structure */}
                <div className="relative">
                  {/* Connecting lines */}
                  <div className="absolute top-1/2 left-[45%] w-[10%] h-[160px] -translate-y-1/2 border-r-2 border-t-2 border-b-2 border-[#1a2f4a] rounded-r-xl z-0"></div>
                  <div className="absolute top-1/2 left-[55%] w-[45%] h-2 bg-[#1a2f4a] -translate-y-1/2 z-0"></div>
                  
                  {/* Match 1 - Top (Finished) */}
                  <div className="relative z-10 bg-[#0d1d35] border border-[#1a2f4a] rounded-xl p-3 mb-8 shadow-md w-[45%]">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-xs">{en ? "Y" : "D"}</div>
                          <span className="text-white font-bold text-sm">{en ? "You" : "Du"}</span>
                        </div>
                        <span className="text-emerald-400 font-black text-sm">{en ? "Win" : "Vinst"}</span>
                      </div>
                      <div className="h-px bg-[#1a2f4a]"></div>
                      <div className="flex items-center justify-between opacity-50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-xs">J</div>
                          <span className="text-white font-bold text-sm">Johan99</span>
                        </div>
                        <span className="text-gray-400 font-black text-sm">{en ? "Loss" : "Förlust"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Final Match - Right (Upcoming) */}
                  <div className="absolute top-1/2 right-0 -translate-y-1/2 z-10 bg-gradient-to-r from-amber-500/10 to-orange-600/10 border-2 border-amber-500/50 rounded-xl p-3 w-[45%] shadow-lg shadow-amber-500/20">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-500 rounded-full text-black font-black text-[10px] uppercase tracking-wider">
                      {en ? "Final" : "Final"}
                    </div>
                    <div className="flex flex-col gap-2 mt-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-xs border border-amber-400">{en ? "Y" : "D"}</div>
                          <span className="text-white font-bold text-sm">{en ? "You" : "Du"}</span>
                        </div>
                        <span className="text-gray-500 font-black text-sm">-</span>
                      </div>
                      <div className="h-px bg-[#1a2f4a]"></div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center text-white font-bold text-xs">K</div>
                          <span className="text-white font-bold text-sm">Kapten_Erik</span>
                        </div>
                        <span className="text-gray-500 font-black text-sm">-</span>
                      </div>
                    </div>
                  </div>

                  {/* Match 2 - Bottom (Finished) */}
                  <div className="relative z-10 bg-[#0d1d35] border border-[#1a2f4a] rounded-xl p-3 w-[45%] shadow-md">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center text-white font-bold text-xs">K</div>
                          <span className="text-white font-bold text-sm truncate max-w-[80px]">Kapten_Erik</span>
                        </div>
                        <span className="text-emerald-400 font-black text-sm">{en ? "Win" : "Vinst"}</span>
                      </div>
                      <div className="h-px bg-[#1a2f4a]"></div>
                      <div className="flex items-center justify-between opacity-50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-xs">A</div>
                          <span className="text-white font-bold text-sm truncate max-w-[80px]">AdmiralAnna</span>
                        </div>
                        <span className="text-gray-400 font-black text-sm">{en ? "Loss" : "Förlust"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action area */}
              <div className="px-6 mt-4">
                <div className="bg-[#0d1d35]/80 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-5 text-center">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" className="text-amber-400">
                      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 19.93C7.05 19.43 4 16.05 4 12C4 7.95 7.05 4.57 11 4.07V19.93ZM13 4.07C16.95 4.57 20 7.95 20 12C20 16.05 16.95 19.43 13 19.93V4.07Z"/>
                    </svg>
                  </div>
                  <h4 className="text-white font-bold text-lg mb-1">{en ? "The final is starting soon" : "Finalen börjar snart"}</h4>
                  <p className="text-gray-400 text-sm mb-4">{en ? "Get ready for your next match against Kapten_Erik." : "Gör dig redo för din nästa match mot Kapten_Erik."}</p>
                  <button className="w-full bg-amber-500 rounded-xl py-3 px-4 text-black font-black text-base active:scale-[0.98] transition-transform">
                    {en ? "Go to match" : "Gå till match"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Bottom glow */}
      <div className="absolute bottom-0 left-0 right-0 h-[600px] bg-gradient-to-t from-amber-600/10 via-transparent to-transparent pointer-events-none"></div>
    </div>
  );
}
