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

// T15.11 (BL-15) - volunteer accepts a request, the seeker's bell shows the
// notification. Written by Tanjila.
//
// The volunteer accepts through the real dashboard (a click on Accept), so the
// whole chain is exercised: accept button -> PATCH /api/requests/:id/accept ->
// notify() -> Notification collection -> GET /api/notifications/unread-count
// and the list -> the seeker's bell badge and dropdown.
//
// Needs T15.5 (notification triggers, Roshni) and T15.7 (the bell, Ahnaf) merged,
// plus T15.3 (the notification APIs). If the notification API is missing the
// tests mark themselves pending instead of failing for the wrong reason.
//
// Run with:  npm run test:e2e:notifications
// Needs:     client on 5173, server on 5000, Chrome, and the seeded accounts
//            (node server/seeds/seedTestSeeker.js, node server/seeds/seedTestAdmin.js).

describe('MindEase Sprint 5 E2E - BL-15 notification bell (Selenium)', function () {
  this.timeout(120000);

  let volunteerDriver;
  let seekerDriver;
  let seekerToken;
  let volunteer;
  let request;

  before(async function () {
    seekerToken = await apiLogin(ACCOUNTS.seeker.email, ACCOUNTS.seeker.password);
    if (!seekerToken) pending(this, 'no seeker account - run node server/seeds/seedTestSeeker.js');

    const adminToken = await apiLogin(ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    if (!adminToken) pending(this, 'no test admin - run node server/seeds/seedTestAdmin.js');

    // is the notification API there at all? (T15.3)
    const probe = await api('/api/notifications/unread-count', { token: seekerToken });
    if (probe.status === 404) pending(this, 'T15.3 not merged - /api/notifications does not exist yet');

    volunteer = await createApprovedVolunteer(adminToken, 't1511');
    request = await createRequest(seekerToken, 'bell test');

    // two separate browsers, so the two logins never share localStorage
    volunteerDriver = await newDriver();
    seekerDriver = await newDriver();
  });

  after(async function () {
    if (volunteerDriver) await volunteerDriver.quit();
    if (seekerDriver) await seekerDriver.quit();
  });

  it('T15.E1: the seeker is notified when a volunteer accepts the request', async function () {
    const before = await api('/api/notifications/unread-count', { token: seekerToken });
    expect(before.status).to.equal(200);

    // --- volunteer: log in and click Accept on exactly this request
    expect(await uiLogin(volunteerDriver, volunteer), 'volunteer login failed').to.equal(true);
    await volunteerDriver.get(`${BASE}/dashboard/volunteer`);

    const card = await volunteerDriver.wait(
      until.elementLocated(
        // the Accept button in the same card as this request's description
        By.xpath(
          `//p[contains(., '${request.description}')]/following-sibling::div//button[normalize-space()='Accept']`
        )
      ),
      20000
    );
    await card.click();

    const accepted = await present(
      volunteerDriver,
      By.xpath("//p[contains(., 'Request accepted')]"),
      10000
    );
    expect(accepted, 'the volunteer dashboard did not confirm the accept').to.equal(true);

    // --- the API now has one more unread notification for the seeker
    const after = await api('/api/notifications/unread-count', { token: seekerToken });
    expect(after.body.count).to.equal(before.body.count + 1);
  });

  it("T15.E2: the seeker's bell shows the unread badge", async function () {
    expect(await uiLogin(seekerDriver, ACCOUNTS.seeker), 'seeker login failed').to.equal(true);

    // The bell reads the count as soon as it mounts, then every 30 seconds.
    const badge = await seekerDriver.wait(
      until.elementLocated(By.css("[data-testid='bell-badge']")),
      15000
    );
    const count = parseInt(await badge.getText(), 10);
    expect(count).to.be.at.least(1);
  });

  it("T15.E3: the dropdown lists the 'request accepted' notification", async function () {
    await seekerDriver.findElement(By.css("[data-testid='bell-button']")).click();

    await seekerDriver.wait(until.elementLocated(By.css("[data-testid='bell-panel']")), 5000);
    const item = await seekerDriver.wait(
      until.elementLocated(
        By.xpath("//*[@data-testid='bell-panel']//button[contains(., 'A volunteer accepted your request')]")
      ),
      10000
    );
    expect(await item.isDisplayed()).to.equal(true);
  });

  it('T15.E4: opening the notification marks it read and the count drops', async function () {
    const before = await api('/api/notifications/unread-count', { token: seekerToken });

    const item = await seekerDriver.findElement(
      By.xpath("//*[@data-testid='bell-panel']//button[contains(., 'A volunteer accepted your request')]")
    );
    await item.click();

    // the notification links to the seeker dashboard
    await seekerDriver.wait(until.urlContains('/dashboard/seeker'), 10000);

    // the unread count in the database went down by one
    const lowered = await (async () => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const now = await api('/api/notifications/unread-count', { token: seekerToken });
        if (now.body.count === before.body.count - 1) return true;
        await new Promise((r) => setTimeout(r, 500));
      }
      return false;
    })();
    expect(lowered, 'the notification was not marked read').to.equal(true);
  });

  it('T15.E5: the notification APIs reject a caller with no token', async function () {
    const res = await api('/api/notifications');
    expect(res.status).to.equal(401);
  });
});
