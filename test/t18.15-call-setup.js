// T18.15 - set up a video consultation for the two-browser call test.
//
// The pages cannot yet build an accepted case on their own (no escalate button
// for volunteers, and the psychologist's Accept button does not show - see
// docs/qa/BL-18-two-browser-call-qa-by-fairoz.md), so this script does the
// same chain through the API that test/t18-video.e2e.test.js uses:
//   seeker raises a request -> volunteer accepts -> volunteer escalates to the
//   test psychologist -> psychologist accepts.
// Then it checks both sides get the SAME room, and prints the two links.
//
// Run from the project root, with the backend running on port 5000:
//     node test/t18.15-call-setup.js
// When the call test is finished, close the case again:
//     node test/t18.15-call-setup.js --cleanup <caseId>
//
// Needs Node 18+ (built-in fetch). No packages to install.

const API = process.env.API_URL || 'http://localhost:5000';
const SITE = process.env.SITE_URL || 'http://localhost:5173';
const MARK = 'QA T18.15 by Fairoz -';

const ACCOUNTS = {
  seeker: { email: 'seeker@test.com', password: 'Seeker@12345' },
  volunteer: { email: 'volunteer@test.com', password: 'Test@1234' },
  psychologist: { email: 'psychologist@mindease.test', password: 'Psychologist@123' },
};

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, body: json };
}

function stop(step, res) {
  const msg = res && res.body && res.body.message ? ` "${res.body.message}"` : '';
  console.log(`\nSTOPPED at: ${step}${res ? ` -> ${res.status}${msg}` : ''}`);
  process.exit(1);
}

async function login(role) {
  const res = await api('/api/auth/login', { method: 'POST', body: ACCOUNTS[role] });
  if (res.status !== 200 || !res.body || !res.body.token) stop(`log in as ${role} (${ACCOUNTS[role].email})`, res);
  console.log(`  logged in as ${role}`);
  return res.body.token;
}

async function setup() {
  console.log(`\nT18.15 call setup against ${API}\n`);
  const seeker = await login('seeker');
  const volunteer = await login('volunteer');
  const psychologist = await login('psychologist');

  // 1. seeker raises a request
  const created = await api('/api/requests', {
    method: 'POST',
    token: seeker,
    body: { category: 'mental_health', urgency: 'high', description: `${MARK} request for the two-browser video call test.` },
  });
  const requestId = created.body && created.body.request && created.body.request._id;
  if (created.status !== 201 || !requestId) stop('seeker creates a request', created);
  console.log(`  1. seeker created request ${requestId}`);

  // 2. volunteer accepts it
  const accepted = await api(`/api/requests/${requestId}/accept`, { method: 'PATCH', token: volunteer });
  if (accepted.status !== 200) stop('volunteer accepts the request', accepted);
  console.log('  2. volunteer accepted it');

  // 3. volunteer escalates it to the test psychologist
  const list = await api('/api/escalations/psychologists', { token: volunteer });
  const psychologists = (list.body && list.body.psychologists) || [];
  const target = psychologists.find((p) => p.email === ACCOUNTS.psychologist.email);
  if (!target) stop(`find ${ACCOUNTS.psychologist.email} in the psychologist list`, list);
  const escalated = await api('/api/escalations', {
    method: 'POST',
    token: volunteer,
    body: { requestId, psychologistId: target._id, summary: `${MARK} handover summary for the video call test.` },
  });
  const caseId = escalated.body && escalated.body.assignment && escalated.body.assignment._id;
  if (escalated.status !== 201 || !caseId) stop('volunteer escalates to the psychologist', escalated);
  console.log(`  3. volunteer escalated it, case ${caseId}`);

  // 4. psychologist accepts the case
  const caseAccepted = await api(`/api/escalations/${caseId}/accept`, { method: 'PATCH', token: psychologist });
  if (caseAccepted.status !== 200) stop('psychologist accepts the case', caseAccepted);
  console.log('  4. psychologist accepted the case');

  // 5. both sides must get the same room
  const asPsychologist = await api(`/api/video/case/${caseId}`, { token: psychologist });
  const asSeeker = await api(`/api/video/request/${requestId}`, { token: seeker });
  if (asPsychologist.status !== 200) stop('psychologist gets the room', asPsychologist);
  if (asSeeker.status !== 200) stop('seeker gets the room', asSeeker);
  const same = asPsychologist.body.roomName === asSeeker.body.roomName;
  console.log(`  5. room as psychologist: ${asPsychologist.body.roomName} (moderator: ${asPsychologist.body.isModerator})`);
  console.log(`     room as seeker:       ${asSeeker.body.roomName} (moderator: ${asSeeker.body.isModerator})`);
  console.log(`     ${same ? 'SAME room - good' : 'DIFFERENT rooms - the two people would not meet. Check VIDEO_ROOM_SECRET.'}`);

  console.log('\n================ READY FOR THE CALL TEST ================');
  console.log(`Case id:     ${caseId}`);
  console.log(`Request id:  ${requestId}`);
  console.log(`Room:        ${asPsychologist.body.url}`);
  console.log('\nPSYCHOLOGIST (Incognito window), log in, then open:');
  console.log(`  ${SITE}/dashboard/psychologist/cases/${caseId}`);
  console.log('SEEKER (normal window), log in, then the Seeker Dashboard. The');
  console.log(`  "${MARK.replace(' -', '')}" request has a "Join video consultation" button.`);
  console.log('\nWhen you are finished, close the case with:');
  console.log(`  node test/t18.15-call-setup.js --cleanup ${caseId}`);
  console.log('==========================================================\n');
}

async function cleanup(caseId) {
  if (!caseId) stop('cleanup needs the case id: node test/t18.15-call-setup.js --cleanup <caseId>');
  const psychologist = await login('psychologist');
  const done = await api(`/api/escalations/${caseId}/complete`, { method: 'PATCH', token: psychologist });
  if (done.status !== 200) stop('psychologist completes the case', done);
  const after = await api(`/api/video/case/${caseId}`, { token: psychologist });
  console.log(`\nCase ${caseId} marked completed.`);
  console.log(`Room after completing: ${after.status}${after.body && after.body.message ? ` "${after.body.message}"` : ''} (a completed case should no longer get a room)\n`);
}

const i = process.argv.indexOf('--cleanup');
(i === -1 ? setup() : cleanup(process.argv[i + 1])).catch((err) => {
  if (err && err.cause && err.cause.code === 'ECONNREFUSED') {
    console.log('\nCannot reach the backend. Start it first:  cd server  then  npm run dev\n');
  } else {
    console.error(err);
  }
  process.exit(1);
});
