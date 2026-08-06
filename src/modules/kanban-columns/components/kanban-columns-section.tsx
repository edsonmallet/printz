"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { KanbanColumnFormDialog } from "@/modules/kanban-columns/components/kanban-column-form-dialog";
import { KanbanColumnList } from "@/modules/kanban-columns/components/kanban-column-list";
import {
  type KanbanColumnWithId,
  seedDefaultColumns,
  useKanbanColumns,
} from "@/modules/kanban-columns/services/kanban-columns.service";
import { useTenant } from "@/shared/hooks/use-tenant";

export function KanbanColumnsSection({ tenantId }: { tenantId: string }) {
  const { role } = useTenant();
  const [dialog, setDialog] = useState<{ open: boolean; column?: KanbanColumnWithId }>({
    open: false,
  });
  const { data: columns, isLoading } = useKanbanColumns(tenantId);
  const hasSeeded = useRef(false);

  useEffect(() => {
    if (isLoading || hasSeeded.current || columns.length > 0 || role !== "admin") return;
    hasSeeded.current = true;
    seedDefaultColumns(tenantId).catch((error) => {
      console.error(
        `KanbanColumnsSection: falha ao semear colunas padrão para tenants/${tenantId}:`,
        error,
      );
    });
  }, [isLoading, columns.length, tenantId, role]);

  return (
    <div className="flex flex-col gap-4">
      {role === "admin" && (
        <div className="flex justify-end">
          <Button onClick={() => setDialog({ open: true, column: undefined })}>Nova coluna</Button>
        </div>
      )}
      <KanbanColumnList
        tenantId={tenantId}
        onEdit={(column) => setDialog({ open: true, column })}
      />
      <KanbanColumnFormDialog
        tenantId={tenantId}
        column={dialog.column}
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
      />
    </div>
  );
}
