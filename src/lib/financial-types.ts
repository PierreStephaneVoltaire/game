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
      remainingUnits: number;
      remainingClosureCost: number;
    }
  | {
      status: 'closed';
      openedAt: number;
      closedAt: number;
    };

export type FinancialEffect = {
  kind: string;
  cashDelta: number;
  before: DebtBreakdown;
  after: DebtBreakdown;
  purchaseCategory?: string;
};
