import { describe, expect, test } from 'vitest';
import type { GameViewModel } from './game-view-model';
import {
  graveyardExportFilename,
  graveyardExportMarkdown,
} from './graveyard-export';

function record(): GameViewModel {
  return {
    companion: {
      name: 'Nova Star',
      avatar: '/nova.png',
      appearances: [],
    },
    mode: 'streaming',
    modeLabel: 'Streaming mode',
    now: Date.UTC(2026, 7, 23, 12),
    runStartedAt: Date.UTC(2026, 7, 22, 12),
    formattedTime: '',
    timezone: 'UTC',
    seed: 'seed',
    balance: 0,
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
      active: false,
      amount: 0,
      total: 0,
      negativeCash: 0,
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
    ending: {
      kind: 'death',
      at: Date.UTC(2026, 7, 23, 12),
      title: 'Death',
      explanation: 'Health reached 0.',
      evidence: [],
      causes: [{ name: 'Starvation' }, { name: 'Sleep deprivation' }],
    },
    commandsDisabled: true,
    events: [
      {
        id: 'journey-1',
        at: Date.UTC(2026, 7, 22, 12),
        message: 'Nova Star began the journey.',
        sourceEventIds: ['event-1'],
      },
      {
        id: 'journey-2',
        at: Date.UTC(2026, 7, 23, 12),
        message: 'Nova Star died.',
        sourceEventIds: ['death'],
      },
    ],
    causalEvents: [
      {
        id: 'cause-1',
        at: Date.UTC(2026, 7, 23, 10),
        message: 'Nova Star became critically hungry.',
        sourceEventIds: ['damage'],
      },
    ],
    anchors: [],
    inventory: [],
    shop: [],
    catalogue: [],
    cart: [],
    cartTotal: 0,
    cartResultingBalance: 0,
    cartCheckoutAllowed: false,
    categories: [],
  };
}

describe('graveyard export', () => {
  test('includes grave details, causal events, and the complete Journey', () => {
    const markdown = graveyardExportMarkdown(record());

    expect(markdown).toContain("# Nova Star's Graveyard Record");
    expect(markdown).toContain('Run started: August 22, 2026 at 12:00 PM');
    expect(markdown).toContain('Duration: 1d 0h 0m');
    expect(markdown).toContain('- Starvation');
    expect(markdown).toContain('- Sleep deprivation');
    expect(markdown).toContain('Nova Star became critically hungry.');
    expect(markdown).toContain('Nova Star began the journey.');
    expect(markdown).toContain('Nova Star died.');
  });

  test('creates a portable dated Markdown filename', () => {
    expect(graveyardExportFilename(record())).toBe(
      'nova-star-graveyard-2026-08-23.md',
    );
  });

  test('rejects export before a grave exists', () => {
    const living = { ...record(), ending: null };
    expect(() => graveyardExportMarkdown(living)).toThrow(/no grave/i);
    expect(() => graveyardExportFilename(living)).toThrow(/no grave/i);
  });
});
