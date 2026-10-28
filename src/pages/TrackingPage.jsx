import React from 'react';
import PageHeading from '../components/PageHeading.jsx';
import RequestRow from '../components/RequestRow.jsx';

export default function TrackingPage(props) {
  const { t, go, requests } = props;
  return <>
    <PageHeading eyebrow={t.navTrack} title={t.trackTitle} description={t.trackIntro}><button className="btn primary" onClick={() => go('request')}>{t.newRequest}</button></PageHeading><div className="panel request-list">{requests.length ? requests.map((request, index) => <RequestRow key={request.id} request={request} t={t} index={index} detailed />) : <div className="empty">🌱<p>{t.noRequests}</p></div>}</div>
  </>;
}
