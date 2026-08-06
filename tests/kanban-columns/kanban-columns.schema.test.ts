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

  it("aceita isProductionEntry true", () => {
    const result = kanbanColumnSchema.safeParse({
      name: "Em fila de impressão",
      order: 1,
      isProductionEntry: true,
    });
    expect(result.success).toBe(true);
  });

  it("assume isProductionEntry false por padrão quando omitido", () => {
    const result = kanbanColumnSchema.safeParse({ name: "A produzir", order: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isProductionEntry).toBe(false);
    }
  });
});
