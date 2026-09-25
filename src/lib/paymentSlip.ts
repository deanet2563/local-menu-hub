import { getAccessToken, supabase } from "@/lib/supabase";
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

export async function uploadAndAttachPaymentSlipToOrder(input: {
  subId: string;
  file: File;
}): Promise<string> {
  const ext = input.file.name.split(".").pop()?.toLowerCase();
  const safeExt = ext && /^(jpg|jpeg|png|webp|gif)$/.test(ext) ? ext : "jpg";
  const path = `${input.subId}/${Date.now()}.${safeExt}`;
  const { error: uploadError } = await supabase.storage
    .from("payment-slips")
    .upload(path, input.file, { contentType: input.file.type || "image/jpeg" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("payment-slips").getPublicUrl(path);
  await attachPaymentSlipToOrder({ subId: input.subId, paymentSlipUrl: data.publicUrl });
  return data.publicUrl;
}
