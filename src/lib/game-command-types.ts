/** Commands accepted by the simulation engine. */
export type GameCommand =
  | {
      type: 'open_line_of_credit';
      commandId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'repay_line_of_credit';
      commandId: string;
      quantity: number;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'pay_medical_debt';
      commandId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'use_item';
      commandId: string;
      itemId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'wait';
      commandId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'rest' | 'socialize' | 'play' | 'medical_care' | 'commission_work';
      commandId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'buy_item';
      commandId: string;
      itemId: string;
      now: number;
      quantity?: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'set_cart_quantity';
      commandId: string;
      itemId: string;
      quantity: number;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'checkout_cart';
      commandId: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'place_item';
      commandId: string;
      itemId: string;
      slot: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'unplace_item';
      commandId: string;
      slot: string;
      now: number;
      expectedStateVersion?: number;
    }
  | {
      type: 'perform_item_action';
      commandId: string;
      itemId: string;
      action: string;
      now: number;
      expectedStateVersion?: number;
    };
