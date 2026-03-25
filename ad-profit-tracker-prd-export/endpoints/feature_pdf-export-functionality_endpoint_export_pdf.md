# Feature Pdf Export Functionality Endpoint Export Pdf

POST /api/export/pdf

## Description

REQUEST: POST { dateFrom: string (YYYY-MM-DD, required), dateTo: string (YYYY-MM-DD, required), sections: string[] (required, non-empty subset of ['cover_page','executive_summary','daily_trend','geo_breakdown','exoclick','rollerads','zeydoo','propush','activity_log']), orientation: 'portrait'|'landscape' (default 'portrait'), paperSize: 'a4'|'letter' (default 'a4'), filename?: string (optional, max 100 chars, alphanumeric+dash+underscore only) }
PROCESS:
1. Verify Firebase ID token via admin.auth().verifyIdToken(token) — return 401 immediately if invalid. uid from verified token only.
2. Validate dateFrom and dateTo: required, valid YYYY-MM-DD, dateFrom <= dateTo, max 90-day range — return 400 if invalid.
3. Validate sections: non-empty array, each item must be one of the 9 allowed section keys — return 400 if invalid.
4. Validate orientation and paperSize against allowed values — return 400 if invalid.
5. Validate filename if provided: alphanumeric, dash, underscore only, max 100 chars — return 400 if invalid.
6. Check rate limit: max 10 exports/hour per user (shared with POST /api/export/excel) — return 429 if exceeded.
7. Check node-cache for key '{uid}_export_preview_{dateFrom}_{dateTo}'. If cache hit, use cached adStats/auditLogs data. On cache miss, execute parallel Firestore queries via Promise.all(): (a) Query adStats collection: filter userId==uid AND date>=dateFrom AND date<=dateTo. Use getDocs. (b) If sections includes 'activity_log', query auditLogs collection: filter userId==uid AND createdAt>=dateFrom AND createdAt<=dateTo. Use getDocs.
8. If adStats result is empty and sections does not include only 'cover_page' or 'activity_log', return 404.
9. Using jsPDF (jspdf ^2.5.1) with jspdf-autotable plugin, create a new jsPDF instance with the requested orientation and paper size (e.g., new jsPDF({ orientation, unit: 'mm', format: paperSize })). Set document properties: title='Ad Profit Tracker Report', author='Ad Profit Tracker', subject='Ad Network Performance Report', creator='Ad Profit Tracker'.
10. For each requested section in order:
  (a) 'cover_page' — Add a styled cover page: app name 'Ad Profit Tracker' in large bold text centered at top, subtitle 'Performance Report' below, date range label (e.g., 'Jan 1 – Jan 31, 2025'), generated timestamp, and a horizontal rule divider. Use doc.setFont/setFontSize/setTextColor for styling. Add a new page after.
  (b) 'executive_summary' — Compute KPIs from adStats in memory: totalRevenue (rollerads+zeydoo+propush), totalCost (exoclick), netProfit, roi (null-safe). Add a section header 'Executive Summary'. Use doc.autoTable() to render a 2-column summary table: [Metric, Value] rows for Total Revenue, Total Cost, Net Profit, ROI%. Format currency values with 2 decimal places. Add a new page after.
  (c) 'daily_trend' — Group adStats by date, compute per-day netProfit. Use doc.autoTable() to render a table with columns [Date, Revenue, Cost, Net Profit, ROI%] sorted by date ASC. Add section header 'Daily Profit Trend'. Add a new page after.
  (d) 'geo_breakdown' — Group adStats by country, compute per-country revenue/cost/netProfit/roi. Enrich with ISO 3166-1 country names from the same static lookup used by other endpoints. Use doc.autoTable() with columns [Country, Revenue, Cost, Net Profit, ROI%, Impressions, Clicks] sorted by netProfit DESC. Add section header 'Geographic Breakdown'. Add a new page after.
  (e) Per-network sections ('exoclick','rollerads','zeydoo','propush') — Filter adStats to the specific networkId. Use doc.autoTable() with columns [Date, Country, Primary Metric, Impressions, Clicks, CTR%, CPM]. Add section header with network name and data role (Cost Only / Revenue Only). Add a new page after each.
  (f) 'activity_log' — Use auditLogs data. Use doc.autoTable() with columns [Timestamp, Action, Resource, Status, Details]. Add section header 'Activity Log'. 
11. Add page numbers to footer of each page using doc.internal.getNumberOfPages() loop: 'Page X of Y' centered at bottom.
12. Generate filename: use provided filename or default to 'ad-profit-tracker-report-{dateFrom}-{dateTo}'.
13. Generate PDF buffer using doc.output('arraybuffer'). Convert to Buffer. Set response headers: Content-Type: application/pdf, Content-Disposition: attachment; filename={filename}.pdf. Stream buffer as response.
14. Write audit log entry to auditLogs Firestore collection via Admin SDK: action='manual_sync_triggered', resourceType='sync', resourceId='export', metadata={ exportType: 'pdf', sectionsIncluded: sections, dateFrom, dateTo, orientation, paperSize, filename }, status='success'.
SUCCESS (200): Binary .pdf file stream with Content-Type: application/pdf and Content-Disposition: attachment headers.
ERRORS:
- 400: invalid params, invalid section keys, invalid orientation/paperSize, filename format invalid, date range exceeds 90 days
- 401: invalid/expired Firebase ID token
- 404: no adStats data found for date range
- 429: rate limit exceeded (10 exports/hour per user — shared budget with Excel export)
- 500: PDF generation failure, Firestore read failure
SECURITY: userId always from verified Firebase ID token. All Firestore queries scoped to authenticated user's documents only. Filename sanitized server-side. No API keys or encrypted values in export. Rate limit shared with Excel export to prevent abuse.

---
Generated by VisualPRD