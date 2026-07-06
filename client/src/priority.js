// Task priority levels (stored 0–4). One source of truth for labels + colors so
// the edit modal, the row indicator, and sorting stay consistent.
export const PRIORITIES = [
  { value: 0, label: 'None', color: 'gray' },
  { value: 1, label: 'Low', color: 'gray' },
  { value: 2, label: 'Medium', color: 'amber' },
  { value: 3, label: 'High', color: 'orange' },
  { value: 4, label: 'Urgent', color: 'red' },
];

export const PRIORITY_META = Object.fromEntries(PRIORITIES.map((p) => [p.value, p]));

// Options for a Mantine <Select> (string values).
export const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({
  value: String(p.value),
  label: p.label,
}));
