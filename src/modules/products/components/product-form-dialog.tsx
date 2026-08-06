"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCostsSettings } from "@/modules/costs-settings/services/costs-settings.service";
import { useMaterials } from "@/modules/materials/services/materials.service";
import { usePrinters } from "@/modules/printers/services/printers.service";
import { calculateProductCost } from "@/modules/products/services/cost-calculation";
import { type ProductInput, productSchema } from "@/modules/products/services/products.schema";
import {
  createProduct,
  type ProductWithId,
  updateProduct,
} from "@/modules/products/services/products.service";

const emptyValues: ProductInput = {
  name: "",
  description: "",
  weightG: 0,
  printTimeH: 0,
  printerId: "",
  materialId: "",
  printConfig: {
    nozzleTempC: 0,
    bedTempC: 0,
    speedMmS: 0,
    supports: false,
    bedAdhesion: "",
    notes: "",
  },
};

interface ProductFormDialogProps {
  tenantId: string;
  product?: ProductWithId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductFormDialog({
  tenantId,
  product,
  open,
  onOpenChange,
}: ProductFormDialogProps) {
  const { data: materials } = useMaterials(tenantId);
  const { data: printers } = usePrinters(tenantId);
  const { data: costsSettings } = useCostsSettings(tenantId);

  const form = useForm<z.input<typeof productSchema>, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyValues,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando o dialog abre ou o produto alvo muda
  useEffect(() => {
    if (open) {
      form.reset(product ?? emptyValues);
    }
  }, [open, product]);

  async function onSubmit(values: ProductInput) {
    if (!costsSettings) {
      toast.error("Configure os custos fixos antes de cadastrar produtos (aba Custos)");
      return;
    }
    const material = materials.find((m) => m.id === values.materialId);
    const printer = printers.find((p) => p.id === values.printerId);
    if (!material || !printer) {
      toast.error("Material ou impressora selecionados não foram encontrados");
      return;
    }

    const { totalCost, suggestedPrice } = calculateProductCost(
      { weightG: values.weightG, printTimeH: values.printTimeH },
      material,
      printer,
      costsSettings,
    );

    const productData = {
      ...values,
      lastCalculation: { totalCost, suggestedPrice, calculatedAt: Date.now() },
    };

    try {
      if (product) {
        await updateProduct(tenantId, product.id, productData);
        toast.success("Produto atualizado");
      } else {
        await createProduct(tenantId, productData);
        toast.success("Produto criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar o produto");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weightG"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peso (g)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
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
              name="printTimeH"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tempo de impressão (horas)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
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
              name="materialId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Material</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um material" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Impressora</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma impressora" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {printers.map((printer) => (
                        <SelectItem key={printer.id} value={printer.id}>
                          {printer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printConfig.nozzleTempC"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temperatura do bico (°C)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
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
              name="printConfig.bedTempC"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Temperatura da mesa (°C)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
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
              name="printConfig.speedMmS"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Velocidade (mm/s)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
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
              name="printConfig.bedAdhesion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adesão à mesa</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="ex: brim, raft, nenhuma" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printConfig.supports"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FormLabel>Usa suporte</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="printConfig.notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações de impressão</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
