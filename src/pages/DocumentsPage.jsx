import React from 'react';
import PageHeading from '../components/PageHeading.jsx';

export default function DocumentsPage(props) {
  const { t, go, uploadDocument, documents, deleteDocument } = props;
  return <>
    <PageHeading eyebrow={t.navDocs} title={t.docsTitle} description={t.docsIntro}><label className="btn primary">{t.addDoc}<input type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={uploadDocument}/></label></PageHeading><div className="notice">🔒 {t.docPrivacy} {t.encryptedDocs}</div><div className="panel request-list">{documents.length?documents.map(doc=><div className="request-row" key={doc.id}><span className="request-dot green"/><div className="request-main"><strong>{doc.originalName}</strong><p>{doc.mimeType} · {Math.ceil(doc.byteSize/1024)} KB · {new Date(doc.createdAt).toLocaleDateString()}</p></div><div className="doc-actions"><a className="btn outline small" href={`/api/documents/${doc.id}/download`}>{t.download}</a><button className="btn outline small" onClick={()=>deleteDocument(doc.id)}>{t.delete}</button></div></div>):<div className="empty">📄<p>{t.noDocuments}</p></div>}</div>
  </>;
}
