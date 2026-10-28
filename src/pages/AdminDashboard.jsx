import React, { useState } from "react";
import PageHeading from "../components/PageHeading.jsx";
import Stat from "../components/Stat.jsx";
import FormField from "../components/FormField.jsx";

function MessageStatus({ status }) {
  const label =
    status === "open"
      ? "Awaiting admin response"
      : status === "answered"
        ? "Answered"
        : "Closed";
  return (
    <span className={`status ${status !== "open" ? "done" : ""}`}>{label}</span>
  );
}

export default function AdminDashboard(props) {
  const {
    t,
    loadAdmin,
    adminSummary,
    requests,
    updateRequestStatus,
    createOpportunity,
    adminOpportunity,
    setAdminOpportunity,
    user,
    adminUsers,
    setAdminUsers,
    adminLogs,
    notify,
    staffApplications = [],
    reviewStaffApplication,
    staffMessages = [],
    adminMessages = [],
    sendStaffMessage,
    replyStaffMessage,
  } = props;
  const [replyDrafts, setReplyDrafts] = useState({});
  const workspaceTitle = "Administrator dashboard";
  return (
    <>
      <PageHeading
        eyebrow={workspaceTitle}
        title={workspaceTitle}
        description={t.adminIntro}
      >
        <button className="btn outline" onClick={loadAdmin}>
          {t.refresh}
        </button>
      </PageHeading>
      <div className="stats">
        <Stat icon="👥" value={adminSummary?.users ?? "—"} label={t.users} />
        <Stat
          icon="📌"
          value={adminSummary?.requests ?? "—"}
          label={t.trackTitle}
        />
        <Stat
          icon="⏳"
          value={adminSummary?.openRequests ?? "—"}
          label={t.openRequests}
        />
        <Stat
          icon="🌱"
          value={adminSummary?.opportunities ?? "—"}
          label={t.navWork}
        />
      </div>

      {user.role === "admin" && (
        <section className="panel admin-panel">
          <div className="admin-section-heading">
            <div>
              <h2>Staff messages &amp; escalation inbox</h2>
              <p className="muted">
                Review staff questions and send a response. Staff can see your
                reply in their workspace.
              </p>
            </div>
            <button className="btn outline small" onClick={loadAdmin}>
              Refresh inbox
            </button>
          </div>
          {adminMessages.length ? (
            adminMessages.map((message) => (
              <article className="staff-message-card" key={message.id}>
                <div className="staff-message-card-heading">
                  <strong>{message.subject}</strong>
                  <MessageStatus status={message.status} />
                </div>
                <p className="staff-message-meta">
                  From {message.staffName || "Staff"} · {message.staffEmail} ·{" "}
                  {message.createdAt
                    ? new Date(message.createdAt).toLocaleString()
                    : ""}
                </p>
                <p>{message.message}</p>
                {message.adminReply && (
                  <div className="admin-reply">
                    <strong>Previous response</strong>
                    <p>{message.adminReply}</p>
                  </div>
                )}
                <form
                  className="staff-reply-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = String(
                      new FormData(event.currentTarget).get("reply") || "",
                    ).trim();
                    if (!value) return;
                    replyStaffMessage(message.id, value, "answered");
                  }}
                >
                  <label>
                    Reply to staff
                    <textarea
                      name="reply"
                      rows={3}
                      minLength={2}
                      maxLength={3000}
                      required
                      defaultValue={
                        replyDrafts[message.id] ?? message.adminReply
                      }
                      onChange={(event) =>
                        setReplyDrafts((old) => ({
                          ...old,
                          [message.id]: event.target.value,
                        }))
                      }
                      placeholder="Write a clear response or next steps."
                    />
                  </label>
                  <div className="staff-reply-actions">
                    <button className="btn primary" type="submit">
                      Save and send response
                    </button>
                    {message.status !== "closed" && (
                      <button
                        className="btn outline"
                        type="button"
                        onClick={() => {
                          const reply = (
                            replyDrafts[message.id] ??
                            message.adminReply ??
                            ""
                          ).trim();
                          if (!reply) {
                            notify(
                              "Write a reply before closing this message.",
                            );
                            return;
                          }
                          replyStaffMessage(message.id, reply, "closed");
                        }}
                      >
                        Reply and close
                      </button>
                    )}
                  </div>
                </form>
              </article>
            ))
          ) : (
            <p className="muted">
              No staff messages yet. Messages sent from a staff workspace will
              appear here.
            </p>
          )}
        </section>
      )}

      <section className="panel admin-panel staff-approval-panel">
        <div className="admin-section-heading">
          <div>
            <h2>Staff applications</h2>
            <p className="muted">
              Review applicants before creating a staff login. Approval is
              required before staff can sign in.
            </p>
          </div>
          <button className="btn outline small" onClick={loadAdmin}>
            Refresh applications
          </button>
        </div>
        {staffApplications.length ? (
          staffApplications.map((application) => (
            <article className="staff-application-card" key={application.id}>
              <div className="staff-case-heading">
                <div>
                  <strong>{application.fullName}</strong>
                  <p>
                    {application.email} ·{" "}
                    {application.villageOrArea || "Area not provided"}
                  </p>
                </div>
                <span
                  className={`status ${application.status === "approved" ? "done" : ""}`}
                >
                  {application.status}
                </span>
              </div>
              {application.experience && (
                <p>
                  <strong>Experience:</strong> {application.experience}
                </p>
              )}
              {application.reason && (
                <p>
                  <strong>Reason for applying:</strong> {application.reason}
                </p>
              )}
              <small className="muted">
                Applied{" "}
                {application.createdAt
                  ? new Date(application.createdAt).toLocaleString()
                  : ""}
              </small>
              {application.status === "pending" && (
                <div className="staff-reply-actions">
                  <button
                    className="btn primary"
                    onClick={() =>
                      reviewStaffApplication(application.id, "approve")
                    }
                  >
                    Approve application
                  </button>
                  <button
                    className="btn outline"
                    onClick={() =>
                      reviewStaffApplication(application.id, "reject")
                    }
                  >
                    Reject application
                  </button>
                </div>
              )}
              {application.reviewNote && (
                <p className="muted">Review note: {application.reviewNote}</p>
              )}
            </article>
          ))
        ) : (
          <p className="muted">
            No staff applications have been submitted yet.
          </p>
        )}
      </section>

      <section className="panel admin-panel">
        <h2>{t.requestQueue}</h2>
        {requests.length ? (
          requests.map((r) => (
            <div className="request-row" key={r.id}>
              <div className="request-main">
                <strong>
                  {r.id} · {r.ownerName || t.member}
                </strong>
                <p>{r.description}</p>
                <small>
                  {r.village} ·{" "}
                  {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                </small>
                <small className="muted">
                  Assigned to: {r.assignedStaffName || "Nobody yet"}
                </small>
              </div>
              <div className="admin-request-actions">
                <select
                  aria-label="Assign staff member"
                  value={r.assignedStaffId || ""}
                  onChange={async (e) => {
                    const staffId = e.target.value
                      ? Number(e.target.value)
                      : null;
                    const response = await fetch(
                      `/api/admin/requests/${encodeURIComponent(r.id)}/assign`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ staffId }),
                      },
                    );
                    const data = await response.json();
                    if (!response.ok) {
                      notify(data.error || t.error);
                      return;
                    }
                    notify("Request assignment updated.");
                    await loadAdmin();
                  }}
                >
                  <option value="">Unassigned</option>
                  {adminUsers
                    .filter((u) => u.role === "staff" && u.active !== false)
                    .map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.fullName}
                      </option>
                    ))}
                </select>
                <select
                  aria-label={t.status}
                  value={r.status}
                  onChange={(e) => updateRequestStatus(r, e.target.value)}
                >
                  <option value="created">{t.created}</option>
                  <option value="review">{t.inReview}</option>
                  <option value="in_progress">{t.inProgress}</option>
                  <option value="waiting_user">{t.waitingUser}</option>
                  <option value="completed">{t.completed}</option>
                  <option value="rejected">{t.rejected}</option>
                </select>
              </div>
            </div>
          ))
        ) : (
          <p>{t.noRequests}</p>
        )}
      </section>

      <section className="panel admin-panel">
        <h2>{t.addOpportunity}</h2>
        <form className="admin-form" onSubmit={createOpportunity}>
          <FormField label={t.opTitle}>
            <input
              required
              minLength="3"
              maxLength="180"
              value={adminOpportunity.title}
              onChange={(e) =>
                setAdminOpportunity({
                  ...adminOpportunity,
                  title: e.target.value,
                })
              }
            />
          </FormField>
          <FormField label={t.description}>
            <textarea
              required
              minLength="3"
              maxLength="3000"
              value={adminOpportunity.description}
              onChange={(e) =>
                setAdminOpportunity({
                  ...adminOpportunity,
                  description: e.target.value,
                })
              }
            />
          </FormField>
          <FormField label={t.kind}>
            <select
              value={adminOpportunity.kind}
              onChange={(e) =>
                setAdminOpportunity({
                  ...adminOpportunity,
                  kind: e.target.value,
                })
              }
            >
              <option value="training">{t.training}</option>
              <option value="work">{t.work}</option>
              <option value="support">{t.support}</option>
            </select>
          </FormField>
          <FormField label={t.organisation}>
            <input
              required
              value={adminOpportunity.organisation}
              onChange={(e) =>
                setAdminOpportunity({
                  ...adminOpportunity,
                  organisation: e.target.value,
                })
              }
            />
          </FormField>
          <FormField label={t.location}>
            <input
              value={adminOpportunity.location}
              onChange={(e) =>
                setAdminOpportunity({
                  ...adminOpportunity,
                  location: e.target.value,
                })
              }
            />
          </FormField>
          <FormField label={t.eligibility}>
            <input
              value={adminOpportunity.eligibility}
              onChange={(e) =>
                setAdminOpportunity({
                  ...adminOpportunity,
                  eligibility: e.target.value,
                })
              }
            />
          </FormField>
          <FormField label={t.compensation}>
            <input
              value={adminOpportunity.compensation}
              onChange={(e) =>
                setAdminOpportunity({
                  ...adminOpportunity,
                  compensation: e.target.value,
                })
              }
            />
          </FormField>
          <FormField label={t.applicationUrl}>
            <input
              type="url"
              value={adminOpportunity.applicationUrl}
              onChange={(e) =>
                setAdminOpportunity({
                  ...adminOpportunity,
                  applicationUrl: e.target.value,
                })
              }
            />
          </FormField>
          <FormField label={t.contact}>
            <input
              value={adminOpportunity.contact}
              onChange={(e) =>
                setAdminOpportunity({
                  ...adminOpportunity,
                  contact: e.target.value,
                })
              }
            />
          </FormField>
          {user.role === "admin" && (
            <>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={adminOpportunity.verified}
                  onChange={(e) =>
                    setAdminOpportunity({
                      ...adminOpportunity,
                      verified: e.target.checked,
                    })
                  }
                />
                {t.verifyOpportunity}
              </label>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={adminOpportunity.published}
                  onChange={(e) =>
                    setAdminOpportunity({
                      ...adminOpportunity,
                      published: e.target.checked,
                    })
                  }
                />
                {t.publishOpportunity}
              </label>
            </>
          )}
          {user.role !== "admin" && (
            <p className="field">
              <small>
                New listings remain unpublished until an administrator verifies
                and publishes them.
              </small>
            </p>
          )}
          <button className="btn primary" type="submit">
            {t.saveOpportunity}
          </button>
        </form>
      </section>

      {user.role === "admin" && (
        <section className="panel admin-panel">
          <h2>{t.users}</h2>
          {adminUsers.map((u) => (
            <div className="request-row" key={u.id}>
              <div className="request-main">
                <strong>{u.fullName}</strong>
                <p>
                  {u.email} · {u.role} ·{" "}
                  {u.active === false ? t.accountDisabled : t.accountActive}
                </p>
              </div>
              <select
                value={u.role}
                aria-label={t.role}
                onChange={async (e) => {
                  const r = await fetch(`/api/admin/users/${u.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: e.target.value }),
                  });
                  const d = await r.json();
                  if (!r.ok) notify(d.error || t.error);
                  else
                    setAdminUsers((old) =>
                      old.map((x) => (x.id === u.id ? d.user : x)),
                    );
                }}
              >
                <option value="member">member</option>
                <option value="staff" disabled>
                  staff (approval required)
                </option>
                <option value="admin">admin</option>
              </select>
              <button
                className="btn outline small"
                onClick={async () => {
                  const r = await fetch(`/api/admin/users/${u.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ active: u.active === false }),
                  });
                  const d = await r.json();
                  if (!r.ok) notify(d.error || t.error);
                  else
                    setAdminUsers((old) =>
                      old.map((x) => (x.id === u.id ? d.user : x)),
                    );
                }}
              >
                {u.active === false ? t.enableAccount : t.disableAccount}
              </button>
            </div>
          ))}
        </section>
      )}
      <section className="panel admin-panel">
        <h2>{t.auditLogs}</h2>
        {adminLogs.map((log, i) => (
          <div className="audit-row" key={log.id || i}>
            <strong>{log.action}</strong>
            <span>
              {log.actor || ""} · {log.entityType || ""} {log.entityId || ""}
            </span>
            <small>
              {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
            </small>
          </div>
        ))}
      </section>
    </>
  );
}
