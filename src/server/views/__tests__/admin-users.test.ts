import { describe, it, expect } from "vitest";
import { buildUsersPageModel } from "@/server/views/admin-users";

const assignment = (
  over: Partial<{
    id: string;
    userId: string;
    role: string;
    valueStreamIds: string[];
    artIds: string[];
    teamIds: string[];
    createdAt: Date;
  }>,
) => ({
  id: "ra-1",
  userId: "u1",
  role: "viewer",
  valueStreamIds: [],
  artIds: [],
  teamIds: [],
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

describe("buildUsersPageModel", () => {
  it("groups assignments by user so each user is one list row", () => {
    const m = buildUsersPageModel({
      assignments: [
        assignment({ id: "ra-1", userId: "u1", role: "viewer" }),
        assignment({ id: "ra-2", userId: "u1", role: "epic_owner" }),
        assignment({ id: "ra-3", userId: "u2", role: "rte" }),
      ],
      valueStreams: [],
      userLabels: { u1: "Alice", u2: "Bob" },
    });
    expect(m.users).toHaveLength(2);
    const u1 = m.users.find((u) => u.id === "u1")!;
    expect(u1.roleCount).toBe(2);
    expect(u1.roles.sort()).toEqual(["epic_owner", "viewer"]);
    expect(u1.assignments.map((a) => a.id).sort()).toEqual(["ra-1", "ra-2"]);
  });

  it("derives initials from email when available, else from label", () => {
    const m = buildUsersPageModel({
      assignments: [
        assignment({ userId: "u1" }),
        assignment({ userId: "u2", id: "ra-2" }),
        assignment({ userId: "u3", id: "ra-3" }),
      ],
      valueStreams: [],
      userLabels: { u1: "Alice Anderson", u2: "Bob", u3: "carol@example.com" },
      userEmails: { u2: "bob.smith@example.com" },
    });
    expect(m.users.find((u) => u.id === "u1")!.initials).toBe("AA");
    expect(m.users.find((u) => u.id === "u2")!.initials).toBe("BS");
    // "carol@example.com" → ["carol", "example", "com"] → "CE"
    expect(m.users.find((u) => u.id === "u3")!.initials).toBe("CE");
  });

  it("sorts users alphabetically by label", () => {
    const m = buildUsersPageModel({
      assignments: [
        assignment({ userId: "u-c", id: "ra-c" }),
        assignment({ userId: "u-a", id: "ra-a" }),
        assignment({ userId: "u-b", id: "ra-b" }),
      ],
      valueStreams: [],
      userLabels: { "u-c": "Charlie", "u-a": "Alice", "u-b": "Bob" },
    });
    expect(m.users.map((u) => u.label)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("counts roles across all users — empty role slots stay at 0", () => {
    const m = buildUsersPageModel({
      assignments: [
        assignment({ userId: "u1", role: "viewer", id: "ra-1" }),
        assignment({ userId: "u2", role: "viewer", id: "ra-2" }),
        assignment({ userId: "u3", role: "rte", id: "ra-3" }),
      ],
      valueStreams: [],
      userLabels: {},
    });
    expect(m.roleCounts["viewer"]).toBe(2);
    expect(m.roleCounts["rte"]).toBe(1);
    expect(m.roleCounts["platform_admin"]).toBe(0);
  });

  it("serialises createdAt as an ISO-day string", () => {
    const m = buildUsersPageModel({
      assignments: [
        assignment({
          userId: "u1",
          createdAt: new Date("2026-03-15T10:00:00Z"),
        }),
      ],
      valueStreams: [],
      userLabels: {},
    });
    expect(m.users[0]!.assignments[0]!.createdAt).toBe("2026-03-15");
  });

  it("passes valueStreams through unchanged for the scope picker", () => {
    const m = buildUsersPageModel({
      assignments: [],
      valueStreams: [
        {
          id: "vs1",
          name: "Retail",
          arts: [{ id: "art1", name: "Mobile ART" }],
        },
      ],
      userLabels: {},
    });
    expect(m.valueStreamOptions).toEqual([
      {
        id: "vs1",
        name: "Retail",
        arts: [{ id: "art1", name: "Mobile ART" }],
      },
    ]);
  });
});
