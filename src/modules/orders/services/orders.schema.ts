import { z } from "zod";

export const orderItemFormSchema = z.object({
  productId: z.string().min(1, "Selecione um produto"),
  quantity: z.coerce.number().int().positive("Quantidade deve ser maior que zero"),
});

export const orderFormSchema = z.object({
  customerName: z.string().optional(),
  customerContact: z.string().optional(),
  items: z.array(orderItemFormSchema).min(1, "Adicione pelo menos um item"),
  dueDate: z.string().min(1, "Data de entrega obrigatória"),
  statusId: z.string().min(1, "Selecione uma coluna"),
  assignedPrinterId: z.string().min(1, "Selecione uma impressora"),
  forceCreate: z.boolean().optional(),
});

export type OrderFormInput = z.infer<typeof orderFormSchema>;

const orderItemDocSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number(),
  materialId: z.string(),
  totalWeightG: z.number(),
  totalPrintTimeH: z.number(),
});

export const orderDocSchema = z.object({
  customer: z.object({ name: z.string(), contact: z.string() }).optional(),
  items: z.array(orderItemDocSchema),
  dueDate: z.number(),
  statusId: z.string(),
  assignedPrinterId: z.string(),
  partnerId: z.null(),
  stockDebited: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type OrderDocInput = z.infer<typeof orderDocSchema>;
