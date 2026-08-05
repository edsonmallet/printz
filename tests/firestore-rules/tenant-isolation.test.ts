import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "printz-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("tenant isolation", () => {
  it("member can read their own tenant doc", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("tenants").doc("tenant-a").set({ name: "Tenant A" });
    });

    await assertSucceeds(alice.firestore().collection("tenants").doc("tenant-a").get());
  });

  it("member cannot read a different tenant's doc", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("tenants").doc("tenant-b").set({ name: "Tenant B" });
    });

    await assertFails(alice.firestore().collection("tenants").doc("tenant-b").get());
  });

  it("unauthenticated user cannot read any tenant doc", async () => {
    const anon = testEnv.unauthenticatedContext();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("tenants").doc("tenant-a").set({ name: "Tenant A" });
    });

    await assertFails(anon.firestore().collection("tenants").doc("tenant-a").get());
  });

  it("member (non-admin) cannot write tenant settings", async () => {
    const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });

    await assertFails(
      bob
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("settings")
        .doc("costs")
        .set({ energyRateKwh: 1 }),
    );
  });

  it("admin can write tenant settings", async () => {
    const admin = testEnv.authenticatedContext("admin-uid", {
      tenantId: "tenant-a",
      role: "admin",
    });

    await assertSucceeds(
      admin
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("settings")
        .doc("costs")
        .set({ energyRateKwh: 1 }),
    );
  });

  it("no client can read or write pendingInvites", async () => {
    const admin = testEnv.authenticatedContext("admin-uid", {
      tenantId: "tenant-a",
      role: "admin",
    });

    await assertFails(admin.firestore().collection("pendingInvites").doc("token-123").get());
    await assertFails(
      admin
        .firestore()
        .collection("pendingInvites")
        .doc("token-123")
        .set({ email: "x@example.com", tenantId: "tenant-a", role: "member", createdAt: 1 }),
    );
  });
});
