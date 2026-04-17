import { useEffect, useState } from "react";
import { PencilSimpleLine } from "@phosphor-icons/react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { toast } from "../components/ui/sonner";
import KpiTable from "../components/report/KpiTable";
import { fetchReport, updateReportWidgets } from "../api/reportApi";

const metricStatuses = ["GREEN", "AMBER", "RED"];
const metricCategories = ["SLA", "Workflow Hygiene", "Traceability", "Quality", "Planning"];
const actionPriorities = ["P0", "P1", "P2"];
const actionStatuses = ["Not Started", "In Progress", "Completed"];

export default function WidgetEditorPage() {
  const [report, setReport] = useState(null);

  const [isSummaryEditing, setIsSummaryEditing] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(null);

  const [isMetricsEditing, setIsMetricsEditing] = useState(false);
  const [metricsDraft, setMetricsDraft] = useState([]);

  const [isRiskRecEditing, setIsRiskRecEditing] = useState(false);
  const [riskDraftText, setRiskDraftText] = useState("");
  const [recommendationDraftText, setRecommendationDraftText] = useState("");

  const [isActionsEditing, setIsActionsEditing] = useState(false);
  const [actionsDraft, setActionsDraft] = useState([]);

  const loadReport = async () => {
    try {
      const reportData = await fetchReport();
      setReport(reportData);
    } catch {
      toast.error("Unable to load editable widgets.");
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const saveWidget = async (payload, successMessage) => {
    try {
      const updated = await updateReportWidgets(payload);
      setReport(updated);
      toast.success(successMessage);
      return updated;
    } catch (error) {
      const message = error?.response?.data?.detail || "Widget save failed.";
      toast.error(message);
      return null;
    }
  };

  if (!report) {
    return (
      <div className="rounded-sm border border-[#E5E7EB] bg-white p-8" data-testid="widget-editor-loading-state">
        Loading widget editor...
      </div>
    );
  }

  return (
    <section className="space-y-8" data-testid="widget-editor-page">
      <div className="space-y-3" data-testid="widget-editor-header">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4B5563]" data-testid="widget-editor-overline">
          Editable Widgets
        </p>
        <h2 className="text-4xl font-bold tracking-tight text-[#111827]" data-testid="widget-editor-heading">
          Modify Dashboard Data with Save/Cancel Controls
        </h2>
      </div>

      <Card className="rounded-sm border-[#E5E7EB] shadow-none" data-testid="widget-summary-editor-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#111827]" data-testid="widget-summary-editor-title">
            Summary Widget
          </CardTitle>
          {!isSummaryEditing && (
            <Button
              variant="outline"
              onClick={() => {
                setSummaryDraft({
                  period: report.period,
                  executive_score: report.executive_score,
                  risk_level: report.risk_level,
                  key_message: report.key_message,
                });
                setIsSummaryEditing(true);
              }}
              data-testid="summary-widget-edit-button"
            >
              <PencilSimpleLine size={16} /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isSummaryEditing ? (
            <div className="space-y-3" data-testid="summary-widget-edit-form">
              <Input
                value={summaryDraft.period}
                onChange={(event) => setSummaryDraft((prev) => ({ ...prev, period: event.target.value }))}
                data-testid="summary-widget-period-input"
              />
              <Input
                type="number"
                value={summaryDraft.executive_score}
                onChange={(event) => setSummaryDraft((prev) => ({ ...prev, executive_score: Number(event.target.value) || 0 }))}
                data-testid="summary-widget-score-input"
              />
              <select
                className="h-10 rounded-sm border border-[#D1D5DB] px-3"
                value={summaryDraft.risk_level}
                onChange={(event) => setSummaryDraft((prev) => ({ ...prev, risk_level: event.target.value }))}
                data-testid="summary-widget-risk-select"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <Textarea
                value={summaryDraft.key_message}
                onChange={(event) => setSummaryDraft((prev) => ({ ...prev, key_message: event.target.value }))}
                data-testid="summary-widget-message-textarea"
              />

              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    const updated = await saveWidget(summaryDraft, "Summary widget updated.");
                    if (updated) setIsSummaryEditing(false);
                  }}
                  data-testid="summary-widget-save-button"
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsSummaryEditing(false)}
                  data-testid="summary-widget-cancel-button"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2" data-testid="summary-widget-readonly">
              <p data-testid="summary-widget-period-display">Period: {report.period}</p>
              <p data-testid="summary-widget-score-display">Executive Score: {report.executive_score}</p>
              <p data-testid="summary-widget-risk-display">Risk Level: {report.risk_level}</p>
              <p data-testid="summary-widget-message-display">{report.key_message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-sm border-[#E5E7EB] shadow-none" data-testid="widget-metrics-editor-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#111827]" data-testid="widget-metrics-editor-title">
            KPI Metrics Widget
          </CardTitle>
          {!isMetricsEditing && (
            <Button
              variant="outline"
              onClick={() => {
                setMetricsDraft(report.metrics.map((metric) => ({ ...metric })));
                setIsMetricsEditing(true);
              }}
              data-testid="metrics-widget-edit-button"
            >
              <PencilSimpleLine size={16} /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isMetricsEditing ? (
            <div className="space-y-3" data-testid="metrics-widget-edit-form">
              {metricsDraft.map((metric, index) => (
                <div key={`${metric.metric_id}-${index}`} className="grid grid-cols-1 gap-2 rounded-sm border border-[#E5E7EB] p-3 md:grid-cols-5" data-testid={`metric-edit-row-${metric.metric_id.toLowerCase()}`}>
                  <Input
                    value={metric.title}
                    onChange={(event) =>
                      setMetricsDraft((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, title: event.target.value } : item)),
                      )
                    }
                    data-testid={`metric-edit-title-${metric.metric_id.toLowerCase()}`}
                  />
                  <Input
                    type="number"
                    value={metric.value}
                    onChange={(event) =>
                      setMetricsDraft((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, value: Number(event.target.value) || 0 } : item)),
                      )
                    }
                    data-testid={`metric-edit-value-${metric.metric_id.toLowerCase()}`}
                  />
                  <select
                    className="h-10 rounded-sm border border-[#D1D5DB] px-3"
                    value={metric.status}
                    onChange={(event) =>
                      setMetricsDraft((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, status: event.target.value } : item)),
                      )
                    }
                    data-testid={`metric-edit-status-${metric.metric_id.toLowerCase()}`}
                  >
                    {metricStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-sm border border-[#D1D5DB] px-3"
                    value={metric.category}
                    onChange={(event) =>
                      setMetricsDraft((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, category: event.target.value } : item)),
                      )
                    }
                    data-testid={`metric-edit-category-${metric.metric_id.toLowerCase()}`}
                  >
                    {metricCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <Input
                    value={metric.insight}
                    onChange={(event) =>
                      setMetricsDraft((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, insight: event.target.value } : item)),
                      )
                    }
                    data-testid={`metric-edit-insight-${metric.metric_id.toLowerCase()}`}
                  />
                </div>
              ))}

              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    const definitions = metricsDraft.map((metric) => ({
                      metric_id: metric.metric_id,
                      definition: metric.title,
                      target: "GREEN <= 5%, AMBER 6-15%, RED > 15%",
                      current_status: metric.status,
                    }));
                    const updated = await saveWidget({ metrics: metricsDraft, kpi_definitions: definitions }, "Metrics widget updated.");
                    if (updated) setIsMetricsEditing(false);
                  }}
                  data-testid="metrics-widget-save-button"
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsMetricsEditing(false)}
                  data-testid="metrics-widget-cancel-button"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <KpiTable metrics={report.metrics} />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-sm border-[#E5E7EB] shadow-none" data-testid="widget-risk-rec-editor-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#111827]" data-testid="widget-risk-rec-editor-title">
            Risks + Recommendations Widget
          </CardTitle>
          {!isRiskRecEditing && (
            <Button
              variant="outline"
              onClick={() => {
                setRiskDraftText(report.top_risks.join("\n"));
                setRecommendationDraftText(report.recommendations.join("\n"));
                setIsRiskRecEditing(true);
              }}
              data-testid="risk-rec-widget-edit-button"
            >
              <PencilSimpleLine size={16} /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isRiskRecEditing ? (
            <div className="space-y-3" data-testid="risk-rec-widget-edit-form">
              <Textarea
                value={riskDraftText}
                onChange={(event) => setRiskDraftText(event.target.value)}
                data-testid="risk-widget-textarea"
              />
              <Textarea
                value={recommendationDraftText}
                onChange={(event) => setRecommendationDraftText(event.target.value)}
                data-testid="recommendation-widget-textarea"
              />

              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    const updated = await saveWidget(
                      {
                        top_risks: riskDraftText.split("\n").map((item) => item.trim()).filter(Boolean),
                        recommendations: recommendationDraftText.split("\n").map((item) => item.trim()).filter(Boolean),
                      },
                      "Risk and recommendation widgets updated.",
                    );
                    if (updated) setIsRiskRecEditing(false);
                  }}
                  data-testid="risk-rec-widget-save-button"
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsRiskRecEditing(false)}
                  data-testid="risk-rec-widget-cancel-button"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="risk-rec-widget-readonly">
              <div>
                <p className="font-semibold text-[#111827]">Top Risks</p>
                <ul className="mt-2 space-y-1 text-sm text-[#374151]">
                  {report.top_risks.map((risk, index) => (
                    <li key={`${index}-${risk}`} data-testid={`risk-widget-item-${index + 1}`}>{risk}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-[#111827]">Recommendations</p>
                <ul className="mt-2 space-y-1 text-sm text-[#374151]">
                  {report.recommendations.map((item, index) => (
                    <li key={`${index}-${item}`} data-testid={`recommendation-widget-item-${index + 1}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-sm border-[#E5E7EB] shadow-none" data-testid="widget-actions-editor-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#111827]" data-testid="widget-actions-editor-title">
            Actions Widget
          </CardTitle>
          {!isActionsEditing && (
            <Button
              variant="outline"
              onClick={() => {
                setActionsDraft(report.actions.map((action) => ({ ...action })));
                setIsActionsEditing(true);
              }}
              data-testid="actions-widget-edit-button"
            >
              <PencilSimpleLine size={16} /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isActionsEditing ? (
            <div className="space-y-3" data-testid="actions-widget-edit-form">
              {actionsDraft.map((action, index) => (
                <div key={`${action.action_id}-${index}`} className="grid grid-cols-1 gap-2 rounded-sm border border-[#E5E7EB] p-3 md:grid-cols-6" data-testid={`actions-edit-row-${action.action_id.toLowerCase()}`}>
                  <Input
                    value={action.title}
                    onChange={(event) =>
                      setActionsDraft((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, title: event.target.value } : item)),
                      )
                    }
                    data-testid={`actions-edit-title-${action.action_id.toLowerCase()}`}
                  />
                  <Input
                    value={action.owner}
                    onChange={(event) =>
                      setActionsDraft((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, owner: event.target.value } : item)),
                      )
                    }
                    data-testid={`actions-edit-owner-${action.action_id.toLowerCase()}`}
                  />
                  <select
                    className="h-10 rounded-sm border border-[#D1D5DB] px-3"
                    value={action.priority}
                    onChange={(event) =>
                      setActionsDraft((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, priority: event.target.value } : item)),
                      )
                    }
                    data-testid={`actions-edit-priority-${action.action_id.toLowerCase()}`}
                  >
                    {actionPriorities.map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    value={action.due_in_days}
                    onChange={(event) =>
                      setActionsDraft((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, due_in_days: Number(event.target.value) || 1 } : item)),
                      )
                    }
                    data-testid={`actions-edit-due-${action.action_id.toLowerCase()}`}
                  />
                  <select
                    className="h-10 rounded-sm border border-[#D1D5DB] px-3"
                    value={action.status}
                    onChange={(event) =>
                      setActionsDraft((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, status: event.target.value } : item)),
                      )
                    }
                    data-testid={`actions-edit-status-${action.action_id.toLowerCase()}`}
                  >
                    {actionStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <Input
                    value={action.expected_impact}
                    onChange={(event) =>
                      setActionsDraft((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, expected_impact: event.target.value } : item)),
                      )
                    }
                    data-testid={`actions-edit-impact-${action.action_id.toLowerCase()}`}
                  />
                </div>
              ))}

              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    const updated = await saveWidget({ actions: actionsDraft }, "Actions widget updated.");
                    if (updated) setIsActionsEditing(false);
                  }}
                  data-testid="actions-widget-save-button"
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsActionsEditing(false)}
                  data-testid="actions-widget-cancel-button"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3" data-testid="actions-widget-readonly">
              {report.actions.map((action, index) => (
                <div key={`${index}-${action.action_id}`} className="rounded-sm border border-[#E5E7EB] p-3" data-testid={`actions-widget-item-${index + 1}`}>
                  <p className="font-semibold text-[#111827]">{action.action_id} · {action.title}</p>
                  <p className="text-sm text-[#4B5563]">{action.owner} | {action.priority} | {action.status} | Due {action.due_in_days} days</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
