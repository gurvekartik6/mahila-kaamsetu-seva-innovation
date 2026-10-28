import React from "react";

export default function Sidebar({ t, user, navItems, page, go }) {
  return (
    <aside className="sidebar">
      <div className="profile">
        <div className="profile-avatar">
          {user?.role === "admin" ? "🛡️" : user?.role === "staff" ? "💼" : "👩🏽"}
        </div>
        <div>
          <strong>{user ? user.fullName : t.welcome}</strong>
          <small>{user ? user.role : t.profile}</small>
        </div>
      </div>
      <p className="nav-caption">
        {user?.role === "admin"
          ? "ADMINISTRATION"
          : user?.role === "staff"
            ? "STAFF WORKSPACE"
            : t.navHome}
      </p>
      <nav className="side-nav">
        {navItems.map(([id, icon, label]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => go(id)}
          >
            <span className="nav-icon" aria-hidden="true">{icon}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
      <div className="privacy-card">
        <strong>🔒 {t.privacyTitle}</strong>
        <p>{t.privacyText}</p>
      </div>
    </aside>
  );
}
