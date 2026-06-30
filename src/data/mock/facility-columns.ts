import type { FacilityColumn } from '../types';

/** Columns available in the Facility Deepdive matrix. `always` columns can't be hidden. */
export const FD_COLUMNS: FacilityColumn[] = [
  {key:'type', label:'Type', always:true},
  {key:'status', label:'Functional Status', always:true},
  {key:'tracer', label:'Tracer Commodities %', always:false},
  {key:'satisfaction', label:'Patient Satisfaction %', always:false},
  {key:'penta3', label:'Penta 3 %', always:false},
  {key:'maternalDeaths', label:'Maternal Deaths', always:false},
];
