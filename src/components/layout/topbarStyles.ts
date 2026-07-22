/**
 * Shared chrome for topbar icon controls.
 *
 * The toolbar reads as one system: every interactive icon carries the brand
 * green, which lifts it off the neutral header and separates the app's controls
 * from page content. Labels on the wider buttons (Filters, Search) stay neutral
 * so the green icon leads and the text stays legible.
 */
export const TOPBAR_ICON_BTN =
  'flex h-9 w-9 items-center justify-center rounded-lg text-brand-bright transition-colors hover:bg-brand/12';

/**
 * Active state for stateful toggles. Since every icon is already green, an
 * enabled toggle is marked by its chip — not by colour alone, which also keeps
 * the signal readable for colour-vision-deficient users.
 */
export const TOPBAR_ICON_BTN_ON = 'bg-brand/12 ring-1 ring-inset ring-brand/40';

/** Icons that sit inside a wider labelled button (Filters, Search). */
export const TOPBAR_LEAD_ICON = 'text-brand-bright';
