import {
  checkoutRequiresDeliveryGate,
  customerDeliveryChargeForCheckout,
  resetDeliveryStateForPickup,
} from "@/lib/checkoutFulfillment";

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
