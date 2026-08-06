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
import { Switch } from "@/components/ui/switch";
import {
  type KanbanColumnInput,
  kanbanColumnSchema,
} from "@/modules/kanban-columns/services/kanban-columns.schema";
import {
  createColumn,
  type KanbanColumnWithId,
  updateColumn,
} from "@/modules/kanban-columns/services/kanban-columns.service";

const emptyValues: KanbanColumnInput = { name: "", order: 0, isProductionEntry: false };

interface KanbanColumnFormDialogProps {
  tenantId: string;
  column?: KanbanColumnWithId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KanbanColumnFormDialog({
  tenantId,
  column,
  open,
  onOpenChange,
}: KanbanColumnFormDialogProps) {
  const form = useForm<z.input<typeof kanbanColumnSchema>, unknown, KanbanColumnInput>({
    resolver: zodResolver(kanbanColumnSchema),
    defaultValues: emptyValues,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando o dialog abre ou a coluna alvo muda
  useEffect(() => {
    if (open) {
      form.reset(column ?? emptyValues);
    }
  }, [open, column]);

  async function onSubmit(values: KanbanColumnInput) {
    try {
      if (column) {
        await updateColumn(tenantId, column.id, values);
        toast.success("Coluna atualizada");
      } else {
        await createColumn(tenantId, values);
        toast.success("Coluna criada");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar a coluna");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{column ? "Editar coluna" : "Nova coluna"}</DialogTitle>
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
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordem</FormLabel>
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
              name="isProductionEntry"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FormLabel>Coluna de entrada em produção</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
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
