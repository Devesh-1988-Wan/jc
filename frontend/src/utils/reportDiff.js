const asArray = (value) => (Array.isArray(value) ? value : []);

const normalizeString = (value) => `${value ?? ""}`.trim();

const compareObjects = (left, right, fields) => {
  if (!left || !right) return false;
  return fields.some((field) => normalizeString(left[field]) !== normalizeString(right[field]));
};

export const getChangeTone = (changeType) => {
  if (changeType === "added") return "bg-[#ECFDF5] border-[#10B981]/30";
  if (changeType === "removed") return "bg-[#FEF2F2] border-[#DC2626]/30";
  if (changeType === "changed") return "bg-[#FFFBEB] border-[#F59E0B]/40";
  return "bg-white border-[#E5E7EB]";
};

export const buildSummaryDiff = (currentReport, previewReport) => {
  const fields = [
    { key: "period", label: "Period" },
    { key: "executive_score", label: "Executive Score" },
    { key: "risk_level", label: "Risk Level" },
    { key: "key_message", label: "Key Message" },
  ];

  return fields.map((field) => {
    const currentValue = currentReport?.[field.key] ?? "Not available";
    const previewValue = previewReport?.[field.key] ?? "Not available";
    return {
      id: field.key,
      label: field.label,
      currentValue,
      previewValue,
      changeType: normalizeString(currentValue) === normalizeString(previewValue) ? "unchanged" : "changed",
    };
  });
};

export const buildObjectDiff = ({ currentItems, previewItems, keyField, compareFields }) => {
  const currentMap = new Map(asArray(currentItems).map((item) => [item[keyField], item]));
  const previewMap = new Map(asArray(previewItems).map((item) => [item[keyField], item]));
  const allKeys = Array.from(new Set([...currentMap.keys(), ...previewMap.keys()]));

  return allKeys.map((key) => {
    const currentItem = currentMap.get(key);
    const previewItem = previewMap.get(key);

    let changeType = "unchanged";
    if (!currentItem && previewItem) changeType = "added";
    if (currentItem && !previewItem) changeType = "removed";
    if (currentItem && previewItem && compareObjects(currentItem, previewItem, compareFields)) {
      changeType = "changed";
    }

    return {
      id: key,
      currentItem,
      previewItem,
      changeType,
    };
  });
};

export const buildListDiff = ({ currentItems, previewItems, idPrefix }) => {
  const left = asArray(currentItems);
  const right = asArray(previewItems);
  const maxLength = Math.max(left.length, right.length);

  return Array.from({ length: maxLength }).map((_, index) => {
    const currentValue = left[index];
    const previewValue = right[index];

    let changeType = "unchanged";
    if (currentValue === undefined && previewValue !== undefined) changeType = "added";
    if (currentValue !== undefined && previewValue === undefined) changeType = "removed";
    if (currentValue !== undefined && previewValue !== undefined && normalizeString(currentValue) !== normalizeString(previewValue)) {
      changeType = "changed";
    }

    return {
      id: `${idPrefix}-${index}`,
      currentValue: currentValue ?? "—",
      previewValue: previewValue ?? "—",
      changeType,
    };
  });
};
