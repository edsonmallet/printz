import { describe, expect, it } from "vitest";
import { productDocSchema, productSchema } from "@/modules/products/services/products.schema";

describe("productSchema", () => {
  const validInput = {
    name: "Vaso geométrico",
    description: "Vaso decorativo pequeno",
    weightG: 45,
    printTimeH: 3.5,
    printerId: "printer-1",
    materialId: "material-1",
    printConfig: {
      nozzleTempC: 210,
      bedTempC: 60,
      speedMmS: 50,
      supports: false,
      bedAdhesion: "brim",
      notes: "",
    },
  };

  it("aceita um produto válido", () => {
    expect(productSchema.safeParse(validInput).success).toBe(true);
  });

  it("aceita sem description e sem printConfig.notes (opcionais)", () => {
    const { description, ...withoutDescription } = validInput;
    const { notes, ...printConfigWithoutNotes } = validInput.printConfig;
    const result = productSchema.safeParse({
      ...withoutDescription,
      printConfig: printConfigWithoutNotes,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    expect(productSchema.safeParse({ ...validInput, name: "" }).success).toBe(false);
  });

  it("rejeita weightG ou printTimeH zero ou negativos", () => {
    expect(productSchema.safeParse({ ...validInput, weightG: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...validInput, printTimeH: -1 }).success).toBe(false);
  });

  it("rejeita printerId ou materialId vazios", () => {
    expect(productSchema.safeParse({ ...validInput, printerId: "" }).success).toBe(false);
    expect(productSchema.safeParse({ ...validInput, materialId: "" }).success).toBe(false);
  });

  it("rejeita printConfig com valores não positivos", () => {
    const result = productSchema.safeParse({
      ...validInput,
      printConfig: { ...validInput.printConfig, nozzleTempC: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejeita printConfig.bedAdhesion vazio", () => {
    const result = productSchema.safeParse({
      ...validInput,
      printConfig: { ...validInput.printConfig, bedAdhesion: "" },
    });
    expect(result.success).toBe(false);
  });
});

describe("productDocSchema", () => {
  const validInput = {
    name: "Vaso geométrico",
    weightG: 45,
    printTimeH: 3.5,
    printerId: "printer-1",
    materialId: "material-1",
    printConfig: {
      nozzleTempC: 210,
      bedTempC: 60,
      speedMmS: 50,
      supports: false,
      bedAdhesion: "brim",
    },
    lastCalculation: {
      totalCost: 12.5,
      suggestedPrice: 31.25,
      calculatedAt: 1735689600000,
    },
  };

  it("aceita um doc completo com lastCalculation", () => {
    expect(productDocSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejeita doc sem lastCalculation", () => {
    const { lastCalculation, ...withoutCalculation } = validInput;
    expect(productDocSchema.safeParse(withoutCalculation).success).toBe(false);
  });
});
