// 🔥 Hardcode base URL
const BASE_URL = "http://127.0.0.1:8000";

// -----------------------------
// GENERIC FETCH HELPER
// -----------------------------
const handleResponse = async (res, url) => {
  console.log(`📡 Response from ${url}:`, res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ API Error (${res.status}) from ${url}:`, text);
    throw new Error(`API Error ${res.status}: ${text}`);
  }

  const data = await res.json();
  console.log(`✅ Data from ${url}:`, data);

  return data;
};

// -----------------------------
// FETCH SUMMARY
// -----------------------------
export const fetchReportSummary = async () => {
  const url = `${BASE_URL}/report/summary`;
  console.log("📊 Calling:", url);

  try {
    const res = await fetch(url);
    return handleResponse(res, url);
  } catch (err) {
    console.error("❌ Summary Fetch Failed:", err);
    throw err;
  }
};

// -----------------------------
// FETCH FULL REPORT
// -----------------------------
export const fetchReport = async () => {
  const url = `${BASE_URL}/report`;
  console.log("📄 Calling:", url);

  try {
    const res = await fetch(url);
    return handleResponse(res, url);
  } catch (err) {
    console.error("❌ Report Fetch Failed:", err);
    throw err;
  }
};

// -----------------------------
// FETCH ACTIONS
// -----------------------------
export const fetchReportActions = async () => {
  const url = `${BASE_URL}/report/actions`;
  console.log("🧠 Calling:", url);

  try {
    const res = await fetch(url);
    return handleResponse(res, url);
  } catch (err) {
    console.error("❌ Actions Fetch Failed:", err);
    throw err;
  }
};

// -----------------------------
// UPDATE ACTION STATUS
// -----------------------------
export const patchActionStatus = async (id, status) => {
  const url = `${BASE_URL}/report/actions/${id}`;
  console.log("✏️ Calling:", url, "Status:", status);

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    return handleResponse(res, url);
  } catch (err) {
    console.error("❌ Patch Action Failed:", err);
    throw err;
  }
};

// -----------------------------
// FETCH WIDGET CONFIG
// -----------------------------
export const fetchReportWidgets = async () => {
  const url = `${BASE_URL}/report/widgets`;
  console.log("🧩 Calling:", url);

  try {
    const res = await fetch(url);
    return handleResponse(res, url);
  } catch (err) {
    console.error("❌ Widgets Fetch Failed:", err);
    throw err;
  }
};

// -----------------------------
// UPDATE WIDGET CONFIG
// -----------------------------
export const updateReportWidgets = async (widgets) => {
  const url = `${BASE_URL}/report/widgets`;
  console.log("🛠️ Calling:", url, "Payload:", widgets);

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ widgets }),
    });

    return handleResponse(res, url);
  } catch (err) {
    console.error("❌ Widget Update Failed:", err);
    throw err;
  }
};

// -----------------------------
// UPLOAD REPORT (PDF)
// -----------------------------
export const uploadReport = async (file) => {
  const url = `${BASE_URL}/upload`;
  console.log("🚀 Upload URL:", url);
  console.log("📄 File:", file);

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    return handleResponse(res, url);
  } catch (err) {
    console.error("❌ Upload Failed:", err);
    throw err;
  }
};