# BL-18 Two-browser video call: QA (T18.15)

**Tester:** Fairoz
**Date:** 3 November 2026
**Task:** T18.15, the two-browser call test and QA note. This is the one BL-18 check no automated test can do: that two people can actually see and hear each other.
**Environment:** macOS (Apple Silicon), Chrome, Node 22, server on `localhost:5000`, client on `localhost:5173`, shared Atlas database, Jitsi on `meet.jit.si`
**Code tested:** `main` at commit `583ae55` (BL-18 frontend and backend from PR #67 and #70)
**How the two sides were run:** the **seeker** in a normal Chrome window, the **psychologist** in a Chrome **Incognito** window (separate logins), on the same Mac. Shared `VIDEO_ROOM_SECRET` from the team `.env`.

**Test data:** the case was set up with `test/t18.15-call-setup.js` (seeker request → volunteer accepts → escalated to `psychologist@mindease.test` → psychologist accepts), marked "QA T18.15 by Fairoz". The script was needed because the pages cannot build an accepted case yet (issues 1 and 2 below). After the test the case was closed with `--cleanup`.

---

## 1. Summary

| | |
|---|---|
| Checks | 16 (2 setup, 4 psychologist, 3 seeker, 7 call) |
| Passed | 16 |
| Failed | 0 |
| Issues found | 6 (2 high, 2 medium, 2 low), none of them in the call itself |

---

## 2. Setup checks

| ID | Check | Expected | Actual | Result |
|---|---|---|---|---|
| V1 | Run `node test/t18.15-call-setup.js` | All 5 steps succeed and print "SAME room - good" | All 5 steps succeeded; "SAME room - good". Case 6ae98f5f3ab045d7dbd6f7c0, room mindease-case-6ae98f5f3ab045d7dbd6f7c0-db71785101 | ✅ |
| V2 | Psychologist room `isModerator` / seeker room `isModerator` | `true` / `false` | psychologist true, seeker false | ✅ |

## 3. The psychologist side (Incognito)

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| P1 | Log in as `psychologist@mindease.test`, open `/dashboard/psychologist/cases/<caseId>` | Case page loads | Case page loads at the direct URL. (Manage Case on the dashboard shows "Page Not Found", issue 3; Accept / Reject buttons missing, issue 2) | ✅ |
| P2 | Look at the buttons | **Start video consultation** is shown | Start video consultation is shown | ✅ |
| P3 | Click it | A new tab opens on `meet.jit.si`, and the room name in the address bar matches the setup output | New tab on meet.jit.si with the same room name as the setup output | ✅ |
| P4 | Enter the room (allow camera and mic) | Psychologist is in the call. Note whether Jitsi asked to sign in as moderator | In the call. meet.jit.si showed "The conference has not yet started because no moderators have yet arrived" and required a Log-in; signed in with a Google account as moderator | ✅ |

## 4. The seeker side (normal window)

| ID | Steps | Expected | Actual | Result |
|---|---|---|---|---|
| S1 | Log in as `seeker@test.com`, Seeker Dashboard | The "QA T18.15" request shows **Join video consultation** | Join video consultation is shown on the QA T18.15 request | ✅ |
| S2 | Click it | A new tab opens on `meet.jit.si` with the **same room name** as P3 | New tab on meet.jit.si with the same room name as P3 | ✅ |
| S3 | Enter the room (allow camera and mic) | Seeker joins the **same** call (the psychologist's tile is visible) | Joined the same call straight away (no lobby, no sign-in needed as a guest); psychologist tile visible | ✅ |

## 5. The call itself (both sides)

| ID | Check | Expected | Actual | Result |
|---|---|---|---|---|
| C1 | Participants | Both windows show **2 participants**, with each other's names | Both windows show 2 participants with their names | ✅ |
| C2 | Video, psychologist → seeker | Seeker window shows the psychologist's video | Psychologist video visible in the seeker window | ✅ |
| C3 | Video, seeker → psychologist | Psychologist window shows the seeker's video | Seeker video visible in the psychologist window (one camera on one Mac, so both show the same camera) | ✅ |
| C4 | Audio, both ways | Speaking in one window lights the speaking indicator in the other | Speaking indicator lit in the other window, both directions (one side muted at a time to avoid echo) | ✅ |
| C5 | Chat, both ways | A chat message sent in each window appears in the other | Chat messages appeared in the other window, both directions | ✅ |
| C6 | Leave and rejoin | Seeker leaves and clicks Join again; returns to the same call | Seeker left, clicked Join video consultation again, returned to the same call | ✅ |
| C7 | After cleanup | After `--cleanup`, the room is refused for the completed case | After --cleanup the case is completed and the room is refused: 400 "This case is not accepted, so there is no consultation room yet." | ✅ |

---

## 6. Issues found

| # | Severity | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | High | Volunteer dashboard | There is no **Escalate** button or modal in the frontend (no escalate component exists), so a volunteer cannot send a case to a psychologist from the page. The API works (`POST /api/escalations`) | Build the escalate modal on the volunteer's accepted cases (T9.7 was planned for this) |
| 2 | High | `client/src/pages/psychologist/CaseDetailPage.jsx` | **Accept Case Request** / **Reject Case** check `status === 'Pending'`, but the API returns lowercase `pending` inside `{ case: {...} }`, so the buttons never show and the psychologist cannot accept a case from the page. Same cause as the missing "Mark Session Completed" button Ahnaf flagged | Read the status with the page's own `caseStatusOf()` helper and compare lowercase |
| 3 | Medium | `client/src/pages/psychologist/PsychologistDashboard.jsx` | **Manage Case** navigates to `/psychologist/case/<id>`, but the page is routed at `/dashboard/psychologist/cases/<id>`, so it shows "Page Not Found" | Change both `navigate(...)` calls to `` `/dashboard/psychologist/cases/${id}` `` |
| 4 | Medium (config) | team `server/.env` | The shared `.env` has no `VIDEO_ROOM_SECRET`. On one machine this is fine (the test passed with the default), but on demo day everyone running their own server must use the same value, or the two sides land in different rooms | Add one agreed `VIDEO_ROOM_SECRET` to the team `.env` and send it to everyone |
| 5 | Low | Psychologist dashboard and case page | The pages use Tailwind CSS classes, but Tailwind is not installed, so they show unstyled (plain buttons, a stray dark shape) | Install Tailwind, or restyle with inline styles like the other pages |
| 6 | Low | `server/utils/videoAccess.js` message | For a **completed** case the room is refused with "This case is not accepted, so there is no consultation room **yet**", which suggests it may open later | Use a message such as "This consultation has ended." for completed cases |

## 7. Conclusion

The video consultation works end to end between two browsers: the psychologist and the seeker reach the same Jitsi room from their own pages, see and hear each other, chat both ways, and the seeker can leave and rejoin. All 16 checks passed. As the T18.1 spike predicted, meet.jit.si requires the first person (the psychologist) to sign in as moderator with Google; the seeker joins as a guest without signing in, and there was no lobby. The call itself has no problems, but a real user cannot yet reach it through the pages alone: volunteers have no escalate button (issue 1) and psychologists cannot accept a case on the case page (issue 2), so the test case was set up through the API with test/t18.15-call-setup.js. For the demo, either fix issues 1-3 or set the case up with the script beforehand, and agree one VIDEO_ROOM_SECRET (issue 4).
