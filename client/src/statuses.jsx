import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { listStatuses, listProjectStatuses } from './api.js';

// The user's workflow statuses, loaded once and shared. Task rows, the board,
// filters, and the editor all read status display (name/color/is_done) from here
// by status_id, so custom statuses flow everywhere without prop-drilling.
const StatusesContext = createContext(null);

const FALLBACK = { id: null, name: '—', color: 'gray', is_done: 0 };

export function StatusesProvider({ children }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    () =>
      listStatuses()
        .then(setStatuses)
        .catch(() => {})
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <StatusesContext.Provider value={{ statuses, loading, refresh }}>
      {children}
    </StatusesContext.Provider>
  );
}

// Overrides the statuses context for a single project's subtree with that
// project's OWNER's statuses (so a shared project's tasks resolve their status_id
// against the set they were tagged with, not the viewer's own). Reuses the same
// context, so useStatuses() inside just works.
export function ProjectStatusesProvider({ projectId, children }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (projectId == null) return Promise.resolve();
    setLoading(true);
    return listProjectStatuses(projectId)
      .then(setStatuses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <StatusesContext.Provider value={{ statuses, loading, refresh }}>
      {children}
    </StatusesContext.Provider>
  );
}

export function useStatuses() {
  const ctx = useContext(StatusesContext);
  const statuses = ctx?.statuses ?? [];
  return {
    statuses,
    loading: ctx?.loading ?? false,
    refresh: ctx?.refresh ?? (() => {}),
    // Look up a status by id (never returns undefined — falls back to a neutral one).
    statusById: (id) => statuses.find((s) => s.id === id) ?? FALLBACK,
    // Map of id → position, for sorting tasks by workflow order.
    positionById: Object.fromEntries(statuses.map((s, i) => [s.id, i])),
  };
}
