import { getAccessToken } from "@/lib/supabase";
import { MYTREE_WORKER_URL } from "@/lib/workerEndpoint";

export async function attachPaymentSlipToOrder(input: {
  subId: string;
  paymentSlipUrl: string;
}): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("กรุณาเปิดผ่าน LIFF เพื่อแนบสลิป");
  }

  const response = await fetch(`${MYTREE_WORKER_URL}/customer/payment-slip`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subId: input.subId,
      paymentSlipUrl: input.paymentSlipUrl,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `payment slip update failed: ${response.status}`);
  }
}
