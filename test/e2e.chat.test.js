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
  waitFor,
  pending,
} = require('./helpers/e2e-helpers');

// T5.7 / T7.6 - chat and role checks, written by Tanjila in Sprint 2.
// C5.4 (Sprint 5): T5.7 now tests the REAL chat. The Sprint 2 version only
// checked that a text box existed on a placeholder route; the real chat lives in
// ChatWindow, opened with "Open chat" on an accepted request.
//
// Two browsers run at the same time (a seeker and a volunteer), because a chat
// that only works for the sender is not working. The data is created through
// the API, so the test needs no hand-made accounts except the seeded seeker and
// admin. Nothing is hard-coded: no personal email or password lives in this file.
//
// What this does NOT check: that the messages are encrypted in the database.
// That is read in MongoDB Compass (C5.3), because the API only ever returns
// decrypted text.
//
// Run with:  npm run test:e2e:chat
// Needs:     client on 5173, server on 5000, Chrome, and the seeded accounts
//            (node server/seeds/seedTestSeeker.js, node server/seeds/seedTestAdmin.js).

const CHAT_INPUT = By.css("input[placeholder^='Type your message']");

describe('MindEase Automated E2E Testing (Selenium)', function () {
  this.timeout(120000);

  let seekerDriver;
  let volunteerDriver;
  let seekerToken;
  let volunteer;
  let outsider;
  let request;

  before(async function () {
    seekerToken = await apiLogin(ACCOUNTS.seeker.email, ACCOUNTS.seeker.password);
    if (!seekerToken) pending(this, 'no seeker account - run node server/seeds/seedTestSeeker.js');

    const adminToken = await apiLogin(ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    if (!adminToken) pending(this, 'no test admin - run node server/seeds/seedTestAdmin.js');

    volunteer = await createApprovedVolunteer(adminToken, 'chat');
    outsider = await createApprovedVolunteer(adminToken, 'outsider');

    // the chat only opens after a volunteer has accepted the request
    request = await createRequest(seekerToken, 'chat test');
    const accept = await api(`/api/requests/${request.id}/accept`, {
      method: 'PATCH',
      token: volunteer.token,
    });
    if (accept.status !== 200) throw new Error(`could not accept the request: ${accept.status}`);

    seekerDriver = await newDriver();
    volunteerDriver = await newDriver();
  });

  after(async function () {
    if (seekerDriver) await seekerDriver.quit();
    if (volunteerDriver) await volunteerDriver.quit();
  });

  // Opens the chat in one browser and waits for the green "Connected" label.
  async function openChat(driver, account, cardXpath) {
    expect(await uiLogin(driver, account), `${account.email} could not log in`).to.equal(true);

    const open = await driver.wait(until.elementLocated(By.xpath(cardXpath)), 20000);
    await open.click();

    await driver.wait(until.elementLocated(By.xpath("//*[normalize-space()='Connected']")), 15000);
    await driver.wait(until.elementLocated(CHAT_INPUT), 5000);
  }

  async function send(driver, text) {
    const input = await driver.findElement(CHAT_INPUT);
    await input.sendKeys(text);
    await driver.findElement(By.xpath("//button[normalize-space()='Send']")).click();
  }

  const bubble = (text) => By.xpath(`//div[normalize-space()='${text}']`);

  it('T5.7a: the seeker opens the chat on an accepted request', async function () {
    await openChat(
      seekerDriver,
      ACCOUNTS.seeker,
      `//p[contains(., '${request.description}')]/following-sibling::button[normalize-space()='Open chat']`
    );
    expect(await present(seekerDriver, By.xpath("//*[contains(., 'Chat with your volunteer')]"))).to.equal(true);
  });

  it('T5.7b: the volunteer opens the same chat from the accepted-cases list', async function () {
    await openChat(
      volunteerDriver,
      volunteer,
      `//p[contains(., '${request.description}')]/following-sibling::div//button[normalize-space()='Open chat']`
    );
    expect(await present(volunteerDriver, By.xpath("//*[contains(., 'Chat with the seeker')]"))).to.equal(true);
  });

  it("T5.7c: a seeker's message appears in both browsers", async function () {
    const text = `Hello from the seeker ${Date.now()}`;
    await send(seekerDriver, text);

    expect(await present(seekerDriver, bubble(text), 10000), 'sender did not see it').to.equal(true);
    expect(await present(volunteerDriver, bubble(text), 10000), 'receiver did not see it').to.equal(true);
  });

  it("T5.7d: the volunteer's reply appears in both browsers", async function () {
    const text = `Hello from the volunteer ${Date.now()}`;
    await send(volunteerDriver, text);

    expect(await present(volunteerDriver, bubble(text), 10000), 'sender did not see it').to.equal(true);
    expect(await present(seekerDriver, bubble(text), 10000), 'receiver did not see it').to.equal(true);
  });

  it('T5.7e: an empty message cannot be sent', async function () {
    const sendBtn = await seekerDriver.findElement(By.xpath("//button[normalize-space()='Send']"));
    expect(await sendBtn.isEnabled()).to.equal(false);
  });

  it('T5.7f: the saved history comes back decrypted and in order', async function () {
    const res = await waitFor(async () => {
      const r = await api(`/api/chat/${request.id}/messages`, { token: seekerToken });
      return r.status === 200 && r.body.messages.length >= 2 ? r : null;
    });
    expect(res, 'the messages were not saved').to.not.equal(null);

    const texts = res.body.messages.map((m) => m.text);
    expect(texts.some((t) => t.startsWith('Hello from the seeker'))).to.equal(true);
    expect(texts.some((t) => t.startsWith('Hello from the volunteer'))).to.equal(true);
    expect(texts.findIndex((t) => t.startsWith('Hello from the seeker'))).to.be.below(
      texts.findIndex((t) => t.startsWith('Hello from the volunteer'))
    );
  });

  it('T5.7g: a refresh keeps the history (it is loaded from the server)', async function () {
    await seekerDriver.navigate().refresh();
    const open = await seekerDriver.wait(
      until.elementLocated(
        By.xpath(`//p[contains(., '${request.description}')]/following-sibling::button[normalize-space()='Open chat']`)
      ),
      20000
    );
    await open.click();
    expect(await present(seekerDriver, By.xpath("//div[starts-with(normalize-space(), 'Hello from the seeker')]"), 15000)).to.equal(true);
  });

  it('T5.7h: a volunteer who did not accept the request cannot read the chat', async function () {
    const res = await api(`/api/chat/${request.id}/messages`, { token: outsider.token });
    expect(res.status).to.equal(403);
  });

  it('T5.7i: the chat history needs a token', async function () {
    const res = await api(`/api/chat/${request.id}/messages`);
    expect(res.status).to.equal(401);
  });

  it('T7.6: a seeker is kept out of the NGO dashboard', async function () {
    await seekerDriver.get(`${BASE}/dashboard/ngo`);
    await seekerDriver.wait(until.urlContains('/dashboard/seeker'), 10000);

    const currentUrl = await seekerDriver.getCurrentUrl();
    expect(currentUrl).to.not.include('/dashboard/ngo');
  });
});
