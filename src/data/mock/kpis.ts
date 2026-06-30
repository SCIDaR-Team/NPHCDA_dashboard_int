import type { KpiGroup } from '../types';

/**
 * Headline KPI cards shown at the top of the Overview page.
 * Values, sparklines, targets and `inverse` flags are preserved verbatim.
 */
export const kpiGroups: KpiGroup[] = [
  { group:"Key outcomes", cards:[
    {label:"Maternal Mortality Ratio (per 100,000 live births)", value:"612", delta:"-9.4% YoY", dir:"up", target:"Target: <300 by 2026", spark:[720,705,690,668,652,640,625,612], pct:45, inverse:true},
    {label:"Under-5 Mortality Rate (per 1,000 live births)", value:"94", delta:"-6.1% YoY", dir:"up", target:"Target: <70 by 2026", spark:[118,113,109,104,101,98,96,94], pct:42, inverse:true},
  ]},
  { group:"Coverage", cards:[
    {label:"Penta 3 Coverage", value:"86.4%", delta:"+4.2 pts YoY", dir:"up", target:"Target: 95%", spark:[75,77,79,81,82,84,85,86], ring:86.4, pct:86.4, inverse:false},
    {label:"Zero-Dose Children", value:"13.8%", delta:"-3.1 pts YoY", dir:"up", target:"Target: <5%", spark:[22,20,19,17,16,15,14,14], ring:13.8, ringInverse:true, pct:13.8, inverse:true},
  ]},
  { group:"System &amp; trust", cards:[
    {label:"Wards with 1+ Functional PHC", value:"68.2%", delta:"+5.0 pts YoY", dir:"up", target:"Target: 100% by 2028", spark:[55,57,59,61,63,65,67,68], ring:68.2, pct:68.2, inverse:false},
    {label:"Patient Satisfaction Composite", value:"76.9%", delta:"+3.4 pts YoY", dir:"up", target:"Re-establish trust (community engagement)", spark:[58,61,64,67,70,73,75,77], ring:76.9, pct:76.9, inverse:false},
  ]},
];
