import React from 'react';
import Stat from '../components/Stat.jsx';
import FeatureCard from '../components/FeatureCard.jsx';
import RequestRow from '../components/RequestRow.jsx';

export default function HomePage(props) {
  const { t, requests, opportunities, go, setForm } = props;
  return <>
    <section className="hero-grid"><div className="hero-copy"><span className="eyebrow">{t.heroEyebrow}</span><h1>{t.heroTitle}</h1><p>{t.heroText}</p><div className="actions"><button className="btn primary" onClick={() => go('request')}>🎙️ {t.askVoice}</button><button className="btn secondary" onClick={() => go('opportunities')}>🌱 {t.seeWork}</button></div></div><div className="hero-art"><span className="demo-label">✦ {t.demo}</span><div className="illustration">👩🏽‍🌾</div><h2>{t.heroCardTitle}</h2><p>{t.heroCardText}</p><div className="decor-ring" /></div></section>
          <section className="stats"><Stat icon="📌" value={requests.filter(r => r.status !== 'completed').length.toString().padStart(2, '0')} label={t.statRequests} /><Stat icon="🌾" value={String(opportunities.length).padStart(2, '0')} label={t.statOpportunities} /><Stat icon="🤝" value="01" label={t.statSupport} /></section>
          <section className="section-heading"><div><h2>{t.quickTitle}</h2><p>{t.quickText}</p></div></section><section className="feature-grid"><FeatureCard icon="🎙️" title={t.featureRequest} text={t.featureRequestText} action={t.start} onClick={() => go('request')} /><FeatureCard icon="🌾" title={t.featureWork} text={t.featureWorkText} action={t.start} onClick={() => go('opportunities')} /><FeatureCard icon="🧭" title={t.featureTrack} text={t.featureTrackText} action={t.start} onClick={() => go('tracking')} /></section>
          <section className="bottom-grid"><div className="panel"><div className="panel-heading"><div><h2>{t.recent}</h2><p>{t.recentText}</p></div><button className="text-button" onClick={() => go('tracking')}>{t.seeAll}</button></div>{requests.slice(0, 3).map(request => <RequestRow key={request.id} request={request} t={t} />)}</div><div className="saheli panel"><div className="saheli-icon">🤝</div><h2>{t.saheliTitle}</h2><p>{t.saheliText}</p><button className="btn primary" onClick={() => { setForm(old => ({ ...old, type: 'saheli' })); go('request'); }}>{t.askSaheli}</button></div></section>
  </>;
}
