export function parseCustomizeOptionLabels(input) {
  const labels = String(input ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (labels.length === 0) throw new Error('กรุณาเพิ่มตัวเลือกอย่างน้อย 1 รายการ');

  const seen = new Set();
  for (const label of labels) {
    const key = label.toLocaleLowerCase('th-TH');
    if (seen.has(key)) throw new Error('ชื่อตัวเลือกซ้ำ กรุณาตรวจสอบอีกครั้ง');
    seen.add(key);
  }
  return labels;
}

export function activeCustomizeGroupsForCategory(groups, categoryId) {
  if (!categoryId) return [];
  return groups.filter((group) => group.is_active && group.category_id === categoryId);
}
