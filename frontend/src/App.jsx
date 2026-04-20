import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";

import ExecutiveSummaryPage from "./pages/ExecutiveSummaryPage";
import SlideBriefPage from "./pages/SlideBriefPage";
import DetailedFindingsPage from "./pages/DetailedFindingsPage";
import KpiAppendixPage from "./pages/KpiAppendixPage";
import UploadReportPage from "./pages/UploadReportPage";
import WidgetEditorPage from "./pages/WidgetEditorPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/summary" />} />

        <Route path="summary" element={<ExecutiveSummaryPage />} />
        <Route path="slides" element={<SlideBriefPage />} />
        <Route path="findings" element={<DetailedFindingsPage />} />
        <Route path="appendix" element={<KpiAppendixPage />} />
        <Route path="upload" element={<UploadReportPage />} />
        <Route path="editor" element={<WidgetEditorPage />} />
      </Route>
    </Routes>
  );
}

export default App;