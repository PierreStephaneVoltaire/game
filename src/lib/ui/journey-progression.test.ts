import { describe, expect, test } from 'vitest';

import type { GameEvent } from '$lib/game-types';
import { projectJourney } from './journey-events';

describe('Journey progression narration', () => {
  test('sorts catch-up results chronologically and narrates channel progress', () => {
    const events: GameEvent[] = [
      {
        id: 'milestone',
        type: 'career_milestone',
        at: 5,
        message: 'sub 1k milestone reached.',
      },
      { id: 'start', type: 'run_started', at: 0, message: 'internal' },
      {
        id: 'followers',
        type: 'followers_gained',
        at: 4,
        message: 'technical',
        followerDelta: 31,
      },
      {
        id: 'donation',
        type: 'donation_received',
        at: 3,
        message: 'technical',
        donationTier: 'whale',
        amount: 2_450,
      },
    ];

    expect(
      projectJourney(events, 'Nova').map((entry) => entry.message),
    ).toEqual([
      "Nova's journey began.",
      "A whale donated $2,450 during Nova's stream.",
      "Nova's stream brought 31 new followers to the channel.",
      "Nova's channel reached 1,000 subscribers! Better stream rates are now available.",
    ]);
  });

  test('narrates background projects and queued special streams', () => {
    const events: GameEvent[] = [
      {
        id: 'rare-start',
        type: 'full_body_project_started',
        at: 1,
        message: 'technical',
      },
      {
        id: 'rare-end',
        type: 'project_completed',
        at: 2,
        message: 'technical',
        amount: 625,
      },
      {
        id: 'model-start',
        type: 'model_project_started',
        at: 3,
        message: 'technical',
      },
      {
        id: 'model-end',
        type: 'project_completed',
        at: 4,
        message: 'technical',
      },
      {
        id: 'queued',
        type: 'event_stream_queued',
        at: 4,
        message: 'Model debut stream queued.',
      },
      {
        id: 'debut',
        type: 'model_debut_stream',
        at: 5,
        message: 'technical',
        sourceActionId: 'debut-stream',
      },
      {
        id: 'debut-end',
        type: 'activity_completed',
        at: 6,
        message: 'technical',
        activityType: 'stream',
        sourceActionId: 'debut-stream',
      },
    ];

    expect(
      projectJourney(events, 'Nova').map((entry) => entry.message),
    ).toEqual([
      'Nova landed a rare full-body commission. The work will carry on in the background.',
      'Nova delivered the full-body commission and earned $625.',
      'Nova commissioned a new model, and the artists got to work.',
      "Nova's new model is finished. Their fresh look is ready.",
      "Nova's model debut stream is lined up for the next clear afternoon slot.",
      'Nova went live to debut the new model.',
      'Nova finished the model debut stream.',
    ]);
  });

  test('uses the payout as the single Commission Work completion entry', () => {
    const events: GameEvent[] = [
      {
        id: 'work-start',
        type: 'activity_started',
        at: 1,
        message: 'Commission Work started.',
        activityType: 'commission_work',
        sourceActionId: 'work',
      },
      {
        id: 'work-end',
        type: 'activity_completed',
        at: 2,
        message: 'Commission Work finished.',
        activityType: 'commission_work',
        sourceActionId: 'work',
      },
      {
        id: 'payout',
        type: 'full_body_project_completed',
        at: 2,
        message: 'technical',
        sourceActionId: 'work',
        amount: 115,
      },
    ];

    expect(
      projectJourney(events, 'Nova').map((entry) => entry.message),
    ).toEqual([
      'Nova settled in for a focused stretch of Commission Work.',
      'Nova wrapped up Commission Work and earned $115.',
    ]);
  });
});
