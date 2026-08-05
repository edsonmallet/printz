"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  type CostsSettingsInput,
  costsSettingsSchema,
} from "@/modules/costs-settings/services/costs-settings.schema";
import {
  saveCostsSettings,
  useCostsSettings,
} from "@/modules/costs-settings/services/costs-settings.service";
import { useTenant } from "@/shared/hooks/use-tenant";

const emptyValues: CostsSettingsInput = {
  energyRateKwh: 0,
  laborCostPerHour: 0,
  monthlyFixedCosts: 0,
  monthlyProductiveHours: 0,
  defaultMarkup: 0,
};

export function CostsSettingsForm({ tenantId }: { tenantId: string }) {
  const { role } = useTenant();
  const { data: costsSettings } = useCostsSettings(tenantId);
  const isAdmin = role === "admin";

  const form = useForm<z.input<typeof costsSettingsSchema>, unknown, CostsSettingsInput>({
    resolver: zodResolver(costsSettingsSchema),
    defaultValues: emptyValues,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando os dados carregados do doc mudam
  useEffect(() => {
    form.reset(costsSettings ?? emptyValues);
  }, [costsSettings]);

  async function onSubmit(values: CostsSettingsInput) {
    try {
      await saveCostsSettings(tenantId, values);
      toast.success("Configuração de custos salva");
    } catch {
      toast.error("Não foi possível salvar a configuração de custos");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4">
        <FormField
          control={form.control}
          name="energyRateKwh"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tarifa de energia (R$/kWh)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!isAdmin}
                  {...field}
                  value={Number.isNaN(field.value) ? "" : (field.value as number)}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="laborCostPerHour"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custo de mão de obra (R$/hora)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!isAdmin}
                  {...field}
                  value={Number.isNaN(field.value) ? "" : (field.value as number)}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="monthlyFixedCosts"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Custos fixos mensais (R$)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!isAdmin}
                  {...field}
                  value={Number.isNaN(field.value) ? "" : (field.value as number)}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="monthlyProductiveHours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Horas produtivas por mês</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="1"
                  disabled={!isAdmin}
                  {...field}
                  value={Number.isNaN(field.value) ? "" : (field.value as number)}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="defaultMarkup"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Markup padrão (multiplicador, ex: 2.5)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!isAdmin}
                  {...field}
                  value={Number.isNaN(field.value) ? "" : (field.value as number)}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {isAdmin && (
          <Button type="submit" disabled={form.formState.isSubmitting} className="self-start">
            Salvar
          </Button>
        )}
      </form>
    </Form>
  );
}
