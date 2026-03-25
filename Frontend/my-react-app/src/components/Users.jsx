import { useState, useEffect } from "react";
import { api } from "../lib/api";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [error, setError] = useState("");

  async function fetchUsers() {
    try {
      const response = await api.get("/user/list");
      setUsers(response.data.users);
    } catch {
      setError("Failed to fetch users");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get("/user/list");
        if (!cancelled) setUsers(response.data.users);
      } catch {
        if (!cancelled) setError("Failed to fetch users");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/user/create", { username, password, role });
      setUsername("");
      setPassword("");
      setRole("user");
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create user");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete("/user/delete", {
        data: { userId: id },
      });
      fetchUsers();
    } catch {
      setError("Failed to delete user");
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user.id);
    setEditUsername(user.username);
    setEditRole(user.role);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put("/user/update", {
        userId: editingUser,
        username: editUsername,
        role: editRole,
      });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update user");
    }
  };

  const cancelEdit = () => {
    setEditingUser(null);
  };

  return (
    <div className="container">
      <div className="card stack">
        <div>
          <h1>Users</h1>
          <p className="muted">Create, edit, and manage organization users.</p>
        </div>
        {error && <p className="error">{error}</p>}

        <form onSubmit={handleCreate} className="card stack">
          <h3>Create user</h3>
          <div className="grid3">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="jane"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="btnRow">
            <button type="submit" className="btn btnSuccess">
              Create
            </button>
          </div>
        </form>

        <div className="card stack">
          <h3>Users list</h3>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Last login</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {editingUser === row.id ? (
                        <input
                          type="text"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                        />
                      ) : (
                        row.username
                      )}
                    </td>
                    <td>
                      {editingUser === row.id ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        row.role
                      )}
                    </td>
                    <td>{new Date(row.created_at).toLocaleDateString()}</td>
                    <td>
                      {row.last_login_at
                        ? new Date(row.last_login_at).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td>
                      {editingUser === row.id ? (
                        <div className="btnRow">
                          <button
                            type="button"
                            onClick={handleUpdate}
                            className="btn btnSuccess"
                          >
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
                      ) : (
                        <div className="btnRow">
                          <button
                            type="button"
                            onClick={() => handleEdit(row)}
                            className="btn btnPrimary"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id)}
                            className="btn btnDanger"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;
