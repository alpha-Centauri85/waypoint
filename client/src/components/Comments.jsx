import { useEffect, useState } from 'react';
import { ActionIcon, Button, Group, Loader, Paper, Stack, Text, Textarea } from '@mantine/core';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { Check, MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import { createComment, deleteComment, listComments, updateComment } from '../api.js';
import { notifyError } from '../notify.js';

dayjs.extend(relativeTime);

// SQLite stores timestamps as UTC "YYYY-MM-DD HH:MM:SS"; make it a real instant.
const asDate = (s) => dayjs(`${String(s).replace(' ', 'T')}Z`);

// A comment thread for a task: list + add, with inline edit/delete of each entry.
export default function Comments({ taskId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState('');

  async function refresh() {
    try {
      setComments(await listComments(taskId));
    } catch (err) {
      notifyError(err, 'Could not load comments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function add() {
    const text = body.trim();
    if (!text) return;
    setPosting(true);
    try {
      await createComment(taskId, text);
      setBody('');
      refresh();
    } catch (err) {
      notifyError(err, 'Could not add comment');
    } finally {
      setPosting(false);
    }
  }

  async function saveEdit(id) {
    const text = editBody.trim();
    if (!text) return;
    try {
      await updateComment(taskId, id, text);
      setEditingId(null);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not update comment');
    }
  }

  async function remove(id) {
    try {
      await deleteComment(taskId, id);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not delete comment');
    }
  }

  return (
    <Stack gap="sm">
      <Group gap={6}>
        <MessageSquare size={15} />
        <Text size="sm" fw={600}>
          Comments
        </Text>
      </Group>

      {loading ? (
        <Group justify="center" py="sm">
          <Loader size="sm" color="teal" />
        </Group>
      ) : comments.length === 0 ? (
        <Text size="xs" c="dimmed">
          No comments yet.
        </Text>
      ) : (
        <Stack gap="xs">
          {comments.map((c) => (
            <Paper
              key={c.id}
              withBorder
              p="xs"
              radius="md"
              bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))"
            >
              {editingId === c.id ? (
                <Stack gap="xs">
                  <Textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.currentTarget.value)}
                    autosize
                    minRows={2}
                    data-autofocus
                  />
                  <Group gap="xs" justify="flex-end">
                    <ActionIcon variant="subtle" color="gray" onClick={() => setEditingId(null)}>
                      <X size={15} />
                    </ActionIcon>
                    <ActionIcon variant="light" color="teal" onClick={() => saveEdit(c.id)}>
                      <Check size={15} />
                    </ActionIcon>
                  </Group>
                </Stack>
              ) : (
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {c.body}
                    </Text>
                    <Text size="xs" c="dimmed" mt={2}>
                      {c.author_email} · {asDate(c.created_at).fromNow()}
                      {c.updated_at ? ' · edited' : ''}
                    </Text>
                  </div>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      aria-label="Edit comment"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditBody(c.body);
                      }}
                    >
                      <Pencil size={13} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      aria-label="Delete comment"
                      onClick={() => remove(c.id)}
                    >
                      <Trash2 size={13} />
                    </ActionIcon>
                  </Group>
                </Group>
              )}
            </Paper>
          ))}
        </Stack>
      )}

      <Textarea
        placeholder="Add a comment…"
        value={body}
        onChange={(e) => setBody(e.currentTarget.value)}
        autosize
        minRows={2}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter posts.
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
      />
      <Group justify="flex-end">
        <Button size="xs" loading={posting} onClick={add} disabled={!body.trim()}>
          Comment
        </Button>
      </Group>
    </Stack>
  );
}
