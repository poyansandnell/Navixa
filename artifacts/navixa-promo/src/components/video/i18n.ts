export type Lang = 'sv' | 'en';

export const LANG: Lang = (() => {
  if (typeof window === 'undefined') return 'sv';
  const p = new URLSearchParams(window.location.search).get('lang');
  return p === 'en' ? 'en' : 'sv';
})();

const sv = {
  taglineWords: ['HITTA.', 'SKJUT.', 'SÄNK.'],
  s1Title: 'SÖK.',
  s1Sub: 'Global Matchmaking',
  s1Searching: 'Söker radar...',
  s2Title: 'ELDA.',
  s2Sub: 'Klassisk bräda. Ny intensitet.',
  s2TargetLocked: 'MÅL LÅST: E6',
  s3Title: 'SÄNK.',
  s3Sunk: 'SLAGSKEPP SÄNKT',
  s3Won: '+500 XP // MATCH VUNNEN',
  s4Title: 'KLÄTTRA I RANG',
  s4Ranks: ['FÄNRIK', 'LÖJTNANT', 'KAPTEN', 'AMIRAL'],
  s5Title: 'UPPDRAG & BELÖNINGAR',
  s5Sub: 'Lås upp unika skepp och titlar',
  s5Daily: 'Dagliga Uppdrag',
  s5Q1: 'SÄNK 5 UBÅTAR',
  s5Q2: 'VINN 3 RANKADE MATCHER',
  s5Q2Reward: 'NY TITEL',
  s5Q3: 'SPELA MOT EN VÄN',
  s5Done: 'KLAR',
  s5RewardLabel: 'Belöning:',
  s5Unlocked: 'Låst upp: Cyber-Hangarfartyg',
  s6Download: 'Ladda ner nu',
  s6Available: 'TILLGÄNGLIG PÅ iOS & ANDROID',
};

const en: typeof sv = {
  taglineWords: ['FIND.', 'FIRE.', 'SINK.'],
  s1Title: 'SEARCH.',
  s1Sub: 'Global Matchmaking',
  s1Searching: 'Scanning radar...',
  s2Title: 'FIRE.',
  s2Sub: 'Classic board. New intensity.',
  s2TargetLocked: 'TARGET LOCKED: E6',
  s3Title: 'SINK.',
  s3Sunk: 'BATTLESHIP SUNK',
  s3Won: '+500 XP // MATCH WON',
  s4Title: 'CLIMB THE RANKS',
  s4Ranks: ['ENSIGN', 'LIEUTENANT', 'CAPTAIN', 'ADMIRAL'],
  s5Title: 'QUESTS & REWARDS',
  s5Sub: 'Unlock unique ships and titles',
  s5Daily: 'Daily Quests',
  s5Q1: 'SINK 5 SUBMARINES',
  s5Q2: 'WIN 3 RANKED MATCHES',
  s5Q2Reward: 'NEW TITLE',
  s5Q3: 'PLAY A FRIEND',
  s5Done: 'DONE',
  s5RewardLabel: 'Reward:',
  s5Unlocked: 'Unlocked: Cyber Carrier',
  s6Download: 'Download now',
  s6Available: 'AVAILABLE ON iOS & ANDROID',
};

export const STR = LANG === 'en' ? en : sv;
