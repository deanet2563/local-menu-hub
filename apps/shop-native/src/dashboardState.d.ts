export declare const THAI_TEXT: {
  ordersLoadFailed: string;
  shopOpening: string;
  shopClosed: string;
  openShopAction: string;
  closeShopAction: string;
  shopOpened: string;
  shopClosedDone: string;
};

export declare function getShopStatusCopy(isOpen: boolean): {
  state: string;
  stateIcon: string;
  action: string;
  success: string;
};

export declare function getNonCriticalDashboardMessage(source: 'orders' | 'push' | 'unknown'): string | null;

export declare function getDashboardContentBottomPadding(bottomInset: number): number;

export declare function getSalesTreeStage(todaySales: number): {
  key: 'seed' | 'sprout' | 'young' | 'branching' | 'flowering' | 'full';
  label: string;
  icon: string;
  progress: number;
};
