// Matches the enums created in:
// - phase1_full_schema_fresh_install.sql
// - phase1_step15_rider_delivery_addon.sql
//
// TODO: replace with real generated types once Supabase CLI auth is set up:
// `supabase gen types typescript --project-id <id> > src/types/database.ts`

export type OrderStatusEnum =
  | "pending"
  | "confirmed"
  | "preparing"
  | "completed"
  | "cancelled";

export type PaymentStatusEnum =
  | "unpaid"
  | "pending"
  | "paid"
  | "refunded"
  | "void";

export type PrintStatusEnum = "not_printed" | "printed" | "reprinted";

export type DeliveryStatusEnum =
  | "not_needed"
  | "needs_rider"
  | "rider_called"
  | "picked_up"
  | "delivered"
  | "failed";

export type FulfillmentTypeEnum = "pickup" | "delivery";

export type PaymentMethodEnum = "cash" | "qr_transfer";

export type HubOrderStatusEnum =
  | "pending"
  | "partially_confirmed"
  | "confirmed"
  | "preparing"
  | "completed"
  | "partially_cancelled"
  | "cancelled";
