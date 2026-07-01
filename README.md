# NPHCDA PHC Readiness, Stock & Service Dashboard

An enterprise analytics platform for Primary Health Care performance across Nigeria —
a full React + TypeScript rebuild of the original single-file dashboard, with the exact
indicators, KPIs and calculations preserved and a data layer built for real datasets.

## Tech stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** design system (brand tokens, dark/light theming)
- **ECharts** for charts, custom SVG Nigeria choropleth map
- **Zustand** for state (theme, filters, notifications, saved views)
- **React Router** for routing, mock-but-pluggable **auth**
- Export to **CSV / Excel / PDF / PNG**

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run preview    # preview the build
```

**Demo login:** `admin@nphcda.gov.ng` / `nphcda2026`
(any email + password `demo` also works).

## Project structure

```
src/
├── app/                 # navigation config
├── components/
│   ├── ui/              # design-system primitives (Button, Card, Modal, …)
│   ├── layout/          # AppShell, Sidebar, Topbar, FilterDrawer, GlobalSearch
│   ├── charts/          # EChart wrapper + chartBase factory, Sparkline, RingProgress
│   ├── map/             # NigeriaMap + MapIndicatorPicker
│   ├── dashboard/       # KpiStrip, IndicatorCard, IndicatorModal, ExportMenu, …
│   └── brand/           # Logo
├── features/
│   ├── landing/         # public landing page
│   ├── auth/            # login + AuthProvider (mock, pluggable)
│   ├── dashboard/       # Home, Overview, BlockPage, Trend, FacilityDeepdive, Sources
│   └── settings/        # profile & preferences
├── data/
│   ├── types.ts         # domain model (the UI's data contract)
│   ├── calculations.ts  # PRESERVED metric math (ported verbatim)
│   ├── datasource/      # DataSource interface + Mock + Api(stub) + factory
│   ├── mock/            # illustrative indicators, KPIs, trends, facilities
│   └── geo/             # states, LGAs, zones, SVG map paths, donors
├── store/               # zustand stores
└── hooks/               # useAsync
```

## Data & real-dataset integration

All data flows through a single `DataSource` interface, so wiring in live data is a
config + one-file change (no UI edits). See **[docs/DATA_INTEGRATION.md](docs/DATA_INTEGRATION.md)**
and the source-column map in `NPHCDA Data Indicator Mapping - Sheet1.csv`.

```bash
# .env.local
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=https://your-api/api
```

## Design & data integrity notes

- Indicator names, tiers, `pct`/`inverse` semantics and all calculations are **preserved
  exactly** from the original dashboard (kept for reference in `reference/`).
- Charts inherit shared defaults from `src/components/charts/chartBase.ts`
  (dynamic label sizing, wrapping, typography, tooltip/legend styling).
- Data gaps (`tier: 3` / `pct: 0`) render a consistent "Data not yet available" state.
