import {
  checkoutRequiresDeliveryGate,
  customerDeliveryChargeForCheckout,
  resetDeliveryStateForPickup,
} from "@/lib/checkoutFulfillment";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const reset = resetDeliveryStateForPickup({
  routeQuote: {
    distanceMeters: 1200,
    durationSeconds: 600,
    feeRatePerKm: 10,
    deliveryFee: 25,
    provider: "test",
    quoteToken: "token",
  },
  error: "กรุณารอให้ระบบคำนวณระยะทางและค่าส่งสำเร็จก่อนสั่ง",
  quotingRoute: true,
  fieldErrors: {
    deliveryPoint: "กรุณายืนยันจุดส่งจริงสำหรับ Rider",
    premises: "required",
    locality: "required",
    customerName: "required",
  },
});

export const checkoutFulfillmentCompileChecks = {
  pickupSkipsDeliveryGate: checkoutRequiresDeliveryGate("pickup") === false,
  deliveryRequiresDeliveryGate: checkoutRequiresDeliveryGate("delivery") === true,
  pickupDeliveryChargeZero: customerDeliveryChargeForCheckout("pickup", { deliveryFee: 25 }) === 0,
  deliveryChargePreserved: customerDeliveryChargeForCheckout("delivery", { deliveryFee: 25 }) === 25,
  pickupClearsQuote: reset.routeQuote === null,
  pickupClearsDeliveryError: reset.error === null,
  pickupClearsDeliveryFieldErrors: !reset.fieldErrors.deliveryPoint && !reset.fieldErrors.premises && !reset.fieldErrors.locality,
  pickupKeepsContactErrors: reset.fieldErrors.customerName === "required",
};

assertEqual(checkoutRequiresDeliveryGate("pickup"), false, "pickup does not require delivery gate");
assertEqual(checkoutRequiresDeliveryGate("delivery"), true, "delivery requires delivery gate");
assertEqual(customerDeliveryChargeForCheckout("pickup", { deliveryFee: 25 }), 0, "pickup customer delivery charge is zero");
assertEqual(customerDeliveryChargeForCheckout("delivery", { deliveryFee: 25 }), 25, "delivery charge is preserved for delivery");
assertEqual(reset.routeQuote, null, "pickup clears route quote");
assertEqual(reset.error, null, "pickup clears delivery-only errors");
assertEqual(reset.fieldErrors.deliveryPoint, undefined, "pickup clears delivery point error");
assertEqual(reset.fieldErrors.premises, undefined, "pickup clears premises error");
assertEqual(reset.fieldErrors.locality, undefined, "pickup clears locality error");
assertEqual(reset.fieldErrors.customerName, "required", "pickup keeps customer contact error");
