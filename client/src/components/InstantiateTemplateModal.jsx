import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Boxes, ListChecks } from 'lucide-react';
import { getTemplate, instantiateTemplate, listModules } from '../api.js';
import LabelPicker from './LabelPicker.jsx';

// Start a new project from a template (the v3 "apply relevant labels" flow):
// standard sections carry their fixed tasks through as-is; module-based sections
// (label slots, or no fixed tasks) show a label picker — the modules matching the
// chosen labels are injected. Slots stored on the template pre-fill the picker.
export default function InstantiateTemplateModal({ opened, templateId, onClose, onInstantiated }) {
  const [template, setTemplate] = useState(null);
  const [modules, setModules] = useState([]);
  const [name, setName] = useState('');
  const [labelsBySection, setLabelsBySection] = useState({}); // sectionId -> labelIds
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!opened || !templateId) return;
    setError(null);
    setLoading(true);
    Promise.all([getTemplate(templateId), listModules()])
      .then(([t, mods]) => {
        setTemplate(t);
        setModules(mods);
        setName(t.name);
        const seed = {};
        for (const s of t.sections ?? []) seed[s.id] = s.labelIds ?? [];
        setLabelsBySection(seed);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [opened, templateId]);

  // A section offers module injection if it has label slots or no fixed tasks.
  const isModuleSection = (s) => (s.labelIds?.length ?? 0) > 0 || (s.tasks?.length ?? 0) === 0;

  // Modules that carry any of the given labels (mirrors the server's injection).
  const matchingModules = (labelIds) => {
    if (!labelIds?.length) return [];
    const set = new Set(labelIds);
    return modules.filter((m) => (m.labels ?? []).some((l) => set.has(l.id)));
  };

  const setSectionLabels = (sectionId, ids) =>
    setLabelsBySection((prev) => ({ ...prev, [sectionId]: ids }));

  async function start(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Project name is required');
      return;
    }
    const sectionLabels = (template.sections ?? [])
      .filter(isModuleSection)
      .map((s) => ({ sectionId: s.id, labelIds: labelsBySection[s.id] ?? [] }));

    setSaving(true);
    try {
      const project = await instantiateTemplate(template.id, trimmed, sectionLabels);
      notifications.show({ message: `Created “${project.name}” from template`, color: 'teal' });
      onInstantiated(project);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Start a project from template"
      size="lg"
      centered
    >
      {loading || !template ? (
        <Group justify="center" py="lg">
          <Loader color="teal" />
        </Group>
      ) : (
        <form onSubmit={start}>
          <Stack>
            <TextInput
              label="Project name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
              data-autofocus
            />

            <Divider label="Sections" labelPosition="left" />

            <ScrollArea.Autosize mah={440} type="auto" offsetScrollbars>
              <Stack gap="sm">
                {(template.sections ?? []).map((s) => (
                  <SectionRow
                    key={s.id}
                    section={s}
                    isModule={isModuleSection(s)}
                    labelIds={labelsBySection[s.id] ?? []}
                    onLabels={(ids) => setSectionLabels(s.id, ids)}
                    matching={matchingModules(labelsBySection[s.id])}
                  />
                ))}
                {(template.sections ?? []).length === 0 && (
                  <Text size="sm" c="dark.2">
                    This template has no sections yet.
                  </Text>
                )}
              </Stack>
            </ScrollArea.Autosize>

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
                Save &amp; start
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}

function SectionRow({ section, isModule, labelIds, onLabels, matching }) {
  const injectedTasks = useMemo(
    () => matching.reduce((n, m) => n + (m.task_count ?? m.tasks?.length ?? 0), 0),
    [matching],
  );

  return (
    <Paper withBorder p="sm" radius="md" bg="dark.7">
      <Group justify="space-between" mb={section.tasks?.length || isModule ? 'xs' : 0}>
        <Text fw={600}>{section.name}</Text>
        <Badge size="xs" variant="light" color={isModule ? 'amber' : 'gray'}>
          {isModule ? 'module-based' : 'standard'}
        </Badge>
      </Group>

      {(section.tasks?.length ?? 0) > 0 && (
        <Stack gap={2} mb={isModule ? 'sm' : 0}>
          {section.tasks.map((t, i) => (
            <Group key={i} gap={6} wrap="nowrap">
              <ListChecks size={13} color="var(--mantine-color-dark-2)" />
              <Text size="sm" c="dark.1" truncate>
                {t.title}
              </Text>
            </Group>
          ))}
        </Stack>
      )}

      {isModule && (
        <>
          <LabelPicker
            label="Apply labels (pulls in matching modules)"
            value={labelIds}
            onChange={onLabels}
          />
          <Group gap={6} mt="xs" wrap="wrap">
            {matching.length === 0 ? (
              <Text size="xs" c="dark.2">
                No modules match yet — pick labels above.
              </Text>
            ) : (
              <>
                <Text size="xs" c="dark.2">
                  Will add {injectedTasks} {injectedTasks === 1 ? 'task' : 'tasks'} from:
                </Text>
                {matching.map((m) => (
                  <Badge
                    key={m.id}
                    size="xs"
                    variant="light"
                    color="teal"
                    leftSection={<Boxes size={10} />}
                  >
                    {m.name}
                  </Badge>
                ))}
              </>
            )}
          </Group>
        </>
      )}
    </Paper>
  );
}
