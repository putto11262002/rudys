export type OrderItem = {
  productCode: string;
  demandQty: number;
  onHandQty: number;
  minQty: number | null;
  maxQty: number | null;
  recommendedOrderQty: number;
  exceedsMax: boolean;
};

export type SkippedOrderItem = {
  productCode: string;
  demandQty: number;
  reason: "no_station" | "station_invalid" | "missing_data";
};

export type CoverageInfo = {
  covered: string[];
  missing: string[];
  percentage: number;
  isComplete: boolean;
};

export type OrderSession = {
  id: string;
  createdAt: string;
};

export type OrderResponse = {
  session: OrderSession;
  orderItems: OrderItem[];
  skippedItems: SkippedOrderItem[];
  coverage: CoverageInfo;
};
