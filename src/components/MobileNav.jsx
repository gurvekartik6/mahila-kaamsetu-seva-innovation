import React from 'react';
export default function MobileNav({ navItems, page, go }) {
  return <nav className="mobile-nav" aria-label="Primary navigation">{navItems.map(([id, icon, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>;
}
