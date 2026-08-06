import { describe, expect, it } from "vitest";
import { kanbanColumnSchema } from "@/modules/kanban-columns/services/kanban-columns.schema";

describe("kanbanColumnSchema", () => {
  it("aceita uma coluna válida", () => {
    const result = kanbanColumnSchema.safeParse({ name: "A produzir", order: 0 });
    expect(result.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    const result = kanbanColumnSchema.safeParse({ name: "", order: 0 });
    expect(result.success).toBe(false);
  });

  it("rejeita order negativo", () => {
    const result = kanbanColumnSchema.safeParse({ name: "A produzir", order: -1 });
    expect(result.success).toBe(false);
  });
});
