export type DebtBreakdown = {
  negativeCash: number;
  hospitalPrincipal: number;
  locClosureCost: number;
  otherFinancedPrincipal: number;
  total: number;
};

export type FinancedObligation = {
  id: string;
  kind: string;
  createdAt: number;
  originalPrincipal: number;
  remainingPrincipal: number;
};

export type LineOfCreditState =
  | { status: 'available' }
  | {
      status: 'open';
      openedAt: number;
      lastOpenChargeDate: string;
      remainingUnits: number;
      remainingClosureCost: number;
      cumulativeOpenCharges: number;
    }
  | {
      status: 'closed';
      openedAt: number;
      closedAt: number;
      cumulativeOpenCharges: number;
    };

export type FinancialEffect = {
  kind: string;
  cashDelta: number;
  before: DebtBreakdown;
  after: DebtBreakdown;
  purchaseCategory?: string;
};
