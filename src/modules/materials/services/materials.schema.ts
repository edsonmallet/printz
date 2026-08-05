import { z } from "zod";

export const materialSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  pricePerKg: z.number().positive("Preço deve ser maior que zero"),
  defaultWasteRate: z
    .number()
    .min(0, "Taxa de perda deve estar entre 0 e 1")
    .max(1, "Taxa de perda deve estar entre 0 e 1"),
  color: z.string().min(1, "Cor obrigatória"),
  density: z.number().positive("Densidade deve ser maior que zero"),
  currentStockG: z.number().min(0, "Estoque não pode ser negativo"),
  minStockG: z.number().min(0, "Estoque mínimo não pode ser negativo"),
});

export type MaterialInput = z.infer<typeof materialSchema>;
