import React from "react";
export default function Header({
  t,
  language,
  setLanguage,
  apiMode,
  user,
  onAuthAction,
  go,
  languages,
}) {
  const homePage =
    user?.role === "admin"
      ? "admin"
      : user?.role === "staff"
        ? "staff"
        : "home";
  return (
    <header className="topbar">
      <button
        className="brand"
        onClick={() => go(homePage)}
        aria-label="Mahila KaamSetu home"
      >
        <span className="brand-mark">🌿</span>
        <span>
          <strong>Mahila KaamSetu</strong>
          <small>{t.tagline}</small>
        </span>
      </button>
      <div className="top-actions">
        <span className={`mode-pill ${apiMode === "live" ? "live" : ""}`}>
          {apiMode === "live" ? "● " + t.apiLive : "● " + t.demo}
        </span>
        <label className="language-select">
          <span aria-hidden="true">文</span>
          <select
            aria-label={t.language}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button className="help-top" onClick={onAuthAction}>
          {user ? `${user.fullName} · ${t.signOut}` : t.signIn}
        </button>
        {user?.role === "member" && (
          <button className="help-top" onClick={() => go("guide")}>
            ⓘ <span>{t.navGuide}</span>
          </button>
        )}
      </div>
    </header>
  );
}
