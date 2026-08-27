import type { Activity, GameEvent, GameState } from '../game-types';
import rules from '../data/simulation-rules.json';
import { createMedicalDebtBill } from '../medical-debt-rules';

/** Apply the persistent state created by a completed Hospital activity. */
export function completeMedicalCare(
  state: GameState,
  activity: Activity,
  completedAt: number,
): GameState {
  const bill = createMedicalDebtBill({
    activityId: activity.id,
    createdAt: completedAt,
    principal: Number(activity.payload?.principal ?? rules.medicalCare.cost),
    insuredAtStart: Boolean(activity.payload?.insuredAtStart),
    scheduledDailyPayment: Number(
      activity.payload?.scheduledDailyPayment ??
        rules.medicalCare.dailyPayment.uninsured,
    ),
  });
  const event: GameEvent = {
    id: `event-${state.events.length + 1}`,
    type: 'medical_debt_created',
    at: completedAt,
    message: `Hospital care created a $${bill.originalPrincipal} medical payment plan.`,
    sourceActionId: activity.sourceActionId,
    amount: bill.originalPrincipal,
    medicalBillId: bill.id,
  };
  return {
    ...state,
    history: {
      ...state.history,
      kidneyStoneFeeds: activity.payload?.treatedKidneyStone
        ? []
        : state.history.kidneyStoneFeeds,
    },
    medicalDebt: [...state.medicalDebt, bill],
    events: [...state.events, event],
  };
}
