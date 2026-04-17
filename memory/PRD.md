# Product Requirements Document (PRD)

## Original Problem Statement
Create a Jira compliance report for leadership.

## Architecture Decisions
- **Frontend:** React dashboard with route-based pages for executive summary, slide brief, detailed findings, KPI appendix, and upload/update.
- **Backend:** FastAPI service exposing report, summary, action tracking, upload preview/apply, and upload history endpoints.
- **Database:** MongoDB stores active report snapshot, upload previews, and retained upload history (latest 10).
- **Document Parsing:** PDF + DOCX parsing on backend using `pypdf` and `python-docx`.

## User Personas
- **C-level Executives:** Need quick risk posture and strategic actions.
- **VP/Directors:** Need KPI control health and accountable action plans.
- **Engineering/Product Leadership:** Need detailed control-level findings and update workflow.

## Core Requirements (Static)
- Build leadership-ready Jira compliance dashboard.
- Include slide-style summary and detailed report views.
- Cover SLA adherence, workflow hygiene, and traceability.
- Support report updates from uploaded files with preview before apply.
- Keep upload history and preserve complete dashboard update behavior.

## What’s Implemented (with dates)
- **2026-04-17:** Built complete multi-page dashboard (Executive Summary, Slide Brief, Detailed Findings, KPI Appendix) using extracted Jira compliance metrics.
- **2026-04-17:** Added backend report APIs for summary, metrics, actions, and action status updates.
- **2026-04-17:** Added upload pipeline:
  - `POST /api/report/upload-preview` (PDF/DOCX parse + preview)
  - `POST /api/report/apply-preview/{preview_id}` (apply to live dashboard)
  - `GET /api/report/upload-history` (latest 10 applies)
- **2026-04-17:** Added Upload Report page with file select, preview summary, missing-field handling (`Not available`), apply update flow, and upload history UI.
- **2026-04-17:** Added automated test coverage for report and upload workflows; resolved duplicate React list-key warning in preview/sparse-data scenarios.

## Prioritized Backlog

### P0 (Critical)
- Add stronger parser mapping for broader Jira report templates (table extraction, section-aware parsing).
- Add upload validation feedback for scanned/low-text PDFs with remediation guidance.

### P1 (Important)
- Add side-by-side diff view (current vs preview report) before apply.
- Add per-upload rollback action to revert to prior report snapshot.
- Remove remaining non-blocking chart container warnings during route transitions.

### P2 (Enhancement)
- Add downloadable executive report export (PDF/PPT layout).
- Add trend comparison across historical uploads.
- Add richer governance analytics (owner SLA by team, aging heatmaps).

## Next Tasks List
1. Implement current-vs-preview diff UI on Upload page.
2. Add rollback endpoint and UI action from upload history.
3. Harden parser with section-based extraction and confidence scoring.
4. Add export-ready report template for leadership distribution.
