import { useEffect, useState } from "react";
import { CheckCircle, CloudArrowUp, FileArrowUp, WarningCircle } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { toast } from "../components/ui/sonner";
import KpiTable from "../components/report/KpiTable";
import {
  applyReportPreview,
  fetchUploadHistory,
  uploadReportPreview,
} from "../api/reportApi";

export default function UploadReportPage() {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const loadHistory = async () => {
    try {
      const historyRows = await fetchUploadHistory();
      setHistory(historyRows);
    } catch {
      toast.error("Unable to load upload history.");
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handlePreview = async () => {
    if (!selectedFile) {
      toast.error("Please choose a PDF or DOCX file first.");
      return;
    }

    setIsPreviewing(true);
    try {
      const previewData = await uploadReportPreview(selectedFile);
      setPreview(previewData);
      toast.success("Preview generated. Review and apply when ready.");
    } catch (error) {
      const message = error?.response?.data?.detail || "Preview generation failed.";
      toast.error(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleApply = async () => {
    if (!preview?.preview_id) {
      toast.error("Generate a preview before applying changes.");
      return;
    }

    setIsApplying(true);
    try {
      await applyReportPreview(preview.preview_id);
      await loadHistory();
      toast.success("Dashboard updated from uploaded report.");
      navigate("/summary");
    } catch (error) {
      const message = error?.response?.data?.detail || "Apply update failed.";
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <section className="space-y-8" data-testid="upload-report-page">
      <div className="space-y-3" data-testid="upload-page-header">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4B5563]" data-testid="upload-page-overline">
          Upload Report and Update Dashboard
        </p>
        <h2 className="text-4xl font-bold tracking-tight text-[#111827]" data-testid="upload-page-heading">
          Upload PDF or DOCX, Preview Changes, Then Apply
        </h2>
        <p className="max-w-4xl text-base text-[#4B5563]" data-testid="upload-page-description">
          This flow parses the uploaded report, previews extracted metrics, fills missing fields as "Not available", and updates the complete dashboard only after confirmation.
        </p>
      </div>

      <Card className="rounded-sm border-[#E5E7EB] shadow-none" data-testid="upload-controls-card">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-lg font-semibold text-[#111827]" data-testid="upload-controls-title">
            <CloudArrowUp size={20} className="text-[#002FA7]" />
            Report Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto] md:items-center" data-testid="upload-controls-grid">
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="w-full rounded-sm border border-[#D1D5DB] bg-white px-3 py-2"
              data-testid="upload-file-input"
            />

            <Button
              onClick={handlePreview}
              disabled={isPreviewing}
              data-testid="generate-preview-button"
            >
              <FileArrowUp size={16} />
              {isPreviewing ? "Parsing..." : "Generate Preview"}
            </Button>

            <Button
              variant="outline"
              onClick={handleApply}
              disabled={!preview?.preview_id || isApplying}
              data-testid="apply-update-button"
            >
              {isApplying ? "Applying..." : "Apply Update"}
            </Button>
          </div>
          <p className="text-sm text-[#4B5563]" data-testid="upload-selected-file-name">
            Selected file: {selectedFile?.name || "None"}
          </p>
        </CardContent>
      </Card>

      {preview && (
        <>
          <Card className="rounded-sm border-[#E5E7EB] bg-[#F9FAFB] shadow-none" data-testid="preview-summary-card">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#111827]" data-testid="preview-summary-title">
                Preview Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4" data-testid="preview-summary-grid">
              <div className="rounded-sm border border-[#E5E7EB] bg-white p-3" data-testid="preview-summary-file">
                <p className="text-xs uppercase tracking-[0.14em] text-[#6B7280]">Source File</p>
                <p className="font-semibold text-[#111827]">{preview.uploaded_filename}</p>
              </div>
              <div className="rounded-sm border border-[#E5E7EB] bg-white p-3" data-testid="preview-summary-period">
                <p className="text-xs uppercase tracking-[0.14em] text-[#6B7280]">Period</p>
                <p className="font-semibold text-[#111827]">{preview.report.period}</p>
              </div>
              <div className="rounded-sm border border-[#E5E7EB] bg-white p-3" data-testid="preview-summary-score">
                <p className="text-xs uppercase tracking-[0.14em] text-[#6B7280]">Executive Score</p>
                <p className="font-semibold text-[#111827]">{preview.report.executive_score}/100</p>
              </div>
              <div className="rounded-sm border border-[#E5E7EB] bg-white p-3" data-testid="preview-summary-risk">
                <p className="text-xs uppercase tracking-[0.14em] text-[#6B7280]">Risk Level</p>
                <p className="font-semibold text-[#111827]">{preview.report.risk_level}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="preview-notices-grid">
            <Card className="rounded-sm border-[#E5E7EB] shadow-none" data-testid="preview-missing-fields-card">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2 text-base font-semibold text-[#111827]">
                  <WarningCircle size={18} className="text-[#F59E0B]" /> Missing Fields (Filled Automatically)
                </CardTitle>
              </CardHeader>
              <CardContent data-testid="preview-missing-fields-list">
                {preview.missing_fields.length === 0 ? (
                  <p className="text-sm text-[#047857]" data-testid="preview-missing-fields-empty">No missing fields detected.</p>
                ) : (
                  <ul className="space-y-2">
                    {preview.missing_fields.map((field) => (
                      <li key={field} className="text-sm text-[#92400E]" data-testid={`preview-missing-field-${field.replace(/_/g, "-")}`}>
                        {field}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-sm border-[#E5E7EB] shadow-none" data-testid="preview-warnings-card">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2 text-base font-semibold text-[#111827]">
                  <CheckCircle size={18} className="text-[#10B981]" /> Parse Notes
                </CardTitle>
              </CardHeader>
              <CardContent data-testid="preview-warnings-list">
                {preview.warnings.length === 0 ? (
                  <p className="text-sm text-[#047857]" data-testid="preview-warnings-empty">No parsing warnings.</p>
                ) : (
                  <ul className="space-y-2">
                    {preview.warnings.map((warning, index) => (
                      <li key={warning} className="text-sm text-[#374151]" data-testid={`preview-warning-item-${index + 1}`}>
                        {warning}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3" data-testid="preview-kpi-table-section">
            <h3 className="text-2xl font-semibold text-[#111827]" data-testid="preview-kpi-heading">
              Parsed KPI Preview
            </h3>
            <KpiTable metrics={preview.report.metrics} />
          </div>
        </>
      )}

      <Card className="rounded-sm border-[#E5E7EB] shadow-none" data-testid="upload-history-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#111827]" data-testid="upload-history-title">
            Upload History (Latest 10)
          </CardTitle>
        </CardHeader>
        <CardContent data-testid="upload-history-list">
          {history.length === 0 ? (
            <p className="text-sm text-[#4B5563]" data-testid="upload-history-empty">
              No uploads have been applied yet.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.history_id} className="rounded-sm border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3" data-testid={`upload-history-item-${item.history_id}`}>
                  <p className="font-semibold text-[#111827]" data-testid={`upload-history-file-${item.history_id}`}>
                    {item.uploaded_filename}
                  </p>
                  <p className="text-sm text-[#4B5563]" data-testid={`upload-history-meta-${item.history_id}`}>
                    Applied: {new Date(item.uploaded_at).toLocaleString()} | Score: {item.executive_score}/100 | Risk: {item.risk_level} | Red Controls: {item.red_controls}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
