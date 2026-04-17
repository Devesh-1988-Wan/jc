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
