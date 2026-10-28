import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const server = await readFile(
  new URL('../server/app.js', import.meta.url),
  'utf8'
)
const opportunitiesPage = await readFile(
  new URL('../src/pages/OpportunitiesPage.jsx', import.meta.url),
  'utf8'
)
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const publicSite = await readFile(
  new URL('../src/components/PublicSite.jsx', import.meta.url),
  'utf8'
)
const viteConfig = await readFile(
  new URL('../vite.config.js', import.meta.url),
  'utf8'
)

test('opportunity API includes publication state for consumers', () => {
  assert.match(server, /published:o\.published===true/)
})

test('opportunity API rejects non-boolean verification and publication values', () => {
  assert.match(
    server,
    /b\.verified!==undefined&&typeof b\.verified!=='boolean'/
  )
  assert.match(
    server,
    /b\.published!==undefined&&typeof b\.published!=='boolean'/
  )
  assert.match(
    server,
    /Only an administrator can verify or publish an opportunity/
  )
})

test('rate limiter has a fallback when the database is missing or unavailable', () => {
  assert.match(server, /rateLimits:new Map\(\)/)
  assert.match(server, /Fall back to a per-process limiter/)
  assert.match(server, /entry\.count>20/)
})

test('member opportunity page only renders verified and published records', () => {
  assert.match(
    opportunitiesPage,
    /item\.verified === true && item\.published === true/
  )
  assert.doesNotMatch(opportunitiesPage, /opportunityKeys\.filter/)
})

test('application passes API connectivity mode to opportunity page', () => {
  assert.match(
    app,
    /pageProps = \{ t, language, requests, opportunities, apiMode,/
  )
})

test('contact form requires a configured recipient before opening email', () => {
  assert.match(publicSite, /import\.meta\.env\.VITE_CONTACT_EMAIL/)
  assert.match(publicSite, /if\(!recipient\)/)
  assert.match(publicSite, /mailto:\$\{recipient\}/)
})

test('Vite development proxy preserves the browser Host for origin validation', () => {
  assert.match(
    viteConfig,
    /target: 'http:\/\/localhost:4000', changeOrigin: false/
  )
})

test('staff can create and read only their own administrator messages', () => {
  assert.match(
    server,
    /app\.get\('\/api\/staff\/messages',auth,roles\('staff'\)/
  )
  assert.match(
    server,
    /app\.post\('\/api\/staff\/messages',auth,roles\('staff'\)/
  )
  assert.match(server, /WHERE staff_user_id=\$1 ORDER BY created_at DESC/)
})

test('only admins can view all staff messages and send replies', () => {
  assert.match(
    server,
    /app\.get\('\/api\/admin\/staff-messages',auth,roles\('admin'\)/
  )
  assert.match(
    server,
    /app\.patch\('\/api\/admin\/staff-messages\/:id\/reply',auth,roles\('admin'\)/
  )
  assert.match(server, /admin_reply=\$1,status=\$2,responded_by=\$3/)
})

test('database schema persists staff-admin conversation and status', async () => {
  const schema = await readFile(
    new URL('../db/schema.sql', import.meta.url),
    'utf8'
  )
  assert.match(schema, /CREATE TABLE IF NOT EXISTS staff_admin_messages/)
  assert.match(schema, /REFERENCES users\(id\) ON DELETE CASCADE/)
  assert.match(schema, /CHECK \(status IN \('open','answered','closed'\)\)/)
})

test('staff and admin messaging appears in the correct role workspace', async () => {
  const adminDashboard = await readFile(
    new URL('../src/pages/AdminDashboard.jsx', import.meta.url),
    'utf8'
  )
  const staffDashboard = await readFile(
    new URL('../src/pages/StaffDashboard.jsx', import.meta.url),
    'utf8'
  )
  assert.match(staffDashboard, /Contact administrator/)
  assert.match(staffDashboard, /My messages/)
  assert.match(adminDashboard, /Staff messages &amp; escalation inbox/)
  assert.match(adminDashboard, /Save and send response/)
  assert.match(app, /sendStaffMessage, replyStaffMessage/)
  assert.doesNotMatch(adminDashboard, /Support staff workspace/)
})

test('login form exposes staff role and explains staff account provisioning', async () => {
  const modal = await readFile(
    new URL('../src/components/ModalHost.jsx', import.meta.url),
    'utf8'
  )
  assert.match(modal, /option value="staff"/)
  assert.match(modal, /Apply as staff/)
  assert.match(modal, /Administrator approval required/)
  assert.match(app, /expectedRole: authForm\.role/)
  assert.match(app, /\/api\/auth\/staff-apply/)
  assert.match(app, /user\?\.role === 'admin'/)
  assert.match(app, /user\?\.role === 'staff'/)
  assert.match(server, /u\.role!==expectedRole/)
})

test('staff provisioning command creates staff role without overwriting an existing account', async () => {
  const pkg = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )
  const script = await readFile(
    new URL('../scripts/create-staff.js', import.meta.url),
    'utf8'
  )
  const readme = await readFile(
    new URL('../README.md', import.meta.url),
    'utf8'
  )
  assert.equal(
    pkg.scripts['staff:create'],
    'node --env-file=.env scripts/create-staff.js'
  )
  assert.match(script, /VALUES\(\$1, \$2, \$3, 'staff', 'mr'\)/)
  assert.match(script, /ON CONFLICT\(email\) DO NOTHING/)
  assert.match(readme, /select \*\*Support staff\*\*/i)
})

test('staff applications require admin approval before a staff user is created', async () => {
  const migration = await readFile(
    new URL('../db/migrations_staff_workflow.sql', import.meta.url),
    'utf8'
  )
  assert.match(server, /app\.post\('\/api\/auth\/staff-apply'/)
  assert.match(
    server,
    /app\.get\('\/api\/admin\/staff-applications',auth,roles\('admin'\)/
  )
  assert.match(
    server,
    /app\.patch\('\/api\/admin\/staff-applications\/:id',auth,roles\('admin'\)/
  )
  assert.match(
    server,
    /staff application is still pending administrator approval/
  )
  assert.match(
    server,
    /Staff access can only be granted by approving a staff application/
  )
  assert.match(migration, /CREATE TABLE IF NOT EXISTS staff_applications/)
  assert.match(migration, /assigned_staff_id BIGINT REFERENCES users\(id\)/)
})

test('staff workspace is separate and reads only assigned requests', async () => {
  const dashboard = await readFile(
    new URL('../src/pages/StaffDashboard.jsx', import.meta.url),
    'utf8'
  )
  assert.match(dashboard, /My assigned requests/)
  assert.match(server, /WHERE r\.assigned_staff_id=\$1/)
  assert.match(server, /AND assigned_staff_id=\$4/)
  assert.match(app, /page === 'staff' && user\?\.role === 'staff'/)
})
