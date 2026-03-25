import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./authCore";

const navLinkClassName = ({ isActive }) =>
  `sidebarLink${isActive ? " isActive" : ""}`;

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const orgLabel = useMemo(() => {
    const org = user?.organizationId ?? "—";
    const role = user?.role ?? "—";
    return `Org ${org} • ${role}`;
  }, [user?.organizationId, user?.role]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="appShell">
      <aside className={`sidebar${mobileOpen ? " isOpen" : ""}`}>
        <div className="sidebarHeader">
          <div className="brand">
            <div className="brandMark" aria-hidden="true" />
            <div className="brandText">
              <div className="brandName">LogRush</div>
              <div className="brandMeta">{orgLabel}</div>
            </div>
          </div>
        </div>

        <nav className="sidebarNav" aria-label="Primary">
          <NavLink to="/dashboard" className={navLinkClassName}>
            Dashboard
          </NavLink>
          <NavLink to="/applications" className={navLinkClassName}>
            Applications
          </NavLink>
          <NavLink to="/environments" className={navLinkClassName}>
            Environments
          </NavLink>
          <NavLink to="/logs" className={navLinkClassName}>
            Logs
          </NavLink>

          {user?.role === "admin" && (
            <>
              <div className="sidebarDivider" role="separator" />
              <div className="sidebarSectionLabel">Admin</div>
              <NavLink to="/users" className={navLinkClassName}>
                Users
              </NavLink>
              <NavLink to="/apikeys" className={navLinkClassName}>
                API Keys
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebarFooter">
          <div className="sidebarFooterRow">
            <div className="userChip" title={user?.username ?? ""}>
              <div className="userAvatar" aria-hidden="true">
                {(user?.username?.[0] ?? "U").toUpperCase()}
              </div>
              <div className="userChipText">
                <div className="userChipName">{user?.username ?? "User"}</div>
                <div className="userChipMeta">{user?.role ?? ""}</div>
              </div>
            </div>

            <button type="button" className="btn btnGhost" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="appBackdrop" onClick={() => setMobileOpen(false)} />

      <div className="appMain">
        <header className="topbar">
          <button
            type="button"
            className="btn btnGhost topbarMenu"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            <span className="hamburger" aria-hidden="true" />
          </button>

          <div className="topbarSpacer" />

          <div className="topbarRight">
            <div className="pill">{user?.username ?? ""}</div>
          </div>
        </header>

        <main className="appContent">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

