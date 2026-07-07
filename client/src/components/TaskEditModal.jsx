import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { updateTask } from '../api.js';
import { PRIORITY_OPTIONS } from '../priority.js';
import { useStatuses } from '../statuses.jsx';
import LabelPicker from './LabelPicker.jsx';

// Modal for editing a task's fields. `task` is the row being edited (or null when
// closed); on save it PATCHes and calls onSaved.
export default function TaskEditModal({ project, task, sections = [], opened, onClose, onSaved }) {
  const { statuses } = useStatuses();
  const statusOptions = statuses.map((s) => ({ value: String(s.id), label: s.name }));
  const [title, setTitle] = useState('');
  const [statusId, setStatusId] = useState(null);
  const [priority, setPriority] = useState(0);
  const [sectionId, setSectionId] = useState(null);
  const [dueDate, setDueDate] = useState(null); // Date | null
  const [notes, setNotes] = useState('');
  const [labelIds, setLabelIds] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Seed the form from the task each time a different one is opened.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setStatusId(task.status_id ?? null);
    setPriority(task.priority ?? 0);
    setSectionId(task.section_id ?? null);
    setDueDate(task.due_date ? dayjs(task.due_date).toDate() : null);
    setNotes(task.notes ?? '');
    setLabelIds((task.labels ?? []).map((l) => l.id));
    setError(null);
  }, [task]);

  async function handleSave(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    try {
      await updateTask(project.id, task.id, {
        title: trimmed,
        statusId,
        priority,
        sectionId,
        labelIds,
        // null clears the field; the backend merges by key presence.
        dueDate: dueDate ? dayjs(dueDate).format('YYYY-MM-DD') : null,
        notes: notes.trim() || null,
      });
      onSaved();
      onClose();
      notifications.show({ message: 'Task updated', color: 'green' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Edit task" centered>
      <form onSubmit={handleSave}>
        <Stack>
          <TextInput
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
            data-autofocus
          />
          <Group grow align="flex-start">
            <Select
              label="Status"
              data={statusOptions}
              value={statusId != null ? String(statusId) : null}
              onChange={(v) => setStatusId(v ? Number(v) : null)}
              allowDeselect={false}
            />
            <Select
              label="Priority"
              data={PRIORITY_OPTIONS}
              value={String(priority)}
              onChange={(v) => setPriority(Number(v ?? 0))}
              allowDeselect={false}
            />
          </Group>
          {sections.length > 0 && (
            <Select
              label="Section"
              placeholder="No section"
              clearable
              data={sections.map((s) => ({ value: String(s.id), label: s.name }))}
              value={sectionId ? String(sectionId) : null}
              onChange={(v) => setSectionId(v ? Number(v) : null)}
            />
          )}
          <DatePickerInput
            label="Due date"
            placeholder="No due date"
            value={dueDate}
            onChange={setDueDate}
            valueFormat="MMM D, YYYY"
            clearable
          />
          <LabelPicker value={labelIds} onChange={setLabelIds} />
          <Textarea
            label="Notes"
            placeholder="Add any details…"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            autosize
            minRows={3}
          />
          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button type="button" variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
