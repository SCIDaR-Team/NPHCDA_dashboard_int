# NPHCDA PHC Intelligence Platform — Comprehensive Product Review

**Reviewed:** July 2026 · **Version reviewed:** snapshot data source, 41 indicators, 3 programme blocks, 5+ live sources (SRH ODK, SFM ODK, SRH Google Sheet, MAMII, PFMO API — 35,941 facilities).

**Reviewer lenses:**
1. Senior UI/UX Designer (enterprise SaaS & analytics dashboards)
2. Senior Software Engineer / Solutions Architect
3. Senior AI Engineer
4. Public Health & NPHCDA Domain Expert (PHC, M&E, HIS/DHIS2, immunization, facility monitoring, programme management)

**Objective:** Not to critique the build, but to identify practical, high-impact opportunities that transform this application into a **world-class, enterprise-grade, AI-powered national health intelligence platform**, aligned to how NPHCDA, WHO, UNICEF, Gavi, AFENET, Solina, CHAI and peers actually consume analytics.

---

## Executive Summary

This is a **mature, well-architected product** — comfortably top-decile among public-health dashboards. The engineering fundamentals are excellent:

- A clean `DataSource` abstraction (`mock | snapshot | api`) means the **entire UI depends on one interface** and can go live against a real backend with a single env flag — no component rewrites.
- A disciplined **real-data-only** philosophy: no fabricated figures, honest "No data" states, small-sample flags at n<30, greyed-out map states where no measurement exists. This is the credibility foundation most dashboards lack.
- A genuine **ETL** pulling five+ live sources into a versioned snapshot, with per-source adapters, outlier caps, and resilient paged fetching (PFMO's 35,941 facilities / 37 states).
- A consistent **design system**: CSS tokens, theme-aware light/dark, all charts routed through `chartBase`, skeletons that mirror final layout, toasts, keyboard-navigable cards, focus rings throughout.

Feature depth is real: a hand-built Nigeria choropleth with donor overlays and composite state scoring; a dual-universe Facility Deepdive (assessed roster vs. 28k PFMO registry); indicator deep-dive modals with per-state/per-facility breakdowns and ~15 bespoke visualization kinds; indexed trend analysis with linear trendlines; global Cmd-K search; saved views/bookmarks (wired into the filter drawer and sidebar); and multi-format export (CSV/Excel/PDF).

**Maturity verdict:** this is a **best-in-class descriptive dashboard**. The gap to a national *intelligence platform* is not polish — it is three categories of capability:

1. **Decision-grade analytics** — scorecards, league tables, A–F grading, targets/benchmarks/variance, and a data-quality (completeness/timeliness/outlier) layer, as first-class experiences. Much of the raw material already exists (composite scoring in `stateProfile.ts`, per-facility measures in `scopedEngine`, `getIndicatorDefs`/`getDefinitions` in the data contract) but is not surfaced.
2. **AI / augmented analytics** — there is currently **no AI surface at all**. This is the single biggest available differentiator and maps cleanly onto the existing clean snapshot + Claude API.
3. **Enterprise hardening** — auth/RBAC exists in code but is disabled in routing; there is **no test suite, no route-level code-splitting, no audit logging, and no surfaced data-refresh timestamp**; and the full snapshot (incl. the 28k registry) ships to the browser.

The roadmap below sequences **high-leverage, low-effort wins** first (surface metadata + refresh time, scorecard/ranking pages, PDF executive report, route lazy-loading) and builds the **visionary AI + geospatial** capabilities on top.

---

## Area-by-Area Walkthrough

*Grounded assessment of each reviewed surface, with the specific opportunity for each.*

### Home Page (`HomePage.tsx`)
A polished standalone entry point outside the dashboard shell: hero, four scope stats (37 states, 3 areas, 41 indicators, 7 dashboards), and a card grid linking each section, with tasteful framer-motion entrance. **Opportunity:** the home page is static — it should become a **live executive landing**: national headline scores (composite readiness/service/stock), "data as of {date}," top movers this period, and 2–3 AI-generated highlights ("Penta3 rose 4pts nationally; 3 states declined"). Add "Recently viewed" and pinned saved views for returning users.

### Overview (`OverviewPage.tsx`)
Strong: grouped KPI strip, the interactive Nigeria map (composite score by default, or per-indicator goodness), a per-block snapshot with hero rings, and a click-through state profile modal that can scope the whole dashboard. **Opportunity:** add a **national scorecard band** (traffic-light matrix) above the map; add best/worst-performer callouts; let the map switch between choropleth, and add an LGA drill level. The composite score is computed but never labeled or explained on-screen — add a "how this is calculated" affordance.

### Facility Readiness / Stock Status / Service Delivery (`BlockPage.tsx`)
A single well-factored component renders all three thematic blocks: sectioned indicator cards, tier legend (Tier 1 = all states, Tier 2 = select, Tier 3 = not yet available), gap sections toned amber, deep-link scroll-and-highlight from Overview KPIs, and per-block export. Each card carries a bespoke visualization. **Opportunity:** add per-block **composite sub-scores** (a Readiness index, a Stock index, a Service index) as a header stat; add **targets and variance** to each card (vs. target, vs. national avg); add ranking chips ("best/worst state on this indicator"). Consider a compact/expanded density toggle for power users scanning many indicators.

### Trend Analysis (`TrendPage.tsx`)
Sophisticated: native monthly resolution rolled up to quarter/year (SUM for counts, MEAN for rates), indexed mode (=100 at start) so mixed-unit indicators share an axis, optional linear trendlines, grouped indicator picker that keeps line colours, geography-scoped recompute via the shared trend engine, and leading-empty-period trimming. **Opportunity:** add **confidence/uncertainty bands**, **forecasting** (see AI section), period-over-period annotations, event markers (e.g., campaign dates), and a **seasonality/decomposition** view. Add small-multiples so many indicators can be scanned without overlapping lines.

### Facility Deep Dive (`FacilityDeepdivePage.tsx`)
Genuinely advanced: two distinct facility universes — the ~637 assessed roster (type / functional status / tracer commodities) and the ~28k PFMO national registry (service flows) — with a universe toggle, local + global filters, grouped column pickers, sortable/paginated tables, heat-coloured percentage cells, "No data" honesty, and CSV/Excel export. **Opportunity:** add a **facility scorecard/profile page** (one facility, all indicators, trend, grade, map pin, catchment); add **facility grading (A–F)** and **risk flags**; add saved facility watchlists; make the registry load lazily (perf). This is the natural home for drill-through from every other surface.

### Detailed Source Dashboards (`SourceDashboards.tsx`)
Clean linked cards to the seven upstream dashboards (SRH, SFM, PFMO, PHC Functionality, NPHCDA DataHub, Vaccine Financing, Stock Management). **Opportunity:** add **per-source freshness badges** ("SRH updated 3 days ago"), record counts, and a **data-lineage view** showing how each source feeds which indicators — a transparency artifact M&E teams will value highly.

### Navigation (`navigation.ts`, `Sidebar.tsx`, `AppShell.tsx`)
Single source of truth for routes; sidebar with saved-views section; topbar with global search and filter drawer. **Opportunity:** add breadcrumbs for drill state, a "Recently viewed" list, and a command-palette-driven jump-to-anything. Group the growing nav under headers (Explore / Analyze / Manage) as the scorecard/alerts pages are added.

### Filtering (`FilterDrawer.tsx`, `filterStore.ts`)
Excellent: every option list is derived from real data (so any selectable value has data behind it), including MAMII's extra geography; zone auto-derives from state; filters scope KPIs, charts, trends and the map coherently; saved views capture page + filter. **Opportunity:** persist filter state into the **URL** (shareable deep links), add filter presets/chips summarizing the active scope, and add a "compare scopes" mode (A vs. B).

### Maps (`NigeriaMap.tsx`, `stateProfile.ts`)
A hand-built SVG choropleth: red→amber→green heat fill, donor markers (Gates/EU-UNFPA/CIFF/LAD), hover tooltips, click-to-profile, click-empty-to-clear, theme-aware strokes/labels, greyed no-data states. **Opportunity (largest single visual upgrade):** LGA-level drill-down choropleth, a **facility point map** (clustered/heat markers from PFMO coordinates), zoom/pan, a mini-map, catchment/nearby-facility analysis, and a **table fallback + keyboard nav** for accessibility. Consider a vector-tile basemap if migrating off bespoke SVG.

### Tables
Consistent sortable/paginated tables with sticky headers, `aria-sort`, group-by-state headers, heat-coloured cells, and "No data" italics. Strong baseline. **Opportunity:** column freeze, CSV-of-current-view (vs. all), inline sparkline columns, conditional formatting rules, and density controls.

### Charts (`indicatorViz.tsx`, `chartBase.ts`, ECharts)
~15 bespoke viz kinds mapped per-indicator (`gauge`, `radial`, `bullet`, `donutBinary`, `barSplit`, `funnel`, `pipeline`, `kpiStat`, `rateBar`, `composition`, stacked functional status, etc.) — this is unusually thoughtful; each indicator gets the *right* chart, not a generic bar. **Opportunity:** add benchmark/target ticks universally (present on `rateBar`, generalize it), confidence intervals, and a consistent "explain this chart" + "view underlying data" affordance on every chart.

### User Workflows
The scope→drill→export loop is coherent and the deep-linking between Overview KPIs and thematic pages is a highlight. **Opportunity:** close the loop with **decision workflows** — from a red cell, a manager should be able to: see who/where, view the trend, read an AI root-cause note, add an annotation, add to a watchlist, and generate a briefing — without leaving the flow.

### Performance
Good memoization discipline throughout; pagination guards against mounting thousands of rows. **Gaps:** no `React.lazy`/`Suspense` (all six pages + heavy ECharts/jsPDF/xlsx load eagerly); the 28k registry is derived client-side; the full snapshot ships to the browser. See Engineering.

### Responsiveness
Tailwind responsive grids throughout (`sm/lg/xl` breakpoints), mobile filter drawer, fluid map. Solid. **Opportunity:** the dense tables and the trend picker need dedicated mobile treatments (horizontal scroll affordances, bottom-sheet pickers); validate the KPI strip's 3-column collapse on small phones.

### Accessibility (WCAG)
Above average: focus-visible rings, `aria-pressed`/`aria-sort`/`aria-label`, keyboard handlers on card buttons, `role="img"` on the map. **Gaps:** the SVG map has no keyboard navigation or table alternative; the red/amber/green heat scale is not colour-blind-safe (colour sometimes the sole encoder); verify contrast of `muted-2` text and chart labels against AA. See Quick Wins.

---

## Review-Category Findings

### 1. UI / UX
Navigation, layout, hierarchy, typography, spacing, iconography (Lucide), animation (framer-motion), empty/loading/error states, and theming are all handled to a high standard and are internally consistent. To reach **Power BI / Tableau / Looker / ArcGIS / Datadog / Grafana** feel, add: (a) a **command palette** that also executes actions (not just navigation); (b) **cross-filtering** (click a bar → filter the page); (c) **drill-through** context menus on every visual ("drill to facilities," "view data," "explain"); (d) **dashboard density controls** and saved layouts; (e) a **global "scope summary" bar** showing active filters as removable chips; (f) colour-blind-safe palettes and a table view for every chart. These are the interaction patterns enterprise BI users expect.

### 2. Dashboard & Analytics
The per-indicator chart selection is already excellent. The missing analytical layer: **targets & benchmarks** (vs target, vs national avg, vs peer group), **variance indicators** and **performance bands** on every KPI, **ranking/league tables** as first-class pages, **trend arrows** with statistical significance, **confidence indicators** (CI bands, small-sample already flagged — extend it), **small multiples** and **side-by-side comparative** views, and **drill-through** from any figure to its facilities and trend. Add **statistical summaries** (distribution, median, IQR) to state breakdowns in the indicator modal.

### 3. Public Health / NPHCDA
This is where the biggest domain value sits. Recommended, in rough priority: **national/state/LGA/facility scorecards** (traffic-light matrix — the artifact programme managers live in); **facility/state/LGA ranking**; a **Programme Performance Index** and named **composite readiness / service-delivery / stock-management scores** (the composite already exists — expose and decompose it); **facility grading (A–F)**; **risk scoring** and an **alert dashboard**; **coverage-gap** and **equity analysis** (zone, rural/urban, donor vs non-donor — the data model already stamps zone/donor); **peer benchmarking** and **best/worst performers**; and a full **data-quality layer** — completeness (% expected facilities reporting), timeliness (reporting lag), missing-data detection, outlier detection. Finally, the **transparency essentials**: an **indicator metadata panel** with definitions, **numerator/denominator explanations**, **data-source lineage**, and **last-refresh information** — several of these are one surfacing task away because the plumbing (`getIndicatorDefs`, `getDefinitions`, snapshot `generatedAt`) already exists.

### 4. AI Features
Currently absent; highest differentiation. Layer these on the clean snapshot via the Claude API: **AI Insights / auto-generated narrative summaries** per page and scope; **"Explain this chart / indicator"**; **natural-language query** and **conversational analytics** ("Which states have Penta3 < 80% and missed BHCPF disbursement?"); **anomaly detection**, **forecasting**, **trend explanations**, **recommendations** and **AI-generated action plans**; **intelligent alerts** and **early-warning** (stock-out, coverage decline, zero-dose accumulation); **AI facility comparison**; **AI executive reports / briefing documents**; **root-cause analysis**; **scenario simulation** ("what if SBA coverage rises 10pts in Kano?"). Start with narrative summaries + "explain this chart" (bounded, low-risk, high-wow), then NL-query, then predictive.

### 5. Engineering
Strengths: the `DataSource` seam, real-data discipline, memoization, typed data model. Priorities: **route-level code-splitting** (`React.lazy` + `Suspense`) and lazy registry computation (perf); a **test suite** — none exists — starting with unit tests for the calculation/scoping engine (`calculations.ts`, `scopedEngine.ts`, the numeric heart) and Playwright smoke tests for scope→export; **auth + RBAC + audit logging** (the `authStore`/`LoginPage`/`ProtectedRoute`/`MockAuthProvider` exist but are removed from routing — re-enable with SSO and geography-scoped roles); **server-side pagination/aggregation** so the national registry isn't held in browser memory (the `ApiDataSource` seam is ready); **error monitoring** (Sentry) + web-vitals; and **CI gates** (typecheck/lint/test on PRs — `.github/` already present). State management (Zustand) and caching (`useAsync`) are appropriate; consider a query cache (TanStack Query) when moving to the live API.

### 6. Product Features
Already present: **saved views/bookmarks**, **global search**, **keyboard shortcuts** (Cmd-K), **export to PDF/Excel/CSV**, **theme preference**. Add: **shareable deep-link URLs**, **scheduled reports** (email a PDF/scorecard on a cadence), **custom dashboards / widget builder**, **annotations / notes / comments**, **notification center**, **watchlists / favorites**, **recently viewed**, **onboarding tour** and **help center**. Shareable links + scheduled reports are the highest-value near-term additions for real NPHCDA workflows (WhatsApp/email distribution, monthly review packs).

### 7. Maps
Covered in the walkthrough. Priority order: **LGA-level choropleth drill-down** → **facility point map (cluster + heat)** → **zoom/pan + mini-map** → **catchment / nearby-facility spatial analysis** → **density maps**. Add accessibility (keyboard + table fallback) alongside. This is the most visible single upgrade and directly matches ArcGIS-Dashboards expectations.

---

## Recommended Features

| Feature | Category | Priority | User Value | Impl. Complexity | Expected Impact |
|---|---|---|---|---|---|
| Indicator metadata panel (definition, numerator/denominator, lineage, refresh) | Public Health / UX | **High** | High | **Low** (`getIndicatorDefs`/`getDefinitions` already in contract) | High |
| "Data as of…" refresh timestamp + per-source freshness badges | Public Health / Trust | **High** | High | **Low** (`generatedAt` exists, unsurfaced) | High |
| National / State / LGA scorecard page (traffic-light matrix) | Public Health / Analytics | **High** | High | Medium | High |
| League tables — best/worst, state & LGA & facility ranking | Analytics | **High** | High | Low–Medium | High |
| Targets, benchmarks & variance on every KPI | Analytics | **High** | High | Medium | High |
| Route-level code-splitting (`React.lazy`) + lazy registry load | Engineering / Perf | **High** | Medium | Low | High |
| AI Insights: auto-generated narrative summary per page/scope | AI | **High** | High | Medium | Very High |
| "Explain this chart / indicator" (Claude) | AI | **High** | High | Medium | Very High |
| PDF executive report / one-click briefing pack | Product | **High** | High | Medium | High |
| Data-quality panel: completeness, timeliness, missing-data, outliers | Public Health / Data Ops | **High** | High | Medium | High |
| Shareable deep-link URLs (encode filter + page in querystring) | Product | **High** | High | Low–Medium | High |
| Facility & state grading (A–F) + named composite sub-scores | Public Health | Medium | High | Medium | High |
| Facility profile / scorecard page (drill-through target) | Public Health / UX | Medium | High | Medium | High |
| Cross-filtering + drill-through context menus on visuals | UX / Analytics | Medium | High | Medium | High |
| Natural-language query over the snapshot | AI | Medium | High | Medium–High | Very High |
| AI anomaly detection + intelligent alert center | AI | Medium | High | High | High |
| AI forecasting / early-warning (stock-out, coverage, zero-dose) | AI | Medium | High | High | High |
| Risk scoring & watchlists (at-risk facilities) | Public Health | Medium | High | Medium | High |
| LGA choropleth + facility point map (cluster/heat) + zoom/pan | Maps | Medium | High | High | High |
| Equity & rural/urban / peer-benchmarking analysis | Public Health | Medium | High | Medium | High |
| Small multiples / side-by-side scope comparison | Analytics | Medium | Medium | Medium | Medium |
| Annotations / notes / comments on indicators & facilities | Collaboration | Medium | Medium | Medium | Medium |
| Notification center + scheduled email reports | Product | Medium | Medium | Medium | Medium |
| Auth + RBAC (geography-scoped) + audit logging | Engineering / Security | Medium | High | Medium | High |
| Test suite (calc-engine unit + critical-flow e2e) + CI gates | Engineering | Medium | Medium | Medium | High |
| Colour-blind-safe palettes + map keyboard/table accessibility | UX / A11y | Medium | Medium | Low | Medium |
| Onboarding tour + help center + recently-viewed | UX | Low | Medium | Low | Medium |
| Custom dashboard / widget builder | Product | Low | High | High | High |
| AI scenario simulation / what-if modeling | AI | Low | High | High | High |

---

## Quick Wins
*Hours to a few days; mostly surfacing capability that already exists in the data layer.*

1. **Surface the refresh timestamp** — render "Data as of {generatedAt}" in the shell/footer; add per-source freshness chips on the Source Dashboards page.
2. **Indicator metadata panel** — `getIndicatorDefs()`/`getDefinitions()` exist but render nowhere; add a definition + numerator/denominator + source-lineage block to the top of `IndicatorModal`.
3. **Route-level code-splitting** — wrap the six routes in `React.lazy`/`Suspense` to cut the initial bundle (ECharts + jsPDF + xlsx are heavy).
4. **Lazy-load the PFMO registry** — only compute `pfmoRegistry()` when the registry tab opens.
5. **Shareable deep links** — serialize filter store + active page into the URL querystring.
6. **Best/worst-performer chips** on each block header (trivial from `stateMeasures`).
7. **Map accessibility** — focusable state paths with `<title>`, keyboard navigation, and a "view as table" toggle.
8. **Colour-blind-safe scale option** — add a viridis/pattern alternative; ensure colour is never the sole encoder.
9. **Explicit registry loading flag** — replace the `pfmoBase.length === 0` inference so a genuinely empty result never reads as "loading."
10. **"Copy figure / cite this"** on KPI cards and modal rows — one-click copy of value + source + period.
11. **Compose the composite label** — name and briefly explain the composite readiness score on the Overview map (add a "how this is calculated" popover).

---

## Medium-Term Enhancements
*Moderate development effort; the management-instrument and collaboration layers.*

- **Scorecard page** — National → State → LGA traffic-light matrix (indicators × geographies), home for the existing composite scores.
- **League tables** — dedicated state / LGA / facility ranking with percentile bands and period-over-period movement (promote the ranking logic currently inside `IndicatorModal`).
- **Targets & benchmarks** — attach target + reference (national/peer/prior) to each indicator; render variance and bands on cards and modals.
- **Composite sub-scores + grading** — expose Readiness / Stock / Service indices and an A–F grade per facility/state, with a transparent calculation drawer.
- **Data-quality dashboard** — completeness, timeliness, missing-data, outliers (the `DASHBOARD_VALUE_AUDIT.md` groundwork shows this is already understood; make it live).
- **Equity analysis** — zone, rural/urban, donor vs non-donor comparisons.
- **Facility profile page** + **watchlists** — the drill-through destination and follow mechanism.
- **Cross-filtering + drill-through menus** on visuals; **small multiples** and **compare-scopes** views.
- **PDF executive report** generator (jsPDF already a dependency); **annotations/notes**; **notification center**; **scheduled reports**.
- **Re-enable auth + RBAC + audit logging**; add **calc-engine unit tests** + **CI gates**; introduce **server-side pagination/aggregation** for the registry.
- **Maps:** LGA choropleth + clustered facility point/heat map + zoom/pan + mini-map.

---

## Long-Term Vision

The platform can evolve from *"the NPHCDA dashboard"* into **the national PHC decision-intelligence layer** — the default surface a Federal, State (SPHCDA), LGA and partner (WHO/UNICEF/Gavi/CHAI/Solina) user opens to answer *"how is primary health care performing, where, and what should we do about it?"* Four pillars:

1. **One trusted data spine.** Every indicator carries a full lineage card (source system → ETL transform → numerator/denominator → refresh time → quality flags). Analysts stop asking "can I trust this number?" — provenance is one click away. The real-data-only discipline already in place is that foundation.
2. **Analytics that grade and rank, not just display.** Scorecards, A–F grades, risk scores and equity lenses turn the dashboard into a management instrument — telling a Director *where to intervene*, ranking facilities for supportive supervision, and auto-flagging bottom-decile LGAs, mirroring how DHIS2 scorecards and the WHO/Gavi review process work.
3. **AI as an analyst-in-the-loop.** A conversational layer, auto-written executive narratives, anomaly detection and early-warning forecasts let a non-technical programme manager get a defensible answer and a draft action plan in seconds — the leap from *reporting* to *intelligence*, made tractable by the clean snapshot.
4. **A collaborative operating surface.** RBAC-scoped views, annotations, watchlists, scheduled briefings and shareable links make it the shared workspace for national review meetings — the live, drill-able artifact projected in the NPHCDA situation room and emailed to State Commissioners, replacing static PowerPoint packs.

Delivered, this positions the product alongside Power BI / Tableau / ArcGIS Dashboards / Grafana in polish, while being **purpose-built for Nigerian PHC** in a way no generic BI tool is — the durable moat.

---

## Prioritized Roadmap

> **Coverage guarantee:** Phases 1–4 are a **strict superset** of the Quick Wins, Medium-Term Enhancements, and Long-Term Vision lists above — every item in those lists appears in exactly one phase below, tagged with its origin: **[QW]** = Quick Win, **[MT]** = Medium-Term, **[LT]** = Long-Term Vision, **[RF]** = item that previously lived only in the Recommended Features table. Nothing in the three prose lists is dropped.

### Phase 1 — Immediate (highest impact, low effort)
*Surface what already exists; remove trust and performance friction.*
- "Data as of…" refresh timestamp + per-source freshness badges. **[QW]**
- Indicator metadata panel (definitions, numerator/denominator, lineage). **[QW]**
- Route-level code-splitting. **[QW]**
- Lazy-load PFMO registry (defer `pfmoRegistry()` to its tab) **and** add an explicit registry loading flag (replace the `pfmoBase.length === 0` inference). **[QW]**
- Shareable deep-link URLs. **[QW]**
- Best/worst-performer chips on block headers. **[QW]**
- "Copy figure / cite this" on KPI cards and modal rows. **[QW]**
- Map keyboard access + "view as table" fallback. **[QW]**
- Colour-blind-safe palette option (colour never the sole encoder). **[QW]**
- Name + explain the composite score on the Overview map. **[QW]**

### Phase 2 — Core product & analytics
*The management-instrument layer.*
- National/State/LGA **scorecard** page. **[MT]**
- **League tables** (state / LGA / facility) with period-over-period movement. **[MT]**
- **Targets, benchmarks & variance** on every KPI. **[MT]**
- **Data-quality dashboard** (completeness, timeliness, missing-data, outliers). **[MT]**
- **Facility & state grading (A–F)** + named composite sub-scores (Readiness / Stock / Service) with a calculation drawer. **[MT]**
- **Facility profile page** (drill-through destination). **[MT]**
- **Equity analysis** — zone, rural/urban, donor vs non-donor. **[MT]**
- **Cross-filtering + drill-through menus**; **small multiples** + **compare-scopes** views. **[MT]**
- **PDF executive report** generator. **[MT]**
- **Annotations / notes** on indicators & facilities. **[MT]**
- **Notification center**. **[MT]**
- Re-enable **Auth + RBAC + audit logging**. **[MT]**
- **Calc-engine unit tests + critical-flow e2e + CI gates**. **[MT]**
- Onboarding tour + help center + recently-viewed. **[RF]**

### Phase 3 — Advanced analytics & AI
*Augmented analytics.*
- **AI Insights** — auto-generated narrative summaries per page/scope. **[LT — pillar 3]**
- **"Explain this chart / indicator."** **[RF]**
- **Natural-language query** over the snapshot. **[RF]**
- **AI anomaly detection** + intelligent **alert center**. **[LT — pillar 3]**
- **Watchlists / favorites** (the follow mechanism paired with facility profiles). **[MT]**
- **Risk scoring** for facilities. **[RF]**
- **Forecasting / early-warning** (stock-out, coverage decline, zero-dose). **[LT — pillar 3]**
- **Maps:** LGA-level choropleth + clustered facility point/heat map + zoom/pan + **mini-map**. **[MT]**
- **Server-side pagination/aggregation** so the registry isn't held in browser memory. **[MT]**

### Phase 4 — Visionary (best-in-class platform)
*Differentiators that make it the national standard.*
- **Conversational analytics** with drill-through and cited figures. **[LT — pillar 3]**
- **AI-generated executive briefings & action plans** (root-cause + recommended interventions). **[LT — pillar 3]**
- **Scheduled reports** — email a PDF/scorecard/briefing on a cadence. **[MT]**
- **AI scenario simulation / what-if** modeling. **[RF]**
- **Custom dashboard / widget builder.** **[LT — pillar 4]**
- Full **collaboration surface** — annotations, comments, shared workspaces, national-review "situation room" mode. **[LT — pillar 4]**
- **One trusted data spine** — the full per-indicator lineage card (source → transform → num/denom → refresh → quality flags) as a first-class experience. **[LT — pillar 1]**
- **Server-side query API + streaming** so the platform scales to every facility, every month, at national concurrency. **[LT — pillar 4]**

---

### Coverage checklist

**Quick Wins (11)** — all in Phase 1: refresh timestamp ✓ · metadata panel ✓ · code-splitting ✓ · lazy registry ✓ · shareable links ✓ · best/worst chips ✓ · map accessibility ✓ · colour-blind scale ✓ · registry loading flag ✓ · copy/cite ✓ · name composite ✓

**Medium-Term (all)** — scorecard ✓ (P2) · league tables ✓ (P2) · targets/benchmarks ✓ (P2) · data-quality ✓ (P2) · composite sub-scores + grading ✓ (P2) · facility profile ✓ (P2) · watchlists ✓ (P3) · equity ✓ (P2) · cross-filtering/drill-through ✓ (P2) · small multiples/compare ✓ (P2) · PDF report ✓ (P2) · annotations ✓ (P2) · notification center ✓ (P2) · scheduled reports ✓ (P4) · auth/RBAC/audit ✓ (P2) · tests + CI ✓ (P2) · server-side pagination ✓ (P3) · maps LGA/point/zoom/mini-map ✓ (P3)

**Long-Term Vision (4 pillars)** — pillar 1 (trusted data spine) ✓ (P4, seeded by P1 metadata panel) · pillar 2 (grade & rank) ✓ (P2 scorecards/grading/league tables + P3 risk) · pillar 3 (AI analyst-in-the-loop) ✓ (P3–P4) · pillar 4 (collaborative operating surface) ✓ (P4)

## Goal Recap

The product is already an **excellent descriptive dashboard**. The fastest path to *enterprise-grade health intelligence* is to (1) **surface the trust and metadata layer that already exists in the data contract**, (2) **add the scorecard / ranking / quality analytics that turn display into decisions**, and (3) **layer AI on top of the clean snapshot** to move from reporting to recommendation — while re-enabling the auth / testing / scalability hardening needed for national, multi-stakeholder use. Every recommendation is grounded in the current architecture's strengths (the `DataSource` seam, real-data discipline, composite scoring, ETL lineage) so the platform evolves **without a rewrite**.
