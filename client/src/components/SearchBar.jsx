import { useEffect, useState } from 'react';
import { Badge, Group, Popover, ScrollArea, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { Search } from 'lucide-react';
import { search } from '../api.js';
import { PRIORITY_META } from '../priority.js';

const STATUS_COLOR = { todo: 'gray', doing: 'amber', done: 'teal' };
const empty = { projects: [], tasks: [] };

// Global search over the user's projects and tasks. Selecting a result opens the
// owning project. Debounced; queries once the term is 2+ characters.
export default function SearchBar({ onSelectProject }) {
  const [query, setQuery] = useState('');
  const [debounced] = useDebouncedValue(query, 220);
  const [results, setResults] = useState(empty);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setResults(empty);
      return;
    }
    let active = true;
    search(q)
      .then((r) => active && (setResults(r), setOpen(true)))
      .catch(() => active && setResults(empty));
    return () => {
      active = false;
    };
  }, [debounced]);

  const count = results.projects.length + results.tasks.length;

  function pick(projectId) {
    onSelectProject(projectId);
    setQuery('');
    setResults(empty);
    setOpen(false);
  }

  return (
    <Popover
      opened={open && count > 0}
      onChange={setOpen}
      position="bottom-start"
      width="target"
      shadow="md"
      trapFocus={false}
    >
      <Popover.Target>
        <TextInput
          placeholder="Search projects and tasks…"
          leftSection={<Search size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onFocus={() => count > 0 && setOpen(true)}
          aria-label="Search"
        />
      </Popover.Target>
      <Popover.Dropdown p={6}>
        <ScrollArea.Autosize mah={380} type="scroll">
          {results.projects.length > 0 && <GroupLabel>Projects</GroupLabel>}
          {results.projects.map((p) => (
            <ResultRow key={`p${p.id}`} onClick={() => pick(p.id)}>
              <Text size="sm" truncate>
                {p.name}
              </Text>
            </ResultRow>
          ))}

          {results.tasks.length > 0 && <GroupLabel>Tasks</GroupLabel>}
          {results.tasks.map((t) => (
            <ResultRow key={`t${t.id}`} onClick={() => pick(t.project_id)}>
              <Group justify="space-between" gap="xs" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Badge
                    size="xs"
                    color={STATUS_COLOR[t.status]}
                    variant={t.status === 'todo' ? 'light' : 'filled'}
                  >
                    {t.status}
                  </Badge>
                  <Text size="sm" truncate>
                    {t.title}
                  </Text>
                  {t.priority > 0 && (
                    <Text size="xs" c={`${PRIORITY_META[t.priority].color}.5`} fw={600}>
                      !
                    </Text>
                  )}
                </Group>
                <Text size="xs" c="dark.2" style={{ flexShrink: 0 }}>
                  {t.project_name}
                </Text>
              </Group>
            </ResultRow>
          ))}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}

function GroupLabel({ children }) {
  return (
    <Text
      size="xs"
      fw={700}
      tt="uppercase"
      c="dark.2"
      px="xs"
      pt={6}
      pb={2}
      style={{ letterSpacing: '0.06em' }}
    >
      {children}
    </Text>
  );
}

function ResultRow({ onClick, children }) {
  return (
    <UnstyledButton
      onClick={onClick}
      p="xs"
      display="block"
      w="100%"
      style={{ borderRadius: 8 }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-5)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {children}
    </UnstyledButton>
  );
}
