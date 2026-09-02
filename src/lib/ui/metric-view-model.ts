import { metricMaximum } from '$lib/game-constants';
import type { GameState, MetricName } from '$lib/game-types';
import { gameCopy } from './game-copy';

export type MetricViewModel = {
  key: MetricName;
  label: string;
  value: number;
  maximum: number;
  percentage: number;
};

const metricKeys: MetricName[] = [
  'health',
  'food',
  'mood',
  'rest',
  'bond',
  'creativity',
];

export function metricPresentation(state: GameState): MetricViewModel[] {
  return metricKeys.map((key) => {
    const maximum = metricMaximum(key);
    const displayMaximum = key === 'health' ? 10 : maximum;
    return {
      key,
      label: gameCopy.metrics[key],
      value:
        key === 'health'
          ? Math.round((state.metrics[key] / maximum) * displayMaximum)
          : state.metrics[key],
      maximum: displayMaximum,
      percentage: (state.metrics[key] / maximum) * 100,
    };
  });
}
