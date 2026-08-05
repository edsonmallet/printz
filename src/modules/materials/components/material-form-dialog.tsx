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
import { type MaterialInput, materialSchema } from "@/modules/materials/services/materials.schema";
import {
  createMaterial,
  type MaterialWithId,
  updateMaterial,
} from "@/modules/materials/services/materials.service";

const emptyValues: MaterialInput = {
  name: "",
  pricePerKg: 0,
  defaultWasteRate: 0,
  color: "",
  density: 0,
  currentStockG: 0,
  minStockG: 0,
};

interface MaterialFormDialogProps {
  tenantId: string;
  material?: MaterialWithId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MaterialFormDialog({
  tenantId,
  material,
  open,
  onOpenChange,
}: MaterialFormDialogProps) {
  const form = useForm<z.input<typeof materialSchema>, unknown, MaterialInput>({
    resolver: zodResolver(materialSchema),
    defaultValues: emptyValues,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando o dialog abre ou o material alvo muda
  useEffect(() => {
    if (open) {
      form.reset(material ?? emptyValues);
    }
  }, [open, material]);

  async function onSubmit(values: MaterialInput) {
    try {
      if (material) {
        await updateMaterial(tenantId, material.id, values);
        toast.success("Material atualizado");
      } else {
        await createMaterial(tenantId, values);
        toast.success("Material criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar o material");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{material ? "Editar material" : "Novo material"}</DialogTitle>
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
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pricePerKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço por kg (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
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
              name="density"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Densidade (g/cm³)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
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
              name="defaultWasteRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taxa de perda padrão (0 a 1)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
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
              name="currentStockG"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estoque atual (g)</FormLabel>
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
              name="minStockG"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estoque mínimo (g)</FormLabel>
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
