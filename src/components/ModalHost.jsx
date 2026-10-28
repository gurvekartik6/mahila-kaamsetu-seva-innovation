
import React from 'react';
import FormField from './FormField.jsx';

export default function ModalHost({
  modal,
  setModal,
  t,
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  authBusy,
  handleAuthSubmit
}) {
  if (!modal) return null;

  const selectedRole = authForm.role || 'member';

  return (
    <div
      className="modal-backdrop"
      onClick={() => setModal(null)}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="auth-modal-title">{modal.title}</h2>
        <p>{modal.body}</p>

        {modal.kind === 'auth' ? (
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === 'register' && (
              <FormField label={t.fullName}>
                <input
                  type="text"
                  autoComplete="name"
                  value={authForm.fullName}
                  onChange={(event) =>
                    setAuthForm({
                      ...authForm,
                      fullName: event.target.value
                    })
                  }
                  required
                  minLength={2}
                  maxLength={120}
                />
              </FormField>
            )}

            {authMode === 'login' && (
              <>
                <FormField label={t.accountType || 'Sign in as'}>
                  <select
                    id="loginRole"
                    name="role"
                    value={selectedRole}
                    onChange={(event) =>
                      setAuthForm({
                        ...authForm,
                        role: event.target.value
                      })
                    }
                    required
                  >
                    <option value="member">
                      {t.memberRole || 'Member'}
                    </option>
                    <option value="staff">
                      {t.staffRole || 'Support staff'}
                    </option>
                    <option value="admin">
                      {t.adminRole || 'Administrator'}
                    </option>
                  </select>
                </FormField>

                <p className="auth-role-help">
                  {selectedRole === 'staff'
                    ? 'Support staff: you must have an account created or approved by an administrator.'
                    : selectedRole === 'admin'
                      ? 'Administrator: use your separately provisioned administrator account.'
                      : 'Choose the role already assigned to your account. The server verifies your actual role.'}
                </p>
              </>
            )}

            <FormField label={t.email}>
              <input
                type="email"
                autoComplete="email"
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm({
                    ...authForm,
                    email: event.target.value
                  })
                }
                required
                maxLength={254}
              />
            </FormField>

            <FormField label={t.password}>
              <input
                type="password"
                autoComplete={
                  authMode === 'register'
                    ? 'new-password'
                    : 'current-password'
                }
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm({
                    ...authForm,
                    password: event.target.value
                  })
                }
                required
                minLength={authMode === 'register' ? 10 : 1}
                maxLength={200}
              />
            </FormField>

            {authMode === 'register' && (
              <small>
                {t.passwordHelp} Staff and administrator accounts cannot
                be self-registered. Contact an administrator for approved
                staff or administrator access.
              </small>
            )}

            <button
              className="btn primary full"
              type="submit"
              disabled={authBusy}
            >
              {authBusy
                ? t.loading
                : authMode === 'register'
                  ? t.createAccount
                  : t.signIn}
            </button>

            <button
              type="button"
              className="text-button"
              onClick={() =>
                setAuthMode(
                  authMode === 'register' ? 'login' : 'register'
                )
              }
              disabled={authBusy}
            >
              {authMode === 'register'
                ? t.haveAccount
                : t.needAccount}
            </button>
          </form>
        ) : (
          <button
            className="btn primary"
            type="button"
            onClick={() => setModal(null)}
          >
            {t.understood}
          </button>
        )}
      </section>
    </div>
  );
}
