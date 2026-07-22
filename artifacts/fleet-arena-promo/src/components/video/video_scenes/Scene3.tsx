import { motion } from 'framer-motion';

import { STR } from '../i18n';

export default function Scene3({ currentScene }: { currentScene: number }) {
  // Sink - Ship silhouette destroyed
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "brightness(2) contrast(2)", scale: 1.1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="absolute top-1/4 w-full text-center z-20">
        <motion.h2 
          className="font-display font-black text-8xl md:text-[150px] tracking-widest text-accent text-glow-red uppercase"
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
        >
          {STR.s3Title}
        </motion.h2>
      </div>

      <div className="relative w-full max-w-6xl mt-24 h-64 flex items-center justify-center">
        {/* Explosion flash background */}
        <motion.div 
          className="absolute inset-0 bg-accent rounded-full blur-[150px]"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0.2], scale: [0, 1.5, 1.2] }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        {/* Ship Silhouette Container */}
        <motion.div 
          className="relative w-full h-full z-10 flex items-center justify-center"
          initial={{ x: "10%" }}
          animate={{ x: 0 }}
          transition={{ duration: 4, ease: "linear" }}
        >
          {/* Base Ship */}
          <motion.img 
            src={`${import.meta.env.BASE_URL}images/battleship.png`}
            className="absolute w-4/5 h-auto object-contain opacity-20"
            style={{ filter: "invert(1)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
          />

          {/* Destroyed / Sinking Ship (rotated and sliding down) */}
          <motion.img 
            src={`${import.meta.env.BASE_URL}images/battleship.png`}
            className="absolute w-4/5 h-auto object-contain"
            style={{ filter: 'invert(1) sepia(1) hue-rotate(-50deg) saturate(5) drop-shadow(0 0 20px #FF3366)' }}
            initial={{ rotate: 0, y: 0, opacity: 1 }}
            animate={{ rotate: 15, y: 150, opacity: 0 }}
            transition={{ duration: 3, delay: 0.5, ease: "easeIn" }}
          />

          {/* Hit markers overlay */}
          <motion.div 
            className="absolute z-20 flex gap-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 2, delay: 0.5 }}
          >
            {[1, 2, 3, 4].map(i => (
              <motion.div 
                key={i}
                className="w-16 h-16 relative"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: [1, 1.5, 1], rotate: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              >
                <div className="absolute inset-0 bg-accent rounded-sm opacity-80" />
                <div className="absolute inset-2 bg-white rounded-full" />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* HUD Overlay text */}
        <motion.div 
          className="absolute bottom-0 font-mono text-4xl font-bold text-accent tracking-widest uppercase bg-bg-dark/80 px-8 py-4 border-2 border-accent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          {STR.s3Sunk}
        </motion.div>
        <motion.div 
          className="absolute bottom-[-40px] font-mono text-xl text-white tracking-widest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          {STR.s3Won}
        </motion.div>
      </div>

    </motion.div>
  );
}
