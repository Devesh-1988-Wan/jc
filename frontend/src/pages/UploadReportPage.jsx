import React, { useState } from "react";
import { uploadReport } from "../api/reportApi";

const UploadReportPage = () => {
  const [file, setFile] = useState(null);
  const [report, setReport] = useState("");

  const handleUpload = async () => {
    try {
      if (!file) {
        alert("Please select a file");
        return;
      }

      console.log("📄 Uploading file:", file);

      const data = await uploadReport(file);

      console.log("✅ Upload response:", data);

      setReport(data.report);
    } catch (err) {
      console.error("❌ Upload Error:", err);
      alert("Upload failed");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Upload Jira Compliance PDF</h2>

      <input
        type="file"
        onChange={(e) => {
          console.log("📂 File selected:", e.target.files[0]);
          setFile(e.target.files[0]);
        }}
      />

      <button type="button" onClick={handleUpload}>
        Generate Report
      </button>

      <pre style={{ marginTop: "20px", whiteSpace: "pre-wrap" }}>
        {report}
      </pre>
    </div>
  );
};

export default UploadReportPage;