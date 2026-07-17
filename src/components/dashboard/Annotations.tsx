import { useMemo, useState } from 'react';
import { MessageSquarePlus, Trash2, StickyNote } from 'lucide-react';
import { useAnnotationStore, type AnnotationTarget } from '@/store/annotationStore';
import { relativeTime } from '@/lib/freshness';

/**
 * Notes/annotations panel for an indicator or facility. Local analyst notebook:
 * add free-text notes that persist in the browser and surface on the deep-dive /
 * profile. Reactive (subscribes to the store) so a new note appears immediately.
 */
export function Annotations({
  targetType,
  targetId,
  targetLabel,
  compact = false,
}: {
  targetType: AnnotationTarget;
  targetId: string;
  targetLabel: string;
  compact?: boolean;
}) {
  const all = useAnnotationStore((s) => s.annotations);
  const add = useAnnotationStore((s) => s.add);
  const remove = useAnnotationStore((s) => s.remove);
  const [text, setText] = useState('');

  const notes = useMemo(
    () =>
      all
        .filter((n) => n.targetType === targetType && n.targetId === targetId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [all, targetType, targetId]
  );

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    add({ targetType, targetId, targetLabel, text: t, author: 'You' });
    setText('');
  };

  return (
    <div className={compact ? '' : 'rounded-lg border border-border bg-bg-elev-2/40 p-3.5'}>
      <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-muted-2">
        <StickyNote size={13} /> Notes {notes.length > 0 && <span className="text-muted">({notes.length})</span>}
      </div>

      <div className="flex items-start gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
          }}
          rows={2}
          placeholder="Add a note, caveat or follow-up…"
          className="min-h-[38px] flex-1 resize-y rounded-lg border border-border bg-bg-elev px-3 py-2 text-[13px] text-text placeholder:text-muted-2 focus-visible:ring-2 focus-visible:ring-brand/60"
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-bold text-white transition-colors hover:bg-brand-bright focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-40"
        >
          <MessageSquarePlus size={15} /> Add
        </button>
      </div>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-lg border border-border-soft bg-bg-elev px-3 py-2">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-soft">{n.text}</p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-2">
                <span>
                  {n.author} · {relativeTime(new Date(n.createdAt).toISOString()) || 'just now'}
                </span>
                <button
                  onClick={() => remove(n.id)}
                  aria-label="Delete note"
                  className="rounded p-0.5 text-muted-2 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
