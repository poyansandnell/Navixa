export default function Iphone4() {
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
      <div className="absolute top-[280px] left-0 right-0 flex flex-col items-center px-16 z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-600/20 border border-amber-500/30 mb-8">
          <span className="text-amber-400 font-bold text-[15px] tracking-[0.15em] uppercase">NAVIXA</span>
        </div>
        
        <h1 className="text-white text-center font-['Inter'] font-black leading-[0.9] mb-6">
          <div className="text-[86px]">
            <span className="relative inline-block">
              {en ? "Climb" : "Klättra"}
              <span className="absolute bottom-[-8px] left-0 right-0 h-[6px] bg-amber-500"></span>
            </span>
            {en ? " the" : " på"}
          </div>
          <div className="text-[86px] mt-3">{en ? "leaderboard" : "topplistan"}</div>
        </h1>
        
        <p className="text-gray-400 text-[22px] font-['Inter'] font-medium text-center max-w-[600px]">
          {en ? "Compete against the world's best players" : "Tävla mot Sveriges bästa spelare"}
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
                <h2 className="text-white font-black text-3xl mb-3">{en ? "Leaderboard" : "Topplistan"}</h2>
                
                {/* Time filter tabs */}
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-amber-500 rounded-lg text-black font-bold text-sm">
                    {en ? "This week" : "Denna vecka"}
                  </button>
                  <button className="px-4 py-2 bg-[#0d1d35] border border-[#1a2f4a] rounded-lg text-gray-400 font-semibold text-sm">
                    {en ? "All time" : "Alla tider"}
                  </button>
                </div>
              </div>

              {/* Top 3 podium */}
              <div className="px-6 py-6 flex items-end justify-center gap-3">
                {/* 2nd place */}
                <div className="flex flex-col items-center">
                  <div className="relative mb-2">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-xl border-4 border-gray-400">
                      S
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gray-400 rounded-full flex items-center justify-center text-black font-black text-sm">
                      2
                    </div>
                  </div>
                  <div className="text-white font-bold text-sm mb-1">SjöormenSara</div>
                  <div className="text-amber-400 font-black text-lg">2156</div>
                  <div className="w-20 h-20 bg-gradient-to-b from-gray-400/30 to-gray-500/40 rounded-t-lg border-t-4 border-gray-400 mt-2"></div>
                </div>

                {/* 1st place */}
                <div className="flex flex-col items-center -mt-4">
                  <div className="relative mb-2">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center text-white font-bold text-2xl border-4 border-amber-400 shadow-lg shadow-amber-500/50">
                      K
                    </div>
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full">
                      <svg width="24" height="24" viewBox="0 0 24 24" className="text-amber-400">
                        <path fill="currentColor" d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                      </svg>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-black font-black text-base shadow-lg">
                      1
                    </div>
                  </div>
                  <div className="text-white font-bold text-base mb-1">Kapten_Erik</div>
                  <div className="text-amber-400 font-black text-2xl">2347</div>
                  <div className="w-24 h-24 bg-gradient-to-b from-amber-400/30 to-amber-600/40 rounded-t-lg border-t-4 border-amber-400 mt-2 shadow-lg shadow-amber-500/30"></div>
                </div>

                {/* 3rd place */}
                <div className="flex flex-col items-center">
                  <div className="relative mb-2">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center text-white font-bold text-xl border-4 border-amber-700">
                      A
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-700 rounded-full flex items-center justify-center text-white font-black text-sm">
                      3
                    </div>
                  </div>
                  <div className="text-white font-bold text-sm mb-1">AdmiralAnna</div>
                  <div className="text-amber-400 font-black text-lg">2089</div>
                  <div className="w-20 h-16 bg-gradient-to-b from-amber-700/30 to-amber-800/40 rounded-t-lg border-t-4 border-amber-700 mt-2"></div>
                </div>
              </div>

              {/* Rest of leaderboard */}
              <div className="px-6 pb-6 space-y-2">
                {/* 4th */}
                <div className="bg-[#0d1d35] border border-[#1a2f4a] rounded-xl p-4 flex items-center gap-4">
                  <div className="text-gray-400 font-black text-xl w-8">4</div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
                    M
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-base">MatrosMaria</div>
                    <div className="text-gray-400 text-sm">34 {en ? "wins" : "vinster"}</div>
                  </div>
                  <div className="text-amber-400 font-black text-xl">1987</div>
                </div>

                {/* 5th */}
                <div className="bg-[#0d1d35] border border-[#1a2f4a] rounded-xl p-4 flex items-center gap-4">
                  <div className="text-gray-400 font-black text-xl w-8">5</div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                    L
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-base">LöjtnantenLars</div>
                    <div className="text-gray-400 text-sm">29 {en ? "wins" : "vinster"}</div>
                  </div>
                  <div className="text-amber-400 font-black text-xl">1923</div>
                </div>

                {/* Current player - highlighted */}
                <div className="bg-gradient-to-r from-amber-500/20 to-orange-600/10 border-2 border-amber-500/50 rounded-xl p-4 flex items-center gap-4 relative">
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-12 bg-amber-500 rounded-full"></div>
                  <div className="text-amber-400 font-black text-xl w-8">12</div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg border-2 border-amber-400">
                    {en ? "Y" : "D"}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-base">{en ? "You" : "Du"}</div>
                    <div className="text-amber-300 text-sm font-semibold">23 {en ? "wins" : "vinster"} · {en ? "Moving up! 📈" : "På väg upp! 📈"}</div>
                  </div>
                  <div className="text-amber-400 font-black text-xl">1847</div>
                </div>

                {/* 13th */}
                <div className="bg-[#0d1d35] border border-[#1a2f4a] rounded-xl p-4 flex items-center gap-4">
                  <div className="text-gray-400 font-black text-xl w-8">13</div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg">
                    F
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-base">FregattFredrik</div>
                    <div className="text-gray-400 text-sm">21 {en ? "wins" : "vinster"}</div>
                  </div>
                  <div className="text-amber-400 font-black text-xl">1834</div>
                </div>

                {/* 14th */}
                <div className="bg-[#0d1d35] border border-[#1a2f4a] rounded-xl p-4 flex items-center gap-4">
                  <div className="text-gray-400 font-black text-xl w-8">14</div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-rose-600 flex items-center justify-center text-white font-bold text-lg">
                    K
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-base">KorvettenKim</div>
                    <div className="text-gray-400 text-sm">19 {en ? "wins" : "vinster"}</div>
                  </div>
                  <div className="text-amber-400 font-black text-xl">1812</div>
                </div>

                {/* 15th */}
                <div className="bg-[#0d1d35] border border-[#1a2f4a] rounded-xl p-4 flex items-center gap-4">
                  <div className="text-gray-400 font-black text-xl w-8">15</div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    T
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-base">TorpedTom</div>
                    <div className="text-gray-400 text-sm">18 {en ? "wins" : "vinster"}</div>
                  </div>
                  <div className="text-amber-400 font-black text-xl">1798</div>
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
