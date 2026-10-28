import React from 'react';
export default function Sidebar({ t, user, navItems, page, go }) {
  return <aside className="sidebar"><div className="profile"><div className="profile-avatar">👩🏽</div><div><strong>{user ? user.fullName : t.welcome}</strong><small>{user ? user.role : t.profile}</small></div></div><p className="nav-caption">{t.navHome}</p><nav className="side-nav">{navItems.map(([id, icon, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)}><span className="nav-icon">{icon}</span>{label}</button>)}</nav><div className="privacy-card"><strong>🔒 {t.privacyTitle}</strong><p>{t.privacyText}</p></div></aside>;
}
