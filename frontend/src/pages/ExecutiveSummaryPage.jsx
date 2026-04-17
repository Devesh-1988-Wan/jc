import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChartBar, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { fetchReport, fetchReportSummary } from "../api/reportApi";
import StatusBadge from "../components/report/StatusBadge";

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
        const [reportData, summaryData] = await Promise.all([fetchReport(), fetchReportSummary()]);
        setReport(reportData);
        setSummary(summaryData);
      } catch (loadError) {
        setError("Unable to load leadership report data.");
      }
    };
    loadData();
  }, []);

  const statusData = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      { name: "Green", value: summary.green_controls, color: chartColor.GREEN },
      { name: "Amber", value: summary.amber_controls, color: chartColor.AMBER },
      { name: "Red", value: summary.red_controls, color: chartColor.RED },
    ];
  }, [summary]);

  if (error) {
    return (
      <div className="rounded-sm border border-[#DC2626]/30 bg-[#FEF2F2] p-6 text-[#991B1B]" data-testid="summary-load-error">
        {error}
      </div>
    );
  }

  if (!report || !summary) {
    return (
      <div className="rounded-sm border border-[#E5E7EB] bg-white p-8" data-testid="summary-loading-state">
        Loading executive dashboard...
      </div>
    );
  }

  return (
    <section className="space-y-8" data-testid="executive-summary-page">
      <div className="space-y-3" data-testid="summary-hero">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4B5563]" data-testid="summary-period-overline">
          Reporting Window: {report.period}
        </p>
        <h2 className="text-4xl font-bold tracking-tight text-[#111827]" data-testid="summary-main-heading">
          Jira Compliance Snapshot for Leadership
        </h2>
        <p className="max-w-4xl text-base text-[#4B5563]" data-testid="summary-key-message">
          {report.key_message}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="summary-stat-cards-grid">
        {statCards.map((item, index) => {
          const Icon = item.icon;
          const cardValue = summary[item.key];

          return (
            <Card
              key={item.key}
              className={`report-card fade-in-up stagger-${index + 1} rounded-sm border-[#E5E7EB] shadow-none`}
              data-testid={`summary-stat-card-${item.key}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-semibold text-[#4B5563]" data-testid={`summary-stat-title-${item.key}`}>
                  {item.label}
                  <Icon size={18} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-[#111827]" data-testid={`summary-stat-value-${item.key}`}>
                  {cardValue}
                  <span className="ml-1 text-base font-medium text-[#4B5563]">{item.suffix}</span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5" data-testid="summary-insights-grid">
        <Card className="report-card rounded-sm border-[#E5E7EB] shadow-none lg:col-span-2" data-testid="status-distribution-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#111827]" data-testid="status-distribution-title">
              Compliance Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-64 w-full min-w-0" data-testid="status-pie-chart-container">
              <ResponsiveContainer width="100%" height="100%" minWidth={260} minHeight={220}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3" data-testid="status-legend-list">
              {statusData.map((entry) => (
                <span key={entry.name} className="inline-flex items-center gap-2 rounded-sm border border-[#E5E7EB] px-3 py-1 text-sm" data-testid={`status-legend-item-${entry.name.toLowerCase()}`}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.name}: {entry.value}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="report-card rounded-sm border-[#E5E7EB] shadow-none lg:col-span-3" data-testid="top-risks-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#111827]" data-testid="top-risks-title">
              Top Leadership Risks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="inline-flex items-center gap-2" data-testid="risk-level-indicator">
              <span className="text-sm font-semibold text-[#4B5563]">Current Risk Level:</span>
              <StatusBadge status={summary.risk_level === "High" ? "RED" : summary.risk_level === "Medium" ? "AMBER" : "GREEN"} testId="risk-level-badge" />
            </div>
            <ul className="space-y-3" data-testid="top-risks-list">
              {report.top_risks.map((risk, index) => (
                <li key={`${index}-${risk}`} className="flex items-start gap-3 text-[#111827]" data-testid={`top-risk-item-${index + 1}`}>
                  <WarningCircle size={20} className="mt-0.5 text-[#DC2626]" weight="fill" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="report-card rounded-sm border-[#E5E7EB] bg-[#F9FAFB] shadow-none" data-testid="executive-actions-preview-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#111827]" data-testid="executive-actions-title">
            Immediate Leadership Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2" data-testid="executive-actions-list">
            {report.recommendations.map((item, index) => (
              <li key={`${index}-${item}`} className="flex items-start gap-3 text-[#111827]" data-testid={`executive-action-item-${index + 1}`}>
                <ArrowRight size={16} className="mt-1 text-[#002FA7]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
