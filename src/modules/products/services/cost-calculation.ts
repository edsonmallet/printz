import type { CostsSettings, Material, Printer } from "@/shared/types/resources";

export interface ProductCostInput {
  weightG: number;
  printTimeH: number;
}

export interface ProductCost {
  totalCost: number;
  suggestedPrice: number;
}

export function calculateProductCost(
  product: ProductCostInput,
  material: Pick<Material, "pricePerKg" | "defaultWasteRate">,
  printer: Pick<Printer, "avgPowerKw" | "acquisitionCost" | "usefulLifeHours">,
  costsSettings: CostsSettings,
): ProductCost {
  const materialCost =
    (product.weightG / 1000) * material.pricePerKg * (1 + material.defaultWasteRate);
  const energyCost = product.printTimeH * printer.avgPowerKw * costsSettings.energyRateKwh;
  const depreciation = product.printTimeH * (printer.acquisitionCost / printer.usefulLifeHours);
  const laborCost = product.printTimeH * costsSettings.laborCostPerHour;
  const fixedCostShare =
    product.printTimeH * (costsSettings.monthlyFixedCosts / costsSettings.monthlyProductiveHours);

  const totalCost = materialCost + energyCost + depreciation + laborCost + fixedCostShare;
  const suggestedPrice = totalCost * costsSettings.defaultMarkup;

  return { totalCost, suggestedPrice };
}
