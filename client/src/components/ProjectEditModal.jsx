import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { updateProject } from '../api.js';
import LabelPicker from './LabelPicker.jsx';

// Modal for renaming a project and editing its description. `project` is the one
// being edited (or null when closed); on save it PATCHes and calls onSaved.
export default function ProjectEditModal({ project, opened, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [labelIds, setLabelIds] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description ?? '');
    setLabelIds((project.labels ?? []).map((l) => l.id));
    setError(null);
  }, [project]);

  async function handleSave(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    try {
      await updateProject(project.id, {
        name: trimmed,
        description: description.trim() || null,
        labelIds,
      });
      onSaved();
      onClose();
      notifications.show({ message: 'Project updated', color: 'green' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Edit project" centered>
      <form onSubmit={handleSave}>
        <Stack>
          <TextInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
            data-autofocus
          />
          <Textarea
            label="Description"
            placeholder="What is this project about?"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <LabelPicker value={labelIds} onChange={setLabelIds} />
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
