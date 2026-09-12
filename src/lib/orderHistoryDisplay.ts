export type OrderHistoryStoredItem = {
  item_name?: string;
  qty?: number;
  unit_price?: number;
  set_id?: string | null;
  set_name?: string | null;
};

export type OrderHistoryOrderItem = {
  item_name_snapshot: string;
  qty: number;
  line_total: number;
};

export type OrderHistoryOptionSnapshot = Record<string, unknown>;

export type OrderHistoryConfigSnapshot = {
  line_ref: string | null;
  item_name_snapshot: string;
  unit_price_snapshot: number;
  qty: number;
  options_snapshot: OrderHistoryOptionSnapshot[] | null;
  bundle_selections_snapshot: OrderHistoryOptionSnapshot[] | null;
  item_note: string | null;
};

export type OrderHistoryDisplayLine = {
  key: string;
  name: string;
  qty: number;
  total: number;
  setName: string | null;
  setId: string | null;
  detailLines: string[];
  note: string | null;
};

function textField(snapshot: OrderHistoryOptionSnapshot, keys: string[]): string | null {
  for (const key of keys) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function numberField(snapshot: OrderHistoryOptionSnapshot, keys: string[]): number {
  for (const key of keys) {
    const value = snapshot[key];
    const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return 0;
}

function formatPriceDelta(value: number): string {
  if (!value) return "";
  const sign = value > 0 ? "+" : "";
  return ` (${sign}${value})`;
}

export function formatOrderHistoryOptionLine(snapshot: OrderHistoryOptionSnapshot): string | null {
  const group = textField(snapshot, ["groupName", "group_name", "groupLabel", "group_label", "group", "sectionName", "section_name"]);
  const option = textField(snapshot, ["optionName", "option_name", "label", "name", "itemName", "item_name"]);
  if (!group && !option) return null;
  const priceDelta = numberField(snapshot, ["priceDelta", "price_delta", "unitPriceDelta", "unit_price_delta"]);
  return `${group ? `${group}: ` : ""}${option ?? ""}${formatPriceDelta(priceDelta)}`;
}

export function buildOrderHistoryDisplayLines(input: {
  itemsJson: OrderHistoryStoredItem[] | null;
  orderItems: OrderHistoryOrderItem[];
  lineConfigurations: OrderHistoryConfigSnapshot[] | null;
}): OrderHistoryDisplayLine[] {
  if (Array.isArray(input.lineConfigurations) && input.lineConfigurations.length > 0) {
    return input.lineConfigurations.map((config, idx) => {
      const options = Array.isArray(config.options_snapshot) ? config.options_snapshot : [];
      const bundleSelections = Array.isArray(config.bundle_selections_snapshot) ? config.bundle_selections_snapshot : [];
      return {
        key: config.line_ref?.trim() || `config-${idx}`,
        name: config.item_name_snapshot,
        qty: Number(config.qty) || 0,
        total: (Number(config.unit_price_snapshot) || 0) * (Number(config.qty) || 0),
        setName: null,
        setId: null,
        detailLines: [...options, ...bundleSelections].map(formatOrderHistoryOptionLine).filter((line): line is string => Boolean(line)),
        note: config.item_note?.trim() || null,
      };
    });
  }

  if (Array.isArray(input.itemsJson) && input.itemsJson.length > 0) {
    return input.itemsJson.map((item, idx) => ({
      key: `json-${idx}`,
      name: item.item_name?.trim() || `รายการ ${idx + 1}`,
      qty: Number(item.qty) || 0,
      total: (Number(item.qty) || 0) * (Number(item.unit_price) || 0),
      setName: item.set_name?.trim() || null,
      setId: item.set_id?.trim() || null,
      detailLines: [],
      note: null,
    }));
  }

  return input.orderItems.map((item, idx) => ({
    key: `item-${idx}`,
    name: item.item_name_snapshot,
    qty: Number(item.qty) || 0,
    total: Number(item.line_total) || 0,
    setName: null,
    setId: null,
    detailLines: [],
    note: null,
  }));
}
