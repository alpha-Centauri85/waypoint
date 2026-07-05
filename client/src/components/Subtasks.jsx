import { useEffect, useState } from 'react';
import { createSubtask, deleteSubtask, listSubtasks, updateSubtask } from '../api.js';

export default function Subtasks({ taskId }) {
  const [subtasks, setSubtasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');

  async function refresh() {
    setSubtasks(await listSubtasks(taskId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createSubtask(taskId, newTitle.trim());
    setNewTitle('');
    refresh();
  }

  async function toggle(subtask) {
    await updateSubtask(taskId, subtask.id, { done: !subtask.done });
    refresh();
  }

  return (
    <div className="subtasks">
      <ul>
        {subtasks.map((s) => (
          <li key={s.id}>
            <label>
              <input type="checkbox" checked={!!s.done} onChange={() => toggle(s)} />
              <span className={s.done ? 'done' : ''}>{s.title}</span>
            </label>
            <button
              className="link danger"
              onClick={async () => {
                await deleteSubtask(taskId, s.id);
                refresh();
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate} className="new-subtask">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add subtask"
        />
        <button type="submit">+</button>
      </form>
    </div>
  );
}
