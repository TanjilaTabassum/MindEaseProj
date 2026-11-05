// Shared helpers for Tanjila's Sprint 5 Selenium tests (T15.11, C5.4, C5.5).
// Lives in test/helpers/ so `mocha test/*.test.js` does not pick it up as a test.

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API = process.env.E2E_API_URL || 'http://localhost:5000';

// Everything these suites create carries this prefix, so a human can recognise
// it in MongoDB Compass if a run is interrupted.
const MARK = 'E2E S5 -';

// Fixed accounts created by the seed scripts in server/seeds/.
const ACCOUNTS = {
  seeker: {
    email: process.env.E2E_SEEKER_EMAIL || 'seeker@test.com',
    password: process.env.E2E_SEEKER_PASSWORD || 'Seeker@12345', // seedTestSeeker.js
  },
  admin: {
    email: process.env.ADMIN_TEST_EMAIL || 'admin.test@mindease.com',
    password: process.env.ADMIN_TEST_PASSWORD || 'Admin@12345', // seedTestAdmin.js
  },
  ngo: {
    email: process.env.NGO_EMAIL || 'ngo@test.com',
    password: process.env.NGO_PASSWORD || 'Ngo@12345', // seedTestNgo.js
  },
};

// ---------------------------------------------------------------- API

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
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

async function apiLogin(email, password) {
  const res = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  return res.status === 200 ? res.body.token : null;
}

// Registers a volunteer, has the admin approve it, and logs it in.
// A fresh account per run keeps the tests independent of whoever else is
// using the shared database. There is no delete endpoint, so these accounts
// stay behind; their names start with MARK.
async function createApprovedVolunteer(adminToken, tag) {
  const stamp = Date.now();
  const email = `e2e.s5.${tag}.${stamp}@test.com`;
  const password = 'Volunteer@12345';

  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: `${MARK} Volunteer ${tag}`, email, password, role: 'volunteer' },
  });
  if (reg.status !== 201) throw new Error(`could not register a volunteer: ${reg.status}`);

  const id = reg.body.user.id;
  const approve = await api(`/api/admin/users/${id}/approve`, { method: 'PATCH', token: adminToken });
  if (approve.status !== 200) throw new Error(`could not approve the volunteer: ${approve.status}`);

  const token = await apiLogin(email, password);
  if (!token) throw new Error('the new volunteer could not log in');
  return { id, email, password, token };
}

// A crisis request from the seeker. The description is unique so the UI can
// find exactly this card among everyone else's data.
async function createRequest(seekerToken, label, category = 'mental_health') {
  const description = `${MARK} ${label} ${Date.now()}`;
  const res = await api('/api/requests', {
    method: 'POST',
    token: seekerToken,
    body: { category, description, urgency: 'medium' },
  });
  if (res.status !== 201) throw new Error(`could not create a request: ${res.status}`);
  return { id: res.body.request._id, description };
}

// ---------------------------------------------------------------- browser

async function newDriver() {
  // Chrome's "password found in a data breach" dialog covers the login form and
  // swallows the submit, and the shared test passwords trigger it.
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
  if (process.env.E2E_HEADLESS === '1') options.addArguments('--headless=new');

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  await driver.manage().window().setRect({ width: 1280, height: 900 });
  return driver;
}

// Logs in through the real login form. Returns true once the dashboard loads.
async function uiLogin(driver, { email, password }) {
  await driver.get(`${BASE}/login`);
  await driver.executeScript('try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}');
  await driver.get(`${BASE}/login`);

  const emailInput = await driver.wait(until.elementLocated(By.css("input[name='email']")), 10000);
  await emailInput.clear();
  await emailInput.sendKeys(email);

  const passInput = await driver.findElement(By.css("input[name='password']"));
  await passInput.clear();
  await passInput.sendKeys(password);

  await driver.findElement(By.css("button[type='submit']")).click();

  try {
    await driver.wait(until.urlContains('/dashboard/'), 30000);
    return true;
  } catch {
    return false;
  }
}

async function present(driver, locator, timeout = 4000) {
  try {
    await driver.wait(until.elementLocated(locator), timeout);
    return true;
  } catch {
    return false;
  }
}

// Polls until fn() returns something truthy, or returns null after the timeout.
async function waitFor(fn, timeout = 10000, every = 500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, every));
  }
  return null;
}

// Marks a test as pending (skipped) and says why in its title.
function pending(ctx, reason) {
  ctx.test.title += ` [pending: ${reason}]`;
  console.log(`      pending: ${reason}`); // a skipped hook has no title to show it
  ctx.skip();
}

module.exports = {
  BASE,
  API,
  MARK,
  ACCOUNTS,
  By,
  until,
  api,
  apiLogin,
  createApprovedVolunteer,
  createRequest,
  newDriver,
  uiLogin,
  present,
  waitFor,
  pending,
};
