import type { Dispatch, SetStateAction } from "react";

export type DeliveryAddressFieldsValue = {
  premises: string;
  locality: string;
  instructions: string;
};

type Props = {
  value: DeliveryAddressFieldsValue;
  onChange: Dispatch<SetStateAction<DeliveryAddressFieldsValue>>;
};

export function DeliveryAddressFields({ value, onChange }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">ที่อยู่ผู้รับ</p>
        <p className="mt-1 text-[11px] leading-4 text-gray-500">
          ที่อยู่ใช้ให้ร้านและ Rider อ่านเข้าใจ ส่วนหมุดด้านล่างใช้สำหรับนำทางจริง
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">บ้านเลขที่ / หมู่บ้าน / อาคาร</label>
        <input
          className="w-full rounded-lg border border-gray-200 p-2.5 text-sm"
          placeholder="เช่น 99/123 หมู่บ้านสัมมากร"
          value={value.premises}
          onChange={(event) => onChange((current) => ({ ...current, premises: event.target.value }))}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">ซอย / ถนน / แขวง-ตำบล / เขต-อำเภอ / จังหวัด</label>
        <textarea
          rows={2}
          className="w-full rounded-lg border border-gray-200 p-2.5 text-sm"
          placeholder="เช่น ซอย G14 รามคำแหง 110 แขวงสะพานสูง เขตสะพานสูง กรุงเทพฯ 10240"
          value={value.locality}
          onChange={(event) => onChange((current) => ({ ...current, locality: event.target.value }))}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">จุดสังเกต / ประตู / ชั้น / ห้อง / หมายเหตุถึง Rider</label>
        <textarea
          rows={2}
          className="w-full rounded-lg border border-gray-200 p-2.5 text-sm"
          placeholder="เช่น บ้านหัวมุม รั้วสีขาว เข้าประตู 2 แล้วเลี้ยวขวา"
          value={value.instructions}
          onChange={(event) => onChange((current) => ({ ...current, instructions: event.target.value }))}
        />
      </div>
    </div>
  );
}

export function formatDeliveryAddress(value: DeliveryAddressFieldsValue): string {
  return [value.premises.trim(), value.locality.trim(), value.instructions.trim()]
    .filter(Boolean)
    .join("\n");
}
