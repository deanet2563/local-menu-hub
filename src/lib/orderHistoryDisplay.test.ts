import assert from "node:assert/strict";
import { buildOrderHistoryDisplayLines, formatOrderHistoryOptionLine, type OrderHistoryConfigSnapshot } from "@/lib/orderHistoryDisplay";

const configA: OrderHistoryConfigSnapshot = {
  line_ref: "line-a",
  item_name_snapshot: "ซาลาเปาหมูสับไข่ต้ม",
  unit_price_snapshot: 37,
  qty: 1,
  options_snapshot: [
    { groupName: "เลือกไส้หลัก", optionName: "หมูแดง", priceDelta: 5 },
    { group_name: "เพิ่มเครื่องเคียง", label: "น้ำจิ้มซีอิ๊วดำ", price_delta: 0 },
  ],
  bundle_selections_snapshot: [],
  item_note: "แยกถุง",
};

const configB: OrderHistoryConfigSnapshot = {
  line_ref: "line-b",
  item_name_snapshot: "ซาลาเปาหมูสับไข่ต้ม",
  unit_price_snapshot: 32,
  qty: 1,
  options_snapshot: [
    { groupName: "เลือกไส้หลัก", optionName: "หมูสับ", priceDelta: 0 },
  ],
  bundle_selections_snapshot: [],
  item_note: null,
};

const lines = buildOrderHistoryDisplayLines({
  itemsJson: null,
  orderItems: [
    { item_name_snapshot: "ซาลาเปาหมูสับไข่ต้ม", qty: 1, line_total: 37 },
    { item_name_snapshot: "ซาลาเปาหมูสับไข่ต้ม", qty: 1, line_total: 32 },
  ],
  lineConfigurations: [configA, configB],
});

assert.equal(lines.length, 2);
assert.equal(lines[0]?.name, "ซาลาเปาหมูสับไข่ต้ม");
assert.equal(lines[0]?.qty, 1);
assert.equal(lines[0]?.total, 37);
assert.deepEqual(lines[0]?.detailLines, ["เลือกไส้หลัก: หมูแดง (+5)", "เพิ่มเครื่องเคียง: น้ำจิ้มซีอิ๊วดำ"]);
assert.equal(lines[0]?.note, "แยกถุง");
assert.deepEqual(lines[1]?.detailLines, ["เลือกไส้หลัก: หมูสับ"]);
assert.equal(lines[1]?.note, null);

assert.equal(formatOrderHistoryOptionLine({ group_label: "ระดับความเผ็ด", label: "เผ็ดน้อย", price_delta: 10 }), "ระดับความเผ็ด: เผ็ดน้อย (+10)");
