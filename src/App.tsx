import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Logo } from "./components/Logo";
import { ThemeToggle } from "./components/ThemeToggle";
import Home from "./routes/Home";
import Admin from "./routes/Admin";
import NotFound from "./routes/NotFound";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="shell">
      <ScrollToTop />
      <header className="site-header">
        <Link to="/" className="brand" aria-label="pwsh.ca home">
          <span className="brand-mark">
            <Logo />
          </span>
          <span className="brand-name">
            pwsh<span className="brand-dim">.ca</span>
          </span>
        </Link>
        <div className="site-tools">
          <nav className="site-nav">
            <a
              href="https://github.com/PowerShell/PowerShell"
              target="_blank"
              rel="noreferrer"
            >
              PowerShell
            </a>
            <a href="https://adilio.ca/">Adilio.ca</a>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main className="site-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="site-footer">
        <p>
          <span className="footer-brand">pwsh.ca</span> · a community-run corner
          for open-source PowerShell, kept by{" "}
          <a href="https://adilio.ca/">Adil Leghari</a>. Not affiliated with or
          endorsed by Microsoft.
        </p>
        <p className="footer-links">
          <a
            href="https://github.com/adilio/pwsh.ca"
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
          <span aria-hidden="true"> · </span>
          <Link to="/admin">admin</Link>
        </p>
      </footer>
    </div>
  );
}
