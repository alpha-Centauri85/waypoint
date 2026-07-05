import { useEffect, useState } from 'react';
import { createTask, deleteTask, listTasks, updateTask } from '../api.js';
import Subtasks from './Subtasks.jsx';

const STATUSES = ['todo', 'doing', 'done'];

export default function TaskList({ project }) {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');

  async function refresh() {
    setTasks(await listTasks(project.id));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createTask(project.id, newTitle.trim());
    setNewTitle('');
    refresh();
  }

  async function cycleStatus(task) {
    const next = STATUSES[(STATUSES.indexOf(task.status) + 1) % STATUSES.length];
    await updateTask(project.id, task.id, { status: next });
    refresh();
  }

  return (
    <div>
      <h2>{project.name}</h2>
      {project.description && <p className="muted">{project.description}</p>}

      <form onSubmit={handleCreate} className="new-task">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New task"
        />
        <button type="submit">Add task</button>
      </form>

      <ul className="tasks">
        {tasks.map((task) => (
          <li key={task.id} className="task">
            <div className="task-row">
              <button className={`status status-${task.status}`} onClick={() => cycleStatus(task)}>
                {task.status}
              </button>
              <span className="task-title">{task.title}</span>
              <button
                className="link danger"
                onClick={async () => {
                  await deleteTask(project.id, task.id);
                  refresh();
                }}
              >
                Delete
              </button>
            </div>
            <Subtasks taskId={task.id} />
          </li>
        ))}
        {!tasks.length && <li className="muted">No tasks yet</li>}
      </ul>
    </div>
  );
}
