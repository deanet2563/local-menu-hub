import { customerOrderErrorMessage } from "@/lib/order";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

export const orderErrorPresentationCompileChecks = {
  rpcFailureIsThai: customerOrderErrorMessage("create order failed", "fn_create_order_v3_priced_failed").includes("ร้านยังไม่พร้อม"),
  customizeFailureIsActionable: customerOrderErrorMessage("invalid order", "invalid_customize_selection").includes("ตัวเลือกสินค้า"),
  unknownFailureKeepsServerMessage: customerOrderErrorMessage("shop is closed") === "shop is closed",
};

assertEqual(orderErrorPresentationCompileChecks.rpcFailureIsThai, true, "priced RPC failure has customer-safe Thai message");
assertEqual(orderErrorPresentationCompileChecks.customizeFailureIsActionable, true, "customize server rejection has actionable Thai message");
assertEqual(orderErrorPresentationCompileChecks.unknownFailureKeepsServerMessage, true, "unknown order failure keeps server message");
