import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChartBar, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import StatusBadge from "../components/report/StatusBadge";

// ✅ FIX: import BOTH APIs
import { fetchReport, fetchReportSummary } from "../api/reportApi";

const chartColor = {
  GREEN: "#10B981",
  AMBER: "#F59E0B",
  RED: "#DC2626",
};

const statCards = [
  { key: "executive_score", label: "Executive Score", icon: ChartBar, suffix: "/100" },
  { key: "red_controls", label: "Red Controls", icon: WarningCircle, suffix: " controls" },
  { key: "green_controls", label: "Green Controls", icon: ShieldCheck, suffix: " controls" },
];

export default function ExecutiveSummaryPage() {
  const [report, setReport] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [reportData, summaryData] = await Promise.all([
          fetchReport(),
          fetchReportSummary(),
        ]);

        // ✅ Safe fallback to prevent crashes
        setReport(reportData || {});
        setSummary(summaryData || {});
      } catch (err) {
        console.error(err);
        setError("Unable to load leadership report data.");
      }
    };

    loadData();
  }, []);

  const statusData = useMemo(() => {
    if (!summary) return [];

    return [
      { name: "Green", value: summary.green_controls || 0, color: chartColor.GREEN },
      { name: "Amber", value: summary.amber_controls || 0, color: chartColor.AMBER },
      { name: "Red", value: summary.red_controls || 0, color: chartColor.RED },
    ];
  }, [summary]);

  if (error) {
    return (
      <div className="rounded-sm border border-red-300 bg-red-50 p-6 text-red-800">
        {error}
      </div>
    );
  }

  if (!report || !summary) {
    return (
      <div className="rounded-sm border border-gray-200 bg-white p-8">
        Loading executive dashboard...
      </div>
    );
  }

  const aiContext = report.ai_context || {
    executive_narrative: "Not available",
    risk_story: "Not available",
    action_rationale: "Not available",
    leadership_talking_points: [],
  };

  return (
    <section className="space-y-8">
      {/* HEADER */}
      <div className="space-y-3">
        <p className="text-xs uppercase text-gray-500">
          Reporting Window: {report.period || "N/A"}
        </p>

        <h2 className="text-4xl font-bold">
          Jira Compliance Snapshot for Leadership
        </h2>

        <p className="text-gray-600">
          {report.key_message || "No summary available"}
        </p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {statCards.map((item) => {
          const Icon = item.icon;
          const value = summary[item.key] || 0;

          return (
            <Card key={item.key}>
              <CardHeader>
                <CardTitle className="flex justify-between text-sm">
                  {item.label}
                  <Icon size={18} />
                </CardTitle>
              </CardHeader>

              <CardContent>
                <p className="text-3xl font-bold">
                  {value}
                  <span className="text-sm text-gray-500 ml-1">
                    {item.suffix}
                  </span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* PIE CHART */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Status Distribution</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name">
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* RISKS */}
      <Card>
        <CardHeader>
          <CardTitle>Top Leadership Risks</CardTitle>
        </CardHeader>

        <CardContent>
          {(report.top_risks || []).map((risk, i) => (
            <p key={i}>• {risk}</p>
          ))}
        </CardContent>
      </Card>

      {/* ACTIONS */}
      <Card>
        <CardHeader>
          <CardTitle>Immediate Leadership Actions</CardTitle>
        </CardHeader>

        <CardContent>
          {(report.recommendations || []).map((r, i) => (
            <p key={i}>→ {r}</p>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}