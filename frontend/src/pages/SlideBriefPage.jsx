import React, { useEffect, useState } from "react";
import { fetchReport } from "../api/reportApi";

const SlideBriefPage = () => {
  const [report, setReport] = useState("");
  const [slides, setSlides] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadReport = async () => {
      try {
        const res = await fetchReport();

        if (res.error || !res.report) {
          throw new Error("No report available");
        }

        setReport(res.report);

        // Simple slide split logic (you can replace with AI later)
        const generatedSlides = res.report
          .split("\n")
          .filter((line) => line.trim() !== "")
          .slice(0, 5)
          .map((line, index) => ({
            title: `Slide ${index + 1}`,
            content: line,
          }));

        setSlides(generatedSlides);
      } catch (err) {
        console.error(err);
        setError("Upload report first to generate slides.");
      }
    };

    loadReport();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Slide Brief</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {slides.length > 0 ? (
        slides.map((slide, index) => (
          <div
            key={index}
            style={{
              marginTop: "15px",
              padding: "15px",
              border: "1px solid #ccc",
              borderRadius: "8px",
            }}
          >
            <h3>{slide.title}</h3>
            <p>{slide.content}</p>
          </div>
        ))
      ) : (
        !error && <p>No slides generated yet.</p>
      )}
    </div>
  );
};

export default SlideBriefPage;