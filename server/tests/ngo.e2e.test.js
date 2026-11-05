const fs = require('fs');
const path = require('path');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { expect } = require('chai');

// NGO role - Selenium coverage (BL-14).
//
// Covers everything an NGO user can do in the app today:
//   - the login page and its error handling
//   - logging in as the NGO and landing on /dashboard/ngo
//   - the "Referred Cases" dashboard: cards, status filter, empty states
//   - navigation, role guarding and logout
//   - the referral API the dashboard sits on (list, get, status update)
//
// Run with:  npm run test:e2e:ngo
// Needs:     client on 5173, server on 5000, Chrome, and the seeded NGO account
//            (node server/seeds/seedTestNgo.js).
//
// Login used:  ngo@test.com / Ngo@12345  (override with E2E_NGO_EMAIL / E2E_NGO_PASSWORD)
//
// NOTE: client/src/api/ngoApi.js currently has USE_MOCK = true, so the
// dashboard shows built-in fake referrals instead of the database ones. Every
// UI test below works in both modes; the one test that compares the screen
// with the API is skipped, with the reason printed, while the mock is on.

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API = process.env.E2E_API_URL || 'http://localhost:5000';

const NGO = {
  email: process.env.E2E_NGO_EMAIL || 'ngo@test.com',
  password: process.env.E2E_NGO_PASSWORD || 'Ngo@12345',
};

const VOLUNTEER = {
  email: process.env.E2E_VOLUNTEER_EMAIL || 'volunteer@test.com',
  password: process.env.E2E_VOLUNTEER_PASSWORD || 'Test@1234',
};

// Same list as STATUS_FILTERS in NgoDashboard.jsx and REFERRAL_STATUSES in
// server/models/Referral.js.
const FILTER_VALUES = ['all', 'pending', 'in_progress', 'resolved', 'closed'];
const REFERRAL_STATUSES = FILTER_VALUES.filter((s) => s !== 'all');

// One of the fake referrals in ngoApi.js. Used only to tell mock mode apart.
const MOCK_MARKER = 'Seeker needs counselling support and a safe place to talk.';

// Anything this suite writes carries this prefix.
const MARK = 'E2E TEST -';

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// ---------------------------------------------------------------- API helpers

async function api(urlPath, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  return { status: res.status, body: payload };
}

async function apiLogin({ email, password }) {
  const res = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  return res.status === 200 ? res.body : null;
}

// --------------------------------------------------------------- UI helpers

// Locators taken from the real components.
const L = {
  // Login.jsx
  email: By.css("input[name='email']"),
  password: By.css("input[name='password']"),
  submit: By.css("button[type='submit']"),
  loginError: By.xpath("//div[contains(normalize-space(.), 'Invalid email or password.') and not(.//div)]"),
  // NgoDashboard.jsx
  heading: By.xpath("//h2[normalize-space()='Referred Cases']"),
  filter: By.css('#status-filter'),
  card: By.xpath("//div[p/strong[normalize-space()='Category:']]"),
  emptyMessage: By.xpath("//p[contains(normalize-space(.), 'No referr')]"),
  alert: By.css("[role='alert']"),
  // Navbar.jsx / Sidebar.jsx
  logout: By.xpath("//button[normalize-space()='Logout']"),
  greeting: By.css('.navbar-user'),
  sidebarTitle: By.css('.sidebar-title'),
  sidebarLink: By.css('.sidebar-link'),
};

async function present(driver, locator, timeout = 4000) {
  try {
    await driver.wait(until.elementLocated(locator), timeout);
    return true;
  } catch {
    return false;
  }
}

async function clearBrowserState(driver) {
  await driver.get(`${BASE}/login`);
  await driver.executeScript('try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}');
}

// Fills the login form and submits. Does not wait for the result.
async function submitLogin(driver, email, password) {
  await driver.get(`${BASE}/login`);
  const emailInput = await driver.wait(until.elementLocated(L.email), 10000);
  await emailInput.clear();
  await emailInput.sendKeys(email);

  const passInput = await driver.findElement(L.password);
  await passInput.clear();
  await passInput.sendKeys(password);

  await driver.findElement(L.submit).click();
}

// Logs in as the NGO through the real login page. Returns true on success.
async function loginAsNgo(driver) {
  await clearBrowserState(driver);
  await submitLogin(driver, NGO.email, NGO.password);
  try {
    await driver.wait(until.urlContains('/dashboard/ngo'), 30000);
    return true;
  } catch {
    return false;
  }
}

async function requireNgoLogin(driver) {
  const ok = await loginAsNgo(driver);
  if (!ok) {
    throw new Error(
      `NGO login failed for ${NGO.email} - run "node server/seeds/seedTestNgo.js" and check client (5173) and server (5000) are running`
    );
  }
}

// The dashboard shows "Loading..." first; the heading only appears afterwards.
async function waitForDashboard(driver) {
  await driver.wait(until.elementLocated(L.heading), 15000);
  await driver.wait(until.elementLocated(L.filter), 5000);
}

async function openDashboard(driver) {
  await driver.get(`${BASE}/dashboard/ngo`);
  await waitForDashboard(driver);
}

// "in_progress", "In progress" and "in progress" all become "in progress".
const normalise = (text) => text.trim().toLowerCase().replace(/[_\s]+/g, ' ');

async function readCards(driver) {
  const cards = await driver.findElements(L.card);
  const result = [];
  for (const card of cards) {
    const paragraphs = await card.findElements(By.css('p'));
    const texts = [];
    for (const p of paragraphs) texts.push(await p.getText());

    const category = (texts.find((t) => t.startsWith('Category:')) || '').replace(/^Category:\s*/, '');
    const urgency = (texts.find((t) => t.startsWith('Urgency:')) || '').replace(/^Urgency:\s*/, '');
    const referredOn = texts.find((t) => t.startsWith('Referred on')) || '';
    const badge = await card.findElement(By.css('span')).getText();

    result.push({ category, urgency, referredOn, status: normalise(badge) });
  }
  return result;
}

async function chooseFilter(driver, value) {
  await driver.findElement(By.css(`#status-filter option[value='${value}']`)).click();
  await driver.wait(async () => {
    const current = await driver.findElement(L.filter).getAttribute('value');
    return current === value;
  }, 3000);
}

async function storedUser(driver) {
  const raw = await driver.executeScript("return localStorage.getItem('user');");
  return raw ? JSON.parse(raw) : null;
}

async function showingMockData(driver) {
  const source = await driver.getPageSource();
  return source.includes(MOCK_MARKER);
}

function pending(ctx, reason) {
  ctx.test.title += ` [pending: ${reason}]`;
  ctx.skip();
}

// ------------------------------------------------------------------- suite

describe('MindEase NGO E2E - login, dashboard and referrals (Selenium)', function () {
  this.timeout(120000);

  let driver;

  before(async function () {
    // Chrome's "password found in a data breach" dialog covers the login form
    // and swallows the submit, and the shared test passwords trigger it.
    const options = new chrome.Options();
    options.addArguments(
      '--disable-features=PasswordLeakDetection,PasswordLeakToggleMove,AutofillServerCommunication',
      '--disable-save-password-bubble',
      '--no-first-run',
      '--no-default-browser-check'
    );
    options.setUserPreferences({
      credentials_enable_service: false,
      'profile.password_manager_enabled': false,
      'profile.password_manager_leak_detection': false,
    });

    // Set HEADLESS=1 to run without opening a window (CI).
    if (process.env.HEADLESS === '1') options.addArguments('--headless=new', '--window-size=1440,900');

    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    if (process.env.HEADLESS !== '1') await driver.manage().window().maximize();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  // Saves a screenshot for every failed test so a red run can be diagnosed.
  afterEach(async function () {
    if (this.currentTest.state !== 'failed' || !driver) return;
    try {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const name = this.currentTest.title.replace(/[^a-z0-9]+/gi, '_').slice(0, 80);
      const png = await driver.takeScreenshot();
      fs.writeFileSync(path.join(SCREENSHOT_DIR, `${name}.png`), png, 'base64');
    } catch {
      // a screenshot must never hide the real failure
    }
  });

  // ============================================================ before login
  describe('Access without logging in', function () {
    beforeEach(async function () {
      await clearBrowserState(driver);
    });

    it('NGO-1: the NGO dashboard redirects a visitor to the login page', async function () {
      await driver.get(`${BASE}/dashboard/ngo`);
      await driver.wait(until.urlContains('/login'), 10000);

      expect(await driver.getCurrentUrl()).to.include('/login');
      expect(await present(driver, L.heading, 1000)).to.equal(false);
    });

    it('NGO-2: /dashboard redirects a visitor to the login page', async function () {
      await driver.get(`${BASE}/dashboard`);
      await driver.wait(until.urlContains('/login'), 10000);

      expect(await driver.getCurrentUrl()).to.include('/login');
    });
  });

  // =========================================================== login screen
  describe('Login page', function () {
    beforeEach(async function () {
      await clearBrowserState(driver);
      await driver.get(`${BASE}/login`);
      await driver.wait(until.elementLocated(L.email), 10000);
    });

    it('NGO-3: shows the email field, password field and Log in button', async function () {
      expect(await driver.findElement(By.css('h1')).getText()).to.equal('Welcome back');
      expect(await driver.findElement(L.email).getAttribute('type')).to.equal('email');
      expect(await driver.findElement(L.password).getAttribute('type')).to.equal('password');
      expect(await driver.findElement(L.submit).getText()).to.equal('Log in');
    });

    it('NGO-4: links to the registration page', async function () {
      await driver.findElement(By.xpath("//a[normalize-space()='Sign up']")).click();
      await driver.wait(until.urlContains('/register'), 10000);

      expect(await driver.getCurrentUrl()).to.include('/register');
    });

    it('NGO-5: an empty form is blocked by the browser and stays on /login', async function () {
      await driver.findElement(L.submit).click();
      await driver.sleep(500);

      expect(await driver.getCurrentUrl()).to.include('/login');
      const valid = await driver.executeScript(
        "return document.querySelector(\"input[name='email']\").checkValidity();"
      );
      expect(valid).to.equal(false);
    });

    it('NGO-6: a wrong password shows an error and does not log in', async function () {
      await submitLogin(driver, NGO.email, 'Wrong@Password1');
      await driver.wait(until.elementLocated(L.loginError), 10000);

      expect(await driver.getCurrentUrl()).to.include('/login');
      expect(await driver.findElement(L.loginError).getText()).to.include('Invalid email or password.');
      expect(await driver.executeScript("return localStorage.getItem('token');")).to.equal(null);
    });

    it('NGO-7: an unknown email shows the same error (no account enumeration)', async function () {
      await submitLogin(driver, 'nobody-e2e@test.com', 'Whatever@123');
      await driver.wait(until.elementLocated(L.loginError), 10000);

      expect(await driver.findElement(L.loginError).getText()).to.include('Invalid email or password.');
      expect(await driver.getCurrentUrl()).to.include('/login');
    });
  });

  // ============================================================= NGO login
  describe('Logging in as the NGO', function () {
    before(async function () {
      await requireNgoLogin(driver);
    });

    it('NGO-8: login lands on /dashboard/ngo', async function () {
      expect(await driver.getCurrentUrl()).to.include('/dashboard/ngo');
    });

    it('NGO-9: the token and an "ngo" user are stored in localStorage', async function () {
      const token = await driver.executeScript("return localStorage.getItem('token');");
      const user = await storedUser(driver);

      expect(token, 'token').to.be.a('string').and.not.empty;
      expect(user.role).to.equal('ngo');
      expect(user.email).to.equal(NGO.email);
      expect(user.status).to.equal('approved');
    });

    it('NGO-10: the navbar greets the NGO user and offers Logout', async function () {
      await openDashboard(driver);
      const user = await storedUser(driver);

      expect(await driver.findElement(L.greeting).getText()).to.equal(`Hi, ${user.name}`);
      expect(await driver.findElement(L.logout).isDisplayed()).to.equal(true);
    });

    it('NGO-11: the sidebar is the NGO menu with Overview and Profile', async function () {
      await openDashboard(driver);

      // index.css uppercases .sidebar-title, and getText() returns the displayed
      // text ("NGO MENU"), so compare case-insensitively.
      const title = await driver.findElement(L.sidebarTitle).getText();
      expect(normalise(title)).to.equal('ngo menu');
      const links = [];
      for (const el of await driver.findElements(L.sidebarLink)) links.push(await el.getText());
      expect(links).to.include.members(['Overview', 'Profile']);
    });
  });

  // ======================================================= referral dashboard
  describe('Referred Cases dashboard', function () {
    before(async function () {
      await requireNgoLogin(driver);
    });

    beforeEach(async function () {
      await openDashboard(driver);
    });

    it('NGO-12: shows the "Referred Cases" heading and no error', async function () {
      expect(await driver.findElement(L.heading).isDisplayed()).to.equal(true);
      expect(await present(driver, L.alert, 800)).to.equal(false);
    });

    it('NGO-13: the status filter offers All, pending, in progress, resolved and closed', async function () {
      const options = await driver.findElements(By.css('#status-filter option'));
      const values = [];
      const labels = [];
      for (const o of options) {
        values.push(await o.getAttribute('value'));
        labels.push(normalise(await o.getText()));
      }

      expect(values).to.deep.equal(FILTER_VALUES);
      expect(labels).to.deep.equal(['all', 'pending', 'in progress', 'resolved', 'closed']);
      expect(await driver.findElement(L.filter).getAttribute('value')).to.equal('all');
    });

    it('NGO-14: the filter has a "Filter by status" label', async function () {
      const label = await driver.findElement(By.css("label[for='status-filter']"));

      expect(await label.getText()).to.include('Filter by status');
    });

    it('NGO-15: either referral cards or an empty-state message are shown', async function () {
      const cards = await driver.findElements(L.card);

      if (cards.length === 0) {
        const message = await driver.findElement(L.emptyMessage).getText();
        expect(message).to.equal('No referred cases yet.');
      } else {
        expect(await present(driver, L.emptyMessage, 500)).to.equal(false);
      }
    });

    it('NGO-16: every card shows category, urgency, referral date and a status badge', async function () {
      const cards = await readCards(driver);
      if (cards.length === 0) pending(this, 'this NGO has no referrals - run node server/seeds/seedTestNgo.js');

      for (const card of cards) {
        expect(card.category, 'category').to.not.equal('');
        expect(card.urgency, 'urgency').to.not.equal('');
        expect(card.referredOn, 'referred on').to.match(/^Referred on .+/);
        expect(REFERRAL_STATUSES, `badge "${card.status}"`).to.include(card.status.replace(/ /g, '_'));
      }
    });

    it('NGO-17: a card never shows seeker identity (data minimisation)', async function () {
      const cards = await driver.findElements(L.card);
      if (cards.length === 0) pending(this, 'this NGO has no referrals');

      for (const card of cards) {
        const text = (await card.getText()).toLowerCase();
        expect(text).to.not.include('seeker@test.com');
        expect(text).to.not.include('test seeker');
        expect(text).to.not.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/);
      }
    });

    it('NGO-18: each status filter shows only cards with that status', async function () {
      for (const status of REFERRAL_STATUSES) {
        await chooseFilter(driver, status);
        const cards = await readCards(driver);

        for (const card of cards) {
          expect(card.status, `filter ${status}`).to.equal(normalise(status));
        }
      }
    });

    it('NGO-19: the status filters add up to the full list', async function () {
      const total = (await readCards(driver)).length;

      let sum = 0;
      for (const status of REFERRAL_STATUSES) {
        await chooseFilter(driver, status);
        sum += (await readCards(driver)).length;
      }

      expect(sum).to.equal(total);
    });

    it('NGO-20: a status with no referrals shows the "No referrals with this status." message', async function () {
      const total = (await readCards(driver)).length;
      if (total === 0) pending(this, 'this NGO has no referrals, so the filtered empty state cannot appear');

      let emptyStatus = null;
      for (const status of REFERRAL_STATUSES) {
        await chooseFilter(driver, status);
        if ((await driver.findElements(L.card)).length === 0) {
          emptyStatus = status;
          break;
        }
      }
      if (!emptyStatus) pending(this, 'every status has at least one referral');

      expect(await driver.findElement(L.emptyMessage).getText()).to.equal('No referrals with this status.');
    });

    it('NGO-21: switching back to All restores the full list', async function () {
      const total = (await readCards(driver)).length;

      await chooseFilter(driver, 'closed');
      await chooseFilter(driver, 'all');

      expect((await readCards(driver)).length).to.equal(total);
    });

    it('NGO-22: reloading the page keeps the NGO logged in', async function () {
      await driver.navigate().refresh();
      await waitForDashboard(driver);

      expect(await driver.getCurrentUrl()).to.include('/dashboard/ngo');
      expect(await driver.findElement(L.heading).isDisplayed()).to.equal(true);
    });

    it('NGO-23: the dashboard matches what the referral API returns', async function () {
      if (await showingMockData(driver)) {
        pending(this, 'ngoApi.js has USE_MOCK = true, so the screen shows built-in fake data');
      }

      const token = await driver.executeScript("return localStorage.getItem('token');");
      const res = await api('/api/referrals/mine', { token });
      expect(res.status).to.equal(200);

      const cards = await readCards(driver);
      expect(cards.length).to.equal(res.body.referrals.length);

      const apiStatuses = res.body.referrals.map((r) => normalise(r.status)).sort();
      expect(cards.map((c) => c.status).sort()).to.deep.equal(apiStatuses);
    });
  });

  // ================================================ navigation and role guard
  describe('Navigation and role guard', function () {
    before(async function () {
      await requireNgoLogin(driver);
    });

    it('NGO-24: /dashboard sends the NGO to /dashboard/ngo', async function () {
      await driver.get(`${BASE}/dashboard`);
      await driver.wait(until.urlContains('/dashboard/ngo'), 10000);

      expect(await driver.getCurrentUrl()).to.include('/dashboard/ngo');
    });

    it('NGO-25: the sidebar Overview link goes to the NGO dashboard', async function () {
      await driver.get(`${BASE}/dashboard/profile`);
      await driver.wait(until.elementLocated(L.sidebarLink), 10000);
      await driver.findElement(By.xpath("//a[contains(@class,'sidebar-link') and normalize-space()='Overview']")).click();
      await driver.wait(until.urlContains('/dashboard/ngo'), 10000);
      await waitForDashboard(driver);

      expect(await driver.findElement(L.heading).isDisplayed()).to.equal(true);
    });

    it('NGO-26: the sidebar Profile link opens the Profile page', async function () {
      await openDashboard(driver);
      await driver.findElement(By.xpath("//a[contains(@class,'sidebar-link') and normalize-space()='Profile']")).click();
      await driver.wait(until.urlContains('/dashboard/profile'), 10000);

      const body = await driver.findElement(By.css('main')).getText();
      expect(body).to.include('Profile');
    });

    for (const role of ['seeker', 'volunteer', 'psychologist', 'facilitator', 'admin']) {
      it(`NGO-27: the NGO cannot open the ${role} dashboard`, async function () {
        await driver.get(`${BASE}/dashboard/${role}`);
        await driver.wait(until.urlContains('/dashboard/ngo'), 10000);

        expect(await driver.getCurrentUrl()).to.not.include(`/dashboard/${role}`);
      });
    }

    it('NGO-28: the NGO cannot open admin-only pages (Verifications, Manage Resources)', async function () {
      for (const page of ['verifications', 'resources']) {
        await driver.get(`${BASE}/dashboard/${page}`);
        await driver.wait(until.urlContains('/dashboard/ngo'), 10000);

        expect(await driver.getCurrentUrl()).to.not.include(`/dashboard/${page}`);
      }
    });

    it('NGO-29: an unknown URL shows the Page Not Found page', async function () {
      await driver.get(`${BASE}/this-page-does-not-exist`);
      await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Page Not Found']")), 10000);
    });
  });

  // ==================================================================== logout
  describe('Logging out', function () {
    before(async function () {
      await requireNgoLogin(driver);
      await openDashboard(driver);
      await driver.findElement(L.logout).click();
      await driver.wait(until.urlContains('/login'), 10000);
    });

    it('NGO-30: Logout returns to the login page', async function () {
      expect(await driver.getCurrentUrl()).to.include('/login');
    });

    it('NGO-31: Logout clears the token and user from localStorage', async function () {
      expect(await driver.executeScript("return localStorage.getItem('token');")).to.equal(null);
      expect(await driver.executeScript("return localStorage.getItem('user');")).to.equal(null);
    });

    it('NGO-32: after logout the navbar shows Login and Register again', async function () {
      expect(await present(driver, By.xpath("//a[normalize-space()='Login']"), 3000)).to.equal(true);
      expect(await present(driver, By.xpath("//a[normalize-space()='Register']"), 3000)).to.equal(true);
      expect(await present(driver, L.logout, 500)).to.equal(false);
    });

    it('NGO-33: after logout the NGO dashboard is no longer reachable', async function () {
      await driver.get(`${BASE}/dashboard/ngo`);
      await driver.wait(until.urlContains('/login'), 10000);

      expect(await driver.getCurrentUrl()).to.include('/login');
    });

    it('NGO-34: the NGO can log back in after logging out', async function () {
      await requireNgoLogin(driver);

      expect(await driver.getCurrentUrl()).to.include('/dashboard/ngo');
    });
  });

  // ================================================================ API layer
  describe('NGO referral API', function () {
    let ngoToken;
    let volunteerToken;
    let referrals = [];

    before(async function () {
      const ngo = await apiLogin(NGO);
      ngoToken = ngo && ngo.token;
      const volunteer = await apiLogin(VOLUNTEER);
      volunteerToken = volunteer && volunteer.token;

      if (ngoToken) {
        const res = await api('/api/referrals/mine', { token: ngoToken });
        referrals = (res.body && res.body.referrals) || [];
      }
    });

    function needNgo(ctx) {
      if (!ngoToken) pending(ctx, `NGO login failed for ${NGO.email} - run server/seeds/seedTestNgo.js`);
    }

    it('NGO-35: POST /api/auth/login returns a token and an ngo user', async function () {
      const res = await api('/api/auth/login', { method: 'POST', body: NGO });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.token).to.be.a('string');
      expect(res.body.user.role).to.equal('ngo');
      expect(res.body.user).to.not.have.property('password');
    });

    it('NGO-36: POST /api/auth/login rejects a wrong password with 401', async function () {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: { email: NGO.email, password: 'Wrong@Password1' },
      });

      expect(res.status).to.equal(401);
    });

    it('NGO-37: GET /api/referrals/mine needs a token', async function () {
      expect((await api('/api/referrals/mine')).status).to.equal(401);
    });

    it('NGO-38: a volunteer cannot list NGO referrals', async function () {
      if (!volunteerToken) pending(this, 'no volunteer@test.com account');

      expect((await api('/api/referrals/mine', { token: volunteerToken })).status).to.equal(403);
    });

    it('NGO-39: the NGO cannot create referrals (volunteer-only)', async function () {
      needNgo(this);

      const res = await api('/api/referrals', {
        method: 'POST',
        token: ngoToken,
        body: { requestId: '000000000000000000000000', ngoId: '000000000000000000000000', consent: true },
      });

      expect(res.status).to.equal(403);
    });

    it('NGO-40: GET /api/referrals/mine returns the NGO\'s referrals', async function () {
      needNgo(this);

      const res = await api('/api/referrals/mine', { token: ngoToken });

      expect(res.status, JSON.stringify(res.body)).to.equal(200);
      expect(res.body.referrals).to.be.an('array');
      expect(res.body.count).to.equal(res.body.referrals.length);
      for (const r of res.body.referrals) {
        expect(REFERRAL_STATUSES).to.include(r.status);
      }
    });

    it('NGO-41: referrals never include the seeker (data minimisation)', async function () {
      needNgo(this);
      if (referrals.length === 0) pending(this, 'this NGO has no referrals');

      for (const r of referrals) {
        expect(r).to.not.have.property('referredBy');
        expect(r).to.not.have.property('consentGiven');
        expect(r.request).to.not.have.property('seeker');
      }
    });

    it('NGO-42: ?status= filters the list', async function () {
      needNgo(this);

      for (const status of REFERRAL_STATUSES) {
        const res = await api(`/api/referrals/mine?status=${status}`, { token: ngoToken });

        expect(res.status).to.equal(200);
        for (const r of res.body.referrals) expect(r.status).to.equal(status);
      }
    });

    it('NGO-43: an unknown ?status= value is rejected with 400', async function () {
      needNgo(this);

      expect((await api('/api/referrals/mine?status=bogus', { token: ngoToken })).status).to.equal(400);
    });

    it('NGO-44: GET /api/referrals/:id returns one referral', async function () {
      needNgo(this);
      if (referrals.length === 0) pending(this, 'this NGO has no referrals');

      const res = await api(`/api/referrals/${referrals[0]._id}`, { token: ngoToken });

      expect(res.status).to.equal(200);
      expect(res.body.referral._id).to.equal(referrals[0]._id);
    });

    it('NGO-45: a malformed referral id is rejected with 400', async function () {
      needNgo(this);

      expect((await api('/api/referrals/not-an-id', { token: ngoToken })).status).to.equal(400);
    });

    it('NGO-46: a referral id that does not exist returns 404', async function () {
      needNgo(this);

      expect((await api('/api/referrals/000000000000000000000000', { token: ngoToken })).status).to.equal(404);
    });

    it('NGO-47: PATCH status needs a token', async function () {
      const res = await api('/api/referrals/000000000000000000000000/status', {
        method: 'PATCH',
        body: { status: 'in_progress' },
      });

      expect(res.status).to.equal(401);
    });

    it('NGO-48: PATCH with an invalid status is rejected with 400', async function () {
      needNgo(this);
      if (referrals.length === 0) pending(this, 'this NGO has no referrals');

      const res = await api(`/api/referrals/${referrals[0]._id}/status`, {
        method: 'PATCH',
        token: ngoToken,
        body: { status: 'teleported' },
      });

      expect(res.status).to.equal(400);
    });

    it('NGO-49: PATCH with a note over 1000 characters is rejected with 400', async function () {
      needNgo(this);
      if (referrals.length === 0) pending(this, 'this NGO has no referrals');

      const res = await api(`/api/referrals/${referrals[0]._id}/status`, {
        method: 'PATCH',
        token: ngoToken,
        body: { status: referrals[0].status, note: 'x'.repeat(1001) },
      });

      expect(res.status).to.equal(400);
    });

    it('NGO-50: the NGO can update a referral status and note (then it is put back)', async function () {
      needNgo(this);
      if (referrals.length === 0) pending(this, 'this NGO has no referrals');

      // This is the shared team database, so the referral is restored below.
      const target = referrals[0];
      const original = { status: target.status, note: target.note || '' };
      const nextStatus = original.status === 'in_progress' ? 'resolved' : 'in_progress';

      try {
        const res = await api(`/api/referrals/${target._id}/status`, {
          method: 'PATCH',
          token: ngoToken,
          body: { status: nextStatus, note: `${MARK} contacted the seeker` },
        });

        expect(res.status, JSON.stringify(res.body)).to.equal(200);
        expect(res.body.referral.status).to.equal(nextStatus);
        expect(res.body.referral.note).to.equal(`${MARK} contacted the seeker`);
        expect(res.body.referral.respondedAt).to.not.equal(null);

        const check = await api(`/api/referrals/${target._id}`, { token: ngoToken });
        expect(check.body.referral.status).to.equal(nextStatus);
      } finally {
        await api(`/api/referrals/${target._id}/status`, {
          method: 'PATCH',
          token: ngoToken,
          body: original,
        });
      }
    });
  });
});