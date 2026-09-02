export const en = {
  metaTitle: 'Legally Distinct Virtual Pet',
  metaDescription:
    'A tiny virtual-pet adventure for looking after your little star.',
  wordmark: 'Legally Distinc Virtual Pet',
  buildLabel: 'START A RUN',
  eyebrow: 'A TINY CARE ADVENTURE',
  heroTitle: 'Keep your Legally Distinc Virtual Pet feeling bright.',
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
      body: 'Learn what makes your Legally Distinc Virtual Pet’s day.',
    },
    rest: {
      title: 'Rest',
      body: 'Give your Legally Distinc Virtual Pet a cozy pause.',
    },
    heart: {
      title: 'Health',
      body: 'Keep your Legally Distinc Virtual Pet feeling well.',
    },
    cheer: {
      title: 'Bond',
      body: 'Build a lasting little friendship.',
    },
  },
  footer: 'VIRTUAL Legally Distinc Virtual Pet',
  login: {
    eyebrow: 'WELCOME TO THE CARE CLUB',
    title: 'Meet your little companion.',
    intro: 'Sign in or create an account with a username and password.',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Your username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    passwordHint: 'Password must be 12–128 characters.',
    submit: 'Sign in',
    createAccount: 'Create account',
    signOut: 'Sign out',
    serviceError: 'The account service could not complete the request.',
    modeTitle: 'Choose your time mode.',
    modeIntro: 'How should time move in this care room?',
    realtimeMode: 'Realtime mode',
    streamingMode: 'Streaming mode',
    back: 'Back to the welcome page',
  },
} as const;

export type Copy = typeof en;
