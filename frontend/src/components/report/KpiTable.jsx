import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import StatusBadge from "./StatusBadge";

export default function KpiTable({ metrics }) {
  return (
    <div className="overflow-hidden rounded-sm border border-[#E5E7EB] bg-white" data-testid="kpi-table-wrapper">
      <Table data-testid="kpi-table">
        <TableHeader>
          <TableRow>
            <TableHead data-testid="kpi-table-header-id">Control</TableHead>
            <TableHead data-testid="kpi-table-header-title">KPI</TableHead>
            <TableHead data-testid="kpi-table-header-category">Category</TableHead>
            <TableHead data-testid="kpi-table-header-value">Value</TableHead>
            <TableHead data-testid="kpi-table-header-status">Status</TableHead>
            <TableHead data-testid="kpi-table-header-insight">Leadership Insight</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.map((metric) => (
            <TableRow key={metric.metric_id} data-testid={`kpi-row-${metric.metric_id.toLowerCase()}`}>
              <TableCell className="font-semibold text-[#111827]" data-testid={`kpi-id-${metric.metric_id.toLowerCase()}`}>
                {metric.metric_id}
              </TableCell>
              <TableCell className="text-[#111827]" data-testid={`kpi-title-${metric.metric_id.toLowerCase()}`}>
                {metric.title}
              </TableCell>
              <TableCell data-testid={`kpi-category-${metric.metric_id.toLowerCase()}`}>{metric.category}</TableCell>
              <TableCell className="font-semibold" data-testid={`kpi-value-${metric.metric_id.toLowerCase()}`}>
                {metric.value}%
              </TableCell>
              <TableCell data-testid={`kpi-status-${metric.metric_id.toLowerCase()}`}>
                <StatusBadge status={metric.status} testId={`kpi-status-badge-${metric.metric_id.toLowerCase()}`} />
              </TableCell>
              <TableCell data-testid={`kpi-insight-${metric.metric_id.toLowerCase()}`}>{metric.insight}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
