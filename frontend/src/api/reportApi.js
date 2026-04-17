import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const apiClient = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 10000,
});

export const fetchReport = async () => {
  const response = await apiClient.get("/report");
  return response.data;
};

export const fetchReportSummary = async () => {
  const response = await apiClient.get("/report/summary");
  return response.data;
};

export const fetchReportActions = async () => {
  const response = await apiClient.get("/report/actions");
  return response.data;
};

export const patchActionStatus = async (actionId, status) => {
  const response = await apiClient.patch(`/report/actions/${actionId}`, { status });
  return response.data;
};

export const uploadReportPreview = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post("/report/upload-preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const applyReportPreview = async (previewId) => {
  const response = await apiClient.post(`/report/apply-preview/${previewId}`);
  return response.data;
};

export const fetchUploadHistory = async () => {
  const response = await apiClient.get("/report/upload-history");
  return response.data;
};

export const rollbackFromHistory = async (historyId, options) => {
  const response = await apiClient.post(`/report/rollback/${historyId}`, options);
  return response.data;
};

export const updateReportWidgets = async (payload) => {
  const response = await apiClient.patch("/report/widgets", payload);
  return response.data;
};
