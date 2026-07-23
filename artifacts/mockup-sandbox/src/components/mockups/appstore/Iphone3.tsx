export default function Iphone3() {
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
          <div className="text-[76px]">Din tur —</div>
          <div className="text-[76px] mt-3">
            <span className="relative inline-block">
              när det
              <span className="absolute bottom-[-8px] left-0 right-0 h-[6px] bg-amber-500"></span>
            </span>
          </div>
          <div className="text-[76px] mt-3">passar dig</div>
        </h1>
        
        <p className="text-gray-400 text-[22px] font-['Inter'] font-medium text-center max-w-[700px]">
          Ett drag per dag. Inga stressiga tidskrav.
        </p>
      </div>

      {/* iPhone frame */}
      <div className="absolute top-[740px] left-1/2 -translate-x-1/2 z-20" style={{ transform: 'scale(2.4)', transformOrigin: 'top center' }}>
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

              {/* Push notification banner */}
              <div className="absolute top-[60px] left-3 right-3 z-50 bg-[#1a1a1a]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-4 animate-[slideDown_0.3s_ease-out]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                      <path d="M3 3L8 3L8 8L3 8L3 3ZM10 3L15 3L15 8L10 8L10 3ZM16 3L21 3L21 8L16 8L16 3ZM3 10L8 10L8 15L3 15L3 10ZM10 10L15 10L15 15L10 15L10 10ZM16 10L21 10L21 15L16 15L16 10ZM3 16L8 16L8 21L3 21L3 16ZM10 16L15 16L15 21L10 21L10 16ZM16 16L21 16L21 21L16 21L16 16Z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-sm mb-1">Navixa · nu</div>
                    <div className="text-white text-sm mb-1">Det är din tur!</div>
                    <div className="text-gray-400 text-xs">SjöormenSara väntar på ditt drag</div>
                  </div>
                </div>
              </div>

              {/* Header */}
              <div className="px-6 py-6 border-b border-[#1a2f4a]">
                <h2 className="text-white font-black text-3xl mb-1">Hem</h2>
                <p className="text-gray-400 text-sm">Välkommen tillbaka, Kapten!</p>
              </div>

              {/* Quick stats */}
              <div className="px-6 py-4 grid grid-cols-3 gap-3">
                <div className="bg-[#0d1d35] rounded-xl p-3 border border-[#1a2f4a]">
                  <div className="text-amber-400 font-black text-2xl mb-1">1847</div>
                  <div className="text-gray-400 text-xs font-semibold">Rating</div>
                </div>
                <div className="bg-[#0d1d35] rounded-xl p-3 border border-[#1a2f4a]">
                  <div className="text-emerald-400 font-black text-2xl mb-1">23</div>
                  <div className="text-gray-400 text-xs font-semibold">Vinster</div>
                </div>
                <div className="bg-[#0d1d35] rounded-xl p-3 border border-[#1a2f4a]">
                  <div className="text-white font-black text-2xl mb-1">67%</div>
                  <div className="text-gray-400 text-xs font-semibold">Win rate</div>
                </div>
              </div>

              {/* Matches list */}
              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-black text-xl">Dina matcher</h3>
                  <button className="text-amber-400 font-semibold text-sm">Se alla</button>
                </div>

                <div className="space-y-3">
                  {/* Active match - Your turn */}
                  <div className="bg-gradient-to-r from-amber-500/20 to-orange-600/10 border-2 border-amber-500/50 rounded-xl p-4 relative overflow-hidden">
                    <div className="absolute top-2 right-2 px-3 py-1 bg-amber-500 rounded-full">
                      <span className="text-black font-black text-xs">DIN TUR</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold">
                        S
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-bold text-base">SjöormenSara</div>
                        <div className="text-amber-300 text-sm font-semibold">1923 rating</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold text-sm">Dag 8</div>
                        <div className="text-gray-300 text-xs">14:32 kvar</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-300">
                        <span className="text-emerald-400 font-bold">4 träffar</span> · 
                        <span className="text-gray-400"> 12 försök</span>
                      </div>
                      <button className="px-5 py-2 bg-amber-500 rounded-lg text-black font-black text-sm">
                        Spela →
                      </button>
                    </div>
                  </div>

                  {/* Waiting for opponent */}
                  <div className="bg-[#0d1d35] border border-[#1a2f4a] rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center text-white font-bold">
                        K
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-bold text-base">Kapten_Erik</div>
                        <div className="text-gray-400 text-sm">1789 rating</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold text-sm">Dag 5</div>
                        <div className="text-gray-400 text-xs">Motståndaren tänker</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-400">
                        <span className="text-emerald-400 font-bold">2 träffar</span> · 
                        <span> 8 försök</span>
                      </div>
                      <div className="px-4 py-2 bg-[#1a2f4a] rounded-lg text-gray-400 text-sm font-semibold">
                        Väntar...
                      </div>
                    </div>
                  </div>

                  {/* Another waiting match */}
                  <div className="bg-[#0d1d35] border border-[#1a2f4a] rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center text-white font-bold">
                        A
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-bold text-base">AdmiralAnna</div>
                        <div className="text-gray-400 text-sm">1654 rating</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold text-sm">Dag 3</div>
                        <div className="text-gray-400 text-xs">19:45 kvar</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-400">
                        <span className="text-emerald-400 font-bold">1 träff</span> · 
                        <span> 5 försök</span>
                      </div>
                      <div className="px-4 py-2 bg-[#1a2f4a] rounded-lg text-gray-400 text-sm font-semibold">
                        Väntar...
                      </div>
                    </div>
                  </div>

                  {/* Your turn again */}
                  <div className="bg-gradient-to-r from-amber-500/20 to-orange-600/10 border-2 border-amber-500/50 rounded-xl p-4 relative overflow-hidden">
                    <div className="absolute top-2 right-2 px-3 py-1 bg-amber-500 rounded-full">
                      <span className="text-black font-black text-xs">DIN TUR</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold">
                        M
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-bold text-base">MatrosMaria</div>
                        <div className="text-amber-300 text-sm font-semibold">1702 rating</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold text-sm">Dag 2</div>
                        <div className="text-gray-300 text-xs">8:12 kvar</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-300">
                        <span className="text-emerald-400 font-bold">0 träffar</span> · 
                        <span className="text-gray-400"> 3 försök</span>
                      </div>
                      <button className="px-5 py-2 bg-amber-500 rounded-lg text-black font-black text-sm">
                        Spela →
                      </button>
                    </div>
                  </div>
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
