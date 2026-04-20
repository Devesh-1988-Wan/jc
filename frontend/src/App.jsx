import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";

const Page = ({ title }) => <div style={{ padding: 20 }}>{title}</div>;

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/summary" />} />
        <Route path="summary" element={<Page title="Executive Summary" />} />
        <Route path="slides" element={<Page title="Slide Brief" />} />
        <Route path="findings" element={<Page title="Detailed Findings" />} />
        <Route path="appendix" element={<Page title="KPI Appendix" />} />
        <Route path="upload" element={<Page title="Upload Report" />} />
        <Route path="editor" element={<Page title="Widget Editor" />} />
      </Route>
    </Routes>
  );
}

export default App;