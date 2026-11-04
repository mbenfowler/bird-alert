import { login, TEST_USER } from '../support/login'
import { stubAuth } from '../support/stubs'

const INVITE = { url: 'https://bird-alert.vercel.app/?ref=invite-abc123', code: 'abc123' }
// A preview build shares links to itself, like sighting shares do.
const LOCAL_URL = 'http://localhost:3000/?ref=invite-abc123'
const MESSAGE = 'I use this for rare bird alerts near me. It’s free, made by a birder.'
const NUDGE = 'Know a birder who’d want this? Invite them'
const DAY = 86_400_000

const stubInvite = () => cy.intercept('GET', '**/api/user?kind=invite-link', { statusCode: 200, body: INVITE }).as('inviteLink')
const asPhone = () => cy.window().then((win) => {
  win.navigator.share = cy.stub().resolves().as('sheet')
  const real = win.matchMedia.bind(win)
  cy.stub(win, 'matchMedia').callsFake((query) => (query === '(pointer: coarse)' ? { ...real(query), matches: true, media: query } : real(query)))
})
const stubCopy = () => cy.window().then((win) => { cy.stub(win.navigator.clipboard, 'writeText').resolves().as('copy') })
const noSidewaysScroll = () => cy.document().then((doc) => expect(doc.documentElement.scrollWidth, 'page width').to.be.at.most(375))

describe('Invite a birding friend: always findable', () => {
  beforeEach(() => {
    stubAuth({ loggedIn: true })
    stubInvite()
    cy.visit('http://localhost:3000/settings')
  })

  it('Settings → Account has the row; on a phone it opens the share sheet with the link and a message', () => {
    asPhone()
    cy.contains('.invite-friend', 'Invite a birding friend').should('be.visible')
    cy.wait('@inviteLink')
    cy.get('#inviteFriend').click()
    cy.get('@sheet').should('have.been.calledOnceWith', { title: 'Bird Alert', text: MESSAGE, url: LOCAL_URL })
  })

  it('without a share sheet, copies the link and says so', () => {
    stubCopy()
    cy.get('#inviteFriend').click()
    cy.get('@copy').should('have.been.calledOnceWith', LOCAL_URL)
    cy.contains('Link copied. Paste it anywhere.')
  })

  it('the ⚙ menu has Share Bird Alert', () => {
    stubCopy()
    cy.contains('#settingsActions button', 'Share Bird Alert').click({ force: true })
    cy.wait('@inviteLink')
    cy.get('@copy').should('have.been.calledOnceWith', LOCAL_URL)
  })

  it('fits a 375px phone', () => {
    cy.viewport(375, 740)
    cy.contains('.invite-friend', 'Invite a birding friend').should('be.visible')
    noSidewaysScroll()
  })
})

describe('Invite a birding friend: the one-time nudge', () => {
  const original = { ...TEST_USER }
  afterEach(() => {
    Object.keys(TEST_USER).forEach((key) => { if (!(key in original)) delete TEST_USER[key] })
    Object.assign(TEST_USER, original)
  })
  const start = (changes = {}) => {
    Object.assign(TEST_USER, changes)
    stubInvite()
    login()
    cy.get('.birds-list .card', { timeout: 15000 })
  }

  it('follows a lifer, once: Not now and it never comes back', () => {
    cy.viewport(375, 740)
    start()
    cy.get('#seen-snogoo').click()
    cy.contains('.lifer-toast', 'Lifer! Snow Goose')
    cy.contains('.invite-nudge', NUDGE, { timeout: 6000 }).should('be.visible')
    noSidewaysScroll()
    cy.contains('.invite-nudge button', 'Not now').click()
    cy.get('.invite-nudge').should('not.exist')
    cy.window().then((win) => expect(win.localStorage.getItem('bird-alert:invite-nudge')).to.eq('not-now'))
    // Another lifer, even after a reload: nothing.
    cy.reload()
    cy.get('.birds-list .card', { timeout: 15000 })
    cy.get('#seen-cangoo').click()
    cy.contains('.lifer-toast', 'Canada Goose')
    // The toast outlasts the nudge's pause, so once it's gone a nudge would be showing.
    cy.get('.lifer-toast', { timeout: 8000 }).should('not.exist')
    cy.get('.invite-nudge').should('not.exist')
  })

  it('Invite shares the link, and the nudge is done for good', () => {
    start()
    stubCopy()
    cy.get('#seen-snogoo').click()
    cy.contains('.invite-nudge button', 'Invite', { timeout: 6000 }).click()
    cy.get('@copy').should('have.been.calledOnceWith', LOCAL_URL)
    cy.get('.invite-nudge').should('not.exist')
    cy.window().then((win) => expect(win.localStorage.getItem('bird-alert:invite-nudge')).to.eq('invited'))
  })

  it('never in the first 3 days after signup', () => {
    start({ created_at: new Date(Date.now() - 2 * DAY).toISOString() })
    cy.get('#seen-snogoo').click()
    cy.contains('.lifer-toast', 'Snow Goose')
    // The toast outlasts the nudge's pause, so once it's gone a nudge would be showing.
    cy.get('.lifer-toast', { timeout: 8000 }).should('not.exist')
    cy.get('.invite-nudge').should('not.exist')
  })

  it('never on an event day', () => {
    start({ activeEvent: { id: 5, name: 'Chiricahuas', count: 0 } })
    cy.get('#seen-snogoo').click()
    cy.contains('.lifer-toast', 'Snow Goose')
    // The toast outlasts the nudge's pause, so once it's gone a nudge would be showing.
    cy.get('.lifer-toast', { timeout: 8000 }).should('not.exist')
    cy.get('.invite-nudge').should('not.exist')
  })

  it('also follows a rare-bird alert opened from a push', () => {
    start()
    cy.fixture('where').then((where) => cy.intercept('GET', '**/api/ebird/where*', { statusCode: 200, body: { ...where, class: 'rare' } }))
    const now = new Date().toISOString()
    cy.intercept('GET', '**/api/push/pending', { statusCode: 200, body: { push: { url: 'http://localhost:3000/sighting/cangoo/S155544243', title: 'Canada Goose', sentAt: now, tappedAt: now, offeredAt: null, openedAt: null } } })
    cy.location('pathname', { timeout: 15000 }).should('eq', '/sighting/cangoo/S155544243')
    cy.contains('.invite-nudge', NUDGE, { timeout: 6000 }).should('be.visible')
  })
})

describe('Invite a birding friend: signing up from an invite', () => {
  it('the invite rides along with the signup, in source', () => {
    stubAuth({ userExists: false })
    cy.visit('http://localhost:3000/login?ref=invite-abc123')
    cy.get('.input.email').type('friend@example.com{enter}')
    cy.wait('@userExists')
    cy.get('.input.password').type('longenough1{enter}')
    cy.wait('@signup').its('request.body.source').should('deep.equal', { landing: 'login', invite: 'invite-abc123' })
  })
})
