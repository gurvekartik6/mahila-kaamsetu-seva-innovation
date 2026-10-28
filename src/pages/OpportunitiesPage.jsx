import React from 'react';
import PageHeading from '../components/PageHeading.jsx';

export default function OpportunitiesPage({ t, filter, setFilter, opportunities, setForm, go, apiMode }) {
  const published = opportunities.filter(item => item.verified === true && item.published === true);
  const visible = published.filter(item => filter === 'all' || item.kind === filter);
  return <>
    <PageHeading eyebrow={t.navWork} title={t.workTitle} description={t.workIntro} />
    <div className="filter-row"><label>{t.filter}<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{t.all}</option><option value="training">{t.training}</option><option value="work">{t.work}</option><option value="support">{t.support}</option></select></label></div>
    {visible.length ? <div className="opportunity-grid">{visible.map(item => <article className="opportunity panel" key={item.id}>
      <div className="opp-top"><span className="opp-icon">🌱</span><span className="tag">{t[item.kind] || item.kind}</span></div><h2>{item.title}</h2><p>{item.description}</p><p><strong>{item.organisation}</strong>{item.location ? ` · ${item.location}` : ''}{item.compensation ? ` · ${item.compensation}` : ''}</p>
      {item.eligibility && <p><strong>{t.eligibility || 'Eligibility'}:</strong> {item.eligibility}</p>}
      <div className="opp-bottom"><span>✓ {t.verifiedOpportunity || 'Verified and published'}</span>{item.applicationUrl && <a className="btn outline small" href={item.applicationUrl} target="_blank" rel="noopener noreferrer">{t.learnMore} →</a>}<button className="btn outline small" onClick={() => { setForm(old => ({ ...old, type: 'work', description: `${item.title} — ` })); go('request'); }}>{t.learnMore} / {t.requestHelp || 'Ask about this'}</button></div>
    </article>)}</div> : <section className="panel empty-state" role="status"><div className="big">🌱</div><h2>{filter === 'all' ? (t.noPublishedOpportunities || 'No verified opportunities are currently published') : (t.noMatchingOpportunities || 'No published opportunities match this filter')}</h2><p>{apiMode === 'live' ? (t.opportunitiesEmptyLive || 'Please check again later. Only verified, published listings are shown here.') : (t.opportunitiesEmptyDemo || 'The database is not connected, so real opportunities cannot be loaded. No sample listings are shown as real jobs.')}</p><button className="btn primary" onClick={() => { setForm(old => ({ ...old, type: 'work', description: '' })); go('request'); }}>{t.askForOpportunityInfo || 'Request information'} →</button></section>}
    <div className="notice"><strong>ℹ️ {t.transparency}:</strong> {t.noRealJobs}</div>
  </>;
}
