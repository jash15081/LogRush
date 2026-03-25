import { useEffect, useState } from "react";
import { api } from "../lib/api";

const APIKeys = () => {
  const [name, setName] = useState("");
  const [rateLimitPerSec, setRateLimitPerSec] = useState(1000);
  const [expiresAt, setExpiresAt] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [error, setError] = useState("");
  const [apiKeys, setApiKeys] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editRateLimit, setEditRateLimit] = useState(1000);
  const [editExpiresAt, setEditExpiresAt] = useState("");

  async function fetchApiKeys() {
    try {
      const response = await api.get("/apikey/list");
      setApiKeys(response.data.apiKeys);
    } catch {
      setError("Failed to fetch API keys");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get("/apikey/list");
        if (!cancelled) setApiKeys(response.data.apiKeys);
      } catch {
        if (!cancelled) setError("Failed to fetch API keys");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/apikey/generate", {
        name,
        rateLimitPerSec: Number(rateLimitPerSec),
        expiresAt: expiresAt || null,
      });
      setGeneratedKey(response.data.apiKey);
      setName("");
      setRateLimitPerSec(1000);
      setExpiresAt("");
      fetchApiKeys();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate API key");
    }
  };

  const handleRevoke = async (id) => {
    try {
      await api.delete("/apikey/revoke", {
        data: { apiKeyId: id },
      });
      fetchApiKeys();
    } catch {
      setError("Failed to revoke API key");
    }
  };

  const handleEdit = (key) => {
    setEditId(key.id);
    setEditName(key.name);
    setEditRateLimit(key.rateLimitPerSec);
    setEditExpiresAt(
      key.expiresAt ? new Date(key.expiresAt).toISOString().slice(0, 16) : "",
    );
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put("/apikey/update", {
        apiKeyId: editId,
        name: editName,
        rateLimitPerSec: Number(editRateLimit),
        expiresAt: editExpiresAt || null,
      });
      setEditId(null);
      setEditName("");
      setEditRateLimit(1000);
      setEditExpiresAt("");
      fetchApiKeys();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update API key");
    }
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditRateLimit(1000);
    setEditExpiresAt("");
  };

  return (
    <div className="container">
      <div className="card stack">
        <div>
          <h1>API Keys</h1>
          <p className="muted">Generate and manage ingestion credentials.</p>
        </div>
        {error && <p className="error">{error}</p>}

        {generatedKey && (
          <div
            className="card stack"
            style={{
              borderColor: "rgba(51, 209, 122, 0.35)",
              backgroundColor: "rgba(51, 209, 122, 0.12)",
            }}
          >
            <div>
              <h3>New key (copy now)</h3>
              <p className="muted">Store this securely. It won’t be shown again.</p>
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                overflow: "auto",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(0,0,0,0.18)",
              }}
            >
              {generatedKey}
            </div>
          </div>
        )}

        <form onSubmit={handleGenerate} className="card stack">
          <h3>Generate API key</h3>
          <div className="grid3">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                placeholder="CI ingestion"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Rate limit / sec</label>
              <input
                type="number"
                placeholder="1000"
                value={rateLimitPerSec}
                onChange={(e) => setRateLimitPerSec(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Expires at</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <div className="btnRow">
            <button type="submit" className="btn btnSuccess">
              Generate
            </button>
          </div>
        </form>

        <ul className="list">
          {apiKeys.map((key) => (
            <li key={key.id} className="list-item stack">
              {editId === key.id ? (
                <form onSubmit={handleUpdate} className="stack">
                  <div className="grid3">
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
                      <label>Rate limit / sec</label>
                    <input
                      type="number"
                      value={editRateLimit}
                      onChange={(e) => setEditRateLimit(e.target.value)}
                    />
                    </div>
                    <div className="form-group">
                      <label>Expires at</label>
                    <input
                      type="datetime-local"
                      value={editExpiresAt}
                      onChange={(e) => setEditExpiresAt(e.target.value)}
                    />
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
                    <h3>{key.name}</h3>
                    <p className="muted">Rate limit: {key.rateLimitPerSec}/sec</p>
                    <p className="muted">
                      Expires:{" "}
                      {key.expiresAt
                        ? new Date(key.expiresAt).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                  <div className="btnRow">
                    <button
                      type="button"
                      onClick={() => handleEdit(key)}
                      className="btn btnPrimary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(key.id)}
                      className="btn btnDanger"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default APIKeys;
