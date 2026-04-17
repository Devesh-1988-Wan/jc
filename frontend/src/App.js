import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Toaster } from "./components/ui/sonner";
import MainLayout from "./components/layout/MainLayout";
import ExecutiveSummaryPage from "./pages/ExecutiveSummaryPage";
import SlideBriefPage from "./pages/SlideBriefPage";
import DetailedFindingsPage from "./pages/DetailedFindingsPage";
import KpiAppendixPage from "./pages/KpiAppendixPage";
import UploadReportPage from "./pages/UploadReportPage";
import WidgetEditorPage from "./pages/WidgetEditorPage";

function App() {
  return (
    <div className="App" data-testid="app-root">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/summary" replace />} />
            <Route path="summary" element={<ExecutiveSummaryPage />} />
            <Route path="slides" element={<SlideBriefPage />} />
            <Route path="findings" element={<DetailedFindingsPage />} />
            <Route path="appendix" element={<KpiAppendixPage />} />
            <Route path="upload" element={<UploadReportPage />} />
            <Route path="editor" element={<WidgetEditorPage />} />
          </Route>
        </Routes>
        <Toaster data-testid="global-toaster" />
      </BrowserRouter>
    </div>
  );
}

export default App;
