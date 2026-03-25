import { useState, useEffect } from "react";
import { api } from "../lib/api";

// Highlights all occurrences of `term` inside `text`
const Highlight = ({ text, term }) => {
  if (!term || !text) return <>{text}</>;

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = String(text).split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{
            backgroundColor: "var(--highlight, #facc15)",
            color: "inherit",
            borderRadius: "2px",
            padding: "0 2px",
          }}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    level: "",
    application: "",
    environment: "",
    q: "",
    startTime: "",
    endTime: "",
    page: 1,
    perPage: 50,
  });
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [appliedQ, setAppliedQ] = useState(""); // tracks what was actually searched

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = {};
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== "" && value !== null && value !== undefined) params[key] = value;
        });
        const response = await api.get("/logs", { params });
        if (cancelled) return;
        setLogs(response.data.logs);
        setTotal(response.data.total);
        setAppliedQ(filters.q); // sync highlight term with what was fetched
        setError("");
      } catch {
        if (!cancelled) setError("Failed to fetch logs");
      }
    })();
    return () => { cancelled = true; };
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="container">
      <div className="card stack">
        <div>
          <h1>Logs</h1>
          <p className="muted">Search and filter ingested logs.</p>
        </div>
        {error && <p className="error">{error}</p>}

        <div className="card stack">
          <h3>Filters</h3>
          <div className="grid3">
            <div className="form-group">
              <label>Query</label>
              <input
                type="text"
                name="q"
                placeholder="message contains…"
                value={filters.q}
                onChange={handleFilterChange}
              />
            </div>
            <div className="form-group">
              <label>Level</label>
              <select name="level" value={filters.level} onChange={handleFilterChange}>
                <option value="">All</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div className="form-group">
              <label>Application</label>
              <input
                type="text"
                name="application"
                placeholder="payments-api"
                value={filters.application}
                onChange={handleFilterChange}
              />
            </div>
            <div className="form-group">
              <label>Environment</label>
              <input
                type="text"
                name="environment"
                placeholder="prod"
                value={filters.environment}
                onChange={handleFilterChange}
              />
            </div>
            <div className="form-group">
              <label>Start</label>
              <input
                type="datetime-local"
                name="startTime"
                value={filters.startTime}
                onChange={handleFilterChange}
              />
            </div>
            <div className="form-group">
              <label>End</label>
              <input
                type="datetime-local"
                name="endTime"
                value={filters.endTime}
                onChange={handleFilterChange}
              />
            </div>
          </div>
        </div>

        <div className="btnRow" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div className="pill">Total: {total}</div>
          <div className="btnRow">
            <button
              type="button"
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page <= 1}
              className="btn btnGhost"
            >
              Previous
            </button>
            <div className="pill">Page {filters.page}</div>
            <button
              type="button"
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page * filters.perPage >= total}
              className="btn btnGhost"
            >
              Next
            </button>
          </div>
        </div>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Message</th>
                <th>Application</th>
                <th>Environment</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.level}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>
                    <Highlight text={log.message} term={appliedQ} />
                  </td>
                  <td>{log.application}</td>
                  <td>{log.environment}</td>
                  <td style={{ color: "var(--muted)" }}>{log["@timestamp"]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Logs;