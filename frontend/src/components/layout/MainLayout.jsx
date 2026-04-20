import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ChartBar, FileArrowUp, FileText, ListChecks, Slideshow, Sliders } from "@phosphor-icons/react";

const navItems = [
  { to: "/summary", label: "Executive Summary", icon: ChartBar, testId: "nav-link-summary" },
  { to: "/slides", label: "Slide Brief", icon: Slideshow, testId: "nav-link-slides" },
  { to: "/findings", label: "Detailed Findings", icon: ListChecks, testId: "nav-link-findings" },
  { to: "/appendix", label: "KPI Appendix", icon: FileText, testId: "nav-link-appendix" },
  { to: "/upload", label: "Upload Report", icon: FileArrowUp, testId: "nav-link-upload" },
  { to: "/editor", label: "Widget Editor", icon: Sliders, testId: "nav-link-editor" },
];

export default function MainLayout() {
  return (
    <div className="report-app" data-testid="jira-compliance-dashboard">
      <header
        className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/85 backdrop-blur-md"
        data-testid="dashboard-header"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4 md:px-10">
          <div data-testid="header-title-group">
            <p className="text-xs uppercase tracking-[0.22em] text-[#4B5563]" data-testid="header-overline">
              Jira Controls | Last 30 Days
            </p>
            <h1 className="text-2xl font-bold text-[#111827] md:text-3xl" data-testid="header-main-title">
              Leadership Compliance Report
            </h1>
          </div>
          <nav className="flex flex-wrap items-center gap-2" data-testid="header-navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  data-testid={item.testId}
                  className={({ isActive }) =>
                    [
                      "inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-medium transition-colors duration-200",
                      isActive
                        ? "border-[#002FA7] bg-[#002FA7] text-white"
                        : "border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F3F4F6]",
                    ].join(" ")
                  }
                >
                  <Icon size={16} weight="regular" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-90px)] w-full max-w-7xl px-6 py-10 md:px-10" data-testid="dashboard-main-content">
        <Outlet />
      </main>
    </div>
  );
}
