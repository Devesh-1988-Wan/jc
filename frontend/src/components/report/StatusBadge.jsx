import { Badge } from "../ui/badge";

const statusStyle = {
  GREEN: "border-[#10B981]/25 bg-[#10B981]/10 text-[#047857]",
  AMBER: "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#92400E]",
  RED: "border-[#DC2626]/25 bg-[#DC2626]/10 text-[#991B1B]",
};

export default function StatusBadge({ status, testId }) {
  return (
    <Badge className={`border font-semibold ${statusStyle[status] || statusStyle.AMBER}`} data-testid={testId || "status-badge"}>
      {status}
    </Badge>
  );
}
