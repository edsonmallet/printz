"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, deleteField, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect } from "react";
import { orderDocSchema } from "@/modules/orders/services/orders.schema";
import { firestore } from "@/shared/services/firebase-client";
import type { Order } from "@/shared/types/order";

export interface OrderWithId extends Order {
  id: string;
}

export function useOrders(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["orders", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      collection(firestore, "tenants", tenantId, "orders"),
      (snapshot) => {
        const orders: OrderWithId[] = snapshot.docs.flatMap((docSnapshot) => {
          const result = orderDocSchema.safeParse(docSnapshot.data());
          if (!result.success) {
            console.warn(
              `useOrders: documento tenants/${tenantId}/orders/${docSnapshot.id} inválido, ignorando`,
              result.error,
            );
            return [];
          }
          return [{ id: docSnapshot.id, ...result.data }];
        });
        queryClient.setQueryData(queryKey, orders);
      },
      (error) => {
        console.error(
          `useOrders: falha ao ouvir tenants/${tenantId}/orders (possível permission-denied por claims desatualizadas):`,
          error,
        );
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<OrderWithId[]>({
    queryKey,
    queryFn: () => [],
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: [],
  });
}

export async function createOrder(
  tenantId: string,
  input: Omit<Order, "createdAt" | "updatedAt">,
): Promise<void> {
  const now = Date.now();
  await addDoc(collection(firestore, "tenants", tenantId, "orders"), {
    ...input,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateOrder(
  tenantId: string,
  orderId: string,
  input: Omit<Order, "createdAt" | "updatedAt">,
): Promise<void> {
  await updateDoc(doc(firestore, "tenants", tenantId, "orders", orderId), {
    ...input,
    // Sem `customer`, o payload precisa apagar o campo explicitamente: `updateDoc`
    // só toca nos campos presentes no objeto, então omitir a chave deixaria um
    // `customer` antigo "grudado" no documento em vez de limpo.
    customer: input.customer ?? deleteField(),
    updatedAt: Date.now(),
  });
}

// Usado pelo drag-and-drop do Board: escreve só `statusId`, nunca o documento
// inteiro. Isso evita sobrescrever edições concorrentes (items, dueDate etc.)
// com um snapshot de client desatualizado, e nunca toca em `stockDebited` —
// então a regra de segurança que trava esse campo nunca é acionada por um
// simples drag.
export async function updateOrderStatus(
  tenantId: string,
  orderId: string,
  statusId: string,
): Promise<void> {
  await updateDoc(doc(firestore, "tenants", tenantId, "orders", orderId), {
    statusId,
    updatedAt: Date.now(),
  });
}
