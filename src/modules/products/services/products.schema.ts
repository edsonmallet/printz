import { z } from "zod";

const printConfigSchema = z.object({
  nozzleTempC: z.coerce.number().positive("Temperatura do bico deve ser maior que zero"),
  bedTempC: z.coerce.number().positive("Temperatura da mesa deve ser maior que zero"),
  speedMmS: z.coerce.number().positive("Velocidade deve ser maior que zero"),
  supports: z.boolean(),
  bedAdhesion: z.string().min(1, "Adesão à mesa obrigatória"),
  notes: z.string().optional(),
});

export const productSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional(),
  weightG: z.coerce.number().positive("Peso deve ser maior que zero"),
  printTimeH: z.coerce.number().positive("Tempo de impressão deve ser maior que zero"),
  printerId: z.string().min(1, "Selecione uma impressora"),
  materialId: z.string().min(1, "Selecione um material"),
  printConfig: printConfigSchema,
});

export type ProductInput = z.infer<typeof productSchema>;

export const productDocSchema = productSchema.extend({
  lastCalculation: z.object({
    totalCost: z.number(),
    suggestedPrice: z.number(),
    calculatedAt: z.number(),
  }),
});
