const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { expect } = require('chai');

// Selenium checks for the three demo pages added on 4 Nov (items 5, 6, 7):
//   - /dashboard/profile    read-only profile, every role
//   - /dashboard/reports    admin count cards
//   - /dashboard/psychologist   restyled dashboard
//
// These are demo-path pages, so the checks are deliberately about what a
// person will see on the day: does the page render, does it show real values
// rather than "coming soon", and do its buttons go somewhere that exists.
//
// Run with:  npx mocha test/demo-pages.e2e.test.js --timeout 120000
// Needs:     client on 5173, server on 5000, Chrome, the seeded accounts.

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';

const ACCOUNTS = {
  seeker: {
    email: process.env.E2E_SEEKER_EMAIL || 'seeker@test.com',
    password: process.env.E2E_SEEKER_PASSWORD || 'Seeker@12345',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin.test@mindease.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'Admin@12345',
  },
  psychologist: {
    email: process.env.E2E_PSYCHOLOGIST_EMAIL || 'psychologist@mindease.test',
    password: process.env.E2E_PSYCHOLOGIST_PASSWORD || 'Psychologist@123',
  },
  facilitator: {
    email: process.env.E2E_FACILITATOR_EMAIL || 'facilitator@test.com',
    password: process.env.E2E_FACILITATOR_PASSWORD || 'Facilitator@12345',
  },
};

async function uiLogin(driver, role) {
  const { email, password } = ACCOUNTS[role];
  if (!password) return 'no-password';

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

function pending(ctx, reason) {
  ctx.test.title += ` [pending: ${reason}]`;
  console.log(`      pending: ${reason}`);
  ctx.skip();
}

async function requireLogin(ctx, driver, role) {
  const result = await uiLogin(driver, role);
  if (result === 'no-password') pending(ctx, `E2E_${role.toUpperCase()}_PASSWORD not set`);
  if (result === false) {
    throw new Error(`${role} login failed for ${ACCOUNTS[role].email}`);
  }
}

const bodyText = async (driver) => (await driver.findElement(By.css('body')).getText());

describe('MindEase demo pages (Selenium)', function () {
  this.timeout(120000);

  let driver;

  before(async function () {
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
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    await driver.manage().window().maximize();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  // ---------- item 5: profile ----------

  describe('Profile page', function () {
    it('D5.1 shows the seeker their own details, not a placeholder', async function () {
      await requireLogin(this, driver, 'seeker');
      await driver.get(`${BASE}/dashboard/profile`);

      await driver.wait(until.elementLocated(By.xpath('//h2[contains(., "My profile")]')), 20000);
      const text = await bodyText(driver);

      expect(text).to.not.match(/coming soon/i);
      expect(text).to.include(ACCOUNTS.seeker.email);
      expect(text).to.match(/Seeker/);
      expect(text).to.match(/read-only/i);
    });

    it('D5.2 shows a different role its own details', async function () {
      await requireLogin(this, driver, 'facilitator');
      await driver.get(`${BASE}/dashboard/profile`);

      await driver.wait(until.elementLocated(By.xpath('//h2[contains(., "My profile")]')), 20000);
      const text = await bodyText(driver);

      expect(text).to.include(ACCOUNTS.facilitator.email);
      expect(text).to.match(/create workshops/i); // the facilitator blurb
    });
  });

  // ---------- item 6: admin reports ----------

  describe('Admin Reports', function () {
    it('D6.1 shows count cards instead of "coming soon"', async function () {
      await requireLogin(this, driver, 'admin');
      await driver.get(`${BASE}/dashboard/reports`);

      await driver.wait(until.elementLocated(By.css('[data-testid="report-users-total"]')), 20000);
      const text = await bodyText(driver);

      expect(text).to.not.match(/coming soon/i);
      for (const id of ['users-total', 'requests-total', 'workshops-total', 'referrals-total']) {
        const card = await driver.findElement(By.css(`[data-testid="report-${id}"]`));
        expect(await card.getText(), id).to.match(/\d/);
      }
    });

    it('D6.2 the totals agree with the admin overview', async function () {
      await requireLogin(this, driver, 'admin');

      await driver.get(`${BASE}/dashboard/reports`);
      const reportCard = await driver.wait(
        until.elementLocated(By.css('[data-testid="report-users-total"]')),
        20000
      );
      const reportUsers = (await reportCard.getText()).match(/\d+/)?.[0];

      await driver.get(`${BASE}/dashboard/admin`);
      await driver.wait(until.elementLocated(By.css('[data-testid^="stat-"]')), 20000);
      const overview = await bodyText(driver);

      // the same number has to appear somewhere on the overview
      expect(overview).to.include(reportUsers);
    });
  });

  // ---------- item 7: psychologist dashboard ----------

  describe('Psychologist dashboard', function () {
    it('D7.1 renders with real styling, not raw unstyled markup', async function () {
      await requireLogin(this, driver, 'psychologist');
      await driver.get(`${BASE}/dashboard/psychologist`);

      await driver.wait(
        until.elementLocated(By.xpath('//h2[contains(., "Cases and consultations")]')),
        20000
      );

      // the summary cards carry a real background, which the Tailwind-class
      // version could not because Tailwind is not installed
      const card = await driver.findElement(By.css('[data-testid="stat-pending"]'));
      const bg = await card.getCssValue('background-color');
      expect(bg).to.match(/rgba?\(255,\s*255,\s*255/); // white panel
      const radius = await card.getCssValue('border-radius');
      expect(radius).to.not.equal('0px');
    });

    it('D7.2 shows the three summary counts', async function () {
      await requireLogin(this, driver, 'psychologist');
      await driver.get(`${BASE}/dashboard/psychologist`);

      for (const id of ['stat-pending', 'stat-accepted', 'stat-completed']) {
        const el = await driver.wait(until.elementLocated(By.css(`[data-testid="${id}"]`)), 20000);
        expect(await el.getText(), id).to.match(/\d/);
      }
    });

    it('D7.3 no icon is rendered at a runaway size', async function () {
      await requireLogin(this, driver, 'psychologist');
      await driver.get(`${BASE}/dashboard/psychologist`);
      await driver.wait(
        until.elementLocated(By.xpath('//h2[contains(., "Cases and consultations")]')),
        20000
      );

      // the old page had <svg className="w-4 h-4"> with no Tailwind, so the
      // icons rendered at their natural size and swamped the header
      const svgs = await driver.findElements(By.css('svg'));
      for (const svg of svgs) {
        const rect = await svg.getRect();
        expect(rect.height, 'an icon is far too tall').to.be.below(60);
      }
    });

    it('D7.4 Open case goes to a route that exists', async function () {
      await requireLogin(this, driver, 'psychologist');
      await driver.get(`${BASE}/dashboard/psychologist`);
      await driver.wait(
        until.elementLocated(By.xpath('//h2[contains(., "Cases and consultations")]')),
        20000
      );

      // the heading renders before the cases arrive, so wait for the table
      // (or the empty state) rather than racing the fetch
      await driver.wait(async () => {
        const rows = await driver.findElements(By.xpath('//button[normalize-space()="Open case"]'));
        const empty = await driver.findElements(By.xpath('//*[contains(., "No cases match")]'));
        return rows.length > 0 || empty.length > 0;
      }, 20000);

      const buttons = await driver.findElements(By.xpath('//button[normalize-space()="Open case"]'));
      if (buttons.length === 0) {
        pending(this, 'this psychologist has no assigned cases to open');
      }

      await buttons[0].click();
      await driver.wait(until.urlContains('/dashboard/psychologist/cases/'), 20000);

      const text = await bodyText(driver);
      expect(text).to.not.match(/page not found/i);
    });
  });
});
