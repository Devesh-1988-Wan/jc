import React, { useEffect, useState } from "react";
import { fetchReportSummary } from "../api/reportApi";

const ExecutiveSummaryPage = () => {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetchReportSummary();

        if (!res || !res.summary) {
          throw new Error("No summary available");
        }

        setSummary(res.summary);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch summary. Upload report first.");
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Executive Summary</h2>

      {/* LOADING */}
      {loading && <p>Loading summary...</p>}

      {/* ERROR */}
      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}

      {/* SUMMARY */}
      {!loading && !error && (
        <div
          style={{
            marginTop: "15px",
            padding: "15px",
            border: "1px solid #ccc",
            borderRadius: "8px",
          }}
        >
          <p style={{ whiteSpace: "pre-wrap" }}>
            {summary}
          </p>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummaryPage;