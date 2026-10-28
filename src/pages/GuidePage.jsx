import React from 'react';
import PageHeading from '../components/PageHeading.jsx';
import GuideCard from '../components/GuideCard.jsx';

export default function GuidePage(props) {
  const { t, guideTab, setGuideTab, selectedGuide, go } = props;
  return <>
    <PageHeading eyebrow={t.navGuide} title={t.guideTitle} description={t.guideIntro} /><div className="guide-tabs" role="tablist">{[['start', t.guideStart], ['request', t.guideAsk], ['work', t.guideFind], ['track', t.guideStatus], ['safety', t.guideSafety]].map(([id, label]) => <button key={id} role="tab" aria-selected={guideTab === id} className={guideTab === id ? 'active' : ''} onClick={() => setGuideTab(id)}>{label}</button>)}</div><section className="guide-focus panel"><div className="guide-number">{['start','request','work','track','safety'].indexOf(guideTab) + 1}</div><h2>{selectedGuide[0]}</h2><p>{selectedGuide[1]}</p><button className="btn primary" onClick={() => go(selectedGuide[2])}>{t.tryNow}</button></section><div className="guide-grid"><GuideCard n="1" title={t.guide1Title} text={t.guide1Text} /><GuideCard n="2" title={t.guide2Title} text={t.guide2Text} /><GuideCard n="3" title={t.guide3Title} text={t.guide3Text} /><GuideCard n="4" title={t.guide4Title} text={t.guide4Text} /><GuideCard n="5" title={t.guide5Title} text={t.guide5Text} /></div>
  </>;
}
