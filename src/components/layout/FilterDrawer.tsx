import { useMemo, useState, useEffect } from 'react';
import { RotateCcw, Bookmark } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button, Input, Select, FieldLabel } from '@/components/ui';
import { useFilterStore, EMPTY_FILTER } from '@/store/filterStore';
import { useSavedViewsStore } from '@/store/savedViewsStore';
import { useNotificationStore } from '@/store/notificationStore';
import { ALL_STATES, ZONE_STATES, ZONE_OF_STATE, ALL_DONORS } from '@/data/geo/states';
import { FD_DATA } from '@/data/mock/facilities';
import { lgasForState, wardsForLga, monthLabels } from '@/data/calculations';
import type { FilterState } from '@/data/types';
import { useLocation } from 'react-router-dom';

const toOpts = (vals: string[], placeholder: string) => [
  { value: '', label: placeholder },
  ...vals.map((v) => ({ value: v, label: v })),
];

export function FilterDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useFilterStore();
  const [draft, setDraft] = useState<FilterState>({ ...EMPTY_FILTER });
  const addView = useSavedViewsStore((s) => s.add);
  const toast = useNotificationStore((s) => s.toast);
  const location = useLocation();

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
        facility: store.facility,
        period: store.period,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch: Partial<FilterState>) => setDraft((d) => ({ ...d, ...patch }));

  // Cascading option lists.
  const stateOptions = useMemo(() => {
    const list = draft.zone ? ZONE_STATES[draft.zone] : ALL_STATES;
    return toOpts([...list].sort(), 'All states');
  }, [draft.zone]);

  const lgaOptions = useMemo(
    () => (draft.state ? toOpts(lgasForState(draft.state), 'All LGAs') : toOpts([], 'All LGAs')),
    [draft.state]
  );

  const wardOptions = useMemo(
    () => (draft.lga ? toOpts(wardsForLga(draft.lga), 'All wards') : toOpts([], 'All wards')),
    [draft.lga]
  );

  const facilityOptions = useMemo(() => {
    let rows = FD_DATA;
    if (draft.state) rows = rows.filter((r) => r.state === draft.state);
    if (draft.lga) rows = rows.filter((r) => r.lga === draft.lga);
    if (draft.ward) rows = rows.filter((r) => r.ward === draft.ward);
    return toOpts(rows.map((r) => r.facility), 'All facilities');
  }, [draft.state, draft.lga, draft.ward]);

  const periodOptions = useMemo(() => toOpts([...monthLabels].reverse(), 'Latest month'), []);

  const onZone = (zone: string) => set({ zone, state: '', lga: '', ward: '', facility: '' });
  const onState = (state: string) =>
    set({
      state,
      zone: state ? ZONE_OF_STATE[state] : draft.zone,
      lga: '',
      ward: '',
      facility: '',
    });
  const onLga = (lga: string) => set({ lga, ward: '', facility: '' });
  const onWard = (ward: string) => set({ ward, facility: '' });

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
      [draft.state, draft.zone, draft.donor].filter(Boolean).join(' · ') || 'Full national scope';
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
            options={toOpts(ALL_DONORS, 'All donors / programmes')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Zone</FieldLabel>
            <Select
              value={draft.zone}
              onChange={(e) => onZone(e.target.value)}
              options={toOpts(Object.keys(ZONE_STATES), 'All zones')}
            />
          </div>
          <div>
            <FieldLabel>State</FieldLabel>
            <Select value={draft.state} onChange={(e) => onState(e.target.value)} options={stateOptions} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>LGA</FieldLabel>
            <Select
              value={draft.lga}
              onChange={(e) => onLga(e.target.value)}
              options={lgaOptions}
              disabled={!draft.state}
            />
          </div>
          <div>
            <FieldLabel>Ward</FieldLabel>
            <Select
              value={draft.ward}
              onChange={(e) => onWard(e.target.value)}
              options={wardOptions}
              disabled={!draft.lga}
            />
          </div>
        </div>
        <div>
          <FieldLabel>Facility</FieldLabel>
          <Select
            value={draft.facility}
            onChange={(e) => set({ facility: e.target.value })}
            options={facilityOptions}
          />
        </div>
        <div>
          <FieldLabel>Reporting period</FieldLabel>
          <Select
            value={draft.period}
            onChange={(e) => set({ period: e.target.value })}
            options={periodOptions}
          />
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
