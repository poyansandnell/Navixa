import { motion } from 'framer-motion';

import { STR } from '../i18n';

export default function Scene5({ currentScene }: { currentScene: number }) {
  // Quests & Cosmetics "Uppdrag & Belöningar"
  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10 px-12"
      initial={{ opacity: 0, x: "10vw" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute top-20 right-20 text-right">
        <motion.h2 
          className="font-display font-bold text-6xl text-warning uppercase"
          style={{ textShadow: "0 0 20px rgba(255,215,0,0.5)" }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {STR.s5Title}
        </motion.h2>
        <motion.p
          className="font-mono text-xl text-white mt-2 tracking-widest uppercase border-r-4 border-warning pr-4 inline-block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {STR.s5Sub}
        </motion.p>
      </div>

      <div className="flex w-full max-w-6xl mt-12 gap-12">
        {/* Daily Quests Panel */}
        <motion.div 
          className="flex-1 bg-bg-light/60 border border-secondary/30 p-8 backdrop-blur-md relative overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-secondary/50" />
          <h3 className="font-mono font-bold text-secondary mb-8 tracking-widest uppercase">{STR.s5Daily}</h3>
          
          <div className="space-y-6">
            <QuestItem delay={0.8} title={STR.s5Q1} reward="500 XP" progress="3/5" />
            <QuestItem delay={1.0} title={STR.s5Q2} reward={STR.s5Q2Reward} progress="1/3" />
            <QuestItem delay={1.2} title={STR.s5Q3} reward="200 COINS" progress={STR.s5Done} done />
          </div>
        </motion.div>

        {/* Cosmetics Preview */}
        <motion.div 
          className="flex-1 flex flex-col justify-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <motion.div 
            className="w-full bg-gradient-to-tr from-bg-dark to-primary/10 border-2 border-primary/40 p-8 relative flex items-center justify-center group h-64"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.4, type: "spring" }}
          >
            <motion.div 
              className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity"
              animate={{ opacity: [0, 0.2, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <img 
              src={`${import.meta.env.BASE_URL}images/carrier.png`} 
              className="h-40 w-auto object-contain" 
              style={{ filter: "invert(1) drop-shadow(0 0 15px #00F0FF)" }}
            />
            <div className="absolute bottom-4 left-6 font-mono text-sm text-primary font-bold uppercase tracking-widest">
              {STR.s5Unlocked}
            </div>
          </motion.div>

          <motion.div 
            className="w-full bg-gradient-to-tr from-bg-dark to-warning/10 border-2 border-warning/40 p-8 relative flex items-center justify-center h-32"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.6, type: "spring" }}
          >
            <div className="font-display font-black text-4xl text-warning tracking-widest drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]">
              "KRAKEN"
            </div>
            <div className="absolute bottom-4 left-6 font-mono text-sm text-warning font-bold uppercase tracking-widest">
              Ny Titel Utrustad
            </div>
          </motion.div>
        </motion.div>
      </div>

    </motion.div>
  );
}

function QuestItem({ delay, title, reward, progress, done = false }: any) {
  return (
    <motion.div 
      className={`p-4 border ${done ? 'border-primary/50 bg-primary/10' : 'border-white/10 bg-black/20'} flex items-center justify-between`}
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div>
        <h4 className={`font-display font-bold text-xl tracking-wider ${done ? 'text-primary' : 'text-white'}`}>{title}</h4>
        <p className="font-mono text-sm text-white/50 mt-1">{STR.s5RewardLabel} {reward}</p>
      </div>
      <div className={`font-mono font-bold ${done ? 'text-primary' : 'text-white'}`}>
        {progress}
      </div>
    </motion.div>
  );
}
