import { z } from "zod";

export const kanbanColumnSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  order: z.coerce.number().min(0, "Ordem não pode ser negativa"),
});

export type KanbanColumnInput = z.infer<typeof kanbanColumnSchema>;
