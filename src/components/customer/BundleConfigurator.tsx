import { useMemo, useState } from "react";
import type { OrderingBundle } from "@/lib/ordering-config";
import type { CartBundleSelection, CartOptionSelection } from "@/lib/cart";

export function BundleConfigurator({
  bundle,
  onClose,
  onConfirm,
}: {
  bundle: OrderingBundle;
  onClose: () => void;
  onConfirm: (input: { bundle: OrderingBundle; qty: number; selections: CartBundleSelection[]; options: CartOptionSelection[]; note: string | null }) => void;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<Record<string, Record<string, number>>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const bundleSelections = useMemo<CartBundleSelection[]>(() => {
    const out: CartBundleSelection[] = [];
    for (const group of bundle.groups) {
      const rows = picked[group.bundle_group_id] ?? {};
      for (const [itemId, itemQty] of Object.entries(rows)) {
        if (itemQty <= 0) continue;
        const item = group.items.find((i) => i.item_id === itemId);
        if (!item) continue;
        out.push({
          groupId: group.bundle_group_id,
          groupName: group.name,
          itemId: item.item_id,
          itemName: item.name,
          qty: itemQty,
          unitPriceDelta: item.price_delta,
        });
      }
    }
    return out;
  }, [bundle.groups, picked]);

  const optionSelections = useMemo<CartOptionSelection[]>(() => {
    const out: CartOptionSelection[] = [];
    for (const group of bundle.optionGroups) {
      for (const optionId of selectedOptions[group.option_group_id] ?? []) {
        const option = group.options.find((o) => o.option_id === optionId);
        if (!option) continue;
        out.push({
          groupId: group.option_group_id,
          groupName: group.name,
          optionId: option.option_id,
          optionName: option.name,
          priceDelta: Number(option.price_delta) || 0,
        });
      }
    }
    return out;
  }, [bundle.optionGroups, selectedOptions]);

  function groupTotal(groupId: string) {
    return Object.values(picked[groupId] ?? {}).reduce((n, q) => n + q, 0);
  }

  function changeItem(groupId: string, itemId: string, delta: number, maxUnits: number) {
    setPicked((current) => {
      const group = { ...(current[groupId] ?? {}) };
      const currentQty = group[itemId] ?? 0;
      const total = Object.values(group).reduce((n, q) => n + q, 0);
      if (delta > 0 && total >= maxUnits) return current;
      const nextQty = Math.max(0, currentQty + delta);
      if (nextQty === 0) delete group[itemId];
      else group[itemId] = nextQty;
      return { ...current, [groupId]: group };
    });
  }

  function toggleOption(groupId: string, optionId: string, maxSelect: number) {
    setSelectedOptions((current) => {
      const ids = current[groupId] ?? [];
      if (ids.includes(optionId)) return { ...current, [groupId]: ids.filter((id) => id !== optionId) };
      if (maxSelect === 1) return { ...current, [groupId]: [optionId] };
      if (ids.length >= maxSelect) return current;
      return { ...current, [groupId]: [...ids, optionId] };
    });
  }

  const extraPerSet = optionSelections.reduce((n, o) => n + o.priceDelta, 0)
    + bundleSelections.reduce((n, s) => n + (s.unitPriceDelta ?? 0) * s.qty, 0);

  function confirm() {
    const invalidBundleGroup = bundle.groups.find((g) => {
      const total = groupTotal(g.bundle_group_id);
      return total < g.min_units || total > g.max_units;
    });
    if (invalidBundleGroup) {
      setError(`กรุณาเลือก “${invalidBundleGroup.name}” ให้ครบ ${invalidBundleGroup.min_units}${invalidBundleGroup.max_units !== invalidBundleGroup.min_units ? `-${invalidBundleGroup.max_units}` : ""} ชิ้น`);
      return;
    }

    const invalidOption = bundle.optionGroups.find((g) => {
      const count = selectedOptions[g.option_group_id]?.length ?? 0;
      const min = g.is_required ? Math.max(1, g.min_select) : g.min_select;
      return count < min || count > g.max_select;
    });
    if (invalidOption) {
      setError(`กรุณาเลือก “${invalidOption.name}” ให้ครบตามที่กำหนด`);
      return;
    }

    onConfirm({ bundle, qty, selections: bundleSelections, options: optionSelections, note: note.trim() || null });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-semibold truncate">{bundle.name}</p>
            <p className="text-sm text-orange-600">ชุดละ ฿{bundle.price}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 text-gray-500">✕</button>
        </div>

        <div className="p-4 space-y-5">
          {bundle.image_url && <img src={bundle.image_url} alt={bundle.name} className="w-full h-40 rounded-xl object-cover bg-gray-100" />}
          {bundle.description && <p className="text-sm text-gray-500">{bundle.description}</p>}

          {bundle.groups.map((group) => {
            const total = groupTotal(group.bundle_group_id);
            return (
              <section key={group.bundle_group_id} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800">{group.name}</p>
                  <span className={`text-[11px] rounded-full px-2 py-0.5 ${total >= group.min_units && total <= group.max_units ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                    เลือกแล้ว {total}/{group.max_units}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const itemQty = picked[group.bundle_group_id]?.[item.item_id] ?? 0;
                    return (
                      <div key={item.item_id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-2.5">
                        <img src={item.image_url ?? ""} alt={item.name} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          {item.price_delta > 0 && <p className="text-xs text-gray-400">+฿{item.price_delta}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => changeItem(group.bundle_group_id, item.item_id, -1, group.max_units)} className="w-7 h-7 rounded-full bg-gray-100">−</button>
                          <span className="w-4 text-center text-sm">{itemQty}</span>
                          <button onClick={() => changeItem(group.bundle_group_id, item.item_id, 1, group.max_units)} className="w-7 h-7 rounded-full bg-orange-500 text-white">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {bundle.optionGroups.map((group) => (
            <section key={group.option_group_id} className="space-y-2">
              <p className="text-sm font-semibold text-gray-800">{group.name}</p>
              <div className="space-y-2">
                {group.options.map((option) => {
                  const checked = (selectedOptions[group.option_group_id] ?? []).includes(option.option_id);
                  return (
                    <button
                      type="button"
                      key={option.option_id}
                      onClick={() => toggleOption(group.option_group_id, option.option_id, group.max_select)}
                      className={`w-full flex items-center justify-between rounded-xl border px-3 py-2.5 text-left ${checked ? "border-orange-500 bg-orange-50" : "border-gray-200"}`}
                    >
                      <span className="text-sm">{checked ? "✓ " : ""}{option.name}</span>
                      {Number(option.price_delta) > 0 && <span className="text-sm text-gray-500">+฿{Number(option.price_delta)}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="หมายเหตุสำหรับชุดนี้ (ไม่บังคับ)"
            className="w-full resize-none rounded-xl border border-gray-200 p-3 text-sm"
          />

          <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
            <span className="text-sm font-medium">จำนวนชุด</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-full bg-white border border-gray-200">−</button>
              <span className="w-6 text-center text-sm font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(99, q + 1))} className="w-8 h-8 rounded-full bg-orange-500 text-white">+</button>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
          <button onClick={confirm} className="w-full rounded-xl bg-orange-500 text-white px-4 py-3 flex items-center justify-between font-medium">
            <span>เพิ่มชุดลงตะกร้า</span>
            <span>฿{(bundle.price + extraPerSet) * qty}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
