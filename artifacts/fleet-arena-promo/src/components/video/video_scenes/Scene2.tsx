import { motion } from 'framer-motion';

export default function Scene2({ currentScene }: { currentScene: number }) {
  // Grid board / "Skjut."
  const cols = ["A","B","C","D","E","F","G","H","I","J"];
  const rows = [1,2,3,4,5,6,7,8,9,10];

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      style={{ perspective: 1000 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 2 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute top-16 left-16 z-20">
        <motion.h2 
          className="font-display font-bold text-6xl md:text-8xl tracking-wider text-accent text-glow-red"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          ELDA.
        </motion.h2>
        <motion.p
          className="font-mono text-xl md:text-2xl text-white mt-2 tracking-widest uppercase bg-accent/20 px-4 py-1 inline-block border-l-4 border-accent"
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "auto" }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          Klassisk bräda. Ny intensitet.
        </motion.p>
      </div>

      {/* Grid container tilted in 3D */}
      <motion.div 
        className="relative grid grid-cols-10 grid-rows-10 gap-1 p-2 bg-bg-light/40 border-2 border-primary/50 backdrop-blur-sm shadow-[0_0_50px_rgba(0,240,255,0.15)]"
        initial={{ rotateX: 60, rotateZ: -30, scale: 0.8, y: 100, opacity: 0 }}
        animate={{ rotateX: 45, rotateZ: -15, scale: 1.2, y: 0, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      >
        {/* Decorative Grid labels */}
        <div className="absolute -top-6 left-0 right-0 flex justify-between px-4 font-mono text-primary text-xs font-bold">
          {cols.map(c => <span key={c}>{c}</span>)}
        </div>
        <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-between py-4 font-mono text-primary text-xs font-bold">
          {rows.map(r => <span key={r}>{r}</span>)}
        </div>

        {/* Generate 100 cells */}
        {Array.from({ length: 100 }).map((_, i) => {
          const col = i % 10;
          const row = Math.floor(i / 10);
          const isTarget = col === 4 && row === 5; // E6
          const isMiss = col === 2 && row === 3; // C4
          const isHit = col === 6 && row === 7; // G8
          
          return (
            <motion.div 
              key={i}
              className={`w-8 h-8 md:w-12 md:h-12 border border-primary/20 relative flex items-center justify-center
                ${isTarget ? 'bg-primary/20 border-primary' : 'bg-bg-dark/50'}
              `}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 + (i % 10) * 0.05 + Math.floor(i / 10) * 0.05 }}
            >
              {isMiss && (
                <motion.div 
                  className="w-3 h-3 rounded-full bg-white"
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2.5, type: "spring" }}
                />
              )}
              {isHit && (
                <motion.div 
                  className="w-6 h-6 rounded-sm bg-accent flex items-center justify-center shadow-[0_0_15px_rgba(255,51,102,0.8)]"
                  initial={{ scale: 0, rotate: 45 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 3, type: "spring" }}
                >
                  <div className="w-2 h-2 bg-white rounded-full" />
                </motion.div>
              )}
              {isTarget && (
                <motion.div 
                  className="absolute inset-0 border-2 border-accent"
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: [0, 1, 0, 1] }}
                  transition={{ delay: 4, duration: 0.5 }}
                >
                  <motion.div 
                    className="absolute inset-0 bg-accent/30"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.5 }}
                  />
                  {/* Crosshair */}
                  <motion.div 
                    className="absolute inset-0 m-auto w-1 h-full bg-accent"
                    initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 4 }}
                  />
                  <motion.div 
                    className="absolute inset-0 m-auto h-1 w-full bg-accent"
                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 4 }}
                  />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </motion.div>
      
      {/* Target locked text */}
      <motion.div
        className="absolute bottom-16 right-16 font-mono text-2xl text-accent tracking-widest uppercase border border-accent bg-accent/10 px-6 py-2"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 4.2 }}
      >
        MÅL LÅST: E6
        <motion.div 
          className="absolute top-0 right-0 w-2 h-full bg-accent"
          animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.2 }}
        />
      </motion.div>
    </motion.div>
  );
}
