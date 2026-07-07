import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  ColorSwatch,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { Check, Trash2 } from 'lucide-react';
import { deleteLabel, listLabels, updateLabel } from '../api.js';
import { notifyError } from '../notify.js';

const COLORS = [
  'teal',
  'amber',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'grape',
  'pink',
  'gray',
];
const swatch = (c) => `var(--mantine-color-${c}-6)`;

// Manage the user's whole label library: rename, recolor, delete. Deleting a
// label removes it from every task/project it was on. `onChanged` lets the caller
// refresh so chips update.
export default function LabelManagerModal({ opened, onClose, onChanged }) {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

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
    if (opened) {
      setDirty(false);
      refresh();
    }
  }, [opened]);

  function edit(id, patch) {
    setLabels((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function save(label) {
    try {
      await updateLabel(label.id, { name: label.name.trim(), color: label.color });
      setDirty(true);
    } catch (err) {
      notifyError(err, 'Could not update label');
      refresh();
    }
  }

  async function remove(label) {
    try {
      await deleteLabel(label.id);
      setDirty(true);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not delete label');
    }
  }

  function handleClose() {
    if (dirty) onChanged?.();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Manage labels" centered>
      {loading ? (
        <Group justify="center" py="lg">
          <Loader color="teal" />
        </Group>
      ) : labels.length === 0 ? (
        <Text c="dark.2" py="md" ta="center">
          No labels yet. Add labels from a task or project’s edit dialog.
        </Text>
      ) : (
        <Stack gap="sm">
          {labels.map((label) => (
            <Group key={label.id} gap="xs" wrap="nowrap">
              <Select
                aria-label="Label colour"
                w={64}
                data={COLORS.map((c) => ({ value: c, label: c }))}
                value={label.color}
                onChange={(v) => edit(label.id, { color: v ?? 'teal' })}
                allowDeselect={false}
                leftSection={
                  <ColorSwatch color={swatch(label.color)} size={14} withShadow={false} />
                }
                leftSectionWidth={28}
                renderOption={({ option }) => (
                  <ColorSwatch color={swatch(option.value)} size={16} withShadow={false} />
                )}
                comboboxProps={{ width: 60 }}
              />
              <TextInput
                style={{ flex: 1 }}
                value={label.name}
                onChange={(e) => edit(label.id, { name: e.currentTarget.value })}
                onKeyDown={(e) => e.key === 'Enter' && save(label)}
              />
              <ActionIcon variant="light" aria-label="Save label" onClick={() => save(label)}>
                <Check size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label="Delete label"
                onClick={() => remove(label)}
              >
                <Trash2 size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Group justify="space-between" mt="xs">
            <Badge variant="light" color="gray">
              {labels.length} {labels.length === 1 ? 'label' : 'labels'}
            </Badge>
            <Button variant="default" onClick={handleClose}>
              Done
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
