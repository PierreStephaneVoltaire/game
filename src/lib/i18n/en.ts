export const en = {
  metaTitle: 'Legally Distinct Virtual Pet',
  metaDescription:
    'A tiny virtual-pet adventure for keeping your little gremlin fed, rested, and mostly out of trouble.',
  wordmark: 'Legally Distinct Virtual Pet',
  buildLabel: 'START A RUN',
  eyebrow: 'CHAT, YOU HAVE ONE JOB',
  heroTitle: 'Keep your little gremlin alive. No pressure, chat.',
  intro:
    'Feed her, let her rest, and keep her company. She can handle the questionable decisions herself.',
  status: 'SESSION',
  previewLabel: 'Decorative virtual pet preview',
  screenMessage: 'HI, CHAT!',
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
      body: 'Keep her fed before she makes it everyone\'s problem',
    },
    rest: {
      title: 'Rest',
      body: 'Try to salvage her sleep schedule.',
    },
    heart: {
      title: 'Health',
      body: 'Keep her healthy. Vibes alone are not a care plan.',
    },
    cheer: {
      title: 'Bond',
      body: 'Stick around for the yapping.',
    },
    mood: {
      title: 'Mood',
      body: 'Keep her laughing. With you or at you. Either counts.',
    },
    creativity: {
      title: 'Creativity',
      body: 'Fuel her next questionable idea',
    },
  },
  footer: 'Legally Distinct Virtual Pet',
  login: {
    eyebrow: 'HI, CHAT',
    title: 'Meet your little gremlin.',
    intro: 'Sign in or create an account with a username and password.',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Your username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    submit: 'Sign in',
    createAccount: 'Create account',
    signOut: 'Sign out',
    serviceError: 'The account service could not complete the request.',
    modeTitle: 'Choose your time mode.',
    modeIntro: 'How should time move in this session?',
    realtimeMode: 'Realtime mode',
    streamingMode: 'Streaming mode',
    back: 'Back to the welcome page',
  },
} as const;

export type Copy = typeof en;