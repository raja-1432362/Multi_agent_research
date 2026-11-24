import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "./auth";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import NewResearch from "./pages/NewResearch";
import RunPage from "./pages/RunPage";
import Settings from "./pages/Settings";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <p className="center muted">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <header className="topbar">
        <a href="/landing.html" className="brand" onClick={() => setMobileMenuOpen(false)}>
          <div className="nav-orb"></div>
          <span>Evidence Desk</span>
        </a>

        {/* Mobile menu toggle button */}
        <button
          className="mobile-menu-btn"
          aria-label="Toggle Navigation"
          onClick={() => setMobileMenuOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Navigation links (desktop and responsive mobile drawer) */}
        <nav className={`nav-links ${mobileMenuOpen ? "open" : ""}`}>
          {user ? (
            <>
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>History</Link>
              <Link to="/new" className="btn small" onClick={() => setMobileMenuOpen(false)}>New research</Link>
              <Link to="/settings" onClick={() => setMobileMenuOpen(false)}>Settings</Link>
              <button
                className="link"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
              <Link to="/register" className="btn small" onClick={() => setMobileMenuOpen(false)}>Create account</Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/new" element={<Protected><NewResearch /></Protected>} />
          <Route path="/research/:id" element={<Protected><RunPage /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="*" element={<p className="center muted">Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
