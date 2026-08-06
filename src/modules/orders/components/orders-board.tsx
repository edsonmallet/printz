"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import {
  type KanbanColumnWithId,
  useKanbanColumns,
} from "@/modules/kanban-columns/services/kanban-columns.service";
import { OrderCard } from "@/modules/orders/components/order-card";
import { debitStockForOrder } from "@/modules/orders/services/debit-stock.action";
import {
  type OrderWithId,
  updateOrderStatus,
  useOrders,
} from "@/modules/orders/services/orders.service";
import { usePrinters } from "@/modules/printers/services/printers.service";
import { useAuth } from "@/shared/hooks/use-auth";

interface OrdersBoardProps {
  tenantId: string;
  onEdit: (order: OrderWithId) => void;
}

function BoardColumn({
  column,
  orders,
  printerName,
  onEdit,
}: {
  column: KanbanColumnWithId;
  orders: OrderWithId[];
  printerName: (id: string) => string;
  onEdit: (order: OrderWithId) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-64 flex-col gap-2 rounded-lg border p-2 ${isOver ? "bg-muted" : ""}`}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{column.name}</span>
        <span className="text-xs text-muted-foreground">{orders.length}</span>
      </div>
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          printerName={printerName(order.assignedPrinterId)}
          onClick={() => onEdit(order)}
        />
      ))}
    </div>
  );
}

export function OrdersBoard({ tenantId, onEdit }: OrdersBoardProps) {
  const { data: orders } = useOrders(tenantId);
  const { data: columns } = useKanbanColumns(tenantId);
  const { data: printers } = usePrinters(tenantId);
  const { user } = useAuth();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function printerName(printerId: string) {
    return printers.find((p) => p.id === printerId)?.name ?? printerId;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const orderId = event.active.id as string;
    const newColumnId = event.over?.id as string | undefined;
    if (!newColumnId) return;

    const order = orders.find((o) => o.id === orderId);
    if (!order || order.statusId === newColumnId) return;

    try {
      await updateOrderStatus(tenantId, order.id, newColumnId);
    } catch {
      toast.error("Não foi possível mover o pedido");
      return;
    }

    const targetColumn = columns.find((c) => c.id === newColumnId);
    if (!targetColumn?.isProductionEntry) return;

    try {
      if (!user) {
        throw new Error("Sessão expirada");
      }
      const idToken = await user.getIdToken();
      await debitStockForOrder({ idToken, orderId: order.id });
    } catch {
      toast.error("Pedido movido, mas não foi possível debitar o estoque — tente novamente");
    }
  }

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {sortedColumns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            orders={orders.filter((order) => order.statusId === column.id)}
            printerName={printerName}
            onEdit={onEdit}
          />
        ))}
      </div>
    </DndContext>
  );
}
