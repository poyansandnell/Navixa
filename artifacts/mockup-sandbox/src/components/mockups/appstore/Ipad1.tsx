import React from 'react';
import { User, Crosshair, Clock, Shield, Target } from 'lucide-react';

export default function Ipad1() {
  return (
    <div style={{ width: 2048, height: 2732 }} className="relative bg-gradient-to-br from-[#0a0a0c] via-[#101016] to-[#0a0a0c] overflow-hidden flex flex-col font-['Inter',sans-serif]">
      {/* Background texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
      
      {/* Glowing orbs */}
      <div className="absolute top-[-200px] left-[-200px] w-[1000px] h-[1000px] bg-amber-500/10 rounded-full blur-[150px]"></div>
      <div className="absolute bottom-[200px] right-[-200px] w-[1200px] h-[1200px] bg-blue-600/10 rounded-full blur-[180px]"></div>

      {/* Copy */}
      <div className="relative z-10 pt-[180px] px-[160px] flex flex-col items-center text-center">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-[2px] bg-amber-500"></div>
          <span className="text-amber-500 text-3xl font-bold tracking-[0.2em] uppercase">Navixa</span>
          <div className="w-12 h-[2px] bg-amber-500"></div>
        </div>
        
        <h1 className="text-white text-[120px] font-black leading-[1.1] tracking-tight mb-12">
          Hela sjöslaget.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">Större</span> än någonsin.
        </h1>
        
        <p className="text-slate-400 text-4xl font-medium max-w-[1200px] leading-relaxed">
          Full överblick över stridszonen. Planera dina attacker och se motståndarens drag i realtid på en och samma skärm.
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
            <div className="h-[140px] shrink-0 bg-[#0A1628] border-b border-[#1D2F4F] flex items-center justify-between px-12">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-1">
                  <div className="w-full h-full bg-[#050B14] rounded-xl flex items-center justify-center">
                    <User className="text-white w-10 h-10" />
                  </div>
                </div>
                <div>
                  <h3 className="text-white text-3xl font-bold">Kapten_Erik</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Shield className="w-5 h-5 text-amber-500" />
                    <span className="text-amber-500 text-xl font-medium">Rank 42</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="text-slate-400 text-xl font-medium uppercase tracking-widest mb-2">Din Tur</div>
                <div className="flex items-center gap-3 bg-amber-500/10 px-6 py-3 rounded-full border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                  <Clock className="w-6 h-6 text-amber-500" />
                  <span className="text-amber-500 text-3xl font-bold tabular-nums">0:45</span>
                </div>
              </div>

              <div className="flex items-center gap-6 text-right">
                <div>
                  <h3 className="text-white text-3xl font-bold">SjöormenSara</h3>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <span className="text-slate-400 text-xl font-medium">Rank 38</span>
                    <Shield className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 p-1">
                  <div className="w-full h-full bg-[#050B14] rounded-xl flex items-center justify-center">
                    <User className="text-white w-10 h-10" />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Battle Area */}
            <div className="flex-1 p-12 flex flex-col gap-12 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0A1628] to-[#050B14]">
              
              {/* Grids Row */}
              <div className="flex gap-12 shrink-0">
                {/* Left Board: My Fleet */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-white text-4xl font-bold flex items-center gap-4">
                      <Shield className="w-10 h-10 text-indigo-400" />
                      Din Flotta
                    </h2>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={`w-12 h-3 rounded-full ${i <= 3 ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-[#1D2F4F]'}`}></div>
                      ))}
                    </div>
                  </div>
                  <div className="w-full bg-[#0A1628] rounded-[32px] border-2 border-[#1D2F4F] p-8 shadow-2xl">
                    {/* Grid 10x10 */}
                    <div className="w-full aspect-square grid grid-cols-10 grid-rows-10 gap-2">
                      {Array.from({ length: 100 }).map((_, i) => {
                        const x = i % 10;
                        const y = Math.floor(i / 10);
                        let content = null;
                        let bg = "bg-[#050B14] hover:bg-[#0F1C33]";
                        let border = "border border-[#1D2F4F]/50";
                        
                        // My ships
                        if (y === 2 && x >= 2 && x <= 6) {
                          bg = "bg-indigo-600/40";
                          border = "border-2 border-indigo-500";
                          if (x === 2) border += " rounded-l-xl";
                          if (x === 6) border += " rounded-r-xl";
                        }
                        
                        // Submarine
                        if (x === 8 && y >= 6 && y <= 8) {
                           bg = "bg-indigo-600/40";
                           border = "border-2 border-indigo-500";
                           if (y === 6) border += " rounded-t-xl";
                           if (y === 8) border += " rounded-b-xl";
                           if (y === 7) { bg = "bg-red-500/20"; border = "border-2 border-red-500"; content = <div className="absolute inset-0 flex items-center justify-center"><div className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]"></div></div>; } // Hit!
                        }

                        // Misses from opponent
                        if ((x===1 && y===1) || (x===4 && y===7) || (x===2 && y===8)) {
                          content = <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 bg-slate-500 rounded-full"></div></div>;
                        }

                        return (
                          <div key={i} className={`relative rounded-lg transition-colors ${bg} ${border}`}>
                            {content}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Board: Radar / Attack */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-white text-4xl font-bold flex items-center gap-4">
                      <Target className="w-10 h-10 text-amber-500" />
                      Attackradar
                    </h2>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className={`w-12 h-3 rounded-full ${i <= 2 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-[#1D2F4F]'}`}></div>
                      ))}
                    </div>
                  </div>
                  <div className="w-full bg-[#0A1628] rounded-[32px] border-2 border-amber-500/30 p-8 shadow-[0_0_50px_rgba(245,158,11,0.05)] relative overflow-hidden">
                    {/* Radar sweep effect */}
                    <div className="absolute inset-0 rounded-[32px] overflow-hidden pointer-events-none">
                      <div className="w-[200%] h-[200%] absolute top-[-50%] left-[-50%] bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(245,158,11,0.08)_90deg,transparent_90deg)] animate-spin" style={{ animationDuration: '4s' }}></div>
                    </div>
                    
                    {/* Grid 10x10 */}
                    <div className="w-full aspect-square grid grid-cols-10 grid-rows-10 gap-2 relative z-10">
                      {Array.from({ length: 100 }).map((_, i) => {
                        const x = i % 10;
                        const y = Math.floor(i / 10);
                        let content = null;
                        let bg = "bg-[#050B14]/80 hover:bg-amber-500/20";
                        let border = "border border-amber-500/10";
                        let hitEffect = null;

                        // My hits
                        if ((x===3 && y===3) || (x===4 && y===3) || (x===5 && y===3)) {
                          bg = "bg-red-500/20";
                          border = "border border-red-500/50";
                          content = <div className="absolute inset-0 flex items-center justify-center"><Crosshair className="w-8 h-8 text-red-500 opacity-90 drop-shadow-[0_0_10px_rgba(239,68,68,0.6)]" /></div>;
                          if (x===4) hitEffect = <div className="absolute inset-[-10px] border-2 border-red-500/50 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>;
                        }

                        // My misses
                        if ((x===2 && y===2) || (x===7 && y===5) || (x===6 && y===8) || (x===8 && y===1)) {
                          content = <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 bg-slate-500 rounded-full"></div></div>;
                        }

                        return (
                          <div key={i} className={`relative rounded-lg transition-colors cursor-pointer ${bg} ${border}`}>
                            {content}
                            {hitEffect}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lower Section (Combat Log & Status) */}
              <div className="flex gap-12 flex-1">
                {/* Logg */}
                <div className="flex-1 bg-[#0A1628] rounded-[32px] border-2 border-[#1D2F4F] p-8 flex flex-col">
                  <h3 className="text-slate-400 text-2xl font-bold mb-6 uppercase tracking-widest flex items-center gap-3">
                    <Clock className="w-6 h-6" />
                    Stridslogg
                  </h3>
                  <div className="space-y-4 flex-1">
                     <div className="flex items-center gap-4 bg-[#050B14] p-5 rounded-2xl border border-[#1D2F4F]">
                        <span className="text-slate-500 font-mono text-xl w-20">14:02</span>
                        <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                        <span className="text-white text-2xl">Träff på <span className="font-bold text-red-400">D4</span>! Motståndarens u-båt skadad.</span>
                     </div>
                     <div className="flex items-center gap-4 bg-[#050B14] p-5 rounded-2xl border border-[#1D2F4F]">
                        <span className="text-slate-500 font-mono text-xl w-20">14:01</span>
                        <div className="w-4 h-4 rounded-full bg-slate-500"></div>
                        <span className="text-slate-300 text-2xl">Miss på <span className="font-bold text-slate-400">B7</span>.</span>
                     </div>
                     <div className="flex items-center gap-4 bg-[#050B14] p-5 rounded-2xl border border-[#1D2F4F]">
                        <span className="text-slate-500 font-mono text-xl w-20">13:58</span>
                        <div className="w-4 h-4 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                        <span className="text-slate-300 text-2xl">Motståndaren missade din kryssare på <span className="font-bold text-indigo-400">H2</span>.</span>
                     </div>
                     <div className="flex items-center gap-4 bg-[#050B14] p-5 rounded-2xl border border-[#1D2F4F]">
                        <span className="text-slate-500 font-mono text-xl w-20">13:55</span>
                        <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                        <span className="text-white text-2xl">Träff på <span className="font-bold text-red-400">E4</span>! Motståndarens u-båt skadad.</span>
                     </div>
                     <div className="flex items-center gap-4 bg-[#050B14] p-5 rounded-2xl border border-[#1D2F4F] opacity-50">
                        <span className="text-slate-500 font-mono text-xl w-20">13:42</span>
                        <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
                        <span className="text-slate-400 text-2xl">Matchen startade. Din tur.</span>
                     </div>
                  </div>
                </div>

                {/* Status */}
                <div className="flex-[0.8] bg-gradient-to-b from-[#0A1628] to-[#050B14] rounded-[32px] border-2 border-[#1D2F4F] p-8 flex flex-col">
                  <h3 className="text-slate-400 text-2xl font-bold mb-8 uppercase tracking-widest flex items-center gap-3">
                    <Shield className="w-6 h-6" />
                    Flottans Status
                  </h3>
                  <div className="space-y-8">
                     <div>
                       <div className="flex justify-between text-2xl mb-4">
                          <span className="text-white font-medium">Hangarfartyg</span>
                          <span className="text-emerald-400 font-bold">100%</span>
                       </div>
                       <div className="h-5 bg-[#050B14] rounded-full overflow-hidden border border-[#1D2F4F]">
                          <div className="h-full bg-emerald-500 w-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                       </div>
                     </div>
                     <div>
                       <div className="flex justify-between text-2xl mb-4">
                          <span className="text-white font-medium">Slagskepp</span>
                          <span className="text-amber-500 font-bold">60%</span>
                       </div>
                       <div className="h-5 bg-[#050B14] rounded-full overflow-hidden border border-[#1D2F4F]">
                          <div className="h-full bg-amber-500 w-[60%] shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                       </div>
                     </div>
                     <div>
                       <div className="flex justify-between text-2xl mb-4">
                          <span className="text-white font-medium">Kryssare</span>
                          <span className="text-red-500 font-bold">Kritisk</span>
                       </div>
                       <div className="h-5 bg-[#050B14] rounded-full overflow-hidden border border-[#1D2F4F]">
                          <div className="h-full bg-red-500 w-[20%] animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                       </div>
                     </div>
                     <div className="opacity-50">
                       <div className="flex justify-between text-2xl mb-4">
                          <span className="text-slate-400 font-medium line-through">U-båt</span>
                          <span className="text-slate-500 font-bold uppercase tracking-wider text-xl mt-1">Sänkt</span>
                       </div>
                       <div className="h-5 bg-[#050B14] rounded-full overflow-hidden border border-[#1D2F4F]">
                          <div className="h-full bg-slate-600 w-0"></div>
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
