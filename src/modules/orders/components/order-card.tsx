"use client";

import { useDraggable } from "@dnd-kit/core";
import type { OrderWithId } from "@/modules/orders/services/orders.service";
import { Card, CardContent } from "@/shared/components/ui/card";

interface OrderCardProps {
  order: OrderWithId;
  printerName: string;
  onClick: () => void;
}

export function OrderCard({ order, printerName, onClick }: OrderCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
    >
      <CardContent className="flex flex-col gap-1 p-3 text-sm">
        <span className="font-medium">{order.customer?.name ?? "—"}</span>
        <span className="text-muted-foreground">
          {order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}
        </span>
        <span className="text-muted-foreground">{printerName}</span>
        <span className="text-muted-foreground">
          {new Date(order.dueDate).toLocaleDateString("pt-BR")}
        </span>
      </CardContent>
    </Card>
  );
}
