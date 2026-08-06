export interface StockValidationItem {
  materialId: string;
  totalWeightG: number;
}

export interface StockValidationResult {
  materialId: string;
  required: number;
  available: number;
  sufficient: boolean;
}

export function validateStock(
  items: StockValidationItem[],
  materials: Map<string, { currentStockG: number }>,
): StockValidationResult[] {
  const requiredByMaterial = new Map<string, number>();
  for (const item of items) {
    requiredByMaterial.set(
      item.materialId,
      (requiredByMaterial.get(item.materialId) ?? 0) + item.totalWeightG,
    );
  }

  return Array.from(requiredByMaterial.entries()).map(([materialId, required]) => {
    const available = materials.get(materialId)?.currentStockG ?? 0;
    return { materialId, required, available, sufficient: available >= required };
  });
}
