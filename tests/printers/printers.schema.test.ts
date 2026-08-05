import { describe, expect, it } from "vitest";
import { printerSchema } from "@/modules/printers/services/printers.schema";

describe("printerSchema", () => {
  const validInput = {
    name: "Ender 3 V2",
    acquisitionCost: 1500,
    usefulLifeHours: 8000,
    avgPowerKw: 0.35,
    buildVolumeMm: { x: 220, y: 220, z: 250 },
    notes: "",
  };

  it("aceita uma impressora válida", () => {
    const result = printerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("aceita sem notes (opcional)", () => {
    const { notes, ...withoutNotes } = validInput;
    const result = printerSchema.safeParse(withoutNotes);
    expect(result.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    expect(printerSchema.safeParse({ ...validInput, name: "" }).success).toBe(false);
  });

  it("rejeita acquisitionCost, usefulLifeHours ou avgPowerKw zero ou negativos", () => {
    expect(printerSchema.safeParse({ ...validInput, acquisitionCost: 0 }).success).toBe(false);
    expect(printerSchema.safeParse({ ...validInput, usefulLifeHours: -1 }).success).toBe(false);
    expect(printerSchema.safeParse({ ...validInput, avgPowerKw: 0 }).success).toBe(false);
  });

  it("rejeita buildVolumeMm com dimensão zero ou negativa", () => {
    const result = printerSchema.safeParse({
      ...validInput,
      buildVolumeMm: { x: 0, y: 220, z: 250 },
    });
    expect(result.success).toBe(false);
  });
});
