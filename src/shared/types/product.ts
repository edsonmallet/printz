export interface PrintConfig {
  nozzleTempC: number;
  bedTempC: number;
  speedMmS: number;
  supports: boolean;
  bedAdhesion: string;
  notes?: string;
}

export interface ProductCalculation {
  totalCost: number;
  suggestedPrice: number;
  calculatedAt: number;
}

export interface Product {
  name: string;
  description?: string;
  weightG: number;
  printTimeH: number;
  printerId: string;
  materialId: string;
  printConfig: PrintConfig;
  lastCalculation: ProductCalculation;
}
