import React from 'react'
import FormField from './FormField.jsx'

export default function ModalHost ({
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
  if (!modal) return null
  const isAuth = modal.kind === 'auth'
  const isRegister = authMode === 'register'
  const isStaffApplication = isRegister && authForm.role === 'staff'
  const update = (key, value) =>
    setAuthForm(current => ({ ...current, [key]: value }))

  return (
    <div className='modal-backdrop' onClick={() => setModal(null)}>
      <section
        className='modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='modal-title'
        onClick={event => event.stopPropagation()}
      >
        <h2 id='modal-title'>{modal.title}</h2>
        <p>{modal.body}</p>
        {isAuth ? (
          <form className='auth-form' onSubmit={handleAuthSubmit}>
            {isRegister && (
              <>
                <FormField label='Create account as'>
                  <select
                    value={authForm.role || 'member'}
                    onChange={event => update('role', event.target.value)}
                  >
                    <option value='member'>Rural woman / Member</option>
                    <option value='staff'>Apply as staff</option>
                  </select>
                </FormField>
                {isStaffApplication && (
                  <div className='privacy-card staff-approval-note'>
                    <strong>Administrator approval required</strong>
                    <p>
                      Your application will be reviewed. You cannot sign in as
                      staff until an administrator approves it.
                    </p>
                  </div>
                )}
                <FormField label={t.fullName || 'Full name'}>
                  <input
                    autoComplete='name'
                    value={authForm.fullName}
                    onChange={event => update('fullName', event.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </FormField>
                {isStaffApplication && (
                  <>
                    <FormField label='Village / area'>
                      <input
                        value={authForm.villageOrArea || ''}
                        onChange={event =>
                          update('villageOrArea', event.target.value)
                        }
                        maxLength={160}
                        placeholder='Where would you provide support?'
                      />
                    </FormField>
                    <FormField label='Relevant experience'>
                      <textarea
                        value={authForm.experience || ''}
                        onChange={event =>
                          update('experience', event.target.value)
                        }
                        maxLength={1200}
                        rows={3}
                        placeholder='Community work, service support, digital help, etc.'
                      />
                    </FormField>
                    <FormField label='Why do you want to join?'>
                      <textarea
                        value={authForm.reason || ''}
                        onChange={event => update('reason', event.target.value)}
                        maxLength={1200}
                        rows={3}
                      />
                    </FormField>
                  </>
                )}
              </>
            )}
            {isRegister && (
              <FormField label={t.email || 'Email'}>
                <input
                  type='email'
                  autoComplete='email'
                  value={authForm.email}
                  onChange={event => update('email', event.target.value)}
                  required
                  maxLength={254}
                />
              </FormField>
            )}
            {!isRegister && (
              <>
                <FormField label='Sign in as'>
                  <select
                    value={authForm.role || 'member'}
                    onChange={event => update('role', event.target.value)}
                  >
                    <option value='member'>Rural woman / Member</option>
                    <option value='staff'>Approved staff</option>
                    <option value='admin'>Administrator</option>
                  </select>
                </FormField>
                <FormField label={t.email || 'Email'}>
                  <input
                    type='email'
                    autoComplete='email'
                    value={authForm.email}
                    onChange={event => update('email', event.target.value)}
                    required
                    maxLength={254}
                  />
                </FormField>
              </>
            )}
            <FormField label={t.password || 'Password'}>
              <input
                type='password'
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={authForm.password}
                onChange={event => update('password', event.target.value)}
                required
                minLength={isRegister ? 10 : 1}
                maxLength={200}
              />
            </FormField>
            {isRegister && (
              <small>
                {isStaffApplication
                  ? 'Your password is stored securely and the account is created only after approval.'
                  : t.passwordHelp ||
                    'Use at least 10 characters and include a number.'}
              </small>
            )}
            <button className='btn primary full' disabled={authBusy}>
              {authBusy
                ? t.loading || 'Please wait…'
                : isRegister
                ? isStaffApplication
                  ? 'Submit staff application'
                  : t.createAccount || 'Create account'
                : t.signIn || 'Sign in'}
            </button>
            <button
              type='button'
              className='text-button'
              onClick={() => {
                setAuthMode(isRegister ? 'login' : 'register')
                setAuthForm(current => ({ ...current, role: 'member' }))
              }}
            >
              {isRegister
                ? t.haveAccount || 'Already have an account? Sign in'
                : t.needAccount || 'Create an account'}
            </button>
          </form>
        ) : (
          <button className='btn primary' onClick={() => setModal(null)}>
            {t.understood || 'Understood'}
          </button>
        )}
      </section>
    </div>
  )
}
