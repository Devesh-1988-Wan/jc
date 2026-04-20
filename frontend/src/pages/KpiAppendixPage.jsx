import { useEffect, useMemo, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { toast } from "../components/ui/sonner";

// ✅ FIXED: single clean import
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
        const [reportData, actionsData] = await Promise.all([
          fetchReport(),
          fetchReportActions(),
        ]);

        setReport(reportData || { kpi_definitions: [] });
        setActions(actionsData || []);

        const draftMap = (actionsData || []).reduce((acc, action) => {
          acc[action.action_id] = action.status;
          return acc;
        }, {});

        setDraftStatus(draftMap);
      } catch (err) {
        console.error(err);
        setError("Unable to load appendix and action tracker.");
      }
    };

    loadData();
  }, []);

  const completedCount = useMemo(
    () =>
      actions.filter(
        (action) =>
          (draftStatus[action.action_id] || action.status) === "Completed"
      ).length,
    [actions, draftStatus]
  );

  const handleSave = async (actionId) => {
    try {
      setSavingActionId(actionId);

      const updatedAction = await patchActionStatus(
        actionId,
        draftStatus[actionId]
      );

      if (!updatedAction) throw new Error("Update failed");

      setActions((prev) =>
        prev.map((action) =>
          action.action_id === actionId ? updatedAction : action
        )
      );

      toast.success("Action status updated.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update action status.");
    } finally {
      setSavingActionId("");
    }
  };

  if (error) {
    return (
      <div className="rounded-sm border border-[#DC2626]/30 bg-[#FEF2F2] p-6 text-[#991B1B]">
        {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-sm border border-[#E5E7EB] bg-white p-8">
        Loading KPI appendix...
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4B5563]">
          KPI Definitions and Governance Appendix
        </p>
        <h2 className="text-4xl font-bold tracking-tight text-[#111827]">
          Definitions, Targets, and 30-Day Action Tracker
        </h2>
      </div>

      {/* ✅ ACTION TRACKER */}
      <Card className="rounded-sm border-[#E5E7EB] bg-[#F9FAFB] shadow-none">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-lg font-semibold text-[#111827]">
            <CheckCircle size={18} className="text-[#10B981]" />
            Action Plan Progress: {completedCount}/{actions.length} Completed
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {actions.map((action) => (
              <div
                key={action.action_id}
                className="grid grid-cols-1 gap-3 rounded-sm border border-[#E5E7EB] bg-white p-4 md:grid-cols-[1fr_auto_auto] md:items-center"
              >
                <div>
                  <p className="font-semibold text-[#111827]">
                    {action.action_id} · {action.title}
                  </p>

                  <p className="text-sm text-[#4B5563]">
                    Owner: {action.owner} | Priority: {action.priority} | Due:{" "}
                    {action.due_in_days} days
                  </p>

                  <p className="text-sm text-[#002FA7]">
                    Expected impact: {action.expected_impact}
                  </p>
                </div>

                <select
                  className="h-10 rounded-sm border border-[#D1D5DB] px-3 text-sm"
                  value={draftStatus[action.action_id] || action.status}
                  onChange={(e) =>
                    setDraftStatus((prev) => ({
                      ...prev,
                      [action.action_id]: e.target.value,
                    }))
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>

                <Button
                  disabled={savingActionId === action.action_id}
                  onClick={() => handleSave(action.action_id)}
                >
                  {savingActionId === action.action_id
                    ? "Saving..."
                    : "Save"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ✅ KPI DEFINITIONS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(report.kpi_definitions || []).map((definition) => (
          <Card
            key={definition.metric_id}
            className="rounded-sm border-[#E5E7EB] shadow-none"
          >
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {definition.metric_id}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-2 text-sm text-[#374151]">
              <p>{definition.definition}</p>

              <p>
                <strong>Target:</strong> {definition.target}
              </p>

              <p>
                <strong>Status:</strong> {definition.current_status}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}