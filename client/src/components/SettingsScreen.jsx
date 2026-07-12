import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  ColorSwatch,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import {
  createLabel,
  createStatus,
  deleteLabel,
  deleteStatus,
  listLabels,
  reorderStatuses,
  updateLabel,
  updateStatus,
} from '../api.js';
import { notifyError } from '../notify.js';
import { useStatuses } from '../statuses.jsx';

const COLORS = [
  'gray',
  'teal',
  'amber',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'cyan',
  'indigo',
  'violet',
  'grape',
  'pink',
];
const swatch = (c) => `var(--mantine-color-${c}-6)`;

function ColorSelect({ value, onChange }) {
  return (
    <Select
      aria-label="Colour"
      w={64}
      data={COLORS.map((c) => ({ value: c, label: c }))}
      value={value}
      onChange={(v) => onChange(v ?? 'gray')}
      allowDeselect={false}
      leftSection={<ColorSwatch color={swatch(value)} size={14} withShadow={false} />}
      leftSectionWidth={28}
      renderOption={({ option }) => (
        <ColorSwatch color={swatch(option.value)} size={16} withShadow={false} />
      )}
      comboboxProps={{ width: 60 }}
    />
  );
}

export default function SettingsScreen() {
  return (
    <Stack gap="xl" maw={720}>
      <Title order={2}>Settings</Title>
      <StatusesPanel />
      <LabelsPanel />
    </Stack>
  );
}

// --- Workflow statuses ---
function StatusesPanel() {
  const { statuses, refresh } = useStatuses();
  const [name, setName] = useState('');
  const [color, setColor] = useState('gray');
  const [busy, setBusy] = useState(false);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createStatus({ name: trimmed, color });
      setName('');
      setColor('gray');
      await refresh();
    } catch (err) {
      notifyError(err, 'Could not add status');
    } finally {
      setBusy(false);
    }
  }

  async function save(status, patch) {
    try {
      await updateStatus(status.id, patch);
      await refresh();
    } catch (err) {
      notifyError(err, 'Could not update status');
    }
  }

  async function remove(status) {
    try {
      await deleteStatus(status.id);
      await refresh();
    } catch (err) {
      notifyError(err, 'Could not delete status');
    }
  }

  async function move(index, dir) {
    const next = [...statuses];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    try {
      await reorderStatuses(next.map((s) => s.id));
      await refresh();
    } catch (err) {
      notifyError(err, 'Could not reorder statuses');
    }
  }

  return (
    <Paper withBorder p="lg" radius="lg">
      <Title order={4}>Workflow statuses</Title>
      <Text size="sm" c="dimmed" mt={4} mb="md">
        The states a task moves through — they become your board columns. “Counts as done” marks a
        state as complete (drives progress and overdue).
      </Text>

      <Stack gap="xs">
        {statuses.map((status, i) => (
          <StatusRow
            key={status.id}
            status={status}
            first={i === 0}
            last={i === statuses.length - 1}
            onSave={save}
            onRemove={remove}
            onMoveUp={() => move(i, -1)}
            onMoveDown={() => move(i, 1)}
          />
        ))}
      </Stack>

      <Group gap="xs" wrap="nowrap" mt="md" align="flex-end">
        <ColorSelect value={color} onChange={setColor} />
        <TextInput
          style={{ flex: 1 }}
          placeholder="New status"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button leftSection={<Plus size={15} />} onClick={add} loading={busy}>
          Add status
        </Button>
      </Group>
    </Paper>
  );
}

function StatusRow({ status, first, last, onSave, onRemove, onMoveUp, onMoveDown }) {
  const [name, setName] = useState(status.name);
  useEffect(() => setName(status.name), [status.name]);
  return (
    <Group gap="xs" wrap="nowrap">
      <Stack gap={0}>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Move up"
          disabled={first}
          onClick={onMoveUp}
        >
          <ArrowUp size={13} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Move down"
          disabled={last}
          onClick={onMoveDown}
        >
          <ArrowDown size={13} />
        </ActionIcon>
      </Stack>
      <ColorSelect value={status.color} onChange={(c) => onSave(status, { color: c })} />
      <TextInput
        style={{ flex: 1 }}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSave(status, { name: name.trim() })}
        onBlur={() => name.trim() && name !== status.name && onSave(status, { name: name.trim() })}
      />
      <Checkbox
        label="Done"
        checked={!!status.is_done}
        onChange={(e) => onSave(status, { isDone: e.currentTarget.checked })}
      />
      <ActionIcon
        variant="light"
        aria-label="Save status"
        onClick={() => onSave(status, { name: name.trim() })}
      >
        <Check size={16} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="red"
        aria-label="Delete status"
        onClick={() => onRemove(status)}
      >
        <Trash2 size={16} />
      </ActionIcon>
    </Group>
  );
}

// --- Label library ---
function LabelsPanel() {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [color, setColor] = useState('teal');

  async function refresh() {
    setLoading(true);
    try {
      setLabels(await listLabels());
    } catch (err) {
      notifyError(err, 'Could not load labels');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createLabel(trimmed, color);
      setName('');
      setColor('teal');
      refresh();
    } catch (err) {
      notifyError(err, 'Could not add label');
    }
  }

  async function save(label, patch) {
    try {
      await updateLabel(label.id, patch);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not update label');
    }
  }

  async function remove(label) {
    try {
      await deleteLabel(label.id);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not delete label');
    }
  }

  return (
    <Paper withBorder p="lg" radius="lg">
      <Group justify="space-between">
        <Title order={4}>Labels</Title>
        {!loading && (
          <Badge variant="light" color="gray">
            {labels.length}
          </Badge>
        )}
      </Group>
      <Text size="sm" c="dimmed" mt={4} mb="md">
        Tags shared across all your projects and tasks.
      </Text>

      {loading ? (
        <Group justify="center" py="md">
          <Loader color="teal" size="sm" />
        </Group>
      ) : (
        <Stack gap="xs">
          {labels.map((label) => (
            <LabelRow key={label.id} label={label} onSave={save} onRemove={remove} />
          ))}
          {labels.length === 0 && (
            <Text size="sm" c="dimmed">
              No labels yet — add one below.
            </Text>
          )}
        </Stack>
      )}

      <Group gap="xs" wrap="nowrap" mt="md" align="flex-end">
        <ColorSelect value={color} onChange={setColor} />
        <TextInput
          style={{ flex: 1 }}
          placeholder="New label"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button leftSection={<Plus size={15} />} onClick={add}>
          Add label
        </Button>
      </Group>
    </Paper>
  );
}

function LabelRow({ label, onSave, onRemove }) {
  const [name, setName] = useState(label.name);
  useEffect(() => setName(label.name), [label.name]);
  return (
    <Group gap="xs" wrap="nowrap">
      <ColorSelect value={label.color} onChange={(c) => onSave(label, { color: c })} />
      <TextInput
        style={{ flex: 1 }}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSave(label, { name: name.trim() })}
        onBlur={() => name.trim() && name !== label.name && onSave(label, { name: name.trim() })}
      />
      <ActionIcon
        variant="subtle"
        color="red"
        aria-label="Delete label"
        onClick={() => onRemove(label)}
      >
        <Trash2 size={16} />
      </ActionIcon>
    </Group>
  );
}
