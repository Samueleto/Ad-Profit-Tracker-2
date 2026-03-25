# Navigation Schema

> Auto-generated from Phase 5D Integration Architecture.
> This is the single source of truth for routing and navigation.

## Auth Flow
- Login style: `modal`
- Login route: `/login`
- Post-login route: `/dashboard`
- Post-logout route: `/`
- Unauthorized behavior: `show-modal`

## Public Routes
- `/` → **LoginModal** ((auth)) [PublicLayout]

## Protected Routes
- `/dashboard` → **ManualRefreshPanel** ((app)) [AppShell] — nav slot: `sidebar-dashboard`
- `/settings` → **SettingsPage** ((app)) [AppShell] — nav slot: `sidebar-settings`
- `/reports` → **CustomReportBuilderPage** ((app)) [AppShell] — nav slot: `sidebar-reports`
- `/settings/team` → **TeamManagementPage** ((app)) [AppShell] — nav slot: `sidebar-team` — parent: `/settings`
- `/help` → **HelpCenterPage** ((app)) [AppShell] — nav slot: `sidebar-help`
- `/help/[articleId]` → **HelpArticlePage** ((app)) [AppShell] — parent: `/help`
- `/onboarding` → **OnboardingWizardPage** ((app)) [AppShell]
- `/invite/accept` → **AcceptInvitationPage** ((app)) [AppShell]

## Modal Routes (no standalone page)
- **SettingsPage** — triggered by: SettingsPage (click preferences tab)
- **NetworkConfigTab** — triggered by: SettingsPage (click network config tab)
- **ActivityLogTab** — triggered by: SettingsPage (click activity log tab)
- **SyncStatusPanel** — triggered by: ManualRefreshPanel (click sync status indicator)
- **ExportModal** — triggered by: CustomReportBuilderPage (click export button)
- **ScheduleReportModal** — triggered by: CustomReportBuilderPage (click schedule report button)
- **InviteMemberModal** — triggered by: TeamManagementPage (click invite member button)
- **RolePermissionsEditModal** — triggered by: TeamManagementPage (click edit role permissions)
- **BenchmarkSettingsModal** — triggered by: ManualRefreshPanel (click benchmark settings)

## Inline Components (tabs / sections)
- **FinancialMetricsDashboardPage** as `section` on `/dashboard` (ManualRefreshPanel)
- **ROIIndicatorSection** as `section` on `/dashboard` (ManualRefreshPanel)
- **DailyProfitTrendSection** as `section` on `/dashboard` (ManualRefreshPanel)
- **GeoBreakdownSection** as `section` on `/dashboard` (ManualRefreshPanel)
- **PerNetworkAnalyticsTabsSection** as `tab` on `/dashboard` (ManualRefreshPanel)
- **ApiExplorerTab** as `tab` on `/dashboard` (ManualRefreshPanel)
- **ComparativeNetworkAnalysisTab** as `tab` on `/dashboard` (ManualRefreshPanel)
- **PerformanceBenchmarkingTab** as `tab` on `/dashboard` (ManualRefreshPanel)
- **PermissionsTab** as `tab` on `/settings/team` (TeamManagementPage)
- **PdfExportTab** as `tab` on `/reports` (CustomReportBuilderPage)
- **ThemeSettingsSection** as `section` on `/settings` (SettingsPage)
- **EmailAlertPreferencesSection** as `section` on `/settings` (SettingsPage)
- **NotificationCenterPanel** as `section` on `global` (AppShell)

## Web Navigation (sidebar)
- `/dashboard` — Dashboard (icon: home, order: 0)
- `/settings` — Settings (icon: settings, order: 1)
- `/reports` — Reports (icon: file-text, order: 2)
- `/settings/team` — Team (icon: users, order: 3)
- `/help` — Help (icon: help-circle, order: 4)

## Layout Components
- **PublicLayout** wraps `(auth)` (nav: false, header: true)
- **AppShell** wraps `(app)` (nav: true, header: true)

## Global State
- **AuthContext** (auth) — owned by `authentication-account-setup`, consumed by: *, persisted to: firebase
- **ApiKeyContext** (settings) — owned by `api-key-management-settings`, consumed by: data-synchronization-collection, dashboard-analytics-visualization, persisted to: firestore
- **DataSyncContext** (sync) — owned by `data-synchronization-collection`, consumed by: dashboard-analytics-visualization, reporting-data-export, persisted to: memory
- **ThemeContext** (ui) — owned by `dark-mode-ui-theming`, consumed by: *, persisted to: localStorage

## Validation Notes
- ❌ Route conflict: "/settings" claimed by both "SettingsPage" and "SettingsPage" → Demoted "SettingsPage" to modal (kept "SettingsPage" as page)
- ❌ Route conflict: "/settings" claimed by both "SettingsPage" and "NetworkConfigTab" → Demoted "NetworkConfigTab" to modal (kept "SettingsPage" as page)
- ❌ Route conflict: "/settings" claimed by both "SettingsPage" and "ActivityLogTab" → Demoted "ActivityLogTab" to modal (kept "SettingsPage" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "SyncStatusPanel" → Demoted "SyncStatusPanel" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "FinancialMetricsDashboardPage" → Demoted "FinancialMetricsDashboardPage" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "ROIIndicatorSection" → Demoted "ROIIndicatorSection" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "DailyProfitTrendSection" → Demoted "DailyProfitTrendSection" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "GeoBreakdownSection" → Demoted "GeoBreakdownSection" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "GeoCountryDrilldownModal" → Demoted "GeoCountryDrilldownModal" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "PerNetworkAnalyticsTabsSection" → Demoted "PerNetworkAnalyticsTabsSection" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "ApiExplorerTab" → Demoted "ApiExplorerTab" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "ComparativeNetworkAnalysisTab" → Demoted "ComparativeNetworkAnalysisTab" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "PerformanceBenchmarkingTab" → Demoted "PerformanceBenchmarkingTab" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "BenchmarkSettingsModal" → Demoted "BenchmarkSettingsModal" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "DateRangeToolbar" → Demoted "DateRangeToolbar" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "FilterToolbar" → Demoted "FilterToolbar" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "ApiExplorerTab" → Demoted "ApiExplorerTab" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/settings" claimed by both "SettingsPage" and "ThemeSettingsSection" → Demoted "ThemeSettingsSection" to modal (kept "SettingsPage" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "MobileNavigationDrawer" → Demoted "MobileNavigationDrawer" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "MobileBottomNavBar" → Demoted "MobileBottomNavBar" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "ResponsiveAppLayout" → Demoted "ResponsiveAppLayout" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "MobileDataTableWrapper" → Demoted "MobileDataTableWrapper" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "ExportModal" → Demoted "ExportModal" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "PdfExportTab" → Demoted "PdfExportTab" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/reports" claimed by both "CustomReportBuilderPage" and "ScheduleReportModal" → Demoted "ScheduleReportModal" to modal (kept "CustomReportBuilderPage" as page)
- ❌ Route conflict: "/dashboard" claimed by both "ManualRefreshPanel" and "NotificationCenterPanel" → Demoted "NotificationCenterPanel" to modal (kept "ManualRefreshPanel" as page)
- ❌ Route conflict: "/settings" claimed by both "SettingsPage" and "EmailAlertPreferencesSection" → Demoted "EmailAlertPreferencesSection" to modal (kept "SettingsPage" as page)
- ❌ Route conflict: "/settings/team" claimed by both "TeamManagementPage" and "InviteMemberModal" → Demoted "InviteMemberModal" to modal (kept "TeamManagementPage" as page)
- ❌ Route conflict: "/settings/team" claimed by both "TeamManagementPage" and "PermissionsTab" → Demoted "PermissionsTab" to modal (kept "TeamManagementPage" as page)
- ❌ Route conflict: "/settings/team" claimed by both "TeamManagementPage" and "RolePermissionsEditModal" → Demoted "RolePermissionsEditModal" to modal (kept "TeamManagementPage" as page)
- ⚠️ Multiple stubs claimed the same route /dashboard → Converted to inline section component within ManualRefreshPanel
- ⚠️ Multiple API Explorer tabs found with same functionality → Merged duplicate API explorer components into single tab component
- ⚠️ Mobile navigation components marked as modal but should be layout components → Converted mobile nav components to inline layout components
- ⚠️ Utility components marked as pages but function as UI components → Converted toolbar and filter components to inline components within their parent pages
