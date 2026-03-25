import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "./authCore";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="card" style={{ margin: 0, borderRadius: 0 }}>
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
            LogRush
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Org {user?.organizationId} • {user?.role}
          </div>
        </div>

        {user && (
          <nav className="nav" style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/applications">Applications</NavLink>
            <NavLink to="/environments">Environments</NavLink>
            <NavLink to="/logs">Logs</NavLink>
            {user.role === "admin" && (
              <>
                <NavLink to="/users">Users</NavLink>
                <NavLink to="/apikeys">API Keys</NavLink>
              </>
            )}
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
