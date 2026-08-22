export const en = {
  metaTitle: '{pet} Virtual Pet',
  metaDescription:
    'A tiny virtual-pet adventure for looking after your little star.',
  wordmark: 'VIRTUAL {pet}',
  buildLabel: 'START A RUN',
  eyebrow: 'A TINY CARE ADVENTURE',
  heroTitle: 'Keep your {pet} feeling bright.',
  intro:
    'Feed, rest, cheer, and look after your little star—one small moment at a time.',
  status: 'CARE ROOM',
  previewLabel: 'Decorative virtual pet preview',
  deviceId: 'PET-01',
  careMode: 'CARE MODE',
  screenMessage: 'HI, FRIEND!',
  statsLabel: 'Example care statistics',
  stats: {
    food: 'FOOD',
    health: 'HEALTH',
    mood: 'MOOD',
    rest: 'REST',
    bond: 'BOND',
    creativity: 'CREATIVITY',
  },
  sectionEyebrow: 'THE LITTLE THINGS COUNT',
  sectionTitle: 'A pocket-sized routine.',
  cards: {
    food: {
      title: 'Food',
      body: 'Learn what makes your {pet}’s day.',
    },
    rest: {
      title: 'Rest',
      body: 'Give your {pet} a cozy pause.',
    },
    heart: {
      title: 'Health',
      body: 'Keep your {pet} feeling well.',
    },
    cheer: {
      title: 'Bond',
      body: 'Build a lasting little friendship.',
    },
  },
  footer: 'VIRTUAL {pet} · A SESSION-ONLY CARE ADVENTURE',
  login: {
    eyebrow: 'WELCOME TO THE CARE CLUB',
    title: 'Meet your little companion.',
    intro: 'Sign in with your username and session key.',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Your username',
    generatedKeyLabel: 'Session key',
    keyPlaceholder: 'Enter your 8-character key',
    generateKey: 'Generate a key for a new session',
    submit: 'Sign in',
    modeTitle: 'Choose your time mode.',
    modeIntro: 'How should time move in this care room?',
    realtimeMode: 'Realtime mode',
    streamingMode: 'Streaming mode',
    back: 'Back to the welcome page',
  },
} as const;

export type Copy = typeof en;
