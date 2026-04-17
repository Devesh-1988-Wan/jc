import { useEffect, useMemo, useState } from "react";
import { CaretLeft, CaretRight, PresentationChart, WarningCircle } from "@phosphor-icons/react";

import { Button } from "../components/ui/button";
import { fetchReport } from "../api/reportApi";

const canvasBackground =
  "https://static.prod-images.emergentagent.com/jobs/8e9defc1-9768-42e9-ae13-ed17a32911ad/images/5088b3d0833bcbad39df135c015b499246b45759f153b3fa83ca3d8960a6bef9.png";
const coverBackground =
  "https://static.prod-images.emergentagent.com/jobs/8e9defc1-9768-42e9-ae13-ed17a32911ad/images/0823fb487a76e61934f892778cba922adec84d19085b00fb486390dd44cef2cf.png";

export default function SlideBriefPage() {
  const [report, setReport] = useState(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const reportData = await fetchReport();
        setReport(reportData);
      } catch {
        setError("Unable to load slide brief data.");
      }
    };

    loadData();
  }, []);

  const slides = useMemo(() => {
    if (!report) {
      return [];
    }

    const redMetrics = report.metrics.filter((metric) => metric.status === "RED").slice(0, 5);
    const slaMetrics = report.metrics.filter((metric) => metric.category === "SLA");

    return [
      {
        id: "cover",
        title: "Leadership Compliance Brief",
        subtitle: report.key_message,
        points: [
          `Period: ${report.period}`,
          `Executive score: ${report.executive_score}/100`,
          `Audience: ${report.audience.join(" • ")}`,
        ],
        background: coverBackground,
      },
      {
        id: "risk-focus",
        title: "Critical Red Controls",
        subtitle: "Immediate operational risk areas requiring governance action",
        points: redMetrics.map((metric) => `${metric.metric_id} · ${metric.value}% · ${metric.title}`),
        background: canvasBackground,
      },
      {
        id: "sla-focus",
        title: "SLA Adherence View",
        subtitle: "Resolution and timeliness controls below leadership thresholds",
        points: slaMetrics.map((metric) => `${metric.metric_id} · ${metric.value}% · ${metric.insight}`),
        background: canvasBackground,
      },
      {
        id: "action-focus",
        title: "30-Day Corrective Action Plan",
        subtitle: "Priority actions with accountable owners",
        points: report.actions.slice(0, 4).map((action) => `${action.action_id} · ${action.owner} · ${action.title}`),
        background: canvasBackground,
      },
    ];
  }, [report]);

  if (error) {
    return (
      <div className="rounded-sm border border-[#DC2626]/30 bg-[#FEF2F2] p-6 text-[#991B1B]" data-testid="slides-load-error">
        {error}
      </div>
    );
  }

  if (!report || slides.length === 0) {
    return (
      <div className="rounded-sm border border-[#E5E7EB] bg-white p-8" data-testid="slides-loading-state">
        Building leadership slide brief...
      </div>
    );
  }

  const activeSlide = slides[slideIndex];

  return (
    <section className="space-y-6" data-testid="slide-brief-page">
      <div className="flex flex-wrap items-end justify-between gap-4" data-testid="slide-brief-header">
        <div className="space-y-2" data-testid="slide-brief-title-group">
          <p className="text-xs uppercase tracking-[0.18em] text-[#4B5563]" data-testid="slide-brief-overline">
            Slide-Style Leadership Summary
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-[#111827]" data-testid="slide-brief-heading">
            Executive Deck View
          </h2>
          <p className="max-w-3xl text-base text-[#4B5563]" data-testid="slide-brief-description">
            This condensed deck highlights the most important compliance risks and immediate actions.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-sm border border-[#E5E7EB] bg-white px-3 py-2" data-testid="slide-brief-counter">
          <PresentationChart size={18} className="text-[#002FA7]" />
          <span className="text-sm font-semibold text-[#111827]">
            Slide {slideIndex + 1} of {slides.length}
          </span>
        </div>
      </div>

      <div
        className="slide-canvas relative aspect-[16/9] overflow-hidden rounded-sm border border-[#E5E7EB] bg-white p-8 md:p-12"
        style={{ backgroundImage: `url(${activeSlide.background})` }}
        data-testid={`slide-canvas-${activeSlide.id}`}
      >
        <div className="absolute inset-0 bg-white/75" />
        <div className="relative z-10 flex h-full flex-col justify-between gap-8">
          <div className="space-y-4" data-testid={`slide-header-${activeSlide.id}`}>
            <h3 className="max-w-4xl text-3xl font-bold text-[#111827] md:text-4xl" data-testid={`slide-title-${activeSlide.id}`}>
              {activeSlide.title}
            </h3>
            <p className="max-w-4xl text-base text-[#374151]" data-testid={`slide-subtitle-${activeSlide.id}`}>
              {activeSlide.subtitle}
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid={`slide-points-${activeSlide.id}`}>
            {activeSlide.points.map((point, index) => (
              <li key={`${activeSlide.id}-${index}-${point}`} className="flex items-start gap-3 rounded-sm border border-[#E5E7EB] bg-white/85 px-4 py-3 text-[#111827]" data-testid={`slide-point-${activeSlide.id}-${index + 1}`}>
                <WarningCircle size={16} className="mt-1 text-[#DC2626]" weight="fill" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4" data-testid="slide-navigation">
        <div className="inline-flex gap-2" data-testid="slide-nav-buttons">
          <Button
            variant="outline"
            onClick={() => setSlideIndex((current) => (current === 0 ? slides.length - 1 : current - 1))}
            data-testid="slide-nav-prev-button"
          >
            <CaretLeft size={16} />
            Previous
          </Button>
          <Button
            onClick={() => setSlideIndex((current) => (current === slides.length - 1 ? 0 : current + 1))}
            data-testid="slide-nav-next-button"
          >
            Next
            <CaretRight size={16} />
          </Button>
        </div>

        <div className="flex items-center gap-2" data-testid="slide-dot-indicators">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={`h-2.5 w-8 rounded-full transition-colors duration-200 ${index === slideIndex ? "bg-[#002FA7]" : "bg-[#CBD5E1] hover:bg-[#94A3B8]"}`}
              onClick={() => setSlideIndex(index)}
              data-testid={`slide-indicator-${slide.id}`}
              aria-label={`Go to ${slide.title}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
