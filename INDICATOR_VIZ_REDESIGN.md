# Indicator Visualization Redesign — Design Rationale

**Scope:** every indicator from the Overview page through Facility Readiness, Stock Status and Service Delivery.
**Date:** 2026-07-06

## How the 41 indicators map to the dashboard

The prioritized-indicator workbook lists **41 indicator rows**. On the dashboard they render as
**38 cards**, because the four facility-functional-status rows (#30 L1, #31 L2, #32 partially
functional, #33 non-functional) are — correctly — one composition card (a facility is exactly one
of the four classes; the four rows are segments of one whole).

- **26 cards are live** (fed by the ETL snapshot: SRH ODK, SFM ODK, SRH Google Sheet, MAMII).
  Counting workbook rows, that is **29 of 41 rows live** (the one functional-status card covers 4 rows).
- **12 cards are pending** (PFMO report and the Vaccine/Stock Management Dashboard are not yet
  connected; HPV has no source in any connected system). That is the remaining **12 of 41 rows**.

Every live redesign below **preserves the existing calculation and value exactly** — only the visual
encoding changes. Every pending indicator gets its intended chart rendered as a neutral "ghost"
(shape only, no fabricated numbers) with an *Awaiting data* message, so users can see how the
indicator will read once its source is connected.

## Design principles applied

1. **Encode the data's true shape.** Counts are not percentages — a count must never render as a
   progress bar (the old UI graded MAMII counts on a meaningless neutral bar). Compositions render
   as part-to-whole charts; targets render against explicit targets; uncertainty renders as a range.
2. **One glance, one insight.** Each card leads with the number and uses the chart to answer the
   *next* question the reader would ask (Where? Compared to what? Trending how?).
3. **Never fabricate.** Ghost charts carry no numbers. Neutral indicators (MMR, U5MR) are not
   colour-graded good/bad. Real zeros (CBHW absorption = 0%) render as emphatic zeros, not gaps.
4. **Shared grammar where shapes match.** Binary facility shares use donuts; composite
   "meets-ALL-items" measures use bullets with Poor/Fair/Good bands; unbounded counts use
   KPI + top-state bars. Identical data shapes deliberately share a visual language — variety is
   driven by the data, not by decoration.
5. **Scoping stays honest.** Under an active filter (state/LGA/donor/period…), cards continue to
   re-compute through the shared indicator engine. Distribution mini-charts are national-scope
   views; when a filter is active the card falls back to the scoped value display so a national
   distribution is never mislabelled as a scoped one. State-bar charts highlight the selected state.

---

## Overview page

| Element | Current | Proposed | Reason | Status |
|---|---|---|---|---|
| KPI strip (6 cards: deliveries, ANC1, mCPR, PPH bundle, PPH death share, ≥4 SBAs) | KPI card + sparkline + progress ring | **KPI card carrying the indicator's own theme-section chart** (deliveries/ANC1 → trend columns; mCPR/≥4 SBAs → donut; PPH bundle → gauge; PPH death share → cause donut) | The overview must speak the same visual language as the theme pages: each KPI card now renders the *exact* chart the indicator uses in its section, so a reader sees one consistent encoding across the app. The line sparklines are gone — no line charts remain on the Overview. Value/delta framing is kept; the redundant corner ring is dropped where the chart already embeds the number. | Implemented |
| State map | Choropleth of state readiness / selected indicators | **Choropleth (retained)** | Geographic variation is exactly what a choropleth is for. | Implemented (retained) |
| Programme snapshot (3 cards) | Ring progress + headline | **Ring progress (retained)** | A single normalized score per programme area; radial progress reads instantly. | Implemented (retained) |

---

## Facility Readiness

### Facility functionality & infrastructure

| Indicator | Current Chart | Proposed Chart | Reason for Selection | Status |
|---|---|---|---|---|
| Facility functional status per state (L1/L2/partial/non-functional) — workbook rows #30–33 | Inline stacked bar + text legend | **100% stacked composition bar with direct segment labels + n annotation** | The four classes are mutually exclusive parts of one whole — the canonical part-to-whole encoding. Upgrade: labels move onto the segments (no legend→bar eye travel), and the assessed-facility count (n = 1,789) is stated so a 0% "partial" reads as a real zero. Deep dive keeps the per-state stacked bars. | Implemented |
| Number of revitalized PHC facilities per state (757) | Progress bar at a neutral 50% (implies a grade that doesn't exist) | **KPI count + top-states horizontal bar** | An unbounded count with no target denominator. The story is *scale* and *where* — a ranked state bar answers both; a progress bar answers neither. | Implemented |
| Proportion of visited PHCs offering the full essential service package* | Empty state (no chart) | **Bullet chart (ghost)** | A composite "% of PHCs meeting ALL 6 services" is a progress-against-full-coverage measure: bullet with Poor/Fair/Good bands. Ghost until PFMO connects. | Pending (PFMO) |
| Proportion of visited PHCs with functional maternal health equipment* (46.9% · 4 of 5) | Ring + thin bar | **Bullet chart with qualitative bands** | "% meeting ALL items" is a target-progress measure. The bullet adds what the ring lacked: explicit Poor/Fair/Good context bands and a 100% target line, so 46.9% reads as "roughly half-ready" at a glance. Partial-scope badge (4 of 5 items) retained. | Implemented |

### Workforce readiness

| Indicator | Current Chart | Proposed Chart | Reason for Selection | Status |
|---|---|---|---|---|
| Number of SBAs recruited (970) | Progress bar at neutral 50% | **KPI count + top-states horizontal bar** | Unbounded ramp-up count; the insight is which states drive recruitment. | Implemented |
| Proportion of SBAs deployed per state (100%) | Ring + thin bar | **Radial progress gauge with explicit 100% label** | A single saturation proportion (deployed ÷ recruited). A filled radial communicates "complete" unmistakably; the meta keeps the recorded-deployments caveat. | Implemented |
| Number of CBHWs trained (1,670) | Progress bar at neutral 50% | **Pipeline bar: trained overlaid on recruited (1,670 of 3,204)** | The training count only means something relative to the recruited pool — both are real MAMII measurements at the same state grain. An overlay bar shows pipeline conversion without inventing a target. | Implemented |
| Proportion of CBHWs recruited (3,204 — reported as a count; no planned denominator) | Progress bar at neutral 50% | **KPI count + top-states horizontal bar** | Reported as a count by agreement with the data owner (no planned/target denominator exists). Same count grammar as SBAs recruited. | Implemented |
| Proportion of CBHWs deployed per state (52.1%) | Ring + thin bar | **State dot plot (0–100%) with national marker** | The name says it: *per state*. A dot strip shows the spread of state deployment rates around the 52.1% national figure — variation is the insight a single ring hides. | Implemented |
| % of recruited CBHWs that have been absorbed (0%) | Ring + thin bar | **Zero-emphasis progress bar with annotation** | A real reported zero, not a gap. An empty bar with an explicit "0% — absorption not yet reported in MAMII" annotation states the finding instead of looking broken. | Implemented |
| Proportion of facilities with a minimum of 4 SBAs (58.4%) | Ring + thin bar | **10×10 waffle chart** | "X in every 100 facilities adequately staffed" is a unit-share statement; a waffle makes the facility-level meaning tangible in a way an abstract ring doesn't. | Implemented |

### Financing readiness

| Indicator | Current Chart | Proposed Chart | Reason for Selection | Status |
|---|---|---|---|---|
| Proportion of BHCPF facilities that received their quarterly disbursement (43.8%) | Ring + thin bar | **Donut: received vs not received** | Binary yes/no share across responding facilities — a two-segment part-to-whole. The "not received" majority is the actionable slice and becomes visible. | Implemented |
| Total BHCPF funds received vs. expected (₦38.4m received) | Thin bar (full-amount share) | **KPI ₦ amount + top-states ₦ bar** | A money magnitude with no expected-amount denominator yet ([known gap](#notes)). Headline the real ₦ figure and show where the money landed; the received-in-full share stays in the meta. | Implemented |
| Proportion of BHCPF facilities that received NHIA capitation funds | Empty state | **Donut (ghost)** | Same binary-receipt shape as the Gateway disbursement — shared grammar. | Pending (PFMO/SRH) |
| Proportion of facilities receiving BOTH NPHCDA Gateway and NHIA Capitation funds | Empty state | **100% stacked composition bar (ghost): both / Gateway only / NHIA only / neither** | The indicator exists to test *synergy* — a four-segment composition tells that story far better than a single %. | Pending (PFMO/SRH) |

### Governance & data systems readiness

| Indicator | Current Chart | Proposed Chart | Reason for Selection | Status |
|---|---|---|---|---|
| Number of planned work plan activities completed | Empty state | **Bullet chart (ghost): completed vs planned** | Completed-of-planned is the textbook bullet case — measure vs explicit target. | Pending (SRH sheet arm) |

---

## Stock Status

| Indicator | Current Chart | Proposed Chart | Reason for Selection | Status |
|---|---|---|---|---|
| Proportion of PHCs with all six tracer commodities available* (50.6% · 3 of 6) | Ring + thin bar | **Bullet chart with qualitative bands** | Composite "meets-ALL-items" availability vs a full-availability target — same shape (and hence same grammar) as maternal-health equipment. Partial-scope badge (3 of 6) retained. | Implemented |
| Proportion of facilities with the PPH bundle available* (19.7%) | Ring + thin bar | **Gauge chart with red/amber/green bands** | The most life-critical stock measure sitting deep in the red. A gauge's needle-in-the-red-zone is the strongest available "act now" encoding for a single criticality-graded value. | Implemented |
| Proportion of wards/main PHCs with functional cold-chain equipment (72.3%) | Ring + thin bar | **Donut: functional vs not functional** | Binary functional/not share of assessed sites — the same binary-share grammar as the financing donuts. The 27.7% non-functional slice is the operational target. | Implemented |
| Proportion of vaccines sufficient (50–80%) | Empty state | **Stock-band spectrum (ghost): 100% stacked band bar with this band highlighted** | The four vaccine-stock indicators are four bands of ONE distribution. Each card previews the full spectrum with its own band highlighted, so the family reads as a coherent whole the day the Vaccine/Stock dashboard connects. | Pending (Vaccine/Stock dashboard) |
| Proportion of vaccines at reorder level (25–50%) | Empty state | **Stock-band spectrum (ghost), reorder band highlighted** | As above. | Pending (Vaccine/Stock dashboard) |
| Proportion of vaccines understocked (<25%) | Empty state | **Stock-band spectrum (ghost), understocked band highlighted** | As above. | Pending (Vaccine/Stock dashboard) |
| Proportion of vaccines stocked out at the last mile | Empty state | **Stock-band spectrum (ghost), stock-out band highlighted** | As above. | Pending (Vaccine/Stock dashboard) |

---

## Service Delivery

### Service uptake & coverage

| Indicator | Current Chart | Proposed Chart | Reason for Selection | Status |
|---|---|---|---|---|
| Number of deliveries in facilities (23,849 latest month) | Thin bar | **KPI count + quarterly area trend** (real ETL trend series) | A volume whose story is trajectory. The snapshot already carries the real quarterly series — an area chart shows utilization momentum that a static bar cannot. | Implemented |
| Proportion of deliveries attended by a skilled birth attendant (100%) | Ring + thin bar | **Radial progress gauge + near-ceiling caveat badge** | Single saturation proportion. The meta's caveat (374 of 382 facilities report identical counts) surfaces as a visible badge so the 100% is read critically. | Implemented |
| % of women with a live birth who attended ANC 1 (81.2%) | Ring + thin bar | **Headline % + area trend** (real ETL trend series) | Coverage entry point with a real quarterly series — direction of travel is the decision-relevant fact. | Implemented |
| % of women with a live birth who attended ANC 4 (43.8%) | Ring + thin bar | **Two-stage funnel: ANC1 → ANC4 retention** | ANC4's meaning *is* the drop-off from ANC1 (81.2% → 43.8%, both real values from the same denominator). A funnel makes the lost-to-follow-up gap the headline insight. | Implemented |
| % of family planning clients using modern contraceptives (91.6%) | Ring + thin bar | **Donut: modern vs other methods** | A share of all FP clients — part-to-whole between exactly two method classes. | Implemented |
| % increase in utilization of FP services (−99.9%) | Ring + thin bar | **Diverging delta KPI (zero-centred bar + directional arrow)** | A signed change metric needs a zero-centred encoding; a 0–100 ring cannot express direction. The known incomplete-latest-month artifact is flagged on the card. | Implemented |
| Proportion of children <1 who received Penta 3 | Empty state | **Bullet chart (ghost)** | Immunization coverage vs programme target — bullet. | Pending (PFMO/Vaccine dashboard) |
| Proportion of children <1 who received Measles 1 | Empty state | **Bullet chart (ghost)** | As Penta 3. | Pending (PFMO) |
| Number of zero-dose children (burden) | Empty state | **KPI count + top-states bar (ghost, inverse colouring)** | A burden count whose insight is geographic concentration; inverse scale (more = worse). | Pending (Vaccine Financing dashboard) |
| Proportion of girls aged 9 who received the HPV vaccine dose | Empty state | **Radial progress (ghost)** | Single coverage proportion. | Pending (no source) |

### Outcomes

| Indicator | Current Chart | Proposed Chart | Reason for Selection | Status |
|---|---|---|---|---|
| Maternal Mortality Ratio — BHCPF vs non-BHCPF (44–340 / 100,000 facility deliveries) | Thin neutral bar | **Range (dumbbell) plot: SRH floor ↔ SFM ceiling** | The value *is* a bracketed range between two sources with opposite biases. A dumbbell renders the uncertainty honestly — a single bar would fabricate false precision the ETL deliberately refuses to. No good/bad colouring (neutral until PFMO's live-births denominator lands). | Implemented |
| Under-5 Mortality Rate — BHCPF vs non-BHCPF (5.09 / 1,000 facility deliveries) | Thin neutral bar | **Ungraded rate KPI (deliberately chart-free) with interim-proxy note** | A small-n neonatal proxy with a substituted denominator. Any chart would imply more certainty than exists; the honest presentation is the stated rate plus its caveat, with the per-state deep dive one click away. | Implemented |
| Proportion of maternal deaths resulting from PPH (21%) | Ring + thin bar | **Cause-share donut with PPH slice highlighted** | The three cause indicators share one denominator (747 SFM maternal deaths). Each card shows the full cause composition with its own cause emphasised — a share of deaths is a part-to-whole, and the sibling context makes 21% interpretable. | Implemented |
| Proportion of maternal deaths resulting from pre-eclampsia/eclampsia (25.4%) | Ring + thin bar | **Cause-share donut, pre-eclampsia slice highlighted** | As above. | Implemented |
| Proportion of maternal deaths resulting from sepsis (10.8%) | Ring + thin bar | **Cause-share donut, sepsis slice highlighted** | As above. | Implemented |

---

## Notes

- **Deep-dive modal** keeps its magnitude-ranked state bars / facility table — it remains the
  exploration surface; cards are the communication surface.
- **#49 BHCPF funds:** the received ÷ expected ratio still awaits PFMO's expected-amount side; the
  card headlines the real ₦ received until then.
- **Filters:** with an active scope, cards render the scoped value through the shared engine
  (unchanged); national-distribution mini-charts are suppressed in favour of the scoped display so
  no chart ever mislabels its scope. State-bar charts under a state-only filter highlight that state.
- Chart components live in `src/components/charts/mini/`; the per-indicator selection map lives in
  `src/components/dashboard/indicatorViz.ts`.
