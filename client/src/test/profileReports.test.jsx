// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Unit tests for the two demo pages: the read-only Profile (item 5) and
// admin Reports (item 6). Both are driven through their presentational views,
// so no server and no network.

vi.mock("../api/adminApi", () => ({
  getAdminSummary: vi.fn(),
  readError: (err, fallback) => err?.response?.data?.message || fallback,
}));

import { ProfileView } from "../pages/common/Profile";
import { ReportsView } from "../pages/admin/Reports";

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

const user = (overrides = {}) => ({
  name: "Test Seeker",
  email: "seeker@test.com",
  role: "seeker",
  status: "approved",
  createdAt: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

// ---------- Profile ----------

describe("Profile", () => {
  it("shows the account details", () => {
    render(<ProfileView user={user()} />);
    expect(screen.getByText("Test Seeker")).toBeInTheDocument();
    expect(screen.getByText("seeker@test.com")).toBeInTheDocument();
    expect(screen.getByText("Seeker")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it.each([
    ["seeker", /crisis request/i],
    ["volunteer", /accept crisis requests/i],
    ["psychologist", /escalated cases/i],
    ["ngo", /referrals sent to your organisation/i],
    ["facilitator", /create workshops/i],
    ["admin", /verify accounts/i],
  ])("shows text specific to the %s role", (role, pattern) => {
    render(<ProfileView user={user({ role })} />);
    expect(screen.getByText(pattern)).toBeInTheDocument();
  });

  it("hides the phone row when there is no phone", () => {
    render(<ProfileView user={user()} />);
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();
  });

  it("shows the phone when there is one", () => {
    render(<ProfileView user={user({ phone: "01700000000" })} />);
    expect(screen.getByText("01700000000")).toBeInTheDocument();
  });

  it("tells a pending user that some actions are locked", () => {
    render(<ProfileView user={user({ status: "pending" })} />);
    expect(screen.getByText(/waiting for an admin/i)).toBeInTheDocument();
  });

  it("tells a suspended user to contact an admin", () => {
    render(<ProfileView user={user({ status: "suspended" })} />);
    // "Suspended" also appears as the status value, so match the note itself
    expect(
      screen.getByText("Your account is suspended. Contact an admin.")
    ).toBeInTheDocument();
  });

  it("shows a rejection reason when there is one", () => {
    render(
      <ProfileView user={user({ status: "rejected", rejectionReason: "Incomplete documents" })} />
    );
    expect(screen.getByText("Incomplete documents")).toBeInTheDocument();
  });

  it("says plainly that the page cannot be edited", () => {
    render(<ProfileView user={user()} />);
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it("does not crash on a user with almost nothing set", () => {
    render(<ProfileView user={{}} />);
    expect(screen.getByRole("heading", { name: /my profile/i })).toBeInTheDocument();
  });
});

// ---------- Reports ----------

const summary = (overrides = {}) => ({
  users: {
    total: 12,
    byRole: { seeker: 5, volunteer: 3, psychologist: 2, ngo: 1, facilitator: 1 },
    byStatus: { pending: 2, approved: 9, rejected: 1, suspended: 0 },
  },
  requests: { total: 7, byStatus: { pending: 3, accepted: 2, closed: 2 } },
  workshops: { total: 4, byStatus: { Scheduled: 3, Cancelled: 1 } },
  referrals: { total: 2, byStatus: { pending: 1, resolved: 1 } },
  generatedAt: "2026-11-04T08:00:00.000Z",
  ...overrides,
});

describe("Reports", () => {
  it("shows the four totals from the summary API", () => {
    render(<ReportsView summary={summary()} />);
    expect(screen.getByTestId("report-users-total")).toHaveTextContent("12");
    expect(screen.getByTestId("report-requests-total")).toHaveTextContent("7");
    expect(screen.getByTestId("report-workshops-total")).toHaveTextContent("4");
    expect(screen.getByTestId("report-referrals-total")).toHaveTextContent("2");
  });

  it("surfaces the counts an admin has to act on", () => {
    render(<ReportsView summary={summary()} />);
    expect(screen.getByTestId("report-users-total")).toHaveTextContent(/2 waiting for approval/i);
    expect(screen.getByTestId("report-requests-total")).toHaveTextContent(/3 still unassigned/i);
  });

  it("breaks users down by role and by status", () => {
    render(<ReportsView summary={summary()} />);
    expect(screen.getByText("Users by role")).toBeInTheDocument();
    expect(screen.getByText("Users by status")).toBeInTheDocument();
  });

  it("falls back to summing the buckets when the API sends no total", () => {
    const s = summary();
    delete s.users.total;
    render(<ReportsView summary={s} />);
    expect(screen.getByTestId("report-users-total")).toHaveTextContent("12");
  });

  it("shows 0 rather than crashing when a group is missing", () => {
    render(<ReportsView summary={{}} />);
    expect(screen.getByTestId("report-users-total")).toHaveTextContent("0");
    expect(screen.getByTestId("report-requests-total")).toHaveTextContent("0");
  });

  it("renders with no summary at all", () => {
    render(<ReportsView summary={null} />);
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
  });

  it("offers a refresh button when a handler is given", () => {
    render(<ReportsView summary={summary()} onRefresh={() => {}} />);
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
  });

  it("omits the refresh button when there is no handler", () => {
    render(<ReportsView summary={summary()} />);
    expect(screen.queryByRole("button", { name: /refresh/i })).not.toBeInTheDocument();
  });
});
