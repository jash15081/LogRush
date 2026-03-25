import { useState, useEffect } from "react";
import { useAuth } from "./authCore";
import { api } from "../lib/api";

const Environments = () => {
  const { user } = useAuth();
  const [environments, setEnvironments] = useState([]);
  const [name, setName] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editApplicationId, setEditApplicationId] = useState("");
  const [filterApplicationId, setFilterApplicationId] = useState("");

  async function fetchEnvironments(currentFilterApplicationId = filterApplicationId) {
    try {
      const response = await api.get("/application/envs", {
        params: currentFilterApplicationId
          ? { applicationId: currentFilterApplicationId }
          : {},
      });
      setEnvironments(response.data.environments);
    } catch {
      setError("Failed to fetch environments");
    }
  }

  async function fetchApplications() {
    try {
      const response = await api.get("/application/");
      setApplications(response.data.applications);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchEnvironments("");
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/application/envs/create", { name, applicationId });
      setName("");
      setApplicationId("");
      fetchEnvironments();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create environment");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete("/application/envs/delete", {
        data: { environmentId: id },
      });
      fetchEnvironments();
    } catch {
      setError("Failed to delete environment");
    }
  };

  const handleEdit = (env) => {
    setEditId(env.id);
    setEditName(env.name);
    setEditApplicationId(env.applicationId || "");
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put("/application/envs/update", {
        environmentId: editId,
        name: editName,
        applicationId: editApplicationId || null,
      });
      setEditId(null);
      setEditName("");
      setEditApplicationId("");
      fetchEnvironments();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update environment");
    }
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditApplicationId("");
  };

  return (
    <div className="container">
      <div className="card stack">
        <div>
          <h1>Environments</h1>
          <p className="muted">Define deployment targets per application.</p>
        </div>
        {error && <p className="error">{error}</p>}

        <div className="card stack">
          <h3>Filter</h3>
          <div className="grid2">
            <div className="form-group">
              <label>Application</label>
              <select
                value={filterApplicationId}
                onChange={(e) => setFilterApplicationId(e.target.value)}
              >
                <option value="">All applications</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="btnRow">
            <button
              type="button"
              className="btn btnGhost"
              onClick={() => fetchEnvironments()}
            >
              Apply
            </button>
          </div>
        </div>

        {user?.role === "admin" && (
          <form onSubmit={handleCreate} className="card stack">
            <h3>Create environment</h3>
            <div className="grid2">
              <div className="form-group">
                <label>Application</label>
                <select
                  value={applicationId}
                  onChange={(e) => setApplicationId(e.target.value)}
                  required
                >
                  <option value="">Select Application</option>
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Environment</label>
                <select value={name} onChange={(e) => setName(e.target.value)} required>
                  <option value="">Select Environment</option>
                  <option value="prod">Production</option>
                  <option value="staging">Staging</option>
                  <option value="dev">Development</option>
                  <option value="test">Test</option>
                </select>
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
          {environments.map((env) => (
            <li key={env.id} className="list-item stack">
              {editId === env.id ? (
                <form onSubmit={handleUpdate} className="stack">
                  <div className="grid2">
                    <div className="form-group">
                      <label>Application</label>
                    <select
                      value={editApplicationId}
                      onChange={(e) => setEditApplicationId(e.target.value)}
                      required
                    >
                      <option value="">Select Application</option>
                      {applications.map((app) => (
                        <option key={app.id} value={app.id}>
                          {app.name}
                        </option>
                      ))}
                    </select>
                    </div>
                    <div className="form-group">
                      <label>Environment</label>
                    <select
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    >
                      <option value="">Select Environment</option>
                      <option value="prod">Production</option>
                      <option value="staging">Staging</option>
                      <option value="dev">Development</option>
                      <option value="test">Test</option>
                    </select>
                    </div>
                  </div>
                  <div className="btnRow">
                    <button type="submit" className="btn btnSuccess">
                      Update
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="btn btnGhost"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="stack">
                  <div>
                    <h3>{env.name}</h3>
                    <p className="muted">
                      Application:{" "}
                      {applications.find((a) => String(a.id) === String(env.applicationId))
                        ?.name || env.applicationId}
                    </p>
                  </div>
                  {user?.role === "admin" && (
                    <div className="btnRow">
                      <button
                        type="button"
                        onClick={() => handleEdit(env)}
                        className="btn btnPrimary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(env.id)}
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

export default Environments;
