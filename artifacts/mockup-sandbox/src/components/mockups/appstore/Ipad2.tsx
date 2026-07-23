import React from 'react';
import { User, Trophy, Search, ChevronRight, Play, Swords, Shield, Medal, Star } from 'lucide-react';

export default function Ipad2() {
  const en = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('lang') === 'en';

  return (
    <div style={{ width: 2048, height: 2732 }} className="relative bg-gradient-to-br from-[#0a0a0c] via-[#101016] to-[#0a0a0c] overflow-hidden flex flex-col font-['Inter',sans-serif]">
      {/* Background texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
      
      {/* Glowing orbs */}
      <div className="absolute top-[-200px] right-[-200px] w-[1000px] h-[1000px] bg-amber-500/10 rounded-full blur-[150px]"></div>
      <div className="absolute bottom-[200px] left-[-200px] w-[1200px] h-[1200px] bg-indigo-600/10 rounded-full blur-[180px]"></div>

      {/* Copy */}
      <div className="relative z-10 pt-[180px] px-[160px] flex flex-col items-center text-center">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-[2px] bg-amber-500"></div>
          <span className="text-amber-500 text-3xl font-bold tracking-[0.2em] uppercase">NAVIXA</span>
          <div className="w-12 h-[2px] bg-amber-500"></div>
        </div>
        
        <h1 className="text-white text-[120px] font-black leading-[1.1] tracking-tight mb-12">
          {en ? "All your matches." : "Alla dina matcher."}<br />
          {en ? "At a " : "En "} <span className="relative inline-block">
            <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">{en ? "glance." : "överblick."}</span>
            <div className="absolute bottom-4 left-0 w-full h-4 bg-amber-500/30 -z-10 rounded-full blur-sm"></div>
          </span>
        </h1>
        
        <p className="text-slate-400 text-4xl font-medium max-w-[1200px] leading-relaxed">
          {en ? "Keep track of active games, challenge friends and climb the leaderboard. All gathered in one beautiful place." : "Håll koll på aktiva spel, utmana vänner och klättra på topplistan. Allt samlat på en vacker och tydlig plats."}
        </p>
      </div>

      {/* iPad Mockup - fits horizontally, bleeds off bottom */}
      <div className="absolute top-[780px] left-1/2 -translate-x-1/2 z-20">
        <div 
          className="relative bg-[#0A1628] rounded-[64px] shadow-[0_80px_200px_rgba(0,0,0,0.8),inset_0_4px_12px_rgba(255,255,255,0.15)] flex flex-col overflow-hidden" 
          style={{ width: '1888px', height: '2200px', border: '24px solid #1a1a1c', borderTopWidth: '40px' }}
        >
          {/* Bezel camera */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 bg-[#0a0a0c] rounded-full mt-[-30px] border border-[#2a2a2c]"></div>
          
          {/* App UI */}
          <div className="relative flex-1 bg-[#050B14] rounded-[36px] overflow-hidden m-[2px] flex flex-col">
            
            {/* Header */}
            <div className="h-[140px] shrink-0 bg-[#0A1628] border-b border-[#1D2F4F] flex items-center justify-between px-16">
              <div className="flex items-center gap-8">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 p-1">
                  <div className="w-full h-full bg-[#050B14] rounded-2xl flex items-center justify-center overflow-hidden relative">
                     <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Erik" className="w-full h-full object-cover opacity-80" alt="Avatar"/>
                     <div className="absolute inset-0 bg-indigo-900/40 mix-blend-overlay"></div>
                  </div>
                </div>
                <div>
                  <h2 className="text-white text-4xl font-bold mb-2">Kapten_Erik</h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-[#050B14] px-4 py-2 rounded-full border border-[#1D2F4F]">
                      <Trophy className="w-6 h-6 text-amber-500" />
                      <span className="text-white text-xl font-medium">Rank 42</span>
                    </div>
                    <div className="flex items-center gap-2 bg-[#050B14] px-4 py-2 rounded-full border border-[#1D2F4F]">
                      <Star className="w-6 h-6 text-indigo-400" />
                      <span className="text-white text-xl font-medium">1,240 XP</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-6">
                <button className="bg-[#1D2F4F] hover:bg-[#2A4066] text-white px-8 py-4 rounded-2xl text-2xl font-bold flex items-center gap-3 transition-colors">
                  <Search className="w-7 h-7" />
                  {en ? "Search players" : "Sök spelare"}
                </button>
                <button className="bg-amber-500 hover:bg-amber-400 text-[#050B14] px-10 py-4 rounded-2xl text-2xl font-bold flex items-center gap-3 transition-colors shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                  <Swords className="w-7 h-7" />
                  {en ? "New match" : "Ny match"}
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-16 flex gap-16 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0A1628] to-[#050B14]">
              
              {/* Left Column: Dina matcher */}
              <div className="flex-[3] flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-white text-3xl font-bold flex items-center gap-4">
                    {en ? "Active matches" : "Aktiva matcher"}
                    <span className="bg-amber-500 text-[#050B14] text-xl px-4 py-1 rounded-full font-bold">5</span>
                  </h3>
                </div>

                <div className="flex flex-col gap-6">
                  {/* Match Card 1 - Din tur */}
                  <div className="bg-gradient-to-r from-amber-500/10 to-[#0A1628] rounded-[32px] border-2 border-amber-500/30 p-8 flex items-center justify-between shadow-[0_0_40px_rgba(245,158,11,0.05)] relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-amber-500"></div>
                    <div className="flex items-center gap-8 pl-4">
                       <div className="relative">
                          <div className="w-24 h-24 rounded-full border-4 border-[#0A1628] bg-purple-900 overflow-hidden flex items-center justify-center">
                             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sara" className="w-full h-full object-cover" alt=""/>
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-[#050B14] border border-[#1D2F4F] w-10 h-10 rounded-full flex items-center justify-center">
                             <Shield className="w-5 h-5 text-slate-400" />
                          </div>
                       </div>
                       <div>
                         <div className="text-amber-500 text-xl font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                           <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]"></span>
                           {en ? "Your turn" : "Din tur"}
                         </div>
                         <h4 className="text-white text-4xl font-bold">SjöormenSara</h4>
                         <p className="text-slate-400 text-2xl mt-2">{en ? "Round 14 • 12 ships left" : "Omgång 14 • 12 fartyg kvar"}</p>
                       </div>
                    </div>
                    <button className="bg-amber-500 text-[#050B14] w-24 h-24 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                      <Play className="w-10 h-10 ml-2" fill="currentColor" />
                    </button>
                  </div>

                  {/* Match Card 2 - Din tur */}
                  <div className="bg-gradient-to-r from-amber-500/10 to-[#0A1628] rounded-[32px] border-2 border-amber-500/30 p-8 flex items-center justify-between shadow-[0_0_40px_rgba(245,158,11,0.05)] relative overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-amber-500"></div>
                    <div className="flex items-center gap-8 pl-4">
                       <div className="relative">
                          <div className="w-24 h-24 rounded-full border-4 border-[#0A1628] bg-emerald-900 overflow-hidden flex items-center justify-center">
                             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ghost" className="w-full h-full object-cover" alt=""/>
                          </div>
                       </div>
                       <div>
                         <div className="text-amber-500 text-xl font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                           <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]"></span>
                           {en ? "Your turn" : "Din tur"}
                         </div>
                         <h4 className="text-white text-4xl font-bold">SpökSkeppet</h4>
                         <p className="text-slate-400 text-2xl mt-2">{en ? "Round 2 • 17 ships left" : "Omgång 2 • 17 fartyg kvar"}</p>
                       </div>
                    </div>
                    <button className="bg-amber-500 text-[#050B14] w-24 h-24 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                      <Play className="w-10 h-10 ml-2" fill="currentColor" />
                    </button>
                  </div>

                  {/* Match Card 3 - Motståndarens tur */}
                  <div className="bg-[#0A1628] rounded-[32px] border-2 border-[#1D2F4F] p-8 flex items-center justify-between opacity-80">
                    <div className="flex items-center gap-8">
                       <div className="relative">
                          <div className="w-24 h-24 rounded-full border-4 border-[#050B14] bg-blue-900 overflow-hidden flex items-center justify-center">
                             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Amiral" className="w-full h-full object-cover" alt=""/>
                          </div>
                       </div>
                       <div>
                         <div className="text-slate-500 text-xl font-bold uppercase tracking-wider mb-2">
                           {en ? "Waiting for" : "Väntar på"}
                         </div>
                         <h4 className="text-white text-4xl font-bold">Amiral_Svensson</h4>
                         <p className="text-slate-400 text-2xl mt-2">{en ? "Round 4 • 16 ships left" : "Omgång 4 • 16 fartyg kvar"}</p>
                       </div>
                    </div>
                    <ChevronRight className="w-12 h-12 text-slate-600" />
                  </div>

                  {/* Match Card 4 - Motståndarens tur */}
                  <div className="bg-[#0A1628] rounded-[32px] border-2 border-[#1D2F4F] p-8 flex items-center justify-between opacity-80">
                    <div className="flex items-center gap-8">
                       <div className="relative">
                          <div className="w-24 h-24 rounded-full border-4 border-[#050B14] bg-teal-900 overflow-hidden flex items-center justify-center">
                             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Kryssaren" className="w-full h-full object-cover" alt=""/>
                          </div>
                       </div>
                       <div>
                         <div className="text-slate-500 text-xl font-bold uppercase tracking-wider mb-2">
                           {en ? "Waiting for" : "Väntar på"}
                         </div>
                         <h4 className="text-white text-4xl font-bold">Kryssaren</h4>
                         <p className="text-slate-400 text-2xl mt-2">{en ? "Round 1 • 17 ships left" : "Omgång 1 • 17 fartyg kvar"}</p>
                       </div>
                    </div>
                    <ChevronRight className="w-12 h-12 text-slate-600" />
                  </div>

                  {/* Match Card 5 - Motståndarens tur */}
                  <div className="bg-[#0A1628] rounded-[32px] border-2 border-[#1D2F4F] p-8 flex items-center justify-between opacity-80">
                    <div className="flex items-center gap-8">
                       <div className="relative">
                          <div className="w-24 h-24 rounded-full border-4 border-[#050B14] bg-red-900 overflow-hidden flex items-center justify-center">
                             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Destroyer" className="w-full h-full object-cover" alt=""/>
                          </div>
                       </div>
                       <div>
                         <div className="text-slate-500 text-xl font-bold uppercase tracking-wider mb-2">
                           {en ? "Waiting for" : "Väntar på"}
                         </div>
                         <h4 className="text-white text-4xl font-bold">Kapten_Krok</h4>
                         <p className="text-slate-400 text-2xl mt-2">{en ? "Round 8 • 5 ships left" : "Omgång 8 • 5 fartyg kvar"}</p>
                       </div>
                    </div>
                    <ChevronRight className="w-12 h-12 text-slate-600" />
                  </div>

                </div>
              </div>

              {/* Right Column: Topplista */}
              <div className="flex-[2] flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-white text-3xl font-bold flex items-center gap-4">
                    <Medal className="w-8 h-8 text-indigo-400" />
                    {en ? "Leaderboard (Sweden)" : "Topplista (Sverige)"}
                  </h3>
                </div>
                
                <div className="bg-[#0A1628] rounded-[32px] border-2 border-[#1D2F4F] p-8 flex-1 flex flex-col">
                  {/* Leaderboard entries */}
                  <div className="flex flex-col gap-6">
                    {/* Rank 1 */}
                    <div className="flex items-center gap-6 p-6 rounded-2xl bg-[#050B14] border border-[#1D2F4F]/50 shadow-lg">
                      <div className="w-16 text-center text-amber-500 text-4xl font-black">1</div>
                      <div className="w-20 h-20 rounded-full border-2 border-amber-500 bg-red-900 overflow-hidden">
                         <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Vast" className="w-full h-full object-cover" alt=""/>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white text-3xl font-bold">Västkusten</h4>
                        <p className="text-slate-400 text-xl mt-1">9,420 XP</p>
                      </div>
                      <Trophy className="w-10 h-10 text-amber-500" />
                    </div>

                    {/* Rank 2 */}
                    <div className="flex items-center gap-6 p-6 rounded-2xl bg-[#050B14] border border-[#1D2F4F]/50 shadow-lg">
                      <div className="w-16 text-center text-slate-300 text-4xl font-black">2</div>
                      <div className="w-20 h-20 rounded-full border-2 border-slate-300 bg-blue-900 overflow-hidden">
                         <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Marin" className="w-full h-full object-cover" alt=""/>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white text-3xl font-bold">MarinBlå</h4>
                        <p className="text-slate-400 text-xl mt-1">8,950 XP</p>
                      </div>
                    </div>

                    {/* Rank 3 */}
                    <div className="flex items-center gap-6 p-6 rounded-2xl bg-[#050B14] border border-[#1D2F4F]/50 shadow-lg">
                      <div className="w-16 text-center text-orange-400 text-4xl font-black">3</div>
                      <div className="w-20 h-20 rounded-full border-2 border-orange-400 bg-green-900 overflow-hidden">
                         <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Bjorn" className="w-full h-full object-cover" alt=""/>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white text-3xl font-bold">Sjöbjörn</h4>
                        <p className="text-slate-400 text-xl mt-1">8,100 XP</p>
                      </div>
                    </div>
                    
                    {/* Rank 4 */}
                    <div className="flex items-center gap-6 p-6 rounded-2xl bg-[#050B14] border border-[#1D2F4F]/50">
                      <div className="w-16 text-center text-slate-500 text-4xl font-black">4</div>
                      <div className="w-20 h-20 rounded-full border-2 border-[#1D2F4F] bg-purple-900 overflow-hidden">
                         <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Norr" className="w-full h-full object-cover" alt=""/>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white text-3xl font-bold">Norrland</h4>
                        <p className="text-slate-400 text-xl mt-1">7,650 XP</p>
                      </div>
                    </div>
                    
                    {/* Rank 5 */}
                    <div className="flex items-center gap-6 p-6 rounded-2xl bg-[#050B14] border border-[#1D2F4F]/50">
                      <div className="w-16 text-center text-slate-500 text-4xl font-black">5</div>
                      <div className="w-20 h-20 rounded-full border-2 border-[#1D2F4F] bg-indigo-900 overflow-hidden">
                         <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Syd" className="w-full h-full object-cover" alt=""/>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white text-3xl font-bold">SydKust</h4>
                        <p className="text-slate-400 text-xl mt-1">7,120 XP</p>
                      </div>
                    </div>

                    {/* Separator */}
                    <div className="flex justify-center py-4">
                       <div className="w-3 h-3 rounded-full bg-[#1D2F4F] mx-2"></div>
                       <div className="w-3 h-3 rounded-full bg-[#1D2F4F] mx-2"></div>
                       <div className="w-3 h-3 rounded-full bg-[#1D2F4F] mx-2"></div>
                    </div>

                    {/* You */}
                    <div className="flex items-center gap-6 p-6 rounded-2xl bg-indigo-900/30 border-2 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)] relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-2 bg-indigo-500"></div>
                      <div className="w-16 text-center text-indigo-400 text-4xl font-black">42</div>
                      <div className="w-20 h-20 rounded-full border-2 border-indigo-400 bg-indigo-900 overflow-hidden">
                         <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Erik" className="w-full h-full object-cover" alt=""/>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white text-3xl font-bold">Kapten_Erik</h4>
                        <p className="text-indigo-300 text-xl mt-1">1,240 XP</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
