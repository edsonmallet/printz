import { z } from "zod";

export const printerSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  acquisitionCost: z.coerce.number().positive("Custo de aquisição deve ser maior que zero"),
  usefulLifeHours: z.coerce.number().positive("Vida útil deve ser maior que zero"),
  avgPowerKw: z.coerce.number().positive("Potência média deve ser maior que zero"),
  buildVolumeMm: z.object({
    x: z.coerce.number().positive("Largura (X) deve ser maior que zero"),
    y: z.coerce.number().positive("Profundidade (Y) deve ser maior que zero"),
    z: z.coerce.number().positive("Altura (Z) deve ser maior que zero"),
  }),
  notes: z.string().optional(),
});

export type PrinterInput = z.infer<typeof printerSchema>;
