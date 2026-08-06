"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderFormDialog } from "@/modules/orders/components/order-form-dialog";
import { OrderList } from "@/modules/orders/components/order-list";
import { OrdersBoard } from "@/modules/orders/components/orders-board";
import type { OrderWithId } from "@/modules/orders/services/orders.service";

export function OrdersSection({ tenantId }: { tenantId: string }) {
  const [dialog, setDialog] = useState<{ open: boolean; order?: OrderWithId }>({ open: false });

  function handleEdit(order: OrderWithId) {
    setDialog({ open: true, order });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, order: undefined })}>Novo pedido</Button>
      </div>
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <OrderList tenantId={tenantId} onEdit={handleEdit} />
        </TabsContent>
        <TabsContent value="board">
          <OrdersBoard tenantId={tenantId} onEdit={handleEdit} />
        </TabsContent>
      </Tabs>
      <OrderFormDialog
        tenantId={tenantId}
        order={dialog.order}
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
      />
    </div>
  );
}
