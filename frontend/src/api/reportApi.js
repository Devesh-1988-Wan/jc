const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// ==============================
// FETCH REPORT SUMMARY (Executive Page)
// ==============================
export const fetchReportSummary = async () => {
  try {
    const res = await fetch(`${BASE_URL}/report/summary`);
    if (!res.ok) throw new Error("Failed to fetch summary");
    return await res.json();
  } catch (err) {
    console.error("fetchReportSummary error:", err);
    return null;
  }
};

// ==============================
// FETCH KPI DATA (Executive Page)
// ==============================
export const fetchKpiData = async () => {
  try {
    const res = await fetch(`${BASE_URL}/report/kpis`);
    if (!res.ok) throw new Error("Failed to fetch KPIs");
    return await res.json();
  } catch (err) {
    console.error("fetchKpiData error:", err);
    return [];
  }
};

// ==============================
// ✅ ADD THIS → USED BY KPI APPENDIX PAGE
// ==============================
export const fetchReport = async () => {
  try {
    const res = await fetch(`${BASE_URL}/report`);
    if (!res.ok) throw new Error("Failed to fetch report");
    return await res.json();
  } catch (err) {
    console.error("fetchReport error:", err);
    return { kpi_definitions: [] }; // safe fallback
  }
};

// ==============================
// ✅ ADD THIS → USED BY ACTION TRACKER
// ==============================
export const fetchReportActions = async () => {
  try {
    const res = await fetch(`${BASE_URL}/actions`);
    if (!res.ok) throw new Error("Failed to fetch actions");
    return await res.json();
  } catch (err) {
    console.error("fetchReportActions error:", err);
    return [];
  }
};

// ==============================
// PATCH ACTION STATUS
// ==============================
export const patchActionStatus = async (id, status) => {
  try {
    const res = await fetch(`${BASE_URL}/actions/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) throw new Error("Failed to update action");

    return await res.json();
  } catch (err) {
    console.error("patchActionStatus error:", err);
    return null;
  }
};

// ==============================
// GENERATE REPORT
// ==============================
export const generateReport = async () => {
  try {
    const res = await fetch(`${BASE_URL}/report/generate`, {
      method: "POST",
    });

    if (!res.ok) throw new Error("Report generation failed");

    return await res.json();
  } catch (err) {
    console.error("generateReport error:", err);
    return null;
  }
};