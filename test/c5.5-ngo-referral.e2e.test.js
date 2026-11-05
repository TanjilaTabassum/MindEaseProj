const { expect } = require('chai');
const {
  BASE,
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
  pending,
} = require('./helpers/e2e-helpers');

describe('MindEase Sprint 4 carry-over E2E - BL-14 NGO referrals (Selenium)', function () {
  this.timeout(120000);

  let driver;
  let ngoToken;
  let volunteer;
  let request;
  let referralId;

  // Broad card locator matching any text content of the request or referral ID
  const cardXpath = (suffix = '') =>
    `//*[contains(@class, 'card') or contains(@class, 'border') or contains(@class, 'referral') or self::tr][contains(., 'ngo referral') or contains(., 'mental_health') or contains(., '${referralId}')]${suffix}`;

  before(async function () {
    const seekerToken = await apiLogin(ACCOUNTS.seeker.email, ACCOUNTS.seeker.password);
    if (!seekerToken) pending(this, 'no seeker account - run node server/seeds/seedTestSeeker.js');

    const adminToken = await apiLogin(ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    if (!adminToken) pending(this, 'no test admin - run node server/seeds/seedTestAdmin.js');

    ngoToken = await apiLogin(ACCOUNTS.ngo.email, ACCOUNTS.ngo.password);
    if (!ngoToken) pending(this, 'no test NGO - run node server/seeds/seedTestNgo.js');

    volunteer = await createApprovedVolunteer(adminToken, 'ngo');
    request = await createRequest(seekerToken, 'ngo referral test', 'mental_health');

    // volunteer accepts, then refers it to the test NGO with the seeker's consent
    const accept = await api(`/api/requests/${request.id}/accept`, { method: 'PATCH', token: volunteer.token });
    if (accept.status !== 200) throw new Error(`could not accept the request: ${accept.status}`);

    const ngos = await api('/api/ngos?category=mental_health', { token: volunteer.token });
    const list = Array.isArray(ngos.body) ? ngos.body : ngos.body?.ngos || [];
    const ngo = list.find((n) => n.organizationName === 'Test NGO Organisation');
    if (!ngo) pending(this, 'the test NGO is not listed - run node server/seeds/seedTestNgo.js');

    const referral = await api('/api/referrals', {
      method: 'POST',
      token: volunteer.token,
      body: { requestId: request.id, ngoId: ngo._id, consent: true },
    });
    if (referral.status !== 201) throw new Error(`could not create the referral: ${referral.status}`);
    referralId = referral.body.referral._id;

    driver = await newDriver();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  async function selectFilter(value) {
    const filter = await driver.wait(
      until.elementLocated(By.xpath("//select[@id='status-filter' or @name='status' or contains(@class, 'filter')]")),
      5000
    );
    await filter.findElement(By.xpath(`.//option[@value='${value}']`)).click();
  }

  it('C5.5-1: the NGO logs in and lands on its dashboard', async function () {
    expect(await uiLogin(driver, ACCOUNTS.ngo), 'NGO login failed').to.equal(true);
    expect(await driver.getCurrentUrl()).to.include('/dashboard/ngo');
  });

  it('C5.5-2: the new referral is listed as pending', async function () {
    await driver.get(`${BASE}/dashboard/ngo`);
    await driver.wait(until.elementLocated(By.xpath("//*[contains(., 'Referred') or contains(., 'Referral')]")), 15000);

    expect(
      await present(driver, By.xpath(cardXpath()), 10000),
      'the referral is not on the NGO dashboard'
    ).to.equal(true);
  });

  it("C5.5-3: the status filter shows it under 'pending' and hides it under 'resolved'", async function () {
    await selectFilter('pending');
    expect(await present(driver, By.xpath(cardXpath()), 3000)).to.equal(true);

    await selectFilter('resolved');
    await driver.wait(async () => (await driver.findElements(By.xpath(cardXpath()))).length === 0, 5000);

    await selectFilter('all');
    expect(await present(driver, By.xpath(cardXpath()), 3000)).to.equal(true);
  });

  it('C5.5-4: the card never shows who the seeker is', async function () {
    const source = await driver.getPageSource();
    expect(source).to.not.include(ACCOUNTS.seeker.email);
  });

  it('C5.5-5: opening the referral shows the detail page with the form', async function () {
    await driver.get(`${BASE}/dashboard/ngo/referrals/${referralId}`);
    await driver.wait(until.urlContains(`/dashboard/ngo/referrals/${referralId}`), 10000);

    // Locate status dropdown by ID, name, or select tag
    await driver.wait(
      until.elementLocated(By.xpath("//select[@id='referral-status' or @name='status' or contains(@id, 'status')]")),
      10000
    );
    // Locate note textarea/input by ID, name, or textarea tag
    await driver.wait(
      until.elementLocated(By.xpath("//textarea[@id='referral-note' or @name='note' or contains(@id, 'note')] | //input[@name='note']")),
      10000
    );
  });

  it('C5.5-6: Save is disabled until something changes', async function () {
    const save = await driver.findElement(
      By.xpath("//button[@type='submit' or contains(translate(., 'SAVE', 'save'), 'save')]")
    );
    expect(await save.isEnabled()).to.equal(false);
  });

  it('C5.5-7: changing the status and adding a note saves them', async function () {
    const statusSelect = await driver.findElement(
      By.xpath("//select[@id='referral-status' or @name='status' or contains(@id, 'status')]")
    );
    await statusSelect.findElement(By.xpath(".//option[@value='in_progress']")).click();

    const noteInput = await driver.findElement(
      By.xpath("//textarea[@id='referral-note' or @name='note' or contains(@id, 'note')] | //input[@name='note']")
    );
    const note = `E2E S5 note ${Date.now()}`;
    await noteInput.sendKeys(note);

    const save = await driver.findElement(
      By.xpath("//button[@type='submit' or contains(translate(., 'SAVE', 'save'), 'save')]")
    );
    await driver.wait(until.elementIsEnabled(save), 5000);
    await save.click();

    await driver.wait(
      until.elementLocated(
        By.xpath("//*[@role='status' or contains(@class, 'alert') or contains(., 'Referral updated') or contains(., 'Saved')]")
      ),
      10000
    );

    // persisted: read it back through the API, as the NGO
    const res = await api(`/api/referrals/${referralId}`, { token: ngoToken });
    expect(res.status).to.equal(200);
    expect(res.body.referral.status).to.equal('in_progress');
    expect(res.body.referral.note).to.equal(note);
    expect(res.body.referral.respondedAt, 'respondedAt should be stamped').to.be.a('string');
  });

  it("C5.5-8: back on the dashboard the referral now sits under 'in progress'", async function () {
    await driver.get(`${BASE}/dashboard/ngo`);
    await driver.wait(until.elementLocated(By.xpath("//select[@id='status-filter' or @name='status' or contains(@class, 'filter')]")), 15000);

    await selectFilter('in_progress');
    expect(await present(driver, By.xpath(cardXpath()), 5000)).to.equal(true);

    await selectFilter('pending');
    await driver.wait(async () => (await driver.findElements(By.xpath(cardXpath()))).length === 0, 5000);
  });

  it('C5.5-9: the API refuses a status that does not exist', async function () {
    const res = await api(`/api/referrals/${referralId}/status`, {
      method: 'PATCH',
      token: ngoToken,
      body: { status: 'banana' },
    });
    expect(res.status).to.equal(400);
  });

  it('C5.5-10: a volunteer token cannot read the NGO referral list', async function () {
    const res = await api('/api/referrals/mine', { token: volunteer.token });
    expect(res.status).to.equal(403);
  });

  it('C5.5-11: a seeker is redirected away from the NGO dashboard', async function () {
    expect(await uiLogin(driver, ACCOUNTS.seeker), 'seeker login failed').to.equal(true);
    await driver.get(`${BASE}/dashboard/ngo`);
    await driver.wait(until.urlContains('/dashboard/seeker'), 10000);
    expect(await driver.getCurrentUrl()).to.not.include('/dashboard/ngo');
  });
});