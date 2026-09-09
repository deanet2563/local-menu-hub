import type { DeliveryRouteQuote } from "@/lib/deliveryLocation";

export type CheckoutFulfillment = "delivery" | "pickup";

export type CheckoutDeliveryState = {
  routeQuote: DeliveryRouteQuote | null;
  error: string | null;
  fieldErrors: Record<string, string | undefined>;
  quotingRoute: boolean;
};

export function checkoutRequiresDeliveryGate(fulfillment: CheckoutFulfillment): boolean {
  return fulfillment === "delivery";
}

export function customerDeliveryChargeForCheckout(
  fulfillment: CheckoutFulfillment,
  routeQuote: Pick<DeliveryRouteQuote, "deliveryFee"> | null,
): number {
  return fulfillment === "delivery" ? Math.max(0, Number(routeQuote?.deliveryFee) || 0) : 0;
}

export function resetDeliveryStateForPickup(state: CheckoutDeliveryState): CheckoutDeliveryState {
  return {
    ...state,
    routeQuote: null,
    error: null,
    quotingRoute: false,
    fieldErrors: {
      ...state.fieldErrors,
      deliveryPoint: undefined,
      premises: undefined,
      locality: undefined,
    },
  };
}
