"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteColumn,
  type KanbanColumnWithId,
  useKanbanColumns,
} from "@/modules/kanban-columns/services/kanban-columns.service";
import { useTenant } from "@/shared/hooks/use-tenant";

interface KanbanColumnListProps {
  tenantId: string;
  onEdit: (column: KanbanColumnWithId) => void;
}

export function KanbanColumnList({ tenantId, onEdit }: KanbanColumnListProps) {
  const { role } = useTenant();
  const { data: columns } = useKanbanColumns(tenantId);
  const [pendingDelete, setPendingDelete] = useState<KanbanColumnWithId | null>(null);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteColumn(tenantId, pendingDelete.id);
      toast.success("Coluna excluída");
    } catch {
      toast.error("Não foi possível excluir a coluna");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Ordem</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {columns.map((column) => (
            <TableRow key={column.id}>
              <TableCell>{column.name}</TableCell>
              <TableCell>{column.order}</TableCell>
              <TableCell>
                {role === "admin" && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(column)}>
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPendingDelete(column)}>
                      Excluir
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna?</AlertDialogTitle>
            <AlertDialogDescription>
              Pedidos que estiverem nessa coluna não serão movidos automaticamente. Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
