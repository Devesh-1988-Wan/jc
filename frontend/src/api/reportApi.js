import axios from "axios";

// ✅ Base URL from Vite env
const BASE_URL = import.meta.env.VITE_BACKEND_URL;

// ⚠️ Debug (remove later if you want)
console.log("API BASE URL:", BASE_URL);

// ✅ Axios instance
const apiClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 60000,
});

// ---------------- REPORT ---------------- //

// Fetch full report (single source of truth)
export const fetchReport = async () => {
  const response = await apiClient.get("/report");
  return response.data;
};

// Backward compatibility (prevents crashes in older pages)
export const fetchReportSummary = async () => {
  return fetchReport();
};

export const fetchReportActions = async () => {
  const report = await fetchReport();
  return report.actions || [];
};

// ---------------- PREVIEW ---------------- //

export const uploadReportPreview = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post(
    "/report/upload-preview",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 120000, // AI processing buffer
    }
  );

  return response.data;
};

// ---------------- APPLY ---------------- //

export const applyReportPreview = async (previewId) => {
  const response = await apiClient.post(
    `/report/apply-preview/${previewId}`
  );
  return response.data;
};

// ---------------- HISTORY ---------------- //

export const fetchUploadHistory = async () => {
  const response = await apiClient.get("/report/upload-history");
  return response.data;
};

// ---------------- ROLLBACK ---------------- //

export const rollbackFromHistory = async (historyId, options) => {
  const response = await apiClient.post(
    `/report/rollback/${historyId}`,
    options
  );
  return response.data;
};

// ---------------- ACTION UPDATE (FIXED) ---------------- //

export const patchActionStatus = async (actionId, status) => {
  const response = await apiClient.patch(
    `/report/actions/${actionId}`,
    { status }
  );
  return response.data;
};

// ---------------- AI REFRESH (OPTIONAL / FUTURE SAFE) ---------------- //

// Safe wrapper: won’t crash if backend endpoint not present
export const refreshPreviewMetricsWithAI = async (previewId) => {
  try {
    const response = await apiClient.post(
      `/report/previews/${previewId}/ai-metrics`
    );
    return response.data;
  } catch (err) {
    console.warn("AI refresh endpoint not available yet");
    return null;
  }
};