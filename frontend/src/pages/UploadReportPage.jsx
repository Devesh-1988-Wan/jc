import { useEffect, useMemo, useState } from "react";
import { CheckCircle, CloudArrowUp, FileArrowUp, WarningCircle, ArrowUUpLeft } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { toast } from "../components/ui/sonner";
import KpiTable from "../components/report/KpiTable";
import {
  applyReportPreview,
  fetchReport,
  fetchUploadHistory,
  rollbackFromHistory,
  uploadReportPreview,
} from "../api/reportApi";
import {
  buildListDiff,
  buildObjectDiff,
  buildSummaryDiff,
  getChangeTone,
} from "../utils/reportDiff";

const rollbackFieldOptions = [
  { key: "restore_summary", label: "Summary" },
  { key: "restore_metrics", label: "Metrics" },
  { key: "restore_risks", label: "Top Risks" },
  { key: "restore_recommendations", label: "Recommendations" },
  { key: "restore_actions", label: "Actions" },
  { key: "restore_kpi_definitions", label: "KPI Definitions" },
  { key: "restore_narratives", label: "Narratives" },
];

const renderChangeBadge = (changeType) => {
  if (changeType === "added") return "Added";
  if (changeType === "removed") return "Removed";
  if (changeType === "changed") return "Changed";
  return "Unchanged";
};

export default function UploadReportPage() {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [rollbackInProgressId, setRollbackInProgressId] = useState("");
  const [rollbackOptions, setRollbackOptions] = useState({
    restore_summary: true,
    restore_metrics: true,
    restore_risks: true,
    restore_recommendations: true,
    restore_actions: true,
    restore_kpi_definitions: true,
    restore_narratives: true,
  });

  const loadHistory = async () => {
    try {
      const historyRows = await fetchUploadHistory();
      setHistory(historyRows);
    } catch {
      toast.error("Unable to load upload history.");
    }
  };

  const loadCurrentReport = async () => {
    try {
      const report = await fetchReport();
      setCurrentReport(report);
    } catch {
      toast.error("Unable to load current dashboard snapshot.");
    }
  };

  useEffect(() => {
    loadHistory();
    loadCurrentReport();
  }, []);

  const summaryDiffRows = useMemo(
    () => buildSummaryDiff(currentReport, preview?.report),
    [currentReport, preview],
  );

  const metricDiffRows = useMemo(
    () =>
      buildObjectDiff({
        currentItems: currentReport?.metrics,
        previewItems: preview?.report?.metrics,
        keyField: "metric_id",
        compareFields: ["title", "value", "status", "category", "insight"],
      }),
    [currentReport, preview],
  );

  const riskDiffRows = useMemo(
    () => buildListDiff({ currentItems: currentReport?.top_risks, previewItems: preview?.report?.top_risks, idPrefix: "risk" }),
    [currentReport, preview],
  );

  const recommendationDiffRows = useMemo(
    () =>
      buildListDiff({
        currentItems: currentReport?.recommendations,
        previewItems: preview?.report?.recommendations,
        idPrefix: "recommendation",
      }),
    [currentReport, preview],
  );

  const actionDiffRows = useMemo(
    () =>
      buildObjectDiff({
        currentItems: currentReport?.actions,
        previewItems: preview?.report?.actions,
        keyField: "action_id",
        compareFields: ["title", "owner", "priority", "due_in_days", "status", "expected_impact"],
      }),
    [currentReport, preview],
  );

  const definitionDiffRows = useMemo(
    () =>
      buildObjectDiff({
        currentItems: currentReport?.kpi_definitions,
        previewItems: preview?.report?.kpi_definitions,
        keyField: "metric_id",
        compareFields: ["definition", "target", "current_status"],
      }),
    [currentReport, preview],
  );

  const handlePreview = async () => {
    if (!selectedFile) {
      toast.error("Please choose a supported file first.");
      return;
    }

    setIsPreviewing(true);
    try {
      await loadCurrentReport();
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
      const updatedReport = await applyReportPreview(preview.preview_id);
      setCurrentReport(updatedReport);
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

  const handleRollback = async (historyId) => {
    if (!Object.values(rollbackOptions).some(Boolean)) {
      toast.error("Select at least one section to restore.");
      return;
    }

    setRollbackInProgressId(historyId);
    try {
      const rolledBackReport = await rollbackFromHistory(historyId, rollbackOptions);
      setCurrentReport(rolledBackReport);
      await loadHistory();
      toast.success("Rollback applied to selected sections.");
    } catch (error) {
      const message = error?.response?.data?.detail || "Rollback failed.";
      toast.error(message);
    } finally {
      setRollbackInProgressId("");
    }
  };

  return (
    <section className="space-y-8" data-testid="upload-report-page">
      <div className="space-y-3" data-testid="upload-page-header">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4B5563]" data-testid="upload-page-overline">
          Upload Report and Update Dashboard
        </p>
        <h2 className="text-4xl font-bold tracking-tight text-[#111827]" data-testid="upload-page-heading">
          Upload, Compare Current vs Preview, Then Apply
        </h2>
        <p className="max-w-4xl text-base text-[#4B5563]" data-testid="upload-page-description">
          Supports PDF, DOCX, TXT, MD, JPG, and PNG files. Missing fields are filled as "Not available" and every change is previewed before applying.
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
              accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png"
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
                    {preview.missing_fields.map((field, index) => (
                      <li key={`${index}-${field}`} className="text-sm text-[#92400E]" data-testid={`preview-missing-field-${field.replace(/_/g, "-")}`}>
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
                      <li key={`${index}-${warning}`} className="text-sm text-[#374151]" data-testid={`preview-warning-item-${index + 1}`}>
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

          <Card className="rounded-sm border-[#E5E7EB] bg-[#F9FAFB] shadow-none" data-testid="full-diff-card">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#111827]" data-testid="full-diff-title">
                Current vs Preview Full Diff
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2" data-testid="summary-diff-section">
                <h4 className="text-base font-semibold text-[#111827]">Summary Fields</h4>
                {summaryDiffRows.map((row, index) => (
                  <div key={row.id} className={`rounded-sm border px-4 py-3 ${getChangeTone(row.changeType)}`} data-testid={`summary-diff-row-${index + 1}`}>
                    <p className="text-xs uppercase tracking-[0.12em] text-[#6B7280]">{row.label} · {renderChangeBadge(row.changeType)}</p>
                    <p className="text-sm text-[#111827]">Current: {row.currentValue}</p>
                    <p className="text-sm text-[#111827]">Preview: {row.previewValue}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2" data-testid="metric-diff-section">
                <h4 className="text-base font-semibold text-[#111827]">KPI Metrics Diff</h4>
                {metricDiffRows.map((row, index) => (
                  <div key={row.id} className={`rounded-sm border px-4 py-3 ${getChangeTone(row.changeType)}`} data-testid={`metric-diff-row-${index + 1}`}>
                    <p className="font-semibold text-[#111827]">{row.id} · {renderChangeBadge(row.changeType)}</p>
                    <p className="text-sm text-[#374151]">Current: {row.currentItem ? `${row.currentItem.title} | ${row.currentItem.value}% | ${row.currentItem.status}` : "—"}</p>
                    <p className="text-sm text-[#374151]">Preview: {row.previewItem ? `${row.previewItem.title} | ${row.previewItem.value}% | ${row.previewItem.status}` : "—"}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2" data-testid="risk-diff-section">
                <h4 className="text-base font-semibold text-[#111827]">Top Risks Diff</h4>
                {riskDiffRows.map((row, index) => (
                  <div key={row.id} className={`rounded-sm border px-4 py-3 ${getChangeTone(row.changeType)}`} data-testid={`risk-diff-row-${index + 1}`}>
                    <p className="text-sm text-[#111827]">{renderChangeBadge(row.changeType)}</p>
                    <p className="text-sm text-[#374151]">Current: {row.currentValue}</p>
                    <p className="text-sm text-[#374151]">Preview: {row.previewValue}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2" data-testid="recommendation-diff-section">
                <h4 className="text-base font-semibold text-[#111827]">Recommendations Diff</h4>
                {recommendationDiffRows.map((row, index) => (
                  <div key={row.id} className={`rounded-sm border px-4 py-3 ${getChangeTone(row.changeType)}`} data-testid={`recommendation-diff-row-${index + 1}`}>
                    <p className="text-sm text-[#111827]">{renderChangeBadge(row.changeType)}</p>
                    <p className="text-sm text-[#374151]">Current: {row.currentValue}</p>
                    <p className="text-sm text-[#374151]">Preview: {row.previewValue}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2" data-testid="action-diff-section">
                <h4 className="text-base font-semibold text-[#111827]">Action Items Diff</h4>
                {actionDiffRows.map((row, index) => (
                  <div key={row.id} className={`rounded-sm border px-4 py-3 ${getChangeTone(row.changeType)}`} data-testid={`action-diff-row-${index + 1}`}>
                    <p className="font-semibold text-[#111827]">{row.id} · {renderChangeBadge(row.changeType)}</p>
                    <p className="text-sm text-[#374151]">Current: {row.currentItem ? `${row.currentItem.title} | ${row.currentItem.owner} | ${row.currentItem.status}` : "—"}</p>
                    <p className="text-sm text-[#374151]">Preview: {row.previewItem ? `${row.previewItem.title} | ${row.previewItem.owner} | ${row.previewItem.status}` : "—"}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2" data-testid="definition-diff-section">
                <h4 className="text-base font-semibold text-[#111827]">KPI Definitions Diff</h4>
                {definitionDiffRows.map((row, index) => (
                  <div key={row.id} className={`rounded-sm border px-4 py-3 ${getChangeTone(row.changeType)}`} data-testid={`definition-diff-row-${index + 1}`}>
                    <p className="font-semibold text-[#111827]">{row.id} · {renderChangeBadge(row.changeType)}</p>
                    <p className="text-sm text-[#374151]">Current: {row.currentItem ? `${row.currentItem.definition} | ${row.currentItem.current_status}` : "—"}</p>
                    <p className="text-sm text-[#374151]">Preview: {row.previewItem ? `${row.previewItem.definition} | ${row.previewItem.current_status}` : "—"}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="rounded-sm border-[#E5E7EB] shadow-none" data-testid="rollback-options-card">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-lg font-semibold text-[#111827]" data-testid="rollback-options-title">
            <ArrowUUpLeft size={18} className="text-[#002FA7]" />
            Rollback Options (Choose What to Restore)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="rollback-options-grid">
          {rollbackFieldOptions.map((option) => (
            <label key={option.key} className="inline-flex items-center gap-2 text-sm text-[#111827]" data-testid={`rollback-option-${option.key}`}>
              <input
                type="checkbox"
                checked={rollbackOptions[option.key]}
                onChange={(event) =>
                  setRollbackOptions((previous) => ({
                    ...previous,
                    [option.key]: event.target.checked,
                  }))
                }
                data-testid={`rollback-option-checkbox-${option.key}`}
              />
              {option.label}
            </label>
          ))}
        </CardContent>
      </Card>

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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#111827]" data-testid={`upload-history-file-${item.history_id}`}>
                        {item.uploaded_filename}
                      </p>
                      <p className="text-sm text-[#4B5563]" data-testid={`upload-history-meta-${item.history_id}`}>
                        Applied: {new Date(item.uploaded_at).toLocaleString()} | Score: {item.executive_score}/100 | Risk: {item.risk_level} | Red Controls: {item.red_controls}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleRollback(item.history_id)}
                      disabled={rollbackInProgressId === item.history_id}
                      data-testid={`upload-history-rollback-button-${item.history_id}`}
                    >
                      {rollbackInProgressId === item.history_id ? "Rolling back..." : "Rollback"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
