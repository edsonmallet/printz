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

export function KanbanColumnsSection({ tenantId }: { tenantId: string }) {
  const [dialog, setDialog] = useState<{ open: boolean; column?: KanbanColumnWithId }>({
    open: false,
  });
  const { data: columns, isLoading } = useKanbanColumns(tenantId);
  const hasSeeded = useRef(false);

  useEffect(() => {
    if (isLoading || hasSeeded.current || columns.length > 0) return;
    hasSeeded.current = true;
    seedDefaultColumns(tenantId);
  }, [isLoading, columns.length, tenantId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, column: undefined })}>Nova coluna</Button>
      </div>
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
