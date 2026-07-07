import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AlertTriangle } from 'lucide-react';
import { createTemplateFromProject, listTemplates, overwriteTemplateFromProject } from '../api.js';
import { notifyError } from '../notify.js';

// Save a project as a template: create a brand-new one, or overwrite an existing
// one (with a warning, since overwrite replaces its whole structure).
export default function SaveAsTemplateModal({ opened, projectId, projectName, onClose, onSaved }) {
  const [mode, setMode] = useState('new'); // 'new' | 'overwrite'
  const [name, setName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [targetId, setTargetId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!opened) return;
    setMode('new');
    setName(projectName ?? '');
    setTargetId(null);
    setError(null);
    listTemplates()
      .then(setTemplates)
      .catch((err) => notifyError(err, 'Could not load templates'));
  }, [opened, projectName]);

  const target = templates.find((t) => String(t.id) === targetId);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (mode === 'overwrite') {
        if (!targetId) {
          setError('Choose a template to overwrite');
          return;
        }
        const t = await overwriteTemplateFromProject(projectId, Number(targetId));
        notifications.show({ message: `Updated template “${t.name}”`, color: 'teal' });
      } else {
        const trimmed = name.trim();
        if (!trimmed) {
          setError('Template name is required');
          return;
        }
        const t = await createTemplateFromProject(projectId, trimmed);
        notifications.show({ message: `Saved “${t.name}” as a template`, color: 'teal' });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Save as template" centered>
      <form onSubmit={submit}>
        <Stack>
          <Text size="sm" c="dark.2">
            Captures this project’s sections and tasks as a reusable template.
          </Text>

          <SegmentedControl
            value={mode}
            onChange={setMode}
            data={[
              { label: 'New template', value: 'new' },
              { label: 'Update existing', value: 'overwrite' },
            ]}
          />

          {mode === 'new' ? (
            <TextInput
              label="Template name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
              data-autofocus
            />
          ) : (
            <>
              <Select
                label="Template to overwrite"
                placeholder={templates.length ? 'Choose a template' : 'No templates yet'}
                data={templates.map((t) => ({ value: String(t.id), label: t.name }))}
                value={targetId}
                onChange={setTargetId}
                searchable
                nothingFoundMessage="No templates"
              />
              {target && (
                <Alert
                  color="orange"
                  variant="light"
                  icon={<AlertTriangle size={16} />}
                  title="This will overwrite the template"
                >
                  “{target.name}” will be replaced with this project’s current sections and tasks.
                  Its label slots will be cleared. This can’t be undone.
                </Alert>
              )}
            </>
          )}

          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}

          <Group justify="flex-end">
            <Button type="button" variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={saving}
              color={mode === 'overwrite' ? 'orange' : undefined}
            >
              {mode === 'overwrite' ? 'Overwrite template' : 'Save template'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
