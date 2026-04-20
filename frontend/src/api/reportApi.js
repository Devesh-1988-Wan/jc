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
// GENERATE PREVIEW
// ==============================
export const applyReportPreview = async () => {
  const res = await fetch(`${BASE_URL}/report/preview`, {
    method: "POST",
  });

  if (!res.ok) throw new Error("Preview generation failed");
  return res.json();
};

// ==============================
// FETCH SUMMARY
// ==============================
export const fetchReportSummary = async () => {
  const res = await fetch(`${BASE_URL}/report/summary`);

  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
};

// ==============================
// FETCH FULL REPORT (Slide Brief)
// ==============================
export const fetchReport = async () => {
  const res = await fetch(`${BASE_URL}/report`);

  if (!res.ok) throw new Error("Failed to fetch report");
  return res.json();
};

// ==============================
// FETCH ACTIONS
// ==============================
export const fetchReportActions = async () => {
  const res = await fetch(`${BASE_URL}/report/actions`);

  if (!res.ok) throw new Error("Failed to fetch actions");
  return res.json();
};

// ==============================
// UPDATE ACTION STATUS
// ==============================
export const patchActionStatus = async (id, status) => {
  const res = await fetch(`${BASE_URL}/report/actions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) throw new Error("Failed to update action");
  return res.json();
};

// ==============================
// UPDATE WIDGET CONFIG
// ==============================
export const updateReportWidgets = async (widgets) => {
  const res = await fetch(`${BASE_URL}/report/widgets`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ widgets }),
  });

  if (!res.ok) throw new Error("Failed to update widgets");
  return res.json();
};

// ==============================
// FETCH WIDGET CONFIG
// (Backend doesn't persist yet → return empty or mock)
// ==============================
export const fetchReportWidgets = async () => {
  // ⚠️ No GET endpoint in backend yet
  // You can later create /report/widgets GET API

  return {
    widgets: [],
  };
};
