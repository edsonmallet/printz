"use client";

import { useKanbanColumns } from "@/modules/kanban-columns/services/kanban-columns.service";
import { type OrderWithId, useOrders } from "@/modules/orders/services/orders.service";
import { usePrinters } from "@/modules/printers/services/printers.service";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

interface OrderListProps {
  tenantId: string;
  onEdit: (order: OrderWithId) => void;
}

export function OrderList({ tenantId, onEdit }: OrderListProps) {
  const { data: orders } = useOrders(tenantId);
  const { data: columns } = useKanbanColumns(tenantId);
  const { data: printers } = usePrinters(tenantId);

  function columnName(statusId: string) {
    return columns.find((c) => c.id === statusId)?.name ?? statusId;
  }

  function printerName(printerId: string) {
    return printers.find((p) => p.id === printerId)?.name ?? printerId;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Itens</TableHead>
          <TableHead>Entrega</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Impressora</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>{order.customer?.name ?? "—"}</TableCell>
            <TableCell>
              {order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}
            </TableCell>
            <TableCell>{new Date(order.dueDate).toLocaleDateString("pt-BR")}</TableCell>
            <TableCell>
              <Badge variant="secondary">{columnName(order.statusId)}</Badge>
            </TableCell>
            <TableCell>{printerName(order.assignedPrinterId)}</TableCell>
            <TableCell>
              <Button variant="outline" size="sm" onClick={() => onEdit(order)}>
                Editar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
