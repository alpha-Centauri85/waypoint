import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { updateTask } from '../api.js';
import { PRIORITY_OPTIONS } from '../priority.js';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
];

// Modal for editing a task's title, status, due date, and notes. `task` is the
// row being edited (or null when closed); on save it PATCHes and calls onSaved.
export default function TaskEditModal({ project, task, opened, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState(0);
  const [dueDate, setDueDate] = useState(null); // Date | null
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Seed the form from the task each time a different one is opened.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setStatus(task.status);
    setPriority(task.priority ?? 0);
    setDueDate(task.due_date ? dayjs(task.due_date).toDate() : null);
    setNotes(task.notes ?? '');
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
        status,
        priority,
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
              data={STATUS_OPTIONS}
              value={status}
              onChange={(v) => setStatus(v ?? 'todo')}
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
          <DatePickerInput
            label="Due date"
            placeholder="No due date"
            value={dueDate}
            onChange={setDueDate}
            valueFormat="MMM D, YYYY"
            clearable
          />
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
