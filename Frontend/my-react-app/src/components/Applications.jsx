import { useState, useEffect } from "react";
import { useAuth } from "./authCore";
import { api } from "../lib/api";

const Applications = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingApp, setEditingApp] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [error, setError] = useState("");

  async function fetchApplications() {
    try {
      const response = await api.get("/application/");
      setApplications(response.data.applications);
    } catch {
      setError("Failed to fetch applications");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get("/application/");
        if (!cancelled) setApplications(response.data.applications);
      } catch {
        if (!cancelled) setError("Failed to fetch applications");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/application/create", { name, description });
      setName("");
      setDescription("");
      fetchApplications();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create application");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete("/application/delete", {
        data: { applicationId: id },
      });
      fetchApplications();
    } catch {
      setError("Failed to delete application");
    }
  };

  const handleEdit = (app) => {
    setEditingApp(app.id);
    setEditName(app.name);
    setEditDescription(app.description || "");
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put("/application/update", {
        applicationId: editingApp,
        name: editName,
        description: editDescription,
      });
      setEditingApp(null);
      fetchApplications();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update application");
    }
  };

  const cancelEdit = () => {
    setEditingApp(null);
  };

  return (
    <div className="container">
      <div className="card stack">
        <div>
          <h1>Applications</h1>
          <p className="muted">Manage apps that send logs into LogRush.</p>
        </div>
        {error && <p className="error">{error}</p>}

        {user?.role === "admin" && (
          <form onSubmit={handleCreate} className="card stack">
            <h3>Create application</h3>
            <div className="grid2">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  placeholder="Payments API"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="What is this app used for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="btnRow">
              <button type="submit" className="btn btnSuccess">
                Create
              </button>
            </div>
          </form>
        )}

        <ul className="list">
          {applications.map((app) => (
            <li key={app.id} className="list-item stack">
              {editingApp === app.id ? (
                <form onSubmit={handleUpdate} className="stack">
                  <div className="grid2">
                    <div className="form-group">
                      <label>Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                    </div>
                  </div>
                  <div className="btnRow">
                    <button type="submit" className="btn btnSuccess">
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="btn btnGhost"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="stack">
                  <div>
                    <h3>{app.name}</h3>
                    <p className="muted">{app.description || "—"}</p>
                  </div>
                  {user?.role === "admin" && (
                    <div className="btnRow">
                      <button
                        type="button"
                        onClick={() => handleEdit(app)}
                        className="btn btnPrimary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(app.id)}
                        className="btn btnDanger"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Applications;
