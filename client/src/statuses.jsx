import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { listStatuses } from './api.js';

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
