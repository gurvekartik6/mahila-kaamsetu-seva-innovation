import React from "react";
import PageHeading from "../components/PageHeading.jsx";

const statusOptions = [
  ["created", "Submitted"],
  ["review", "Under review"],
  ["in_progress", "In progress"],
  ["waiting_user", "Awaiting information"],
  ["completed", "Resolved"],
  ["rejected", "Closed / not eligible"],
];

export default function StaffDashboard({
  user,
  requests = [],
  updateRequestStatus,
  loadStaff,
  notify,
  staffMessages = [],
  sendStaffMessage,
}) {
  return (
    <>
      <PageHeading
        eyebrow="Staff workspace"
        title="Community support workspace"
        description="Work only on requests assigned to your staff account. Record progress clearly and protect each woman's personal information."
      >
        <button className="btn outline" onClick={loadStaff}>
          Refresh
        </button>
      </PageHeading>
      <div className="stats">
        <div className="stat">
          <div className="stat-icon">📌</div>
          <div>
            <div className="stat-value">{requests.length}</div>
            <div className="stat-label">Assigned requests</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon">⏳</div>
          <div>
            <div className="stat-value">
              {
                requests.filter(
                  (item) => !["completed", "rejected"].includes(item.status),
                ).length
              }
            </div>
            <div className="stat-label">Open cases</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon">✓</div>
          <div>
            <div className="stat-value">
              {requests.filter((item) => item.status === "completed").length}
            </div>
            <div className="stat-label">Resolved cases</div>
          </div>
        </div>
      </div>
      <section className="panel admin-panel">
        <div className="admin-section-heading">
          <div>
            <h2>My assigned requests</h2>
            <p className="muted">
              Only requests assigned to you appear here. Ask an administrator if
              you need a case assigned.
            </p>
          </div>
        </div>
        {requests.length ? (
          requests.map((request) => (
            <article className="staff-case-card" key={request.id}>
              <div className="staff-case-heading">
                <div>
                  <strong>
                    {request.id} · {request.ownerName || "Member"}
                  </strong>
                  <p>
                    {request.type} · {request.village || "Village not provided"}
                  </p>
                </div>
                <span
                  className={`status ${request.status === "completed" ? "done" : ""}`}
                >
                  {statusOptions.find(
                    ([value]) => value === request.status,
                  )?.[1] || request.status}
                </span>
              </div>
              <p>{request.description}</p>
              <small className="muted">
                Submitted{" "}
                {request.createdAt
                  ? new Date(request.createdAt).toLocaleString()
                  : "date unavailable"}
              </small>
              <div className="staff-case-actions">
                <label>
                  Status{" "}
                  <select
                    value={request.status}
                    onChange={(event) =>
                      updateRequestStatus(request, event.target.value)
                    }
                  >
                    {statusOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <div className="big">🗂️</div>
            <h3>No requests assigned yet</h3>
            <p>
              When an administrator assigns a request to your account, it will
              appear here.
            </p>
          </div>
        )}
      </section>
      <section className="panel admin-panel">
        <h2>Staff responsibilities</h2>
        <ul className="tip-list">
          <li>Contact the woman using the consented contact method.</li>
          <li>
            Check information and documents only when needed and with consent.
          </li>
          <li>
            Record factual progress; do not claim that an external service was
            approved without confirmation.
          </li>
          <li>Escalate sensitive or unresolved cases to an administrator.</li>
        </ul>
      </section>
      <section className="panel admin-panel">
        <h2>Contact administrator</h2>
        <p className="muted">
          Ask for help with account access, an assigned case or an operational
          issue.
        </p>
        <form
          className="staff-message-form"
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget);
            sendStaffMessage(event, {
              subject: String(data.get("subject") || ""),
              message: String(data.get("message") || ""),
            });
          }}
        >
          <label className="field">
            Subject
            <input
              name="subject"
              required
              minLength={3}
              maxLength={160}
              placeholder="What do you need help with?"
            />
          </label>
          <label className="field">
            Message
            <textarea
              name="message"
              required
              minLength={3}
              maxLength={3000}
              rows={3}
              placeholder="Describe the issue or request ID."
            />
          </label>
          <button className="btn primary" type="submit">
            Send to administrator
          </button>
        </form>
        <div className="admin-section-heading" style={{ marginTop: 20 }}>
          <h3>My messages</h3>
          <button className="btn outline small" onClick={loadStaff}>
            Refresh
          </button>
        </div>
        {staffMessages.length ? (
          staffMessages.map((message) => (
            <article className="staff-message-card" key={message.id}>
              <div className="staff-case-heading">
                <strong>{message.subject}</strong>
                <span
                  className={`status ${message.status !== "open" ? "done" : ""}`}
                >
                  {message.status}
                </span>
              </div>
              <p>{message.message}</p>
              {message.adminReply ? (
                <div className="admin-reply">
                  <strong>Administrator response</strong>
                  <p>{message.adminReply}</p>
                </div>
              ) : (
                <p className="muted">Waiting for administrator response.</p>
              )}
            </article>
          ))
        ) : (
          <p className="muted">No messages sent yet.</p>
        )}
      </section>
    </>
  );
}
