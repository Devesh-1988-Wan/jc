import React, { useState } from "react";
import {
  uploadReport,
  generatePreview,
  applyReportPreview,
} from "../api/reportApi";

const UploadReportPage = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setPreview(null);

      // ✅ STEP 1: Upload file
      const uploadRes = await uploadReport(file);
      console.log("Upload Response:", uploadRes);

      // ✅ STEP 2: Generate preview
      const previewRes = await generatePreview();
      console.log("Preview Response:", previewRes);

      if (previewRes?.error) {
        throw new Error(previewRes.error);
      }

      setPreview(previewRes);
    } catch (err) {
      console.error("Upload Flow Error:", err);
      setError(err.message || "Failed to generate preview. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ OPTIONAL: Apply preview (separate action)
  const handleApply = async () => {
    try {
      setLoading(true);
      const res = await applyReportPreview();
      console.log("Apply Response:", res);

      setSuccess("Preview applied successfully!");
    } catch (err) {
      console.error(err);
      setError("Failed to apply preview");
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
        accept=".pdf,.txt"
        onChange={(e) => {
          setFile(e.target.files[0]);
          setError("");
          setSuccess("");
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
        <p style={{ color: "red", marginTop: "10px" }}>{error}</p>
      )}

      {/* SUCCESS */}
      {success && (
        <p style={{ color: "green", marginTop: "10px" }}>{success}</p>
      )}

      {/* PREVIEW */}
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

          {/* APPLY BUTTON */}
          <button
            onClick={handleApply}
            style={{ marginTop: "10px" }}
            disabled={loading}
          >
            Apply Preview
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadReportPage;