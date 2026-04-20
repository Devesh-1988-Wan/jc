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

  return res.json();
};

// ==============================
// FETCH SUMMARY
// ==============================
export const fetchReportSummary = async () => {
  const res = await fetch(`${BASE_URL}/report/summary`);
  return res.json();
};

// ==============================
// FETCH RAW REPORT
// ==============================
export const fetchReport = async () => {
  const res = await fetch(`${BASE_URL}/report`);
  return res.json();
};

// ==============================
// GENERATE PREVIEW
// ==============================
export const applyReportPreview = async () => {
  const res = await fetch(`${BASE_URL}/report/preview`, {
    method: "POST",
  });
  return res.json();
};

// ==============================
// FETCH ACTIONS ✅ FIXED
// ==============================
export const fetchReportActions = async () => {
  const res = await fetch(`${BASE_URL}/report/actions`);
  return res.json();
};

// ==============================
// UPDATE WIDGETS ✅ FIXED
// ==============================
export const updateReportWidgets = async (data) => {
  const res = await fetch(`${BASE_URL}/report/widgets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return res.json();
};

// ==============================
// PATCH STATUS
// ==============================
export const patchActionStatus = async (data) => {
  const res = await fetch(`${BASE_URL}/report/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return res.json();
};