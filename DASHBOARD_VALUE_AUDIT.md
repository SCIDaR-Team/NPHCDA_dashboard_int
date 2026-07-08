# NPHCDA Dashboard — Deep-Dive Value Audit

**Date:** 2026-07-08
**Scope:** Every value displayed across Overview, Facility Readiness, Stock Status, Service Delivery, Trend Analysis, Facility Deepdive (incl. map).
**Nature:** Validation & verification only — **no code was changed.**
**Snapshot audited:** `public/data-snapshot/measurements.json` (`generatedAt` 2026-07-06T19:58Z).
**Sources of truth:** `docs/Prioritized Indicators mapped to data sources.xlsx` (the mapping workbook; `docs/screenshots/*.png` are images of the same workbook), `docs/20260427_SfM_Data_Dictionary.xlsx`, `docs/PFMO/*`, and the raw datasets (`etl/data/MAMII.csv`, live SRH/SFM ODK, SRH Sheet, PFMO API).

---

## 1. Method

The dashboard has a clean, single-definition data path:

1. **ETL** (`etl/`) pulls each source, an **adapter** (`etl/sources/*.mjs`) maps raw columns → normalised fields, and **one** indicator engine (`etl/lib/indicators.mjs` → `buildIndicators`) computes every figure. Output → `measurements.json` (`indicators`, `kpis`, `trends`, `facts`, `facilities`).
2. **Default (unfiltered) display** reads `snapshot.indicators` directly (`SnapshotDataSource.overlayBlocks`). When **no filter** is active, `effectiveIndicatorValue()` returns `null`, so cards show the national snapshot value verbatim.
3. **Filtered display** re-runs the **exact same** `buildIndicators` in the browser (`src/data/scopedEngine.ts`) over the AND-filtered `facts` subset — so filtering never re-implements math.

Verification performed:

- **Column mapping**: cross-checked every prioritized indicator's adapter fields against the workbook's per-source "Column name on data source" columns.
- **Engine reproduction**: re-ran `buildIndicators` over the **shipped `facts`** and compared to `snapshot.indicators` → **26 / 28 reproduce exactly** (the 2 exceptions explained in §4).
- **Independent recomputation** of every MAMII and PFMO figure straight from the raw CSV / facts.
- **Filter simulation** across Kano / Lagos / Kebbi / Ebonyi to confirm scoping recomputes correctly.

**Headline result:** the source-to-indicator mapping and the calculation engine are **accurate and faithful to the workbook**. All material discrepancies trace to **one root cause — an incomplete final reporting month (Jun 2026) plus stray 2027-dated source rows** — which distort *period-over-period* figures (KPI deltas, the FP-increase card, and trend tails), not the point-in-time indicator values.

---

## 2. Findings register (ranked)

| # | Severity | Area | Issue |
|---|----------|------|-------|
| F1 | ❌ **High** | Service Delivery card #71 | **"% increase in utilization of FP services = −99.9%"** is a data artifact. The current month is **Jun 2026 with only 1 SRH facility reporting** (fp_total = 15 vs ~10,539 in Jan). Real Jan→May 2026 trend is roughly flat. |
| F2 | ⚠️ **High** | Overview KPI strip | The **"over period" deltas** are distorted by the same incomplete Jun 2026 month: Facility deliveries **−68.8%**, ANC1 **+15.6 pts**, Modern contraceptives **+10.9 pts**, PPH bundle **−8.4 pts**. All driven by the thin final month, not real change. |
| F3 | ⚠️ **Medium** | Trend Analysis | SRH rate trends (ANC1/ANC4/FP/PPH) have **no minimum-reporting-facility gate** (unlike the deliveries series' ≥20 gate), so the Jun 2026 tail spikes to **ANC1 100 %, FP 100 %, PPH 0 %** off a 1-facility sample. |
| F4 | ⚠️ **Low–Med** | Source data quality | SRH ODK carries **stray "May 2027" submissions (2 facilities)** and a **near-empty "Jun 2026" (1 facility)**. The 2027 rows create the spurious `period.quarters` → `"2027 Q2"` and `period.to = "2027 Q2"`. |
| F5 | ⚠️ **Low** | Stock/Readiness (#27, PFMO) | Shipped `facts.pfmo` **omit `facilityId`**, so the browser's per-facility dedup key (`state\|lga\|facility`) differs from the ETL's (`facilityId`). National #27 shows **6.8 % (n=20,094)**; recomputed-from-facts (the path used under **any** filter) gives **6.9 % (n=19,819)**. |
| F6 | ℹ️ Note | Overview KPI | Label **"Facility deliveries (latest month)"** shows **23,750**, which is the pooled *latest-per-facility* SRH+SFM total, **not** a single month (latest month ≈ 19,079). Mislabel. |
| F7 | ℹ️ Note | Trend Analysis | The Trend page **does not respond to dashboard filters** — trends are always national. The brief asks "filtering updates trends correctly"; currently it has no effect. |
| F8 | ℹ️ Note | Map (dead data) | `snapshot.stateScores` / `getStateScores()` are computed but **unused** (map uses `stateCompositeScore`). No accuracy impact. |
| F9 | ℹ️ Note | Facility Deepdive (assessed) | "Maternal Deaths" column is real only for SRH rows; **SFM & Sheet rows are hard-coded 0** (display "0", not "No data"). "Commodities available (#)" mixes semantics (SRH count vs SFM 5/0 PPH proxy). |
| F10 | ℹ️ Note | Map tooltip | Single-indicator map tooltip shows the **0–100 goodness score**, not the indicator's actual value; for inverse/neutral indicators (MMR) it paints every state ≈50/amber. |
| F11 | ℹ️ Note | MAMII adapter (latent) | `COL.cbhwAbsorbed` lacks the source header's **trailing space** (`'…absorbed '`) → lookup misses. **No current impact** (the column is all 0), but latent if data changes. |

---

## 3. What is CORRECT (verified)

**Source→column mapping** matches the workbook exactly for every prioritized indicator, including the three distinct SFM delivery fields correctly separated:
- `anc.tot_facility_deliveries` (#92 count, #97 denominator),
- `mnh_data.maternal_stats.total_facility_deliveries` (#58 SFM MMR denominator),
- `mnh_data.maternal_stats.total_deliveries` (#102/#103 ANC denominator).

**Independent recomputation matched the snapshot** for:
- **MAMII** — SBAs recruited 970, deployed 970 (100 %), ≥4-SBA pool 58.4 %, functional split L2 42.3 % / L1 57.7 % / partial 0 % / non-func 0 % (n=1,789), revitalized 757 across 153 LGAs, CBHW recruited 3,204 / trained 1,670 / deployed 52.1 % / absorbed 0 %. Note: MAMII's L2/L1/partial columns are **counts** despite headers reading "Proportion" — the engine correctly treats them as counts.
- **PFMO** — MMR 177/100k (1,527÷861,529), U5MR 3/1k, Penta3 94.9 % (1,732,962÷1,826,391), tracer-6 60.6 % (3,868÷6,381), essential-services 84 % (16,044÷19,109).
- **SFM** — cold-chain 72.9 %, SBA-attended 100 %, cause shares PPH 21 % / pre-eclampsia 25.5 % / sepsis 10.8 % (n=748).
- **SRH+SFM pooled** — deliveries 23,750, PPH bundle 19.3 %, ANC1 81.3 %, ANC4 43.5 %, FP modern 91.6 %, BHCPF disbursement 43.8 %, funds ₦38.4m.

**Filter scoping** recomputes correctly (validated per-state), and **26/28** indicators reproduce bit-for-bit from the shipped facts.

---

## 4. The two engine-reproduction exceptions

1. **Facility functional status** — computed by `transform.buildFunctionalStatus` (overlaid separately), not by `buildIndicators`; the browser uses a dedicated path (`functionalStatusByState`). Not a discrepancy.
2. **#27 maternal-health equipment** — the only real seam (F5): national 6.8 % vs facts-recompute 6.9 % because `facts.pfmo` drop `facilityId`. Magnitude ≈0.1 pp.

---

## 5. Per-indicator audit tables

Legend: ✅ correct · ⚠️ correct value but caveat/period-distortion · ❌ displayed value misleading/wrong. "Default value" = unfiltered national figure as shown.

### 5.1 Overview — KPI strip

| Indicator | Source | Numerator | Denominator | Calculation | Default Value | Filter | Status | Comments |
|---|---|---|---|---|---|---|---|---|
| ANC1 coverage | SRH+SFM | (livebirths−lb0)+SFM anc_one | livebirths+SFM total_deliveries | pooled ratio | 81.3 % | rescopes ✓ | ✅ | Value ✅. Delta **+15.6 pts** ⚠️ (F2 – Jun 2026 tail =100 %). |
| Facility deliveries | SRH+SFM | deliveries_total + tot_facility_deliveries | — (count) | additive sum | 23,750 | ✓ | ⚠️ | Value ✅ but **labelled "latest month"** (F6). Delta **−68.8 %** ⚠️ (F2). |
| Modern contraceptive use | SRH ODK | Σ6 modern methods | fp_total | ratio | 91.6 % | ✓ | ✅ | Value ✅. Delta **+10.9 pts** ⚠️ (F2). |
| PPH bundle availability | SRH+SFM | facilities all-5 available | facilities assessed | ratio | 19.3 % | ✓ | ✅ | Value ✅. Delta **−8.4 pts** ⚠️ (F2). |
| Maternal deaths from PPH (share) | SFM ODK | md_*_pph | total maternal deaths (mds) | ratio, all periods | 21 % | ✓ | ✅ | Correct; delta "Live". |
| Facilities with ≥4 SBAs | MAMII+Sheet | facilities SBA≥4 | facilities assessed | ratio, MAMII precedence | 58.4 % | ✓ | ✅ | Correct. |

### 5.2 Facility Readiness

| Indicator | Source | Numerator | Denominator | Default Value | Status | Comments |
|---|---|---|---|---|---|---|
| Facility functional status (L1/L2/partial/non-func) | MAMII | L2,L1,partial counts per LGA | total BHCPF facilities per LGA | L2 42.3 % · L1 57.7 % · partial 0 % · non-func 0 % | ✅ | Recomputed exactly (n=1,789/33 states). Non-func derived. BHCPF-vs-non split needs PFMO (not wired). |
| Number of revitalized PHC facilities | MAMII | revitalized PHCs per LGA | — (count) | 757 | ✅ | Across 153 LGAs; "#N/A" excluded. |
| Visited PHCs offering full essential package* | PFMO | all-6 services | PHCs reporting services | 84 % | ✅ | 16,044/19,109; 3-vocabulary matcher verified. |
| Visited PHCs w/ functional maternal equip* | PFMO | all-5 avail+functional | PHCs reporting equip | 6.8 % · 5 of 5 | ⚠️ | Correct method; **6.8 % vs 6.9 % facts-recompute** (F5 facilityId). |
| Number of SBAs recruited | MAMII | Σ recruited (facility) | — (count) | 970 | ✅ | pct=50 neutral (count indicator). |
| Proportion of SBAs deployed per state | MAMII | deployed | recruited | 100 % | ✅ | Recorded deployments = recruitments. |
| Number of CBHWs trained | MAMII | Σ trained (state-dedup) | — (count) | 1,670 | ✅ | |
| Proportion of CBHWs recruited | MAMII | Σ recruited (state-dedup) | — (no target denom) | "3,204 recruited" | ✅ | Shown as count (no planned denom in data) — matches workbook gap. |
| Proportion of CBHWs deployed per state | MAMII | deployed | recruited | 52.1 % | ✅ | 1,670/3,204. |
| % recruited CBHWs absorbed | MAMII | absorbed | recruited | 0 % | ✅ | Real 0. See F11 (latent trailing-space, no impact). |
| Facilities w/ minimum 4 SBAs | MAMII+Sheet | facilities SBA≥4 | facilities assessed | 58.4 % | ✅ | MAMII precedence per state. |
| BHCPF facilities received quarterly disbursement | SRH ODK | bhcpf_received=yes | facilities responding | 43.8 % | ✅ | On-time refinement (89 %) in meta. |
| Total BHCPF funds received vs expected | SRH ODK | Σ bhcpf_amount | *(expected not collected)* | "₦38.4m received" | ✅ | Ratio can't be computed — expected side absent (documented). |
| NHIA capitation / both gateways / workplan / govt-data | — | — | — | — (empty state) | ✅ | Correctly "Data not yet available" (no wired source). |

### 5.3 Stock Status

| Indicator | Source | Numerator | Denominator | Default Value | Status | Comments |
|---|---|---|---|---|---|---|
| PHCs with all six tracer commodities* | PFMO | all-6 tracers (incl. ACT+Penta) | PHCs reporting commodities | 60.6 % · 6 of 6 | ✅ | 3,868/6,381; recomputed exactly. |
| Facilities with PPH bundle available* | SRH+SFM | all-5 available (strict) | facilities assessed | 19.3 % | ✅ | SRH "available" / SFM "always_in_stock". |
| Wards/main PHCs functional cold-chain (SDD/CCE) | SFM ODK | cce = yes (strict) | facilities answering cce | 72.9 % | ✅ | yes_no_therm / yes_faulty excluded. |
| Vaccine stock bands (4 indicators) | Vaccine dashboard | — | — | — (empty) | ✅ | Correctly empty (source not connected). |

### 5.4 Service Delivery

| Indicator | Source | Numerator | Denominator | Default Value | Status | Comments |
|---|---|---|---|---|---|---|
| Number of deliveries in facilities | SRH+SFM | deliveries_total + tot_facility_deliveries | — | 23,750 | ✅ | Additive (disjoint state panels). |
| Deliveries by skilled birth attendant | SFM ODK | births_attended_by_sba | tot_facility_deliveries | 100 % | ✅ | SFM-only (SRH has no attended-delivery field). |
| ANC1 (live birth) | SRH+SFM | (livebirths−lb0)+anc_one | livebirths+total_deliveries | 81.3 % | ✅ | ≥1 visit; more complete than the workbook's literal `anc_livebirth_1_4` column (defensible). |
| ANC4 (live birth) | SRH+SFM | (lb5_7+lb8plus)+anc_four | livebirths+total_deliveries | 43.5 % | ✅ | ≥5 proxy for ≥4 (bucket can't isolate exactly-4); documented floor. |
| FP clients using modern contraceptives | SRH ODK | Σ6 modern methods | fp_total | 91.6 % | ✅ | Condoms excluded per workbook. |
| **% increase in utilization of FP services** | SRH ODK | current − baseline month | baseline month | **−99.9 %** | ❌ | **F1** — current = Jun 2026 (1 facility, fp=15). Should compare complete months (Jan→May ≈ flat). |
| Penta 3 (children <1yr) | PFMO | penta3 | penta1 *(target pop unavailable)* | 94.9 % (Penta3/Penta1) | ✅ | Completion proxy (documented). |
| Maternal Mortality Ratio | PFMO | maternal_deaths_monthly | live_births_monthly ×100k | 177 / 100,000 | ✅ | True live-births denom; not yet BHCPF-split; pct neutral. |
| Under-5 Mortality Rate | PFMO | under5_deaths_monthly | live_births_monthly ×1k | 3 / 1,000 | ✅ | Facility-recorded; pct neutral. |
| Maternal deaths from PPH / pre-eclampsia / sepsis | SFM ODK | cause sub-fields | total maternal deaths (748) | 21 % / 25.5 % / 10.8 % | ✅ | SFM-only (SRH n=10 too small); documented. |
| Measles 1 / zero-dose / HPV | PFMO / Vaccine | — | — | — (empty) | ✅ | Correctly empty. |

---

## 6. Map validation (Overview)

- **Default fill** = `stateCompositeScore(state)` — the mean 0–100 goodness of ~8 curated profile indicators the state has data for (`components/map/stateProfile.ts`); inverse-aware. States with no data are greyed. **Correct & consistent** with the per-state engine (`stateMeasures`).
- **Single-indicator fill** = real per-state goodness from the shared engine (`stateMeasures(name)`), inverse-aware, absent states greyed. **Correct.**
- **Choropleth** = `heatColor()` red→amber→green over 0–100. **Correct.**
- **Filter behaviour**: filter highlights/dims states (`highlight`) but the fill stays the composite/indicator value — states are not recoloured to the filtered subset (by design). ✅
- ⚠️ **F10**: tooltip "Value: N" is the goodness score (0–100), not the indicator's real value; diverges for inverse/neutral indicators (MMR → ~50 everywhere).
- ℹ️ **F8**: `stateScores` snapshot field is unused.

---

## 7. Trend Analysis validation

- **Source/mapping**: 9 national series, all from the correct sources; SRH rate series from SRH, deliveries from the deep SFM panel, PFMO rates (MMR/U5MR/Penta3) + live-births from PFMO. Names carry `(count)`/`(%)` so roll-up uses **sum vs mean** correctly.
- **Time frame**: 42-month frame Jan 2023→Jun 2026, aligned ETL↔frontend (`MONTH_LABELS` ≡ `monthLabels`); quarter/year roll-ups aligned. ✅ The stray May 2027 rows fall outside the frame and are correctly dropped from the plot.
- ⚠️ **F3**: Jun 2026 tail anomalies (ANC1 100 %, ANC4 33 %, FP 100 %, PPH 0 %) off a 1-facility sample — SRH rate series lack the ≥N-facility gate the deliveries series has.
- ⚠️ PFMO monthly series are volatile (e.g. MMR Apr 2026 = 408 vs ~110 neighbours; live births swing 72k–387k) due to swings in reporting volume — mitigated by the ≥500-facility gate and rate-based trending, but the tail should be read with care.
- ℹ️ **F7**: Trend page ignores dashboard filters (always national).

---

## 8. Facility Deepdive validation

**Assessed roster (637, SRH/SFM/Sheet)** — State→LGA→Facility matrix.
- Type / Functional status / Commodities columns come from `buildFacilities`. ✅ structure.
- ⚠️ **F9**: "Maternal Deaths" real only for SRH rows (SFM/Sheet hard-coded 0, shown as "0"). "Commodities available (#)" mixes SRH count vs SFM 5/0 PPH proxy. `penta3` column correctly removed (working-tree change to `config.ts`).
- KPI tiles (assessed/CEmONC/BEmONC/L2/states) computed over the filtered rows. ✅
- Local + global filters compound correctly (state/LGA/search/type/zone/donor). ✅

**National PHC registry (PFMO, ~28k)** — separate universe (`pfmoRegistry.ts`).
- One row per facility; flow fields **summed across months**, Penta3 = penta3÷penta1 (matches #87). ✅
- Registry ignores facilityType/ward filters (PFMO has neither) — intentional so those filters don't empty the table. ✅
- ℹ️ Uses `state|lga|full-name` key (facilityId absent from facts) — same root as F5; here it only affects how two same-named facilities merge into one registry row (cosmetic).

---

## 9. Recommendations (for the fix phase — not yet applied)

1. **F1/F2/F3 (root cause):** Exclude or gate **incomplete reporting months**. Options: (a) gate SRH rate trends by a minimum reporting-facility floor (mirror the deliveries ≥20 gate); (b) compute #71 and KPI "over period" deltas over the **last complete month** (or a rolling window), not the raw latest month. This single fix corrects the FP −99.9 % card, the four KPI deltas, and the trend tails.
2. **F4:** Clean stray-dated source rows (drop submissions dated outside the reporting window, e.g. 2027) at the adapter, and recompute `period` so `period.to` isn't "2027 Q2".
3. **F5:** Ship `facilityId` in the slim `facts.pfmo` (or pre-dedupe PFMO `allRecords` to one row per facility-month by `facilityId` before slimming) so the browser per-facility key matches the ETL — aligning filtered PFMO status indicators (#17/#27/#47) with the national headline.
4. **F6:** Relabel the deliveries KPI (e.g. "Facility deliveries (current)") or feed it the true latest-month value.
5. **F7:** Decide whether Trend Analysis should honour filters; if yes, wire scoped trends (the engine already supports per-scope aggregation).
6. **F9:** Render non-sourced assessed cells ("Maternal Deaths" for SFM/Sheet) as "No data" rather than 0; consider splitting the commodity column by source semantics.
7. **F10:** Show the indicator's real value in the map tooltip (not the goodness score).
8. **F8/F11:** Remove the unused `stateScores` path; fix the `cbhwAbsorbed` header trailing space (latent).

**Bottom line:** the indicator engine, source mapping, and filter/scoping logic are **sound and verifiably accurate**. Confidence in the *point-in-time* values is high. The remaining risk is concentrated in **period-over-period figures** distorted by one incomplete month — addressing recommendation 1 restores full confidence.
