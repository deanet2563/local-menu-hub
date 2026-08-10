import { useEffect, useMemo, useState } from "react";
import type { OrderingOptionGroup } from "@/lib/ordering-config";
import { loadItemOptionGroups } from "@/lib/ordering-config";
import type { CartOptionSelection } from "@/lib/cart";

export type ConfigurableProduct = {
  itemId: string;
  shopId: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

type Props = {
  product: ConfigurableProduct;
  onClose: () => void;
  onConfirm: (input: {
    product: ConfigurableProduct;
    qty: number;
    options: CartOptionSelection[];
    note: string | null;
  }) => void;
};

function selectedCount(selected: Record<string, string[]>, groupId: string) {
  return selected[groupId]?.length ?? 0;
}

export function ProductConfigurator({ product, onClose, onConfirm }: Props) {
  const [groups, setGroups] = useState<OrderingOptionGroup[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await loadItemOptionGroups(product.itemId);
        if (!active) return;
        setGroups(data);
        const defaults: Record<string, string[]> = {};
        for (const g of data) {
          const ids = g.options.filter((o) => o.is_default).slice(0, g.max_select).map((o) => o.option_id);
          if (ids.length) defaults[g.option_group_id] = ids;
        }
        setSelected(defaults);
      } catch (e) {
        // Until the additive migration is applied, keep simple-product ordering
        // available instead of breaking the existing flow.
        setError(e instanceof Error ? e.message : "ไม่สามารถโหลดตัวเลือกสินค้าได้");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [product.itemId]);

  const selections = useMemo<CartOptionSelection[]>(() => {
    const out: CartOptionSelection[] = [];
    for (const group of groups) {
      for (const optionId of selected[group.option_group_id] ?? []) {
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
  }, [groups, selected]);

  const extra = selections.reduce((sum, s) => sum + s.priceDelta, 0);
  const unitTotal = product.price + extra;

  function toggle(group: OrderingOptionGroup, optionId: string) {
    setSelected((current) => {
      const ids = current[group.option_group_id] ?? [];
      const has = ids.includes(optionId);
      if (has) {
        return { ...current, [group.option_group_id]: ids.filter((id) => id !== optionId) };
      }
      if (group.max_select === 1) {
        return { ...current, [group.option_group_id]: [optionId] };
      }
      if (ids.length >= group.max_select) return current;
      return { ...current, [group.option_group_id]: [...ids, optionId] };
    });
  }

  const invalidGroup = groups.find((g) => {
    const count = selectedCount(selected, g.option_group_id);
    const min = g.is_required ? Math.max(1, g.min_select) : g.min_select;
    return count < min || count > g.max_select;
  });

  function confirm() {
    if (invalidGroup) {
      setError(`กรุณาเลือก “${invalidGroup.name}” ให้ครบตามที่กำหนด`);
      return;
    }
    onConfirm({ product, qty, options: selections, note: note.trim() || null });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <div className="min-w-0">
            <p className="font-semibold truncate">{product.name}</p>
            <p className="text-sm text-orange-600">฿{product.price}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 text-gray-500" aria-label="ปิด">✕</button>
        </div>

        <div className="p-4 space-y-5">
          {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="w-full h-40 rounded-xl object-cover bg-gray-100" />}

          {loading && <p className="text-sm text-gray-400">กำลังโหลดตัวเลือก...</p>}

          {!loading && groups.map((group) => {
            const min = group.is_required ? Math.max(1, group.min_select) : group.min_select;
            const count = selectedCount(selected, group.option_group_id);
            return (
              <section key={group.option_group_id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{group.name}</p>
                    {group.description && <p className="text-xs text-gray-400">{group.description}</p>}
                  </div>
                  <span className={`text-[11px] rounded-full px-2 py-0.5 ${count >= min ? "bg-gray-100 text-gray-500" : "bg-red-50 text-red-600"}`}>
                    {min > 0 ? `เลือก ${min}${group.max_select !== min ? `-${group.max_select}` : ""}` : `เลือกได้ถึง ${group.max_select}`}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.options.map((option) => {
                    const checked = (selected[group.option_group_id] ?? []).includes(option.option_id);
                    return (
                      <button
                        type="button"
                        key={option.option_id}
                        onClick={() => toggle(group, option.option_id)}
                        className={`w-full flex items-center justify-between rounded-xl border px-3 py-2.5 text-left ${checked ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white"}`}
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <span className={`w-5 h-5 flex items-center justify-center border ${group.max_select === 1 ? "rounded-full" : "rounded"} ${checked ? "border-orange-500 bg-orange-500 text-white" : "border-gray-300"}`}>
                            {checked ? "✓" : ""}
                          </span>
                          {option.name}
                        </span>
                        {Number(option.price_delta) > 0 && <span className="text-sm text-gray-500">+฿{Number(option.price_delta)}</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section className="space-y-2">
            <p className="text-sm font-semibold text-gray-800">หมายเหตุสินค้า</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="เช่น แยกใส่ถุง / ไม่ใส่ต้นหอม (ไม่บังคับ)"
              className="w-full resize-none rounded-xl border border-gray-200 p-3 text-sm"
            />
          </section>

          <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
            <span className="text-sm font-medium">จำนวน</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-full bg-white border border-gray-200">−</button>
              <span className="w-6 text-center text-sm font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(99, q + 1))} className="w-8 h-8 rounded-full bg-orange-500 text-white">+</button>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
          <button
            onClick={confirm}
            disabled={loading}
            className="w-full rounded-xl bg-orange-500 text-white px-4 py-3 flex items-center justify-between font-medium disabled:opacity-50"
          >
            <span>เพิ่มลงตะกร้า</span>
            <span>฿{unitTotal * qty}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
