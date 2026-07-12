import { Badge, ColorSwatch, Menu } from '@mantine/core';
import { Check } from 'lucide-react';
import { useStatuses } from '../statuses.jsx';

// A status Badge that opens a Menu to pick any of the workflow statuses. Renders
// a plain, non-interactive badge when !canEdit. Shared by TaskCard and Subtasks
// so both read the same set via useStatuses() — which the surrounding
// ProjectStatusesProvider scopes to the project OWNER for shared projects.
export default function StatusPicker({ statusId, onChange, canEdit = true, size, w = 110 }) {
  const { statuses, statusById } = useStatuses();
  const status = statusById(statusId);
  const badge = (
    <Badge
      color={status.color}
      variant={status.is_done ? 'filled' : 'light'}
      size={size}
      w={w}
      aria-label={canEdit ? `Status: ${status.name} — change` : `Status: ${status.name}`}
      style={{ cursor: canEdit ? 'pointer' : 'default', flexShrink: 0 }}
    >
      {status.name}
    </Badge>
  );
  if (!canEdit) return badge;
  return (
    <Menu shadow="md" width={180} position="bottom-start" withinPortal>
      <Menu.Target>{badge}</Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Set status</Menu.Label>
        {statuses.map((s) => (
          <Menu.Item
            key={s.id}
            leftSection={
              <ColorSwatch
                color={`var(--mantine-color-${s.color}-6)`}
                size={12}
                withShadow={false}
              />
            }
            rightSection={s.id === statusId ? <Check size={14} /> : null}
            onClick={() => onChange(s.id)}
          >
            {s.name}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
