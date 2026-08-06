import { describe, expect, it } from "vitest";
import { calculateProductCost } from "@/modules/products/services/cost-calculation";

describe("calculateProductCost", () => {
  const product = { weightG: 50, printTimeH: 2 };
  const material = { pricePerKg: 100, defaultWasteRate: 0.1 };
  const printer = { avgPowerKw: 0.2, acquisitionCost: 2000, usefulLifeHours: 5000 };
  const costsSettings = {
    energyRateKwh: 0.9,
    laborCostPerHour: 20,
    monthlyFixedCosts: 600,
    monthlyProductiveHours: 200,
    defaultMarkup: 3,
  };

  it("calcula totalCost como soma dos 5 componentes", () => {
    const materialCost = (50 / 1000) * 100 * 1.1; // 5.5
    const energyCost = 2 * 0.2 * 0.9; // 0.36
    const depreciation = 2 * (2000 / 5000); // 0.8
    const laborCost = 2 * 20; // 40
    const fixedCostShare = 2 * (600 / 200); // 6
    const expectedTotal = materialCost + energyCost + depreciation + laborCost + fixedCostShare;

    const result = calculateProductCost(product, material, printer, costsSettings);

    expect(result.totalCost).toBeCloseTo(expectedTotal, 6);
  });

  it("calcula suggestedPrice como totalCost * defaultMarkup", () => {
    const result = calculateProductCost(product, material, printer, costsSettings);
    expect(result.suggestedPrice).toBeCloseTo(result.totalCost * costsSettings.defaultMarkup, 6);
  });

  it("com defaultWasteRate zero, materialCost é só peso vezes preço", () => {
    const result = calculateProductCost(
      product,
      { ...material, defaultWasteRate: 0 },
      printer,
      costsSettings,
    );
    const materialCostSemPerda = (50 / 1000) * 100;
    const energyCost = 2 * 0.2 * 0.9;
    const depreciation = 2 * (2000 / 5000);
    const laborCost = 2 * 20;
    const fixedCostShare = 2 * (600 / 200);
    const expectedTotal =
      materialCostSemPerda + energyCost + depreciation + laborCost + fixedCostShare;
    expect(result.totalCost).toBeCloseTo(expectedTotal, 6);
  });

  it("com printTimeH bem pequeno, resultado ainda é positivo e finito", () => {
    const result = calculateProductCost(
      { weightG: 5, printTimeH: 0.01 },
      material,
      printer,
      costsSettings,
    );
    expect(result.totalCost).toBeGreaterThan(0);
    expect(Number.isFinite(result.totalCost)).toBe(true);
    expect(Number.isFinite(result.suggestedPrice)).toBe(true);
  });
});
