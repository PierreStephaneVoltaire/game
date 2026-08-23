import type { Metrics, StatusName } from '../game-types';
import rules from '../data/simulation-rules.json';

export const LOW_STATUS_RULES: ReadonlyArray<{
  status: StatusName;
  metric: keyof Metrics;
  onsetMaximum: number;
  clearMinimum: number;
}> = [
  {
    status: 'starving',
    metric: 'food',
    onsetMaximum: rules.statusRules.lowMetricOnsetMaximum,
    clearMinimum: rules.statusRules.lowMetricClearMinimum,
  },
  {
    status: 'sleep_deprived',
    metric: 'rest',
    onsetMaximum: rules.statusRules.lowMetricOnsetMaximum,
    clearMinimum: rules.statusRules.lowMetricClearMinimum,
  },
  {
    status: 'depressed',
    metric: 'mood',
    onsetMaximum: rules.statusRules.lowMetricOnsetMaximum,
    clearMinimum: rules.statusRules.lowMetricClearMinimum,
  },
  {
    status: 'lonely',
    metric: 'bond',
    onsetMaximum: rules.statusRules.lowMetricOnsetMaximum,
    clearMinimum: rules.statusRules.lowMetricClearMinimum,
  },
  {
    status: 'creative_block',
    metric: 'creativity',
    onsetMaximum: rules.statusRules.lowMetricOnsetMaximum,
    clearMinimum: rules.statusRules.lowMetricClearMinimum,
  },
];
