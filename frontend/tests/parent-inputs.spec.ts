import { expect, test } from '@playwright/test'

const child = {
  id: 7, nickname: 'Mira', age_band: '7-9', age: 8, dob: null, is_infant: false,
  is_demo: false, languages: ['English'], preferred_language: 'English', voice_enabled: true,
  activities: ['chat'], daily_minutes: 30, used_minutes_today: 0, remaining_minutes_today: 30,
  limit_reached: false, voice_engine: '', voice_id: '', voice_language: 'English', avatar: '',
}
const incident = {
  id: 15, child_id: 7, nickname: 'Mira', is_demo: 0, session_id: 21,
  category: 'disclosure', detail: 'A safety check needs a grown-up to review.', severity: 'high',
  created_at: '2026-11-06T10:00:00Z', reviewed_at: null, parent_note: '', language: 'English',
  notification_status: 'dashboard_only', notification_channel: '', notification_recipient: '',
  notification_attempted_at: null, notification_delivered_at: null,
}

async function mockApp(page: import('@playwright/test').Page, ageBand = '7-9', limitReached = false) {
  let note = ''
  let reviewed = false
  let savedLimit: number | undefined
  let createdAgeMonths: number | undefined
  let lastTurnMode: string | undefined
  const deleteCalls: string[] = []
  await page.addInitScript(() => sessionStorage.setItem('mallow.parentToken', 'test-token'))
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api/, '')
    if (path === '/bootstrap') return route.fulfill({ json: { consent: true, pin_set: true, parent_unlocked: true, companion_name: 'Mallow', child_count: 1, demo_count: 0, languages: ['English'], helpline: 'Local helpline', services: { llm: false, moderation: false, stt: false, voice_output: false, voice_output_label: '', offline_companion: true } } })
    if (path === '/children' && request.method() === 'GET') return route.fulfill({ json: [{ ...child, age_band: ageBand, limit_reached: limitReached, remaining_minutes_today: limitReached ? 0 : 30 }] })
    if (path === '/children' && request.method() === 'POST') { createdAgeMonths = request.postDataJSON().age_months; return route.fulfill({ json: { ...child } }) }
    if (path === '/chat/session') { const mode = request.postDataJSON().mode; return route.fulfill({ json: { session_id: mode === 'chat' ? 21 : 22, limit_reached: limitReached && !['study', 'homework', 'explain'].includes(mode), purpose: ['study', 'homework', 'explain'].includes(mode) ? 'educational' : 'general', messages: [] } }) }
    if (path === '/chat/turn') { lastTurnMode = request.postDataJSON().mode; return route.fulfill({ json: { reply: 'Let us work through the fractions together.', message_id: 4, blocked: false, is_disclosure: false, limit_reached: false, offline: true, provider_error: false, emotion: 'neutral', mood: 'neutral', safety_layer: 'passed', helpline: null, duplicate: false } }) }
    if (path === '/safety/incidents') return route.fulfill({ json: [{ ...incident, parent_note: note, reviewed_at: reviewed ? '2026-11-06T10:01:00Z' : null }] })
    if (path === '/safety/incidents/15/review') { note = request.postDataJSON().note; reviewed = true; return route.fulfill({ json: { ok: true } }) }
    if (path === '/children/7' && request.method() === 'PATCH') { savedLimit = request.postDataJSON().daily_minutes; return route.fulfill({ json: { ...child, daily_minutes: savedLimit } }) }
    if (path === '/data/delete-all') { deleteCalls.push(path); return route.fulfill({ json: { ok: true } }) }
    if (path === '/auth/logout') return route.fulfill({ json: { ok: true } })
    return route.fulfill({ json: {} })
  })
  return { getSavedLimit: () => savedLimit, getCreatedAgeMonths: () => createdAgeMonths, getLastTurnMode: () => lastTurnMode, deleteCalls }
}

test('safety note supports caret edits and persists when reviewed', async ({ page }) => {
  await mockApp(page)
  await page.goto('/parent/safety')
  await page.getByTestId('review-15').click()
  const note = page.getByRole('textbox', { name: 'Private note' })
  await note.fill('Talked with Mira today\nFollow up tomorrow')
  await note.evaluate((element: HTMLTextAreaElement) => { element.focus(); element.setSelectionRange(0, 0) })
  await note.type('Parent: ')
  await expect(note).toHaveValue('Parent: Talked with Mira today\nFollow up tomorrow')
  await page.getByTestId('review-save').click()
  await expect(page.getByText('Your note: Parent: Talked with Mira today Follow up tomorrow')).toBeVisible()
  await page.getByRole('radio', { name: 'Reviewed' }).click()
  await expect(page.getByText('Your note: Parent: Talked with Mira today Follow up tomorrow')).toBeVisible()
})

for (const [band, keyPhrase] of [
  ['4-6', 'Your grown-up can read our chats'],
  ['7-9', 'your parent or guardian may be able to read them'],
  ['10-12', 'your parent or guardian can read the full chat'],
]) {
  test(`child privacy explanation for ages ${band}`, async ({ page }) => {
    await mockApp(page, band)
    await page.goto('/child/7/chat')
    const privacy = page.getByTestId('child-privacy-explanation')
    await expect(privacy).toContainText(keyPhrase)
    await expect(privacy).toContainText('Mallow cannot')
  })
}

test('parent privacy disclosure describes stored transcripts and dashboard access', async ({ page }) => {
  await mockApp(page)
  await page.goto('/parent/settings')
  await expect(page.getByText('Privacy and stored data')).toBeVisible()
  await expect(page.getByText('Authorized parents can read full transcripts, conversation dates and durations, message counts, activity and learning results, usage totals, and safety notes in each child\'s dashboard.')).toBeVisible()
  await expect(page.getByText(/no automatic transcript expiry/i)).toBeVisible()
})

test('parent can select exact infant months and the form stores the month age', async ({ page }) => {
  const app = await mockApp(page)
  await page.goto('/parent/children')
  await page.getByTestId('add-child').click()
  await page.getByLabel('Name').fill('Luna')
  await page.getByRole('radio', { name: 'Months' }).click()
  const months = page.getByRole('spinbutton', { name: 'Age (months)' })
  await months.fill('18')
  await expect(page.getByTestId('band-preview')).toContainText('18-23 months')
  await page.getByTestId('child-save').click()
  await expect.poll(app.getCreatedAgeMonths).toBe(18)
})

test('educational mode stays usable after general time runs out', async ({ page }) => {
  const app = await mockApp(page, '7-9', true)
  await page.goto('/child/7/chat')
  await expect(page.getByRole('alert').filter({ hasText: "All of today's talking time is used" })).toBeVisible()
  await page.getByRole('radio', { name: 'Homework' }).click()
  await expect(page.getByTestId('chat-input')).toBeEnabled()
  await expect(page.getByRole('alert').filter({ hasText: "All of today's talking time is used" })).toHaveCount(0)
  await page.getByTestId('chat-input').fill('Help me understand fractions with an example.')
  await page.getByTestId('send').click()
  await expect.poll(app.getLastTurnMode).toBe('homework')
})

test('daily talking time can be cleared and replaced before save', async ({ page }) => {
  const app = await mockApp(page)
  await page.goto('/parent/children')
  await page.getByTestId('edit-7').click()
  const limit = page.getByRole('textbox', { name: 'Daily talking time (minutes)' })
  await limit.fill('')
  await expect(limit).toHaveValue('')
  await page.getByTestId('child-save').click()
  await expect(page.getByText('Enter a whole number from 0 to 240.')).toBeVisible()
  await limit.fill('241')
  await page.getByTestId('child-save').click()
  await expect(page.getByText('Enter a whole number from 0 to 240.')).toBeVisible()
  await limit.fill('')
  await limit.pressSequentially('45')
  await expect(limit).toHaveValue('45')
  await page.getByTestId('child-save').click()
  await expect.poll(app.getSavedLimit).toBe(45)
})

test('delete confirmation accepts only exact uppercase DELETE and never deletes during verification', async ({ page }) => {
  const app = await mockApp(page)
  await page.goto('/parent/settings')
  await page.getByTestId('delete-all').click()
  const confirm = page.getByRole('textbox', { name: 'Type DELETE to confirm' })
  const destructive = page.getByRole('button', { name: 'Delete everything' })
  await expect(destructive).toBeDisabled()
  await confirm.fill('delete')
  await expect(destructive).toBeDisabled()
  await confirm.fill('DELETE extra')
  await expect(destructive).toBeDisabled()
  await confirm.fill('DELETE')
  await expect(destructive).toBeEnabled()
  await page.getByRole('button', { name: 'Cancel' }).click()
  expect(app.deleteCalls).toEqual([])
})
