"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { useKanbanColumns } from "@/modules/kanban-columns/services/kanban-columns.service";
import { useMaterials } from "@/modules/materials/services/materials.service";
import { type OrderFormInput, orderFormSchema } from "@/modules/orders/services/orders.schema";
import {
  createOrder,
  type OrderWithId,
  updateOrder,
} from "@/modules/orders/services/orders.service";
import {
  type StockValidationResult,
  validateStock,
} from "@/modules/orders/services/stock-validation";
import { usePrinters } from "@/modules/printers/services/printers.service";
import { useProducts } from "@/modules/products/services/products.service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { Order, OrderItem } from "@/shared/types/order";

const emptyValues: OrderFormInput = {
  customerName: "",
  customerContact: "",
  items: [{ productId: "", quantity: 1 }],
  dueDate: "",
  statusId: "",
  assignedPrinterId: "",
  forceCreate: false,
};

// Interpreta/formata "YYYY-MM-DD" como meia-noite no fuso local, evitando o
// off-by-one causado por `new Date("YYYY-MM-DD")` (que o JS interpreta como UTC).
function parseLocalDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

function formatLocalDateInput(timestamp: number): string {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function orderToFormValues(order: OrderWithId): OrderFormInput {
  return {
    customerName: order.customer?.name ?? "",
    customerContact: order.customer?.contact ?? "",
    items: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    dueDate: formatLocalDateInput(order.dueDate),
    statusId: order.statusId,
    assignedPrinterId: order.assignedPrinterId,
    forceCreate: false,
  };
}

interface OrderFormDialogProps {
  tenantId: string;
  order?: OrderWithId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderFormDialog({ tenantId, order, open, onOpenChange }: OrderFormDialogProps) {
  const { data: products } = useProducts(tenantId);
  const { data: printers } = usePrinters(tenantId);
  const { data: columns } = useKanbanColumns(tenantId);
  const { data: materials } = useMaterials(tenantId);
  const [insufficientStock, setInsufficientStock] = useState<StockValidationResult[] | null>(null);

  const form = useForm<z.input<typeof orderFormSchema>, unknown, OrderFormInput>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: emptyValues,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset só deve rodar quando o dialog abre ou o pedido alvo muda
  useEffect(() => {
    if (open) {
      form.reset(order ? orderToFormValues(order) : emptyValues);
      setInsufficientStock(null);
    }
  }, [open, order]);

  function buildOrderItems(values: OrderFormInput): OrderItem[] {
    return values.items.map((formItem) => {
      const product = products.find((p) => p.id === formItem.productId);
      if (!product) {
        throw new Error(`Produto ${formItem.productId} não encontrado`);
      }
      return {
        productId: product.id,
        name: product.name,
        quantity: formItem.quantity,
        materialId: product.materialId,
        totalWeightG: product.weightG * formItem.quantity,
        totalPrintTimeH: product.printTimeH * formItem.quantity,
      };
    });
  }

  async function persistOrder(values: OrderFormInput, items: OrderItem[]) {
    const orderData: Omit<Order, "createdAt" | "updatedAt"> = {
      ...(values.customerName
        ? { customer: { name: values.customerName, contact: values.customerContact ?? "" } }
        : {}),
      items,
      dueDate: parseLocalDate(values.dueDate),
      statusId: values.statusId,
      assignedPrinterId: values.assignedPrinterId,
      partnerId: null,
      stockDebited: order?.stockDebited ?? false,
    };

    try {
      if (order) {
        await updateOrder(tenantId, order.id, orderData);
        toast.success("Pedido atualizado");
      } else {
        await createOrder(tenantId, orderData);
        toast.success("Pedido criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar o pedido");
    }
  }

  async function onSubmit(values: OrderFormInput) {
    let items: OrderItem[];
    try {
      items = buildOrderItems(values);
    } catch {
      toast.error("Um dos produtos selecionados não foi encontrado");
      return;
    }

    if (!values.forceCreate) {
      const materialsMap = new Map(
        materials.map((m) => [m.id, { currentStockG: m.currentStockG }]),
      );
      const validation = validateStock(items, materialsMap);
      const insufficient = validation.filter((v) => !v.sufficient);
      if (insufficient.length > 0) {
        setInsufficientStock(insufficient);
        return;
      }
    }

    await persistOrder(values, items);
  }

  async function handleForceConfirm() {
    const values = orderFormSchema.parse(form.getValues());
    let items: OrderItem[];
    try {
      items = buildOrderItems(values);
    } catch {
      toast.error("Um dos produtos selecionados não foi encontrado");
      return;
    }
    setInsufficientStock(null);
    await persistOrder(values, items);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{order ? "Editar pedido" : "Novo pedido"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contato do cliente (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <Label>Itens</Label>
                {fields.map((fieldItem, index) => (
                  <div key={fieldItem.id} className="flex items-end gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.productId`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um produto" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
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
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              {...field}
                              value={Number.isNaN(field.value) ? "" : (field.value as number)}
                              onChange={(e) => field.onChange(e.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => append({ productId: "", quantity: 1 })}
                >
                  Adicionar item
                </Button>
              </div>

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de entrega</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="statusId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coluna</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma coluna" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {columns.map((column) => (
                          <SelectItem key={column.id} value={column.id}>
                            {column.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {columns.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma coluna configurada. Crie uma em Recursos e custos → aba Colunas.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assignedPrinterId"
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
              <DialogFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!insufficientStock}
        onOpenChange={(open) => !open && setInsufficientStock(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estoque insuficiente</AlertDialogTitle>
            <AlertDialogDescription>
              Os seguintes materiais não têm estoque suficiente para este pedido:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-col gap-1 text-sm">
            {insufficientStock?.map((v) => {
              const materialName =
                materials.find((m) => m.id === v.materialId)?.name ?? v.materialId;
              return (
                <li key={v.materialId}>
                  {materialName}: necessário {v.required}g, disponível {v.available}g.
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted-foreground">
            Criar o pedido mesmo assim vai deixar o estoque negativo quando for debitado (o débito
            automático de estoque ainda não está ativo nesta versão).
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceConfirm}>Criar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
