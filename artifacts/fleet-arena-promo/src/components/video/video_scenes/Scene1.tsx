import { motion } from 'framer-motion';

export default function Scene1({ currentScene }: { currentScene: number }) {
  // Matchmaking
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: "-10vh" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute top-1/4 left-0 w-full text-center">
        <motion.h2 
          className="font-display font-bold text-5xl md:text-7xl tracking-wider text-white text-glow-cyan"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          SÖK.
        </motion.h2>
        <motion.p
          className="font-mono text-xl md:text-2xl text-secondary mt-4 tracking-widest uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          Global Matchmaking
        </motion.p>
      </div>

      {/* VS Screen */}
      <div className="relative mt-24 flex items-center justify-center gap-12 w-full max-w-4xl px-8">
        {/* Player 1 */}
        <motion.div 
          className="flex flex-col items-center"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 1, type: "spring", stiffness: 100 }}
        >
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-2 border-primary bg-bg-light flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.4)]">
             <img src={`${import.meta.env.BASE_URL}images/icon.png`} className="w-24 h-24 object-contain opacity-80" />
          </div>
          <p className="mt-4 font-display text-2xl font-bold text-white tracking-widest">COMMANDER</p>
          <p className="font-mono text-primary">ELo 1450</p>
        </motion.div>

        {/* VS */}
        <motion.div 
          className="font-display font-black text-6xl text-accent text-glow-red"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5, type: "spring" }}
        >
          VS
        </motion.div>

        {/* Player 2 (Searching -> Found) */}
        <motion.div 
          className="flex flex-col items-center"
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 1, type: "spring", stiffness: 100 }}
        >
          <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full border-2 border-accent bg-bg-light flex items-center justify-center overflow-hidden">
            {/* Searching state */}
            <motion.div 
              className="absolute inset-0 border-4 border-accent rounded-full border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: 2.5, ease: "linear" }}
            />
            {/* Found Avatar */}
            <motion.div
              className="w-full h-full bg-accent/20 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3.5 }}
            >
              <div className="w-20 h-20 rounded-full bg-accent" />
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.5 }} className="text-center mt-4">
            <p className="font-display text-2xl font-bold text-white tracking-widest">ADMIRAL_X</p>
            <p className="font-mono text-accent">ELo 1482</p>
          </motion.div>
          <motion.div 
            className="absolute -bottom-8 font-mono text-sm text-secondary"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, delay: 3.5 }}
          >
            Söker radar...
          </motion.div>
        </motion.div>
      </div>

    </motion.div>
  );
}
