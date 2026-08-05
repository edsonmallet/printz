import { describe, expect, it } from "vitest";
import { costsSettingsSchema } from "@/modules/costs-settings/services/costs-settings.schema";

describe("costsSettingsSchema", () => {
  const validInput = {
    energyRateKwh: 0.95,
    laborCostPerHour: 25,
    monthlyFixedCosts: 800,
    monthlyProductiveHours: 160,
    defaultMarkup: 2.5,
  };

  it("aceita um input válido", () => {
    expect(costsSettingsSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejeita energyRateKwh zero ou negativo", () => {
    expect(costsSettingsSchema.safeParse({ ...validInput, energyRateKwh: 0 }).success).toBe(
      false,
    );
    expect(costsSettingsSchema.safeParse({ ...validInput, energyRateKwh: -1 }).success).toBe(
      false,
    );
  });

  it("rejeita laborCostPerHour zero ou negativo", () => {
    expect(costsSettingsSchema.safeParse({ ...validInput, laborCostPerHour: 0 }).success).toBe(
      false,
    );
  });

  it("rejeita monthlyFixedCosts zero ou negativo", () => {
    expect(costsSettingsSchema.safeParse({ ...validInput, monthlyFixedCosts: 0 }).success).toBe(
      false,
    );
  });

  it("rejeita monthlyProductiveHours zero ou negativo", () => {
    expect(
      costsSettingsSchema.safeParse({ ...validInput, monthlyProductiveHours: 0 }).success,
    ).toBe(false);
  });

  it("rejeita defaultMarkup zero ou negativo", () => {
    expect(costsSettingsSchema.safeParse({ ...validInput, defaultMarkup: 0 }).success).toBe(
      false,
    );
  });
});
