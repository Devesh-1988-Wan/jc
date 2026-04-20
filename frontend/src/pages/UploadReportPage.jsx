import React, { useState } from "react";
import { uploadReport, applyReportPreview } from "../api/reportApi";

const UploadReportPage = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setPreview(null);

      // Step 1: Upload
      await uploadReport(file);

      // Step 2: Generate Preview
      const previewData = await applyReportPreview();

      if (previewData?.error) {
        throw new Error(previewData.error);
      }

      setPreview(previewData);
    } catch (err) {
      console.error(err);
      setError("Failed to generate preview. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Upload Report</h2>

      {/* FILE INPUT */}
      <input
        type="file"
        onChange={(e) => {
          setFile(e.target.files[0]);
          setError("");
        }}
      />

      {/* BUTTON */}
      <div style={{ marginTop: "10px" }}>
        <button onClick={handleUpload} disabled={loading}>
          {loading ? "Processing..." : "Upload & Generate Preview"}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <p style={{ color: "red", marginTop: "10px" }}>
          {error}
        </p>
      )}

      {/* PREVIEW OUTPUT */}
      {preview && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            border: "1px solid #ccc",
            borderRadius: "8px",
          }}
        >
          <h3>{preview.title || "Preview"}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {preview.content}
          </p>
        </div>
      )}
    </div>
  );
};

export default UploadReportPage;