import type { Dispatch, SetStateAction } from "react";

export type DeliveryAddressFieldsValue = {
  premises: string;
  locality: string;
  instructions: string;
};

type Props = {
  value: DeliveryAddressFieldsValue;
  onChange: Dispatch<SetStateAction<DeliveryAddressFieldsValue>>;
  errors?: Partial<Record<keyof DeliveryAddressFieldsValue, string>>;
  onFieldChange?: (field: keyof DeliveryAddressFieldsValue) => void;
};

function RequiredMark() {
  return <span className="text-red-600" aria-hidden="true">*</span>;
}

export function DeliveryAddressFields({ value, onChange, errors = {}, onFieldChange }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">ที่อยู่ผู้รับ</p>
        <p className="mt-1 text-[11px] leading-4 text-gray-500">
          ช่องที่มีเครื่องหมาย <span className="font-semibold text-red-600">*</span> เป็นข้อมูลจำเป็น กรุณากรอกให้ครบเพื่อให้ร้านและ Rider จัดส่งได้ถูกต้อง
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="delivery-premises" className="text-xs font-medium text-gray-600">บ้านเลขที่ / หมู่บ้าน / อาคาร <RequiredMark /></label>
        <input
          id="delivery-premises"
          className="w-full rounded-lg border border-gray-200 p-2.5 text-sm"
          placeholder="เช่น 99/123 หมู่บ้านสัมมากร"
          value={value.premises}
          onChange={(event) => {
            onChange((current) => ({ ...current, premises: event.target.value }));
            onFieldChange?.("premises");
          }}
          aria-invalid={Boolean(errors.premises)}
          aria-describedby={errors.premises ? "delivery-premises-error" : undefined}
        />
        {errors.premises && <p id="delivery-premises-error" className="text-xs text-red-600">{errors.premises}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="delivery-locality" className="text-xs font-medium text-gray-600">ซอย / ถนน / แขวง-ตำบล / เขต-อำเภอ / จังหวัด / รหัสไปรษณีย์ <RequiredMark /></label>
        <textarea
          id="delivery-locality"
          rows={2}
          className="w-full rounded-lg border border-gray-200 p-2.5 text-sm"
          placeholder="เช่น ซอย G14 รามคำแหง 110 แขวงสะพานสูง เขตสะพานสูง กรุงเทพฯ 10240"
          value={value.locality}
          onChange={(event) => {
            onChange((current) => ({ ...current, locality: event.target.value }));
            onFieldChange?.("locality");
          }}
          aria-invalid={Boolean(errors.locality)}
          aria-describedby={errors.locality ? "delivery-locality-error" : undefined}
        />
        {errors.locality && <p id="delivery-locality-error" className="text-xs text-red-600">{errors.locality}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="delivery-instructions" className="text-xs font-medium text-gray-600">จุดสังเกต / ประตู / ชั้น / ห้อง / หมายเหตุถึง Rider <span className="font-normal text-gray-400">(ไม่บังคับ)</span></label>
        <textarea
          id="delivery-instructions"
          rows={2}
          className="w-full rounded-lg border border-gray-200 p-2.5 text-sm"
          placeholder="เช่น บ้านหัวมุม รั้วสีขาว เข้าประตู 2 แล้วเลี้ยวขวา"
          value={value.instructions}
          onChange={(event) => {
            onChange((current) => ({ ...current, instructions: event.target.value }));
            onFieldChange?.("instructions");
          }}
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
