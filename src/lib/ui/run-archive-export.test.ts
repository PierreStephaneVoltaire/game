import { describe, expect, test } from 'vitest';
import type { GameViewModel } from './game-view-model';
import {
  runArchiveExportFilename,
  runArchiveExportMarkdown,
} from './run-archive-export';

function record(kind: NonNullable<GameViewModel['ending']>['kind']) {
  const ending: NonNullable<GameViewModel['ending']> = {
    kind,
    at: Date.UTC(2026, 7, 23, 12),
    title:
      kind === 'death'
        ? 'Death'
        : kind === 'quit_streaming'
          ? 'Quit Streaming'
          : kind === 'financial_ruin'
            ? 'Financial Ruin'
            : 'Made It',
    explanation:
      kind === 'death'
        ? 'Health reached 0.'
        : 'The relevant ending threshold was reached.',
    evidence: kind === 'death' ? [] : ['Threshold evidence.'],
    causes: kind === 'death' ? [{ name: 'Starvation' }] : [],
  };
  return {
    companion: { name: 'Nova Star', avatar: '/nova.png', appearances: [] },
    mode: 'streaming',
    modeLabel: 'Streaming mode',
    now: ending.at,
    runStartedAt: Date.UTC(2026, 7, 22, 12),
    formattedTime: '',
    timezone: 'UTC',
    seed: 'archive-seed',
    balance: -20_001,
    medicalDebt: {
      total: 0,
      nextScheduledPayment: 0,
      discountedFullPayment: 0,
    },
    followers: 100,
    peakFollowers: 100,
    streamStats: { started: 0, completed: 0, interrupted: 0, elapsedMs: 0 },
    career: {} as GameViewModel['career'],
    debt: {
      active: true,
      amount: 20_001,
      total: 20_001,
      negativeCash: 20_001,
      hospitalPrincipal: 0,
      locClosureCost: 0,
      otherFinancedPrincipal: 0,
    },
    lineOfCredit: {
      status: 'available',
      remainingUnits: 0,
      remainingClosureCost: 0,
      repaymentUnitPrice: 600,
      applicationPrice: 50,
      cashAdvance: 10_000,
      totalUnits: 20,
      totalClosureCost: 12_000,
    },
    madeItUnlocked: false,
    effects: [],
    projects: [],
    activeAvatar: {} as GameViewModel['activeAvatar'],
    hospital: {} as GameViewModel['hospital'],
    metrics: [],
    statuses: [],
    endingRisks: [],
    activity: null,
    ending,
    commandsDisabled: true,
    events: [
      {
        id: 'journey',
        at: ending.at,
        message: 'The run ended.',
        sourceEventIds: ['ending'],
      },
    ],
    causalEvents: [],
    careChoices: { socialize: [], play: [] },
    anchors: [],
    inventory: [],
    shop: [],
    catalogue: [],
    cart: [],
    cartTotal: 0,
    cartResultingBalance: -20_001,
    cartCheckoutAllowed: false,
    categories: [],
  } satisfies GameViewModel;
}

describe('run archive export', () => {
  test.each([
    ['death', 'Death'],
    ['quit_streaming', 'Quit Streaming'],
    ['financial_ruin', 'Financial Ruin'],
    ['made_it', 'Made It'],
  ] as const)('exports the %s outcome', (kind, title) => {
    const model = record(kind);
    const markdown = runArchiveExportMarkdown(model);
    expect(markdown).toContain(`- Outcome: ${title}`);
    expect(markdown).toContain('The run ended.');
    if (kind === 'death') {
      expect(markdown).toContain('Graveyard Record');
      expect(markdown).toContain('Cause of death');
      expect(runArchiveExportFilename(model)).toContain('-graveyard-');
    } else {
      expect(markdown).toContain('Archived Run');
      expect(markdown).not.toContain('Graveyard');
      expect(markdown).not.toContain('Cause of death');
      expect(runArchiveExportFilename(model)).toContain('-run-archive-');
    }
  });

  test('rejects active runs', () => {
    const active = { ...record('quit_streaming'), ending: null };
    expect(() => runArchiveExportMarkdown(active)).toThrow(/active run/i);
    expect(() => runArchiveExportFilename(active)).toThrow(/active run/i);
  });
});
