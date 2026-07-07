import { useEffect, useState } from 'react';
import {
  ActionIcon,
  ColorSwatch,
  Group,
  MultiSelect,
  Select,
  Stack,
  TextInput,
} from '@mantine/core';
import { Plus } from 'lucide-react';
import { createLabel, listLabels } from '../api.js';
import { notifyError } from '../notify.js';

// Colours a label may use (mirrors the server's LABEL_COLORS).
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

// Assign labels to a task (multi-select of the user's library) and create new
// ones inline. `value` is an array of label ids; `onChange` receives the new array.
export default function LabelPicker({ value, onChange, label = 'Labels' }) {
  const [labels, setLabels] = useState([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('teal');

  useEffect(() => {
    listLabels()
      .then(setLabels)
      .catch((err) => notifyError(err, 'Could not load labels'));
  }, []);

  async function addLabel() {
    const name = newName.trim();
    if (!name) return;
    try {
      const label = await createLabel(name, newColor);
      setLabels((ls) => [...ls, label].sort((a, b) => a.name.localeCompare(b.name)));
      onChange([...value, label.id]);
      setNewName('');
    } catch (err) {
      notifyError(err, 'Could not create label');
    }
  }

  return (
    <Stack gap="xs">
      <MultiSelect
        label={label}
        placeholder={labels.length ? 'Add labels' : 'No labels yet — create one below'}
        data={labels.map((l) => ({ value: String(l.id), label: l.name }))}
        value={value.map(String)}
        onChange={(vals) => onChange(vals.map(Number))}
        searchable
        clearable
        renderOption={({ option }) => {
          const l = labels.find((x) => String(x.id) === option.value);
          return (
            <Group gap="xs" wrap="nowrap">
              <ColorSwatch color={swatch(l?.color ?? 'gray')} size={12} withShadow={false} />
              <span>{option.label}</span>
            </Group>
          );
        }}
      />
      <Group gap="xs" wrap="nowrap" align="flex-end">
        <Select
          aria-label="New label colour"
          w={64}
          data={COLORS.map((c) => ({ value: c, label: c }))}
          value={newColor}
          onChange={(v) => setNewColor(v ?? 'teal')}
          allowDeselect={false}
          leftSection={<ColorSwatch color={swatch(newColor)} size={14} withShadow={false} />}
          leftSectionWidth={28}
          renderOption={({ option }) => (
            <ColorSwatch color={swatch(option.value)} size={16} withShadow={false} />
          )}
          comboboxProps={{ width: 60 }}
        />
        <TextInput
          style={{ flex: 1 }}
          placeholder="New label name"
          value={newName}
          onChange={(e) => setNewName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addLabel();
            }
          }}
        />
        <ActionIcon variant="light" size="lg" aria-label="Create label" onClick={addLabel}>
          <Plus size={16} />
        </ActionIcon>
      </Group>
    </Stack>
  );
}
