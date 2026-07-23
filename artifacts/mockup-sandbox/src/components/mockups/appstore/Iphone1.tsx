export default function Iphone1() {
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
      <div className="absolute top-[240px] left-0 right-0 flex flex-col items-center px-16 z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-600/20 border border-amber-500/30 mb-8">
          <span className="text-amber-400 font-bold text-[15px] tracking-[0.15em] uppercase">NAVIXA</span>
        </div>
        
        <h1 className="text-white text-center font-['Inter'] font-black leading-[0.9] mb-6">
          <div className="text-[88px]">Sänk skepp.</div>
          <div className="text-[88px] mt-3">
            <span className="relative inline-block">
              Klättra
              <span className="absolute bottom-[-8px] left-0 right-0 h-[6px] bg-amber-500"></span>
            </span>
            {" i rank."}
          </div>
        </h1>
        
        <p className="text-gray-400 text-[22px] font-['Inter'] font-medium text-center max-w-[600px]">
          Spela klassiska Sänka Skepp med rating
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

              {/* Game header */}
              <div className="px-5 py-4 bg-[#0d1d35] border-b border-[#1a2f4a]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
                      D
                    </div>
                    <div>
                      <div className="text-white font-bold text-base">Du</div>
                      <div className="text-amber-400 font-semibold text-sm">1847</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="text-xs text-gray-400 font-medium mb-1">Din tur</div>
                    <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-md">
                      <span className="text-amber-400 font-bold text-sm">2:34</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-white font-bold text-base text-right">Kapten_Erik</div>
                      <div className="text-amber-400 font-semibold text-sm text-right">1923</div>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                      K
                    </div>
                  </div>
                </div>

                {/* Ship status */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a2f4a]">
                  <div className="flex gap-1">
                    {[5, 4, 3, 3, 2].map((len, i) => (
                      <div key={i} className="flex gap-[2px]">
                        {Array.from({ length: len }).map((_, j) => (
                          <div key={j} className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500"></div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {[5, 4, 3, 3, 2].map((len, i) => (
                      <div key={i} className="flex gap-[2px]">
                        {Array.from({ length: len }).map((_, j) => (
                          <div key={j} className={`w-3 h-3 rounded-sm ${i < 2 ? 'bg-red-500/30 border border-red-500' : 'bg-gray-600/30 border border-gray-500'}`}></div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Battle grid - opponent's board */}
              <div className="px-5 py-5">
                <div className="text-xs text-gray-400 font-semibold mb-3 tracking-wide">MOTSTÅNDARENS BRÄDE</div>
                <div className="inline-grid grid-cols-11 gap-0 bg-[#0d1d35] p-2 rounded-lg">
                  {/* Column headers */}
                  <div className="w-8 h-8"></div>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map(col => (
                    <div key={col} className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs font-semibold">{col}</div>
                  ))}
                  
                  {/* Grid rows */}
                  {Array.from({ length: 10 }).map((_, row) => (
                    <div key={`row-${row}`} className="contents">
                      <div className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs font-semibold">{row + 1}</div>
                      {Array.from({ length: 10 }).map((_, col) => {
                        // Hit pattern - dramatic mid-game
                        const coord = `${row}-${col}`;
                        const hits = ['2-3', '2-4', '2-5', '5-7', '5-8', '7-2', '8-2', '9-2', '1-9', '4-4'];
                        const misses = ['0-0', '1-1', '3-6', '6-5', '8-8', '9-9', '0-5', '7-7', '4-1', '6-9'];
                        const isHit = hits.includes(coord);
                        const isMiss = misses.includes(coord);
                        
                        return (
                          <div
                            key={`${row}-${col}`}
                            className={`w-8 h-8 border border-[#1a2f4a] flex items-center justify-center transition-all ${
                              isHit ? 'bg-red-500/40' : isMiss ? 'bg-blue-400/20' : 'bg-[#0A1628] hover:bg-[#1a2f4a]'
                            }`}
                          >
                            {isHit && (
                              <div className="w-5 h-5 relative">
                                <div className="absolute inset-0 bg-red-500 rounded-full"></div>
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 20 20">
                                  <path d="M10 0L10 20M0 10L20 10" stroke="#991b1b" strokeWidth="2"/>
                                </svg>
                              </div>
                            )}
                            {isMiss && <div className="w-2 h-2 bg-blue-300 rounded-full opacity-60"></div>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
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
