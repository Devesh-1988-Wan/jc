const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// ==============================
// UPLOAD REPORT
// ==============================
export const uploadReport = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/report/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Upload failed");
  return res.json();
};

// ==============================
// FETCH REPORT
// ==============================
export const fetchReport = async () => {
  const res = await fetch(`${BASE_URL}/report`);
  if (!res.ok) throw new Error("Fetch report failed");
  return res.json();
};

// ==============================
// FETCH SUMMARY
// ==============================
export const fetchReportSummary = async () => {
  const res = await fetch(`${BASE_URL}/report/summary`);
  if (!res.ok) throw new Error("Fetch summary failed");
  return res.json();
};

// ==============================
// GENERATE PREVIEW
// ==============================
export const generatePreview = async () => {
  const res = await fetch(`${BASE_URL}/report/preview`, {
    method: "POST",
  });

  if (!res.ok) throw new Error("Preview failed");
  return res.json();
};

// ==============================
// APPLY PREVIEW
// ==============================
export const applyReportPreview = async () => {
  const res = await fetch(`${BASE_URL}/report/apply-preview`, {
    method: "POST",
  });

  if (!res.ok) throw new Error("Apply preview failed");
  return res.json();
};

// ==============================
// FETCH ACTIONS
// ==============================
export const fetchReportActions = async () => {
  const res = await fetch(`${BASE_URL}/actions`);
  if (!res.ok) throw new Error("Fetch actions failed");
  return res.json();
};
// ==============================
// UPDATE WIDGETS (FIX)
// ==============================
export const updateReportWidgets = async (widgets) => {
  const res = await fetch(`${BASE_URL}/report/widgets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(widgets),
  });

  if (!res.ok) throw new Error("Failed to update widgets");
  return res.json();
};
// ==============================
// PATCH ACTION STATUS
// ==============================
export const patchActionStatus = async (id, status) => {
  const res = await fetch(`${BASE_URL}/actions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) throw new Error("Update failed");
  return res.json();
};