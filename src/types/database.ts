// TODO: Generate with `supabase gen types typescript --project-id <id> > src/types/database.ts`
// Placeholder enums matching DB schema

export type OrderStatusEnum =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type PaymentStatusEnum =
  | "unpaid"
  | "paid"
  | "refunded";

export type PrintStatusEnum =
  | "not_printed"
  | "printed";

export type DeliveryStatusEnum =
  | "waiting"
  | "picked_up"
  | "delivering"
  | "delivered";
