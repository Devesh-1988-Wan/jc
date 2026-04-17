# Product Requirements Document (PRD)

## Original Problem Statement
Create a Jira compliance report for leadership.

## Architecture Decisions
- **Frontend:** React dashboard with route-based pages for executive summary, slide brief, detailed findings, KPI appendix, upload/update, and widget editor.
- **Backend:** FastAPI service exposing report, summary, action tracking, upload preview/apply, upload history, rollback, and widget-update endpoints.
- **Database:** MongoDB stores active report snapshot, upload previews, and retained upload history (latest 10).
- **Document Parsing:** PDF, DOCX, TXT, MD, JPG, PNG parsing using `pypdf`, `python-docx`, text parsing, and OCR (`pytesseract` + `Pillow`).

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
- **2026-04-17:** Added full **Current vs Preview diff** on Upload page with highlighted added/removed/changed rows across summary, metrics, risks, recommendations, actions, and KPI definitions.
- **2026-04-17:** Added configurable **one-click rollback** from upload history with section-level restore choices (summary, metrics, risks, recommendations, actions, KPI definitions, narratives).
- **2026-04-17:** Added **Widget Editor** page with edit mode + Save/Cancel per widget for:
  - Summary widget
  - KPI metrics widget
  - Risks/recommendations widget
  - Actions widget
- **2026-04-17:** Expanded parser support to additional formats (TXT/MD/JPG/PNG + OCR) and improved metric extraction robustness.

## Prioritized Backlog

### P0 (Critical)
- Add stronger parser mapping confidence scoring and section confidence display in preview.
- Add richer OCR fallback handling for low-quality scans (language packs, preprocessing pipeline).

### P1 (Important)
- Add metric-level visual diff filters (show only changed/added/removed).
- Add rollback confirmation modal summarizing selected restore sections before execution.
- Remove remaining non-blocking chart container warnings during route transitions.

### P2 (Enhancement)
- Add downloadable executive report export (PDF/PPT layout).
- Add trend comparison across historical uploads.
- Add richer governance analytics (owner SLA by team, aging heatmaps).

## Next Tasks List
1. Add change-only filters and search in full diff panel.
2. Add rollback preflight confirmation and optional notes/audit reason.
3. Improve OCR preprocessing for noisy screenshots/scans.
4. Add export-ready leadership PDF/PPT report package.
