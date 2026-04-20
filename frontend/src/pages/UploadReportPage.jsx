// src/pages/UploadReportPage.jsx

import React, { useState } from "react";
import { uploadReport, applyReportPreview } from "../api/reportApi";

const UploadReportPage = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setLoading(true);
    setError("");
    setPreview(null);

    try {
      console.log("Uploading file...");
      await uploadReport(file);

      console.log("Generating preview...");
      const previewData = await applyReportPreview();

      setPreview(previewData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Upload Report</h2>

      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <br /><br />

      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Processing..." : "Upload & Generate Preview"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {preview && (
        <div style={{ marginTop: "20px" }}>
          <h3>Preview</h3>
          <pre>{JSON.stringify(preview, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default UploadReportPage;