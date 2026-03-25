import { useEffect, useState } from "react";
import { useAuth } from "./authCore";
import { api } from "../lib/api";

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    applications: 0,
    environments: 0,
    apiKeys: null,
    logs24h: null,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");
      try {
        const startTime = new Date(
          Date.now() - 24 * 60 * 60 * 1000,
        ).toISOString();

        const [appsRes, envsRes] = await Promise.all([
          api.get("/application/"),
          api.get("/application/envs"),
        ]);

        const next = {
          applications: appsRes.data.applications?.length ?? 0,
          environments: envsRes.data.environments?.length ?? 0,
          apiKeys: null,
          logs24h: null,
        };

        try {
          const logsRes = await api.get("/logs", {
            params: { startTime, page: 1, perPage: 1 },
          });
          next.logs24h = logsRes.data.total ?? 0;
        } catch {
          next.logs24h = null;
        }

        if (user?.role === "admin") {
          try {
            const keysRes = await api.get("/apikey/list");
            next.apiKeys = keysRes.data.apiKeys?.length ?? 0;
          } catch {
            next.apiKeys = null;
          }
        }

        setStats(next);
      } catch {
        setError("Failed to load dashboard stats");
      }
    };

    load();
  }, [user?.role]);

  return (
    <div className="container">
      <div className="card stack">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            Welcome back, <strong>{user?.username}</strong>. Here’s what’s happening
            in your organization.
          </p>
        </div>
        {error && <p className="error">{error}</p>}

        <div className="grid3">
          <div className="card">
            <h3>Applications</h3>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {stats.applications}
            </div>
            <p className="muted">Registered apps</p>
          </div>
          <div className="card">
            <h3>Environments</h3>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {stats.environments}
            </div>
            <p className="muted">Across applications</p>
          </div>
          <div className="card">
            <h3>Logs (24h)</h3>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {stats.logs24h ?? "—"}
            </div>
            <p className="muted">Total ingested</p>
          </div>
        </div>

        {user?.role === "admin" && (
          <div className="card">
            <h3>API Keys</h3>
            <p className="muted">Total active keys</p>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {stats.apiKeys ?? "—"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
