import { NavLink, Outlet, Link } from 'react-router-dom';

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/jobs', label: 'Jobs' },
  { to: '/search', label: 'Candidate Search' },
  { to: '/resume-search', label: 'Resume Search' },
  { to: '/shortlists', label: 'Shortlists' },
];

export default function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">T</span> TalentDesk <span className="brand-sub">Recruiter</span>
          </Link>
          <nav className="mainnav">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            <Link to="/jobs/new" className="btn btn-primary btn-sm">Post a Job</Link>
            <NavLink to="/profile" className="avatar-link" title="Recruiter profile">Profile</NavLink>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
