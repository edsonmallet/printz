export interface Material {
  name: string;
  pricePerKg: number;
  defaultWasteRate: number;
  color: string;
  density: number;
  currentStockG: number;
  minStockG: number;
}

export interface Printer {
  name: string;
  acquisitionCost: number;
  usefulLifeHours: number;
  avgPowerKw: number;
  buildVolumeMm: { x: number; y: number; z: number };
  notes?: string;
}
