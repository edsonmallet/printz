"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect } from "react";
import {
  type KanbanColumnInput,
  kanbanColumnSchema,
} from "@/modules/kanban-columns/services/kanban-columns.schema";
import { firestore } from "@/shared/services/firebase-client";
import type { KanbanColumn } from "@/shared/types/kanban-column";

export interface KanbanColumnWithId extends KanbanColumn {
  id: string;
}

const DEFAULT_COLUMN_NAMES = ["A produzir", "Em fila de impressão", "Pronto", "Entregue"];

export function useKanbanColumns(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["kanban-columns", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      collection(firestore, "tenants", tenantId, "kanbanColumns"),
      (snapshot) => {
        const columns: KanbanColumnWithId[] = snapshot.docs.flatMap((docSnapshot) => {
          const result = kanbanColumnSchema.safeParse(docSnapshot.data());
          if (!result.success) {
            console.warn(
              `useKanbanColumns: documento tenants/${tenantId}/kanbanColumns/${docSnapshot.id} inválido, ignorando`,
              result.error,
            );
            return [];
          }
          return [{ id: docSnapshot.id, ...result.data }];
        });
        columns.sort((a, b) => a.order - b.order);
        queryClient.setQueryData(queryKey, columns);
      },
      (error) => {
        console.error(
          `useKanbanColumns: falha ao ouvir tenants/${tenantId}/kanbanColumns (possível permission-denied por claims desatualizadas):`,
          error,
        );
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<KanbanColumnWithId[]>({
    queryKey,
    queryFn: () => [],
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: [],
  });
}

export async function createColumn(tenantId: string, input: KanbanColumnInput): Promise<void> {
  await addDoc(collection(firestore, "tenants", tenantId, "kanbanColumns"), input);
}

export async function updateColumn(
  tenantId: string,
  columnId: string,
  input: KanbanColumnInput,
): Promise<void> {
  await updateDoc(doc(firestore, "tenants", tenantId, "kanbanColumns", columnId), input);
}

export async function deleteColumn(tenantId: string, columnId: string): Promise<void> {
  await deleteDoc(doc(firestore, "tenants", tenantId, "kanbanColumns", columnId));
}

export async function seedDefaultColumns(tenantId: string): Promise<void> {
  const columnsRef = collection(firestore, "tenants", tenantId, "kanbanColumns");
  const existing = await getDocs(columnsRef);
  if (!existing.empty) return;

  const batch = writeBatch(firestore);
  DEFAULT_COLUMN_NAMES.forEach((name, order) => {
    batch.set(doc(columnsRef), { name, order });
  });
  await batch.commit();
}
