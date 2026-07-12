import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Checkbox,
  ColorSwatch,
  Group,
  Loader,
  Menu,
  Popover,
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import {
  ArrowUpDown,
  Check,
  EllipsisVertical,
  GripVertical,
  History,
  LayoutTemplate,
  Pencil,
  Plus,
  Tag,
  Tags,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  createSection,
  createTask,
  deleteSection,
  deleteTask,
  listSections,
  listTasks,
  reorderSections,
  reorderTasks,
  updateSection,
  updateTask,
} from '../api.js';
import { notifyError } from '../notify.js';
import { useStatuses } from '../statuses.jsx';
import TaskCard from './TaskCard.jsx';
import TaskBoard from './TaskBoard.jsx';
import TaskEditModal from './TaskEditModal.jsx';
import LabelManagerModal from './LabelManagerModal.jsx';
import SaveAsTemplateModal from './SaveAsTemplateModal.jsx';
import ActivityDrawer from './ActivityDrawer.jsx';
import ShareModal from './ShareModal.jsx';

const labelSwatch = (c) => `var(--mantine-color-${c}-6)`;

const SORT_OPTIONS = [
  { value: 'default', label: 'Manual order' },
  { value: 'priority', label: 'Priority' },
  { value: 'due', label: 'Due date' },
  { value: 'status', label: 'Status' },
  { value: 'title', label: 'Title' },
];

// Apply the status filter, label filter, and sort. Due dates are ISO strings
// (YYYY-MM-DD), which sort chronologically as plain strings; tasks without a due
// date sort last. Sorting is non-mutating (works on a copy). `statusFilter` is
// 'all' or a status id; `labelIds` keeps tasks carrying any of the selected
// labels; `positionById` maps status_id → workflow order for status sort.
// Exported for tests.
export function arrangeTasks(tasks, statusFilter, sortBy, labelIds = [], positionById = {}) {
  let filtered =
    statusFilter === 'all'
      ? tasks
      : tasks.filter((t) => String(t.status_id) === String(statusFilter));
  if (labelIds.length) {
    filtered = filtered.filter((t) => (t.labels ?? []).some((l) => labelIds.includes(l.id)));
  }
  const sorted = [...filtered];
  if (sortBy === 'due') {
    sorted.sort((a, b) => {
      if (a.due_date === b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    });
  } else if (sortBy === 'priority') {
    sorted.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)); // urgent first
  } else if (sortBy === 'status') {
    sorted.sort((a, b) => (positionById[a.status_id] ?? 0) - (positionById[b.status_id] ?? 0));
  } else if (sortBy === 'title') {
    sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }
  return sorted;
}

// Move the task with `draggedId` to the position of `targetId`, returning a new
// array (the original is untouched). Exported for tests.
export function moveTask(tasks, draggedId, targetId) {
  if (draggedId === targetId) return tasks;
  const from = tasks.findIndex((t) => t.id === draggedId);
  const to = tasks.findIndex((t) => t.id === targetId);
  if (from === -1 || to === -1) return tasks;
  const next = [...tasks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// Same section? (both null = ungrouped). Guards drag reordering to one group.
const sameSection = (a, b) => (a.section_id ?? null) === (b.section_id ?? null);

export default function TaskList({ project, onTasksChanged }) {
  const { statuses, statusById, positionById } = useStatuses();
  const [tasks, setTasks] = useState([]);
  const [sections, setSections] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [editingSectionDescription, setEditingSectionDescription] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [labelFilter, setLabelFilter] = useState([]); // label ids
  const [sortBy, setSortBy] = useState('default');
  const [view, setView] = useState('list'); // 'list' | 'board'
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const role = project.role ?? 'owner';
  const canEdit = role !== 'viewer'; // owner + editor may mutate
  const isOwner = role === 'owner';
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [draggedSectionId, setDraggedSectionId] = useState(null);
  const [dropZoneSectionId, setDropZoneSectionId] = useState(undefined); // undefined = none
  const [loading, setLoading] = useState(true);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const visibleTasks = useMemo(
    () => arrangeTasks(tasks, statusFilter, sortBy, labelFilter, positionById),
    [tasks, statusFilter, sortBy, labelFilter, positionById],
  );

  // Board applies the label filter but not the status filter (columns = status).
  const boardTasks = useMemo(
    () => arrangeTasks(tasks, 'all', 'default', labelFilter),
    [tasks, labelFilter],
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All statuses' },
      ...statuses.map((s) => ({ value: String(s.id), label: s.name })),
    ],
    [statuses],
  );

  // Labels available to filter by = those actually used in this project.
  const availableLabels = useMemo(() => {
    const byId = new Map();
    for (const t of tasks) for (const l of t.labels ?? []) byId.set(l.id, l);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const doneCount = tasks.filter((t) => statusById(t.status_id).is_done).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  // Reordering only makes sense when the list reflects the stored manual order
  // (no filter hiding rows, no other sort overriding it).
  const reorderEnabled = statusFilter === 'all' && sortBy === 'default';

  async function refresh() {
    try {
      const [t, s] = await Promise.all([listTasks(project.id), listSections(project.id)]);
      setTasks(t);
      setSections(s);
    } catch (err) {
      notifyError(err, 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  }

  // Refetch and let the parent refresh its per-project progress rollups.
  async function refreshAll() {
    await refresh();
    onTasksChanged?.();
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // --- tasks ---
  async function addTask(title, sectionId = null) {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await createTask(project.id, trimmed, sectionId ? { sectionId } : {});
      refreshAll();
    } catch (err) {
      notifyError(err, 'Could not add task');
    }
  }

  async function changeStatus(task, statusId) {
    try {
      await updateTask(project.id, task.id, { statusId });
      refreshAll();
    } catch (err) {
      notifyError(err, 'Could not update task');
    }
  }

  async function removeTask(task) {
    try {
      await deleteTask(project.id, task.id);
      refreshAll();
    } catch (err) {
      notifyError(err, 'Could not delete task');
    }
  }

  // --- sections ---
  async function addSection(e) {
    e.preventDefault();
    const name = newSectionName.trim();
    if (!name) return;
    try {
      await createSection(project.id, name);
      setNewSectionName('');
      refresh();
    } catch (err) {
      notifyError(err, 'Could not add section');
    }
  }

  async function saveSectionName() {
    const name = editingSectionName.trim();
    const description = editingSectionDescription.trim();
    const id = editingSectionId;
    setEditingSectionId(null);
    if (!name) return;
    try {
      // null clears the description; the backend merges by key presence.
      await updateSection(project.id, id, { name, description: description || null });
      refresh();
    } catch (err) {
      notifyError(err, 'Could not update section');
    }
  }

  async function removeSection(section) {
    try {
      await deleteSection(project.id, section.id);
      refreshAll(); // tasks become ungrouped
    } catch (err) {
      notifyError(err, 'Could not delete section');
    }
  }

  // --- task drag (reorder within a section, or move across sections) ---
  function taskDragProps(task) {
    return {
      dragging: draggedId === task.id,
      dragOver: dragOverId === task.id && draggedId !== task.id,
      onDragStart: () => setDraggedId(task.id),
      onDragEnd: clearDrag,
      onDragOver: (e) => {
        if (!reorderEnabled || draggedId === null) return;
        e.preventDefault();
        e.stopPropagation(); // over a task → task highlight only, not the section zone
        if (dragOverId !== task.id) setDragOverId(task.id);
      },
      onDrop: (e) => {
        e.preventDefault();
        e.stopPropagation(); // don't also trigger the section drop zone
        dropOnTask(task);
      },
    };
  }

  function clearDrag() {
    setDraggedId(null);
    setDragOverId(null);
    setDraggedSectionId(null);
    setDropZoneSectionId(undefined);
  }

  function persistOrder(orderedIds) {
    reorderTasks(project.id, orderedIds).catch((err) => {
      notifyError(err, 'Could not reorder tasks');
      refresh();
    });
  }

  function dropOnTask(target) {
    const dragged = tasks.find((t) => t.id === draggedId);
    clearDrag();
    if (!dragged || dragged.id === target.id) return;
    if (sameSection(dragged, target)) {
      // Reorder within the section, optimistically.
      const group = tasks.filter((t) => sameSection(t, target));
      const next = moveTask(group, dragged.id, target.id);
      if (next === group) return;
      const iter = next[Symbol.iterator]();
      setTasks(tasks.map((t) => (sameSection(t, target) ? iter.next().value : t)));
      persistOrder(next.map((t) => t.id));
    } else {
      moveTaskToSection(dragged, target.section_id ?? null, target.id);
    }
  }

  // Drop a task onto a section's area (or the "No section" area) → append there.
  function dropIntoSection(sectionId) {
    const dragged = tasks.find((t) => t.id === draggedId);
    clearDrag();
    if (!dragged || (dragged.section_id ?? null) === (sectionId ?? null)) return;
    moveTaskToSection(dragged, sectionId, null);
  }

  // Move a task into another section, placed before `beforeTaskId` (or at the end
  // when null). Persist the section change, then the target section's order.
  async function moveTaskToSection(dragged, sectionId, beforeTaskId) {
    const targetGroup = tasks.filter(
      (t) => (t.section_id ?? null) === (sectionId ?? null) && t.id !== dragged.id,
    );
    const idx = beforeTaskId ? targetGroup.findIndex((t) => t.id === beforeTaskId) : -1;
    const at = idx === -1 ? targetGroup.length : idx;
    const orderedIds = [
      ...targetGroup.slice(0, at).map((t) => t.id),
      dragged.id,
      ...targetGroup.slice(at).map((t) => t.id),
    ];
    try {
      await updateTask(project.id, dragged.id, { sectionId });
      await reorderTasks(project.id, orderedIds);
      refreshAll();
    } catch (err) {
      notifyError(err, 'Could not move task');
      refresh();
    }
  }

  function sectionDropZone(sectionId) {
    return {
      active: draggedId !== null && dropZoneSectionId === (sectionId ?? null),
      onDragOver: (e) => {
        if (draggedId === null) return;
        e.preventDefault();
        if (dropZoneSectionId !== (sectionId ?? null)) setDropZoneSectionId(sectionId ?? null);
      },
      onDrop: (e) => {
        e.preventDefault();
        dropIntoSection(sectionId);
      },
    };
  }

  // --- section drag (reorder sections) ---
  function sectionDragProps(section) {
    return {
      draggable: reorderEnabled,
      onDragStart: () => setDraggedSectionId(section.id),
      onDragEnd: clearDrag,
      onDragOver: (e) => {
        if (draggedSectionId === null || draggedSectionId === section.id) return;
        e.preventDefault();
        if (dropZoneSectionId !== section.id) setDropZoneSectionId(section.id);
      },
      onDrop: (e) => {
        if (draggedSectionId === null) return;
        e.preventDefault();
        e.stopPropagation();
        dropOnSection(section);
      },
    };
  }

  function dropOnSection(target) {
    const id = draggedSectionId;
    clearDrag();
    if (!id || id === target.id) return;
    const next = moveTask(sections, id, target.id); // generic reorder by id
    if (next === sections) return;
    setSections(next); // optimistic
    reorderSections(
      project.id,
      next.map((s) => s.id),
    ).catch((err) => {
      notifyError(err, 'Could not reorder sections');
      refresh();
    });
  }

  const renderTask = (task) => (
    <TaskCard
      key={task.id}
      task={task}
      canEdit={canEdit}
      reorderEnabled={reorderEnabled && canEdit}
      drag={taskDragProps(task)}
      onSetStatus={(statusId) => changeStatus(task, statusId)}
      onEdit={() => setEditingTask(task)}
      onDelete={() => removeTask(task)}
    />
  );

  const ungrouped = visibleTasks.filter((t) => (t.section_id ?? null) === null);

  return (
    <Stack>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Title order={2}>{project.name}</Title>
          {project.description && (
            <Text c="dark.2" mt={4}>
              {project.description}
            </Text>
          )}
        </div>
        <Group gap="sm" align="flex-start" wrap="nowrap">
          {tasks.length > 0 && (
            <Stack gap={4} w={180} style={{ flexShrink: 0 }}>
              <Group justify="space-between" gap="xs">
                <Text size="xs" c="dark.2">
                  {doneCount} of {tasks.length} done
                </Text>
                <Text size="xs" fw={600} c={pct === 100 ? 'teal.4' : 'dark.1'}>
                  {pct}%
                </Text>
              </Group>
              <Progress value={pct} color={pct === 100 ? 'teal' : 'amber'} size="md" radius="xl" />
            </Stack>
          )}
          <Menu shadow="md" position="bottom-end" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label="Project actions">
                <EllipsisVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<Users size={15} />} onClick={() => setShareOpen(true)}>
                {isOwner ? 'Share' : 'Members'}
              </Menu.Item>
              {isOwner && (
                <Menu.Item
                  leftSection={<LayoutTemplate size={15} />}
                  onClick={() => setTemplateModalOpen(true)}
                >
                  Save as template
                </Menu.Item>
              )}
              {isOwner && (
                <Menu.Item
                  leftSection={<Tags size={15} />}
                  onClick={() => setManageLabelsOpen(true)}
                >
                  Manage labels
                </Menu.Item>
              )}
              <Menu.Item leftSection={<History size={15} />} onClick={() => setActivityOpen(true)}>
                Activity
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      {canEdit && (
        <form onSubmit={(e) => (e.preventDefault(), addTask(newTitle), setNewTitle(''))}>
          <Group gap="xs" wrap="nowrap">
            <TextInput
              placeholder="New task"
              value={newTitle}
              onChange={(e) => setNewTitle(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button type="submit">Add task</Button>
          </Group>
        </form>
      )}

      {tasks.length > 0 && (
        <Group justify="space-between" gap="xs">
          <Group gap="xs">
            <SegmentedControl
              size="xs"
              value={view}
              onChange={setView}
              data={[
                { label: 'List', value: 'list' },
                { label: 'Board', value: 'board' },
              ]}
            />
            {view === 'list' && (
              <Select
                size="xs"
                w={150}
                aria-label="Filter by status"
                data={statusFilterOptions}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v ?? 'all')}
                allowDeselect={false}
              />
            )}
            {availableLabels.length > 0 && (
              <LabelFilter
                available={availableLabels}
                value={labelFilter}
                onChange={setLabelFilter}
              />
            )}
          </Group>
          {view === 'list' && (
            <Select
              size="xs"
              w={150}
              aria-label="Sort tasks"
              leftSection={<ArrowUpDown size={14} />}
              data={SORT_OPTIONS}
              value={sortBy}
              onChange={(v) => setSortBy(v ?? 'default')}
              allowDeselect={false}
            />
          )}
        </Group>
      )}

      {loading && (
        <Center py="xl">
          <Loader color="teal" />
        </Center>
      )}

      {!loading && view === 'board' && (
        <TaskBoard tasks={boardTasks} onChangeStatus={changeStatus} onEditTask={setEditingTask} />
      )}

      {!loading && view === 'list' && (
        <Stack gap="lg">
          {/* Sections, in order */}
          {sections.map((section) => {
            const items = visibleTasks.filter((t) => t.section_id === section.id);
            const zone = sectionDropZone(section.id);
            return (
              <Stack
                key={section.id}
                gap="xs"
                onDragOver={zone.onDragOver}
                onDrop={zone.onDrop}
                style={{
                  opacity: draggedSectionId === section.id ? 0.4 : 1,
                  borderRadius: 10,
                  outline: zone.active ? '2px dashed var(--mantine-color-teal-7)' : 'none',
                  outlineOffset: 4,
                }}
              >
                {editingSectionId === section.id ? (
                  <Stack gap={6}>
                    <Group gap="xs" wrap="nowrap">
                      <TextInput
                        size="sm"
                        style={{ flex: 1 }}
                        value={editingSectionName}
                        onChange={(e) => setEditingSectionName(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveSectionName();
                          if (e.key === 'Escape') setEditingSectionId(null);
                        }}
                        autoFocus
                      />
                      <ActionIcon
                        variant="light"
                        aria-label="Save section"
                        onClick={saveSectionName}
                      >
                        <Check size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label="Cancel"
                        onClick={() => setEditingSectionId(null)}
                      >
                        <X size={16} />
                      </ActionIcon>
                    </Group>
                    <Textarea
                      size="xs"
                      placeholder="Add a description…"
                      value={editingSectionDescription}
                      onChange={(e) => setEditingSectionDescription(e.currentTarget.value)}
                      autosize
                      minRows={2}
                    />
                  </Stack>
                ) : (
                  <>
                    <Group
                      justify="space-between"
                      gap="xs"
                      {...sectionDragProps(section)}
                      style={{
                        borderBottom:
                          draggedSectionId !== null && dropZoneSectionId === section.id
                            ? '2px solid var(--mantine-primary-color-filled)'
                            : '1px solid var(--mantine-color-dark-4)',
                        paddingBottom: 6,
                      }}
                    >
                      <Group gap="xs">
                        {reorderEnabled && (
                          <GripVertical
                            size={15}
                            aria-label="Drag section"
                            style={{ cursor: 'grab', opacity: 0.5, flexShrink: 0 }}
                          />
                        )}
                        <Text fw={700} tt="uppercase" size="sm" style={{ letterSpacing: '0.04em' }}>
                          {section.name}
                        </Text>
                        <Badge size="sm" variant="light" color="gray">
                          {items.length}
                        </Badge>
                      </Group>
                      <Group gap={4}>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          aria-label="Rename section"
                          onClick={() => {
                            setEditingSectionId(section.id);
                            setEditingSectionName(section.name);
                            setEditingSectionDescription(section.description ?? '');
                          }}
                        >
                          <Pencil size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          aria-label="Delete section"
                          onClick={() => removeSection(section)}
                        >
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                    {section.description && (
                      <Text size="sm" c="dimmed" pl="xs">
                        {section.description}
                      </Text>
                    )}
                  </>
                )}

                {items.map(renderTask)}
                {!items.length && (
                  <Text size="sm" c="dark.3" pl="xs">
                    No tasks in this section.
                  </Text>
                )}
                <SectionAddTask onAdd={(title) => addTask(title, section.id)} />
              </Stack>
            );
          })}

          {/* Ungrouped tasks (a drop target so tasks can be dragged out of a section) */}
          {(() => {
            const zone = sectionDropZone(null);
            const showHeader = sections.length > 0 && ungrouped.length > 0;
            return (
              <Stack
                gap="sm"
                onDragOver={zone.onDragOver}
                onDrop={zone.onDrop}
                style={{
                  borderRadius: 10,
                  outline: zone.active ? '2px dashed var(--mantine-color-teal-7)' : 'none',
                  outlineOffset: 4,
                  minHeight: sections.length > 0 ? 8 : undefined,
                }}
              >
                {showHeader && (
                  <Text
                    fw={700}
                    tt="uppercase"
                    size="sm"
                    c="dark.2"
                    style={{ letterSpacing: '0.04em' }}
                  >
                    No section
                  </Text>
                )}
                {ungrouped.map(renderTask)}
              </Stack>
            );
          })()}

          {!tasks.length && (
            <Text c="dark.2" py="sm">
              No tasks yet — add your first one above.
            </Text>
          )}
          {tasks.length > 0 && !visibleTasks.length && (
            <Text c="dark.2" py="sm">
              No tasks match this filter.
            </Text>
          )}

          {/* Add a section */}
          {canEdit && (
            <form onSubmit={addSection}>
              <Group gap="xs" wrap="nowrap" maw={360}>
                <TextInput
                  size="xs"
                  placeholder="New section"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.currentTarget.value)}
                  style={{ flex: 1 }}
                  leftSection={<Plus size={14} />}
                />
                <Button type="submit" size="xs" variant="light">
                  Add section
                </Button>
              </Group>
            </form>
          )}
        </Stack>
      )}

      <TaskEditModal
        project={project}
        task={editingTask}
        sections={sections}
        opened={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSaved={refreshAll}
      />

      <SaveAsTemplateModal
        opened={templateModalOpen}
        projectId={project.id}
        projectName={project.name}
        onClose={() => setTemplateModalOpen(false)}
      />

      <LabelManagerModal
        opened={manageLabelsOpen}
        onClose={() => setManageLabelsOpen(false)}
        onChanged={refreshAll}
      />

      <ActivityDrawer
        opened={activityOpen}
        projectId={project.id}
        projectName={project.name}
        onClose={() => setActivityOpen(false)}
      />

      <ShareModal
        opened={shareOpen}
        project={project}
        onClose={() => setShareOpen(false)}
        onChanged={onTasksChanged}
      />
    </Stack>
  );
}

// Filter tasks by label (any-of). Options are the labels used in this project.
function LabelFilter({ available, value, onChange }) {
  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <Popover position="bottom-start" shadow="md" width={220} withinPortal>
      <Popover.Target>
        <Button
          size="xs"
          variant={value.length ? 'light' : 'default'}
          leftSection={<Tag size={14} />}
        >
          {value.length ? `${value.length} label${value.length > 1 ? 's' : ''}` : 'Labels'}
        </Button>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <Stack gap={6}>
          {available.map((l) => (
            <Checkbox
              key={l.id}
              size="xs"
              checked={value.includes(l.id)}
              onChange={() => toggle(l.id)}
              label={
                <Group gap={6} wrap="nowrap">
                  <ColorSwatch color={labelSwatch(l.color)} size={10} withShadow={false} />
                  <Text size="sm">{l.name}</Text>
                </Group>
              }
            />
          ))}
          {value.length > 0 && (
            <Button size="xs" variant="subtle" color="gray" onClick={() => onChange([])}>
              Clear
            </Button>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

// Inline "add task to this section" form with its own input state.
function SectionAddTask({ onAdd }) {
  const [title, setTitle] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(title);
        setTitle('');
      }}
    >
      <Group gap="xs" wrap="nowrap">
        <TextInput
          size="xs"
          placeholder="Add task to this section"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <ActionIcon
          type="submit"
          size="md"
          variant="subtle"
          color="gray"
          aria-label="Add task to section"
        >
          <Plus size={16} />
        </ActionIcon>
      </Group>
    </form>
  );
}
