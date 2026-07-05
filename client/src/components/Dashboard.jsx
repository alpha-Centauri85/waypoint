import { useEffect, useState } from 'react';
import { createProject, deleteProject, listProjects } from '../api.js';
import TaskList from './TaskList.jsx';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState('');

  async function refresh() {
    const rows = await listProjects();
    setProjects(rows);
    // Keep a valid selection.
    if (rows.length && !rows.some((p) => p.id === selectedId)) {
      setSelectedId(rows[0].id);
    }
    if (!rows.length) setSelectedId(null);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const project = await createProject(newName.trim());
    setNewName('');
    setSelectedId(project.id);
    refresh();
  }

  async function handleDelete(id) {
    await deleteProject(id);
    refresh();
  }

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2>Projects</h2>
        <ul>
          {projects.map((p) => (
            <li key={p.id} className={p.id === selectedId ? 'active' : ''}>
              <button className="link" onClick={() => setSelectedId(p.id)}>
                {p.name}
              </button>
              <button className="link danger" onClick={() => handleDelete(p.id)}>
                ×
              </button>
            </li>
          ))}
          {!projects.length && <li className="muted">No projects yet</li>}
        </ul>
        <form onSubmit={handleCreate} className="new-project">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project name"
          />
          <button type="submit">Add</button>
        </form>
      </aside>
      <section className="panel">
        {selected ? (
          <TaskList project={selected} />
        ) : (
          <p className="muted">Create or select a project to get started.</p>
        )}
      </section>
    </div>
  );
}
