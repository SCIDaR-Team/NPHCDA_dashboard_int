import { useMemo, useState, useEffect } from 'react';
import { RotateCcw, Bookmark } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button, Input, Select, FieldLabel } from '@/components/ui';
import { useFilterStore, EMPTY_FILTER } from '@/store/filterStore';
import { useSavedViewsStore } from '@/store/savedViewsStore';
import { useNotificationStore } from '@/store/notificationStore';
import { ZONE_OF_STATE } from '@/data/geo/states';
import { getDataSource } from '@/data/datasource';
import { useAsync } from '@/hooks/useAsync';
import type { FilterState } from '@/data/types';
import { useLocation } from 'react-router-dom';
import { useSnapshotStore } from '@/store/snapshotStore';

/** Minimal geography shape the option lists key on (roster rows + MAMII facts). */
interface GeoRow {
  state: string;
  zone?: string;
  donor?: string[];
  lga: string;
  facility: string;
  type: string | null;
}

const toOpts = (vals: string[], placeholder: string) => [
  { value: '', label: placeholder },
  ...vals.map((v) => ({ value: v, label: v })),
];
const distinct = (vals: (string | undefined | null)[]) =>
  Array.from(new Set(vals.filter((v): v is string => !!v))).sort();

export function FilterDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useFilterStore();
  const [draft, setDraft] = useState<FilterState>({ ...EMPTY_FILTER });
  const addView = useSavedViewsStore((s) => s.add);
  const toast = useNotificationStore((s) => s.toast);
  const location = useLocation();

  // Every option list is derived from REAL data, so any value the user can pick
  // corresponds to data that actually exists: the facility register PLUS MAMII's
  // geography (its 19 extra states / their LGAs & facilities), so MAMII-covered
  // states are selectable and its indicators rescope. MAMII rows are added for
  // option-building only — they never enter the roster / Facility Deepdive (MAMII
  // carries no per-facility metrics or functional status).
  const ds = getDataSource();
  const { data: facilities } = useAsync(() => ds.getFacilities());
  const mamiiFacts = useSnapshotStore((s) => s.facts?.mamii);
  const FAC = useMemo<GeoRow[]>(() => {
    const roster: GeoRow[] = (facilities ?? []).map((f) => ({
      state: f.state, zone: f.zone, donor: f.donor, lga: f.lga, facility: f.facility, type: f.type,
    }));
    const mamiiGeo: GeoRow[] = (mamiiFacts ?? []).map((r) => ({
      state: r.state, zone: r.zone, donor: r.donor, lga: r.lga, facility: r.facility, type: null,
    }));
    return [...roster, ...mamiiGeo];
  }, [facilities, mamiiFacts]);

  // Sync draft from the live store whenever the drawer opens.
  useEffect(() => {
    if (open) {
      setDraft({
        search: store.search,
        donor: store.donor,
        zone: store.zone,
        state: store.state,
        lga: store.lga,
        ward: store.ward,
        facilityType: store.facilityType,
        facility: store.facility,
        year: store.year,
        month: store.month,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch: Partial<FilterState>) => setDraft((d) => ({ ...d, ...patch }));

  const zoneOptions = useMemo(() => distinct(FAC.map((f) => f.zone)), [FAC]);
  const donorOptions = useMemo(() => distinct(FAC.flatMap((f) => f.donor ?? [])), [FAC]);
  const typeOptions = useMemo(() => distinct(FAC.map((f) => f.type)), [FAC]);

  const stateOptions = useMemo(() => {
    const src = draft.zone ? FAC.filter((f) => f.zone === draft.zone) : FAC;
    return toOpts(distinct(src.map((f) => f.state)), 'All states');
  }, [FAC, draft.zone]);

  const lgaOptions = useMemo(
    () => (draft.state ? toOpts(distinct(FAC.filter((f) => f.state === draft.state).map((f) => f.lga)), 'All LGAs') : toOpts([], 'All LGAs')),
    [FAC, draft.state]
  );

  const facilityOptions = useMemo(() => {
    let src = FAC;
    if (draft.state) src = src.filter((f) => f.state === draft.state);
    if (draft.lga) src = src.filter((f) => f.lga === draft.lga);
    if (draft.facilityType) src = src.filter((f) => f.type === draft.facilityType);
    return toOpts(distinct(src.map((f) => f.facility)), 'All facilities');
  }, [FAC, draft.state, draft.lga, draft.facilityType]);

  const yearOptions = useMemo(() => ['2026', '2025'], []);
  const monthOptions = useMemo(
    () => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    []
  );

  const onZone = (zone: string) => set({ zone, state: '', lga: '', facility: '' });
  const onState = (state: string) =>
    set({ state, zone: state ? ZONE_OF_STATE[state] ?? draft.zone : draft.zone, lga: '', facility: '' });
  const onLga = (lga: string) => set({ lga, facility: '' });
  const onType = (facilityType: string) => set({ facilityType, facility: '' });

  const apply = () => {
    store.apply(draft);
    onClose();
  };

  const reset = () => {
    setDraft({ ...EMPTY_FILTER });
    store.reset();
  };

  const saveView = () => {
    store.apply(draft);
    const label =
      [draft.state, draft.zone, draft.donor, draft.facilityType].filter(Boolean).join(' · ') || 'Full national scope';
    addView({ name: label, page: location.pathname, filter: draft });
    toast({ tone: 'success', title: 'View saved', description: label });
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Refine the dashboard scope"
      side="left"
      width={372}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="primary" className="flex-1" onClick={apply}>
            Apply filters
          </Button>
          <Button variant="secondary" size="icon" title="Save as view" onClick={saveView}>
            <Bookmark size={16} />
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Search facility</FieldLabel>
          <Input
            placeholder="Type a facility name…"
            value={draft.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Donor / programme</FieldLabel>
          <Select
            value={draft.donor}
            onChange={(e) => set({ donor: e.target.value })}
            options={toOpts(donorOptions, 'All donors / programmes')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Zone</FieldLabel>
            <Select value={draft.zone} onChange={(e) => onZone(e.target.value)} options={toOpts(zoneOptions, 'All zones')} />
          </div>
          <div>
            <FieldLabel>State</FieldLabel>
            <Select value={draft.state} onChange={(e) => onState(e.target.value)} options={stateOptions} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>LGA</FieldLabel>
            <Select value={draft.lga} onChange={(e) => onLga(e.target.value)} options={lgaOptions} disabled={!draft.state} />
          </div>
          <div>
            <FieldLabel>Ward</FieldLabel>
            <Select value="" onChange={() => {}} options={[{ value: '', label: 'Not collected' }]} disabled />
            <p className="mt-1 text-[10px] leading-snug text-muted">Ward is not collected by any source yet.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Facility type</FieldLabel>
            <Select value={draft.facilityType} onChange={(e) => onType(e.target.value)} options={toOpts(typeOptions, 'All types')} />
          </div>
          <div>
            <FieldLabel>Facility</FieldLabel>
            <Select value={draft.facility} onChange={(e) => set({ facility: e.target.value })} options={facilityOptions} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Year</FieldLabel>
            <Select value={draft.year} onChange={(e) => set({ year: e.target.value })} options={toOpts(yearOptions, 'All years')} />
          </div>
          <div>
            <FieldLabel>Month</FieldLabel>
            <Select value={draft.month} onChange={(e) => set({ month: e.target.value })} options={toOpts(monthOptions, 'All months')} />
          </div>
        </div>

        <button
          onClick={reset}
          className="mt-2 flex items-center gap-2 text-xs font-semibold text-muted transition-colors hover:text-text"
        >
          <RotateCcw size={13} /> Reset all filters
        </button>
      </div>
    </Drawer>
  );
}
