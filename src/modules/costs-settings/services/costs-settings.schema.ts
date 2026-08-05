import { z } from "zod";

export const costsSettingsSchema = z.object({
  energyRateKwh: z.coerce.number().positive("Tarifa de energia deve ser maior que zero"),
  laborCostPerHour: z.coerce.number().positive("Custo de mão de obra deve ser maior que zero"),
  monthlyFixedCosts: z.coerce.number().positive("Custos fixos mensais devem ser maiores que zero"),
  monthlyProductiveHours: z.coerce
    .number()
    .positive("Horas produtivas mensais devem ser maiores que zero"),
  defaultMarkup: z.coerce.number().positive("Markup padrão deve ser maior que zero"),
});

export type CostsSettingsInput = z.infer<typeof costsSettingsSchema>;
