/**
 * The maternal-death cause shares.
 *
 * These three indicators divide ONE denominator — total recorded maternal deaths —
 * so they are presented as a single merged card and split by cause in the deep dive,
 * where a derived "Others" series carries the remainder they leave unattributed.
 *
 * Defined in the data layer because both the presentation layer and the snapshot
 * loader need the canonical list; the loader must not reach up into components.
 */
export const CAUSE_INDICATORS: Record<string, string> = {
  PPH: 'Proportion of maternal deaths resulting from PPH',
  'Pre-eclampsia/eclampsia': 'Proportion of maternal deaths resulting from pre-eclampsia/eclampsia',
  Sepsis: 'Proportion of maternal deaths resulting from sepsis',
};

/** The indicator that hosts the merged card; the other two fold into it. */
export const CAUSE_HOST_INDICATOR = CAUSE_INDICATORS.PPH;

export const CAUSE_INDICATOR_NAMES = Object.values(CAUSE_INDICATORS);

/** Title for the merged card — it no longer stands for any single cause. */
export const CAUSE_CARD_TITLE = 'Maternal deaths by cause';
