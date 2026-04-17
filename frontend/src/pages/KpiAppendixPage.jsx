import { useEffect, useMemo, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { toast } from "../components/ui/sonner";
import { fetchReport, fetchReportActions, patchActionStatus } from "../api/reportApi";

const statusOptions = ["Not Started", "In Progress", "Completed"];

export default function KpiAppendixPage() {
  const [report, setReport] = useState(null);
  const [actions, setActions] = useState([]);
  const [draftStatus, setDraftStatus] = useState({});
  const [savingActionId, setSavingActionId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [reportData, actionsData] = await Promise.all([fetchReport(), fetchReportActions()]);
        setReport(reportData);
        setActions(actionsData);

        const draftMap = actionsData.reduce((acc, action) => {
          acc[action.action_id] = action.status;
          return acc;
        }, {});
        setDraftStatus(draftMap);
      } catch {
        setError("Unable to load appendix and action tracker.");
      }
    };

    loadData();
  }, []);

  const completedCount = useMemo(
    () => actions.filter((action) => (draftStatus[action.action_id] || action.status) === "Completed").length,
    [actions, draftStatus],
  );

  const handleSave = async (actionId) => {
    try {
      setSavingActionId(actionId);
      const updatedAction = await patchActionStatus(actionId, draftStatus[actionId]);
      setActions((previous) => previous.map((action) => (action.action_id === actionId ? updatedAction : action)));
      toast.success("Action status updated.");
    } catch {
      toast.error("Failed to update action status.");
    } finally {
      setSavingActionId("");
    }
  };

  if (error) {
    return (
      <div className="rounded-sm border border-[#DC2626]/30 bg-[#FEF2F2] p-6 text-[#991B1B]" data-testid="appendix-load-error">
        {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-sm border border-[#E5E7EB] bg-white p-8" data-testid="appendix-loading-state">
        Loading KPI appendix...
      </div>
    );
  }

  return (
    <section className="space-y-8" data-testid="kpi-appendix-page">
      <div className="space-y-3" data-testid="appendix-header">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4B5563]" data-testid="appendix-overline">
          KPI Definitions and Governance Appendix
        </p>
        <h2 className="text-4xl font-bold tracking-tight text-[#111827]" data-testid="appendix-heading">
          Definitions, Targets, and 30-Day Action Tracker
        </h2>
      </div>

      <Card className="rounded-sm border-[#E5E7EB] bg-[#F9FAFB] shadow-none" data-testid="action-progress-card">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-lg font-semibold text-[#111827]" data-testid="action-progress-title">
            <CheckCircle size={18} className="text-[#10B981]" />
            Action Plan Progress: {completedCount}/{actions.length} Completed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3" data-testid="action-tracker-list">
            {actions.map((action) => (
              <div key={action.action_id} className="grid grid-cols-1 gap-3 rounded-sm border border-[#E5E7EB] bg-white p-4 md:grid-cols-[1fr_auto_auto] md:items-center" data-testid={`action-item-${action.action_id.toLowerCase()}`}>
                <div data-testid={`action-item-info-${action.action_id.toLowerCase()}`}>
                  <p className="font-semibold text-[#111827]" data-testid={`action-item-title-${action.action_id.toLowerCase()}`}>
                    {action.action_id} · {action.title}
                  </p>
                  <p className="text-sm text-[#4B5563]" data-testid={`action-item-meta-${action.action_id.toLowerCase()}`}>
                    Owner: {action.owner} | Priority: {action.priority} | Due: {action.due_in_days} days
                  </p>
                  <p className="text-sm text-[#002FA7]" data-testid={`action-item-impact-${action.action_id.toLowerCase()}`}>
                    Expected impact: {action.expected_impact}
                  </p>
                </div>

                <select
                  className="h-10 rounded-sm border border-[#D1D5DB] bg-white px-3 text-sm"
                  value={draftStatus[action.action_id] || action.status}
                  onChange={(event) => setDraftStatus((prev) => ({ ...prev, [action.action_id]: event.target.value }))}
                  data-testid={`action-status-select-${action.action_id.toLowerCase()}`}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <Button
                  disabled={savingActionId === action.action_id}
                  onClick={() => handleSave(action.action_id)}
                  data-testid={`action-save-button-${action.action_id.toLowerCase()}`}
                >
                  {savingActionId === action.action_id ? "Saving..." : "Save"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="kpi-definition-grid">
        {report.kpi_definitions.map((definition) => (
          <Card key={definition.metric_id} className="rounded-sm border-[#E5E7EB] shadow-none" data-testid={`kpi-definition-card-${definition.metric_id.toLowerCase()}`}>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-[#111827]" data-testid={`kpi-definition-title-${definition.metric_id.toLowerCase()}`}>
                {definition.metric_id}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-[#374151]">
              <p data-testid={`kpi-definition-desc-${definition.metric_id.toLowerCase()}`}>{definition.definition}</p>
              <p data-testid={`kpi-definition-target-${definition.metric_id.toLowerCase()}`}>
                <span className="font-semibold text-[#111827]">Target: </span>
                {definition.target}
              </p>
              <p data-testid={`kpi-definition-status-${definition.metric_id.toLowerCase()}`}>
                <span className="font-semibold text-[#111827]">Status: </span>
                {definition.current_status}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
