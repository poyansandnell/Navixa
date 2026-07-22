import { motion } from 'framer-motion';

export default function Scene0({ currentScene }: { currentScene: number }) {
  // Intro: Fleet Arena logo + Tagline
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="relative w-48 h-48 mb-8"
        initial={{ scale: 0, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Radar sweeping circle behind logo */}
        <motion.div 
          className="absolute inset-0 rounded-full border border-primary/40 shadow-[0_0_30px_rgba(0,240,255,0.3)]"
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
        <img 
          src={`${import.meta.env.BASE_URL}images/icon.png`}
          alt="Fleet Arena Logo"
          className="w-full h-full object-contain relative z-10 drop-shadow-2xl rounded-[32px]"
        />
      </motion.div>

      <motion.div className="overflow-hidden">
        <motion.h1 
          className="font-display font-black text-7xl md:text-8xl lg:text-9xl text-white tracking-widest uppercase mb-4 text-glow-cyan"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          FLEET ARENA
        </motion.h1>
      </motion.div>

      <motion.div className="flex gap-4 lg:gap-8 mt-6">
        {["HITTA.", "SKJUT.", "SÄNK."].map((word, i) => (
          <motion.div
            key={word}
            className="overflow-hidden"
          >
            <motion.span 
              className="block font-display font-bold text-2xl md:text-4xl text-primary tracking-[0.2em]"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.2 + i * 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {word}
            </motion.span>
          </motion.div>
        ))}
      </motion.div>

      {/* Grid Coordinates decorative */}
      <motion.div 
        className="absolute top-8 left-12 font-mono text-sm text-primary/50 tracking-widest"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
      >
        <p>SYS.INIT // v2.4.0</p>
        <p>COORD: 59°19'46"N 18°04'07"E</p>
        <p>STATUS: ONLINE</p>
      </motion.div>

    </motion.div>
  );
}
