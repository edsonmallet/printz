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

  it("member of tenant A can read tenant A's members", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("members")
        .doc("alice")
        .set({ email: "alice@example.com", displayName: "Alice", role: "member" });
    });

    await assertSucceeds(
      alice.firestore().collection("tenants").doc("tenant-a").collection("members").get(),
    );
  });

  it("member of tenant A cannot read tenant B's members", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-b")
        .collection("members")
        .doc("bob")
        .set({ email: "bob@example.com", displayName: "Bob", role: "member" });
    });

    await assertFails(
      alice.firestore().collection("tenants").doc("tenant-b").collection("members").get(),
    );
  });

  it("non-admin member cannot write to tenant A's members", async () => {
    const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });

    await assertFails(
      bob
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("members")
        .doc("carol")
        .set({ email: "carol@example.com", displayName: "Carol", role: "member" }),
    );
  });

  it("member can read tenant materials", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("materials")
        .doc("material-1")
        .set({ name: "PLA" });
    });

    await assertSucceeds(
      alice.firestore().collection("tenants").doc("tenant-a").collection("materials").get(),
    );
  });

  it("member (non-admin) cannot write tenant materials", async () => {
    const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });

    await assertFails(
      bob
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("materials")
        .doc("material-1")
        .set({ name: "PLA" }),
    );
  });

  it("admin can write tenant materials", async () => {
    const admin = testEnv.authenticatedContext("admin-uid", {
      tenantId: "tenant-a",
      role: "admin",
    });

    await assertSucceeds(
      admin
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("materials")
        .doc("material-1")
        .set({ name: "PLA" }),
    );
  });

  it("member of tenant A cannot read tenant B's materials", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-b")
        .collection("materials")
        .doc("material-1")
        .set({ name: "PLA" });
    });

    await assertFails(
      alice.firestore().collection("tenants").doc("tenant-b").collection("materials").get(),
    );
  });

  it("member can read tenant printers", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("printers")
        .doc("printer-1")
        .set({ name: "Ender 3" });
    });

    await assertSucceeds(
      alice.firestore().collection("tenants").doc("tenant-a").collection("printers").get(),
    );
  });

  it("member (non-admin) cannot write tenant printers", async () => {
    const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });

    await assertFails(
      bob
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("printers")
        .doc("printer-1")
        .set({ name: "Ender 3" }),
    );
  });

  it("admin can write tenant printers", async () => {
    const admin = testEnv.authenticatedContext("admin-uid", {
      tenantId: "tenant-a",
      role: "admin",
    });

    await assertSucceeds(
      admin
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("printers")
        .doc("printer-1")
        .set({ name: "Ender 3" }),
    );
  });

  it("member of tenant A cannot read tenant B's printers", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-b")
        .collection("printers")
        .doc("printer-1")
        .set({ name: "Ender 3" });
    });

    await assertFails(
      alice.firestore().collection("tenants").doc("tenant-b").collection("printers").get(),
    );
  });

  it("member (non-admin) can write tenant products", async () => {
    const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });

    await assertSucceeds(
      bob
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("products")
        .doc("product-1")
        .set({ name: "Vaso" }),
    );
  });

  it("member (non-admin) can read tenant products", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("products")
        .doc("product-1")
        .set({ name: "Vaso" });
    });

    await assertSucceeds(
      alice.firestore().collection("tenants").doc("tenant-a").collection("products").get(),
    );
  });

  it("member of tenant A cannot read tenant B's products", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-b")
        .collection("products")
        .doc("product-1")
        .set({ name: "Vaso" });
    });

    await assertFails(
      alice.firestore().collection("tenants").doc("tenant-b").collection("products").get(),
    );
  });

  it("member of tenant A cannot write tenant B's products", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });

    await assertFails(
      alice
        .firestore()
        .collection("tenants")
        .doc("tenant-b")
        .collection("products")
        .doc("product-1")
        .set({ name: "Vaso" }),
    );
  });

  it("member (non-admin) can write tenant orders", async () => {
    const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });

    await assertSucceeds(
      bob
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("orders")
        .doc("order-1")
        .set({ statusId: "col-1", stockDebited: false }),
    );
  });

  it("member (non-admin) can create an order with stockDebited: false", async () => {
    const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });

    await assertSucceeds(
      bob
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("orders")
        .doc("order-1")
        .set({ statusId: "col-1", stockDebited: false }),
    );
  });

  it("member (non-admin) cannot flip an order's stockDebited via client update", async () => {
    const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("orders")
        .doc("order-1")
        .set({ statusId: "col-1", stockDebited: false });
    });

    await assertFails(
      bob
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("orders")
        .doc("order-1")
        .set({ statusId: "col-1", stockDebited: true }),
    );
  });

  it("member of tenant A cannot read tenant B's orders", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-b")
        .collection("orders")
        .doc("order-1")
        .set({ statusId: "col-1" });
    });

    await assertFails(
      alice.firestore().collection("tenants").doc("tenant-b").collection("orders").get(),
    );
  });

  it("member (non-admin) cannot write tenant kanbanColumns", async () => {
    const bob = testEnv.authenticatedContext("bob", { tenantId: "tenant-a", role: "member" });

    await assertFails(
      bob
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("kanbanColumns")
        .doc("col-1")
        .set({ name: "A produzir", order: 0 }),
    );
  });

  it("admin can write tenant kanbanColumns", async () => {
    const admin = testEnv.authenticatedContext("admin-uid", {
      tenantId: "tenant-a",
      role: "admin",
    });

    await assertSucceeds(
      admin
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("kanbanColumns")
        .doc("col-1")
        .set({ name: "A produzir", order: 0 }),
    );
  });

  it("member can read tenant kanbanColumns", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("kanbanColumns")
        .doc("col-1")
        .set({ name: "A produzir", order: 0 });
    });

    await assertSucceeds(
      alice.firestore().collection("tenants").doc("tenant-a").collection("kanbanColumns").get(),
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

  it("member can read tenant stockMovements", async () => {
    const alice = testEnv.authenticatedContext("alice", { tenantId: "tenant-a", role: "member" });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("stockMovements")
        .doc("movement-1")
        .set({ materialId: "pla-branco", type: "out", quantityG: 100 });
    });

    await assertSucceeds(
      alice.firestore().collection("tenants").doc("tenant-a").collection("stockMovements").get(),
    );
  });

  it("no client (including admin) can write tenant stockMovements", async () => {
    const admin = testEnv.authenticatedContext("admin-uid", {
      tenantId: "tenant-a",
      role: "admin",
    });

    await assertFails(
      admin
        .firestore()
        .collection("tenants")
        .doc("tenant-a")
        .collection("stockMovements")
        .doc("movement-1")
        .set({ materialId: "pla-branco", type: "out", quantityG: 100 }),
    );
  });
});
