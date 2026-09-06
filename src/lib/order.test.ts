import { customerOrderErrorMessage } from "@/lib/order";

export const orderErrorPresentationCompileChecks = {
  rpcFailureIsThai: customerOrderErrorMessage("create order failed", "fn_create_order_v3_priced_failed").includes("ร้านยังไม่พร้อม"),
  customizeFailureIsActionable: customerOrderErrorMessage("invalid order", "invalid_customize_selection").includes("ตัวเลือกสินค้า"),
  unknownFailureKeepsServerMessage: customerOrderErrorMessage("shop is closed") === "shop is closed",
};
