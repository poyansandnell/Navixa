import { motion } from 'framer-motion';

export default function Scene6({ currentScene }: { currentScene: number }) {
  // Outro "Ladda ner nu"
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="w-32 h-32 mb-8 rounded-[24px] overflow-hidden border-2 border-primary/50 shadow-[0_0_40px_rgba(0,240,255,0.4)]"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/icon.png`}
          alt="Fleet Arena App Icon"
          className="w-full h-full object-contain bg-bg-light"
        />
      </motion.div>

      <motion.h1 
        className="font-display font-black text-6xl md:text-8xl text-white tracking-widest uppercase mb-4 text-glow-cyan"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5, type: "spring" }}
      >
        FLEET ARENA
      </motion.h1>

      <motion.div 
        className="flex gap-4 lg:gap-8 mt-2 mb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <span className="block font-display font-bold text-xl md:text-3xl text-primary tracking-[0.2em]">HITTA.</span>
        <span className="block font-display font-bold text-xl md:text-3xl text-accent tracking-[0.2em]">SKJUT.</span>
        <span className="block font-display font-bold text-xl md:text-3xl text-primary tracking-[0.2em]">SÄNK.</span>
      </motion.div>

      <motion.div 
        className="bg-white text-bg-dark font-display font-bold text-2xl md:text-3xl px-12 py-4 tracking-widest uppercase rounded-sm"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.5, type: "spring" }}
      >
        Ladda ner nu
      </motion.div>
      
      <motion.p
        className="font-mono text-sm text-secondary mt-6 tracking-widest"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        TILLGÄNGLIG PÅ iOS & ANDROID
      </motion.p>
      
      {/* Final dramatic flash before loop */}
      <motion.div 
        className="absolute inset-0 bg-white pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1] }}
        transition={{ duration: 5, times: [0, 0.95, 1], ease: "linear" }}
      />
    </motion.div>
  );
}
