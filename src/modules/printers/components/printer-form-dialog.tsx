"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
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
import { Textarea } from "@/components/ui/textarea";
import { type PrinterInput, printerSchema } from "@/modules/printers/services/printers.schema";
import {
  createPrinter,
  type PrinterWithId,
  updatePrinter,
} from "@/modules/printers/services/printers.service";

const emptyValues: PrinterInput = {
  name: "",
  acquisitionCost: 0,
  usefulLifeHours: 0,
  avgPowerKw: 0,
  buildVolumeMm: { x: 0, y: 0, z: 0 },
  notes: "",
};

interface PrinterFormDialogProps {
  tenantId: string;
  printer?: PrinterWithId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrinterFormDialog({
  tenantId,
  printer,
  open,
  onOpenChange,
}: PrinterFormDialogProps) {
  const form = useForm<z.input<typeof printerSchema>, unknown, PrinterInput>({
    resolver: zodResolver(printerSchema),
    defaultValues: emptyValues,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando o dialog abre ou a impressora alvo muda
  useEffect(() => {
    if (open) {
      form.reset(printer ?? emptyValues);
    }
  }, [open, printer]);

  async function onSubmit(values: PrinterInput) {
    try {
      if (printer) {
        await updatePrinter(tenantId, printer.id, values);
        toast.success("Impressora atualizada");
      } else {
        await createPrinter(tenantId, values);
        toast.success("Impressora criada");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar a impressora");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{printer ? "Editar impressora" : "Nova impressora"}</DialogTitle>
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
              name="acquisitionCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custo de aquisição (R$)</FormLabel>
                  <FormControl>
                    <DecimalInput
                      {...field}
                      value={field.value as number}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="usefulLifeHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vida útil (horas)</FormLabel>
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
              name="avgPowerKw"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Potência média (kW)</FormLabel>
                  <FormControl>
                    <DecimalInput
                      {...field}
                      value={field.value as number}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-4">
              <FormField
                control={form.control}
                name="buildVolumeMm.x"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Largura X (mm)</FormLabel>
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
                name="buildVolumeMm.y"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profundidade Y (mm)</FormLabel>
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
                name="buildVolumeMm.z"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Altura Z (mm)</FormLabel>
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
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
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
