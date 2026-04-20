import React, { useEffect, useState } from "react";
import { fetchReportSummary } from "../api/reportApi";

const ExecutiveSummaryPage = () => {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await fetchReportSummary();

        console.log("SUMMARY API RESPONSE:", data);

        if (!data || !data.summary) {
          setError("No summary available");
          return;
        }

        setSummary(data.summary);

      } catch (err) {
        console.error("Summary Error:", err);
        setError("Failed to load summary");
      } finally {
        setLoading(false); // ✅ ALWAYS stop loading
      }
    };

    loadSummary(); // ✅ CORRECT placement
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Executive Summary</h2>

      {/* LOADING */}
      {loading && <p>Loading summary...</p>}

      {/* ERROR */}
      {!loading && error && (
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
            {typeof summary === "string"
              ? summary
              : JSON.stringify(summary, null, 2)}
          </p>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummaryPage;