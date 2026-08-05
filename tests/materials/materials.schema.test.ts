import { describe, expect, it } from "vitest";
import { materialSchema } from "@/modules/materials/services/materials.schema";

describe("materialSchema", () => {
  const validInput = {
    name: "PLA Branco",
    pricePerKg: 89.9,
    defaultWasteRate: 0.05,
    color: "Branco",
    density: 1.24,
    currentStockG: 1000,
    minStockG: 200,
  };

  it("aceita um material válido", () => {
    const result = materialSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    const result = materialSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita pricePerKg zero ou negativo", () => {
    expect(materialSchema.safeParse({ ...validInput, pricePerKg: 0 }).success).toBe(false);
    expect(materialSchema.safeParse({ ...validInput, pricePerKg: -1 }).success).toBe(false);
  });

  it("rejeita defaultWasteRate fora do intervalo 0-1", () => {
    expect(materialSchema.safeParse({ ...validInput, defaultWasteRate: -0.1 }).success).toBe(
      false,
    );
    expect(materialSchema.safeParse({ ...validInput, defaultWasteRate: 1.1 }).success).toBe(
      false,
    );
  });

  it("rejeita density zero ou negativa", () => {
    expect(materialSchema.safeParse({ ...validInput, density: 0 }).success).toBe(false);
  });

  it("rejeita currentStockG ou minStockG negativos", () => {
    expect(materialSchema.safeParse({ ...validInput, currentStockG: -1 }).success).toBe(false);
    expect(materialSchema.safeParse({ ...validInput, minStockG: -1 }).success).toBe(false);
  });
});
