import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Cell } from "recharts";
import { ClipboardText } from "@phosphor-icons/react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { fetchReport } from "../api/reportApi";
import KpiTable from "../components/report/KpiTable";

const categoryColor = {
  SLA: "#002FA7",
  "Workflow Hygiene": "#10B981",
  Traceability: "#DC2626",
  Quality: "#F59E0B",
  Planning: "#1D4ED8",
};

export default function DetailedFindingsPage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadReport = async () => {
      try {
        const reportData = await fetchReport();
        setReport(reportData);
      } catch {
        setError("Unable to load detailed compliance findings.");
      }
    };

    loadReport();
  }, []);

  const categoryData = useMemo(() => {
    if (!report) {
      return [];
    }

    const grouped = report.metrics.reduce((acc, metric) => {
      const current = acc[metric.category] || { category: metric.category, count: 0, totalValue: 0 };
      current.count += 1;
      current.totalValue += metric.value;
      acc[metric.category] = current;
      return acc;
    }, {});

    return Object.values(grouped).map((item) => ({
      category: item.category,
      averageValue: Math.round(item.totalValue / item.count),
      fill: categoryColor[item.category] || "#4B5563",
    }));
  }, [report]);

  if (error) {
    return (
      <div className="rounded-sm border border-[#DC2626]/30 bg-[#FEF2F2] p-6 text-[#991B1B]" data-testid="findings-load-error">
        {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-sm border border-[#E5E7EB] bg-white p-8" data-testid="findings-loading-state">
        Loading detailed findings...
      </div>
    );
  }

  return (
    <section className="space-y-8" data-testid="detailed-findings-page">
      <div className="space-y-3" data-testid="findings-header">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4B5563]" data-testid="findings-overline">
          Full Detailed Report
        </p>
        <h2 className="text-4xl font-bold tracking-tight text-[#111827]" data-testid="findings-heading">
          Compliance Findings and Control Performance
        </h2>
        <p className="max-w-4xl text-base text-[#4B5563]" data-testid="findings-description">
          This section translates the uploaded Jira report into leadership-ready evidence, context, and prioritization.
        </p>
      </div>

      <Card className="rounded-sm border-[#E5E7EB] shadow-none" data-testid="category-performance-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#111827]" data-testid="category-performance-title">
            Average Control Value by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full min-w-0" data-testid="category-performance-chart-container">
            <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={240}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="averageValue" radius={[2, 2, 0, 0]}>
                  {categoryData.map((entry) => (
                    <Cell key={entry.category} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4" data-testid="kpi-detail-table-section">
        <h3 className="text-2xl font-semibold text-[#111827]" data-testid="kpi-detail-table-heading">
          Control-by-Control Breakdown
        </h3>
        <KpiTable metrics={report.metrics} />
      </div>

      <Card className="rounded-sm border-[#E5E7EB] bg-[#F9FAFB] shadow-none" data-testid="leadership-narratives-card">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-lg font-semibold text-[#111827]" data-testid="leadership-narratives-title">
            <ClipboardText size={18} className="text-[#002FA7]" />
            Leadership Narratives
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4" data-testid="leadership-narratives-list">
          {report.narratives.map((narrative, index) => (
            <div key={`${index}-${narrative.what_happened}`} className="rounded-sm border border-[#E5E7EB] bg-white p-4" data-testid={`leadership-narrative-item-${index + 1}`}>
              <p className="font-semibold text-[#111827]" data-testid={`leadership-narrative-what-${index + 1}`}>
                {narrative.what_happened}
              </p>
              <p className="mt-2 text-sm text-[#374151]" data-testid={`leadership-narrative-why-${index + 1}`}>
                {narrative.why_it_matters}
              </p>
              <p className="mt-2 text-sm text-[#002FA7]" data-testid={`leadership-narrative-rec-${index + 1}`}>
                Recommended: {narrative.recommendation}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
