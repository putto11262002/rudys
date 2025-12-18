export type OrderItem = {
  productCode: string;
  demandQty: number;
  onHandQty: number;
  minQty: number | null;
  maxQty: number | null;
  recommendedOrderQty: number;
  exceedsMax: boolean;
};

export type OrderSession = {
  id: string;
  createdAt: string;
  status: string;
};

export type OrderResponse = {
  session: OrderSession;
  orderItems: OrderItem[];
};
