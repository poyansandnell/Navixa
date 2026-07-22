import { motion } from 'framer-motion';

import { STR } from '../i18n';

export default function Scene4({ currentScene }: { currentScene: number }) {
  // Ranked / Leaderboards "Klättra i rang"
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10 px-12"
      initial={{ opacity: 0, y: "10vh" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: "-10vw" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute top-20 left-20">
        <motion.h2 
          className="font-display font-bold text-6xl text-primary text-glow-cyan uppercase"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {STR.s4Title}
        </motion.h2>
        <motion.p
          className="font-mono text-2xl text-secondary mt-2 tracking-widest uppercase border-l-4 border-primary pl-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Glicko-2 Elo System
        </motion.p>
      </div>

      {/* Ranks visualization */}
      <div className="flex items-end justify-center gap-4 md:gap-8 mt-32 w-full h-[400px]">
        {/* Bronze / Ensign */}
        <RankBar delay={0.6} height="30%" title={STR.s4Ranks[0]} color="text-[#CD7F32]" bg="bg-[#CD7F32]" points="1200" />
        
        {/* Silver / Lieutenant */}
        <RankBar delay={0.8} height="50%" title={STR.s4Ranks[1]} color="text-[#C0C0C0]" bg="bg-[#C0C0C0]" points="1500" />
        
        {/* Gold / Captain */}
        <RankBar delay={1.0} height="70%" title={STR.s4Ranks[2]} color="text-warning" bg="bg-warning" points="1800" />
        
        {/* Diamond / Admiral */}
        <RankBar delay={1.2} height="100%" title={STR.s4Ranks[3]} color="text-primary" bg="bg-primary" points="2200+" isTop />
      </div>

      <motion.div 
        className="absolute bottom-20 right-20 bg-bg-light/80 border border-primary/30 p-6 backdrop-blur-md w-96 shadow-[0_0_30px_rgba(0,240,255,0.1)]"
        initial={{ opacity: 0, scale: 0.9, rotateX: 20 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        style={{ perspective: 1000 }}
      >
        <h3 className="font-mono text-primary font-bold mb-4 tracking-widest uppercase text-sm border-b border-primary/20 pb-2">Global Leaderboard</h3>
        {[
          { rank: 1, name: "ADMIRAL_X", elo: 2450 },
          { rank: 2, name: "GHOST_SUB", elo: 2412 },
          { rank: 3, name: "YOU", elo: 2398, isYou: true },
        ].map((p, i) => (
          <motion.div 
            key={p.rank}
            className={`flex justify-between font-mono text-sm py-2 ${p.isYou ? 'text-primary font-bold bg-primary/10 -mx-6 px-6 border-y border-primary/30' : 'text-white/70'}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 2 + i * 0.2 }}
          >
            <span className="w-8">#{p.rank}</span>
            <span className="flex-1">{p.name}</span>
            <span>{p.elo}</span>
          </motion.div>
        ))}
      </motion.div>

    </motion.div>
  );
}

function RankBar({ delay, height, title, color, bg, points, isTop = false }: any) {
  return (
    <motion.div 
      className="flex flex-col items-center justify-end w-24 md:w-32 h-full relative"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, type: "spring", stiffness: 100 }}
    >
      <motion.div 
        className={`w-full ${bg} relative`}
        initial={{ height: 0 }}
        animate={{ height }}
        transition={{ delay: delay + 0.3, duration: 1, ease: "easeOut" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-bg-dark to-transparent opacity-80" />
        {isTop && (
          <motion.div 
            className="absolute -top-12 left-1/2 -translate-x-1/2 text-4xl"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ⭐
          </motion.div>
        )}
      </motion.div>
      <div className="mt-4 text-center">
        <p className={`font-display font-bold text-lg md:text-xl tracking-widest ${color}`}>{title}</p>
        <p className="font-mono text-white/50 text-sm mt-1">{points}</p>
      </div>
    </motion.div>
  );
}
