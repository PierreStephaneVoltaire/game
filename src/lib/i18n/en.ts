export const en = {
  metaTitle: '{pet} Virtual Pet',
  metaDescription:
    'A tiny virtual-pet adventure for looking after your little star.',
  wordmark: 'VIRTUAL {pet}',
  buildLabel: 'Loading soon',
  eyebrow: 'A TINY CARE ADVENTURE',
  heroTitle: 'Keep your {pet} feeling bright.',
  intro:
    'Feed, rest, cheer, and look after your little star—one small moment at a time.',
  status: 'First playable build in progress',
  previewLabel: 'Decorative virtual pet preview',
  deviceId: 'PET-01',
  careMode: 'CARE MODE',
  screenMessage: 'HI, FRIEND!',
  statsLabel: 'Example care statistics',
  stats: {
    food: 'FOOD',
    rest: 'REST',
    heart: 'HEART',
    cheer: 'CHEER',
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
      title: 'Heart',
      body: 'Be there when it matters.',
    },
    cheer: {
      title: 'Cheer',
      body: 'Find a little fun together.',
    },
  },
  footer: 'VIRTUAL {pet} · A SMALL PROJECT IN THE MAKING',
  login: {
    eyebrow: 'WELCOME TO THE CARE CLUB',
    title: 'Meet your little companion.',
    intro: 'Keep a save name and recovery code handy for your next visit.',
    saveNameLabel: 'Save name',
    saveNamePlaceholder: 'A name for this save',
    recoveryLabel: 'Recovery code',
    recoveryPlaceholder: '8-digit recovery code',
    submit: 'Enter the care room',
    back: 'Back to the welcome page',
  },
  game: {
    eyebrow: 'CARE ROOM 01',
    title: 'Good morning, {pet}.',
    subtitle: 'A tiny check-in for a very important little life.',
    status: 'FEELING BRIGHT',
    statsLabel: 'Current care statistics',
    actionsLabel: 'Care actions',
    actions: {
      food: 'Feed',
      rest: 'Rest',
      heart: 'Cuddle',
      cheer: 'Play',
    },
    back: 'Exit to welcome page',
  },
} as const;

export type Copy = typeof en;
