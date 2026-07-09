# Trend Analysis & Facility Deep Dive — Coverage Review

**Date:** 2026-07-09
**Scope:** Every *implemented* (live) indicator, assessed for inclusion on the **Trend Analysis** and **Facility Deep Dive** pages.

## How the two pages work today

- **Trend Analysis** (`src/features/dashboard/TrendPage.tsx`) renders **every series returned by the snapshot's `trends` block** (built by `etl/lib/trends.mjs → buildTrends`). It is not a hand-picked list — it auto-lists all series, so *expanding coverage means adding a series to the trend engine*. Only sources with a **reporting month** can produce a monthly series: SRH ODK, SFM ODK, PFMO. MAMII and the SRH Google-Sheet baseline carry **no month**, so their indicators are structurally un-trendable.
- **Facility Deep Dive** (`src/features/dashboard/FacilityDeepdivePage.tsx`) is a **cross-indicator facility matrix** with two universes:
  - **Assessed** — the ~637 SRH/SFM/Sheet roster. Columns are per-facility indicator values.
  - **Registry** — PFMO's ~28k-facility national PHC reporting registry (service flows).

  Per-indicator, per-facility values already exist through the shared engine (`facilityMeasures()` in `scopedEngine.ts`) — the same function the Indicator modal uses — so *expanding coverage means surfacing more of those columns in the matrix*, not new math.

> Note: the **Indicator modal** (opened from any card) already exposes a *By-state / By-facility* breakdown for **every** indicator. This review is about the two dedicated **pages**, which give an at-a-glance cross-facility / over-time comparison the modal does not.

## Trend series already live (9)

Facility deliveries (count) · ANC1 coverage (%) · ANC4 coverage (%) · Modern contraceptive use (%) · PPH bundle availability (%) · Penta 3 completion (%) · Maternal mortality ratio (per 100k) · Under-5 mortality (per 1k) · Live births (count).

## Facility Deep Dive columns already live

- **Assessed:** Facility Type, Functional Status, Commodities available (#), Patient Satisfaction % *(no source — permanent "No data")*.
- **Registry:** Penta 3 % · Live births · Maternal deaths · Under-5 deaths · Months reported.

---

## Review table

Legend — **T** = Trend Analysis, **FDD** = Facility Deep Dive. "Currently" reflects the two pages before this change.

| Indicator | Theme | In T (now) | Add to T | In FDD (now) | Add to FDD | Reason |
|---|---|---|---|---|---|---|
| Number of deliveries in facilities | Service Delivery | ✅ (deliveries count) | — | ❌ | ✅ **assessed** | Core service volume; real per-facility count from SRH+SFM. Highest-coverage per-facility metric (all roster facilities). |
| Proportion of deliveries attended by a skilled birth attendant | Service Delivery | ❌ | ✅ | ❌ | ✅ **assessed** | SFM has a monthly attended-delivery count → trendable; per-facility quality-of-care signal. (Trend is near-ceiling ~99–100% — a legitimate "consistently high" finding.) |
| % of women with a live birth who attended ANC 1 | Service Delivery | ✅ | — | ❌ | ✅ **assessed** | Already trended nationally; adding a per-facility column shows antenatal entry point per facility (581 facilities). |
| % of women with a live birth who attended ANC 4 | Service Delivery | ✅ | — | ❌ | ➖ optional | Trended already. Per-facility ANC4 duplicates ANC1's antenatal story; omitted to avoid matrix clutter (available in the Indicator modal). |
| % of family planning clients using modern contraceptives | Service Delivery | ✅ | — | ❌ | ✅ **assessed** | Trended already; per-facility FP coverage is a distinct SRH service worth a column (221 facilities). |
| % increase in utilization of FP services | Service Delivery | ❌ | ❌ | ❌ | ❌ | It **is** the first→last delta of the FP trend already on the page — adding it would duplicate that line. Not a per-facility quantity. |
| Proportion of children <1y who received Penta 3 | Service Delivery | ✅ (Penta 3 completion) | — | ✅ (registry Penta 3 %) | — | Fully covered in both pages (PFMO). |
| Maternal Mortality Ratio — BHCPF vs non-BHCPF | Service Delivery | ✅ (MMR per 100k) | — | ✅ (registry: maternal deaths + live births) | — | Trended (PFMO); its inputs are per-facility in the registry. A per-facility MMR is single-month noise across 36k rows → not meaningful. |
| Under-5 Mortality Rate — BHCPF vs non-BHCPF | Service Delivery | ✅ (U5MR per 1k) | — | ✅ (registry: under-5 deaths + live births) | — | Same as MMR. |
| Proportion of maternal deaths resulting from PPH | Service Delivery | ❌ | ❌ | ❌ | ❌ | Deaths are rare cumulative events (742 total across the window); a monthly cause-*share* is statistical noise, and a per-facility share is worse (median 0–1 deaths). Cause breakdown belongs on the card, not a trend/matrix. |
| Proportion of maternal deaths from pre-eclampsia/eclampsia | Service Delivery | ❌ | ❌ | ❌ | ❌ | Same as PPH share. |
| Proportion of maternal deaths resulting from sepsis | Service Delivery | ❌ | ❌ | ❌ | ❌ | Same as PPH share. |
| Proportion of facilities with the PPH bundle available* | Stock Status | ✅ (PPH bundle availability) | — | ❌ | ✅ **assessed** | Trended already; a per-facility Yes/No readiness column is exactly the deep-dive's purpose (631 facilities). |
| Proportion of PHCs with all six tracer commodities available* | Stock Status | ❌ | ❌ | ⚠️ partial (assessed "Commodities available #") + ❌ registry | ✅ **registry** | Point-in-time assessment → not a monthly flow. Assessed matrix already shows the commodity **count**; PFMO carries the true **6/6** per facility and it is shown **nowhere** today (the modal's facility view excludes PFMO). Add to registry. |
| Proportion of wards/main PHCs with functional cold-chain (SDD/CCE) | Stock Status | ❌ | ❌ | ❌ | ✅ **assessed** | Point-in-time assessment → not trendable. Per-facility Yes/No cold-chain readiness is a strong deep-dive column (365 SFM facilities). |
| Proportion of visited PHCs with functional maternal health equipment* | Stock Status | ❌ | ❌ | ❌ | ✅ **registry** | Assessment, not a flow → not trended. PFMO carries the full **5/5** equipment status per facility, unseen today → add to registry. (Assessed side is a partial 4/5 pooled proxy; kept in the modal to avoid a misleading matrix column.) |
| Proportion of visited PHCs offering the full essential service package* | Facility Readiness | ❌ | ❌ | ❌ | ✅ **registry** | Assessment, not a flow → not trended. PFMO carries per-facility 6/6 essential-services status, unseen today → add to registry. |
| Facility functional status per state (L1/L2/partial/non-functional) | Facility Readiness | ❌ | ❌ | ✅ (assessed "Functional Status") | — | Categorical, MAMII-only, no month → not trendable. Already a matrix column. |
| Proportion of facilities with a minimum of 4 SBAs | Facility Readiness | ❌ | ❌ | ❌ | ➖ optional | Point-in-time staffing (MAMII+Sheet). MAMII facilities aren't in the assessed roster, so column coverage is thin and overlaps the Functional-Status column; left to the modal. |
| Number of SBAs recruited | Facility Readiness | ❌ | ❌ | ❌ | ❌ | MAMII, no month → not trendable. Facility-native count with no per-facility target; belongs in the ranked state bars, not the matrix. |
| Proportion of SBAs deployed per state | Facility Readiness | ❌ | ❌ | ❌ | ❌ | MAMII, no month; a *per-state* ratio (deployed÷recruited) — no honest per-facility grain. |
| Proportion of CBHWs recruited | Facility Readiness | ❌ | ❌ | ❌ | ❌ | MAMII **state-aggregate** (denormalised); no month, no facility grain (see `AGGREGATE_ONLY_INDICATORS`). |
| Number of CBHWs trained | Facility Readiness | ❌ | ❌ | ❌ | ❌ | MAMII state-aggregate; as above. |
| Proportion of CBHWs deployed per state | Facility Readiness | ❌ | ❌ | ❌ | ❌ | MAMII state-aggregate; as above. |
| % of recruited CBHWs that have been absorbed | Facility Readiness | ❌ | ❌ | ❌ | ❌ | MAMII state-aggregate (currently a real 0); as above. |
| Number of revitalized PHC facilities per state | Facility Readiness | ❌ | ❌ | ❌ | ❌ | MAMII **LGA-aggregate**; no month, no facility grain. |
| Proportion of BHCPF facilities that received their quarterly disbursement | Facility Readiness | ❌ | ❌ | ❌ | ➖ optional | Survey answer keyed to *when a facility was assessed*, not disbursement timing → a monthly trend would mislead. Per-facility "received" is subsumed by the richer ₦-amount column below. |
| Total BHCPF funds received vs. expected | Facility Readiness | ❌ | ❌ | ❌ | ✅ **assessed** | Survey amount, no month → not trended. A per-facility ₦-received column adds a financing dimension the matrix currently lacks (249 facilities). |

---

## What is being implemented

### Trend Analysis (1 add)
- **SBA-attended deliveries (%)** — new series in `etl/lib/trends.mjs` (SFM: attended deliveries ÷ facility deliveries, by complete month). Snapshot `trends` regenerated from the committed `facts` (verified to reproduce the existing 9 series byte-for-byte). Scoped trends already recompute through the same engine, so filtered views pick it up automatically.

### Facility Deep Dive — Assessed matrix (6 new toggleable columns)
Surfaced at runtime via `facilityMeasures()` (no new math, no snapshot change), keyed by `state|lga|facility`, rendered "No data" where a facility's source doesn't measure it:

| Column | Indicator | Format |
|---|---|---|
| Facility deliveries | Number of deliveries in facilities | count |
| SBA-attended deliveries % | Proportion of deliveries attended by a skilled birth attendant | % (heat-coloured) |
| ANC1 coverage % | % of women with a live birth who attended ANC 1 | % (heat-coloured) |
| Modern contraceptive use % | % of family planning clients using modern contraceptives | % (heat-coloured) |
| PPH bundle | Proportion of facilities with the PPH bundle available* | Yes/No badge |
| Cold chain (SDD/CCE) | Proportion of wards/main PHCs with functional cold-chain equipment | Yes/No badge |
| BHCPF funds received | Total BHCPF funds received vs. expected | ₦ |

All columns are **toggle pills, off by default** (matching the existing "Commodities available" pattern), so the default view stays clean; sorting, grouping, pagination and CSV export all extend to them.

### Facility Deep Dive — PFMO registry (3 new columns)
Aggregated per facility in `pfmoRegistry.ts` as the **% of a facility's reporting months** in which it reported the full set (null when the family was never reported):

| Column | Indicator |
|---|---|
| Tracer 6/6 % | Proportion of PHCs with all six tracer commodities available* |
| Equipment 5/5 % | Proportion of visited PHCs with functional maternal health equipment* |
| Essential services 6/6 % | Proportion of visited PHCs offering the full essential service package* |

These three PFMO readiness measures had **no facility-level view anywhere** in the app (the Indicator modal's facility breakdown deliberately excludes PFMO's 36k rows), so the registry is their natural home.

## Design & integrity notes
- No indicator math or data source changed — new views re-use `buildTrends`, `facilityMeasures` and the PFMO aggregate, all of which already exist.
- Percent columns use the shared `heatColor` scale; Yes/No columns use the existing `Badge`; ₦ uses the existing compact-naira formatting — consistent with the rest of the dashboard.
- Everything respects the existing filter/scope, grouping, pagination, responsiveness and export behaviour.
- **Intentionally excluded:** MAMII/Sheet-sourced indicators (no month → un-trendable; aggregate grain → no honest facility column) and maternal-death cause shares (small-n noise at monthly/facility grain).
