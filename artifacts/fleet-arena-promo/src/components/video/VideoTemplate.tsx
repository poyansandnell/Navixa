import { useEffect, useRef } from 'react';

import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';

import { SCENE_DURATIONS } from './SCENE_DURATIONS';

import Scene0 from './video_scenes/Scene0';
import Scene1 from './video_scenes/Scene1';
import Scene2 from './video_scenes/Scene2';
import Scene3 from './video_scenes/Scene3';
import Scene4 from './video_scenes/Scene4';
import Scene5 from './video_scenes/Scene5';
import Scene6 from './video_scenes/Scene6';

const SCENE_COMPONENTS: Record<
  string,
  React.ComponentType<{ currentScene: number }>
> = {
  intro: Scene0,
  matchmaking: Scene1,
  grid: Scene2,
  sink: Scene3,
  ranked: Scene4,
  quests: Scene5,
  outro: Scene6,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export { SCENE_DURATIONS };

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  return (
    <div className="w-full h-screen overflow-hidden relative bg-bg-dark text-text-primary font-body">
      
      {/* PERSISTENT BACKGROUND ELEMENTS */}
      {/* Dark Navy Background Base */}
      <div className="absolute inset-0 bg-bg-dark z-0" />
      
      {/* Background Grid Pattern */}
      <motion.div 
        className="absolute inset-0 z-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--color-primary) 1px, transparent 1px),
            linear-gradient(to bottom, var(--color-primary) 1px, transparent 1px)
          `,
          backgroundSize: '4vw 4vw'
        }}
        animate={{
          y: sceneIndex >= 2 && sceneIndex <= 3 ? ['0vw', '4vw'] : '0vw',
        }}
        transition={{
          duration: 2,
          ease: "linear",
          repeat: sceneIndex >= 2 && sceneIndex <= 3 ? Infinity : 0
        }}
      />

      {/* Cinematic Radar / Water Video Backgrounds (Outside AnimatePresence for continuity) */}
      <motion.div 
        className="absolute inset-0 z-0"
        animate={{
          opacity: sceneIndex === 0 ? 0.3 : sceneIndex === 1 ? 0.15 : 0
        }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <video 
          src={`${import.meta.env.BASE_URL}videos/radar.mp4`}
          className="w-full h-full object-cover"
          autoPlay 
          muted 
          loop 
          playsInline
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg-dark opacity-80" />
      </motion.div>

      <motion.div 
        className="absolute inset-0 z-0"
        animate={{
          opacity: sceneIndex >= 2 && sceneIndex <= 4 ? 0.4 : 0
        }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <video 
          src={`${import.meta.env.BASE_URL}videos/water_grid.mp4`}
          className="w-full h-full object-cover"
          autoPlay 
          muted 
          loop 
          playsInline
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg-dark opacity-90" />
      </motion.div>
      
      {/* Global Vignette */}
      <div className="absolute inset-0 z-50 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,var(--color-bg-dark)_120%)]" />

      {/* FOREGROUND SCENES */}
      <AnimatePresence mode="popLayout">
        {SceneComponent && (
          <SceneComponent key={currentSceneKey} currentScene={sceneIndex} />
        )}
      </AnimatePresence>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
