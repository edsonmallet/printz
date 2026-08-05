"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect } from "react";
import type { PrinterInput } from "@/modules/printers/services/printers.schema";
import { firestore } from "@/shared/services/firebase-client";
import type { Printer } from "@/shared/types/resources";

export interface PrinterWithId extends Printer {
  id: string;
}

export function usePrinters(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["printers", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      collection(firestore, "tenants", tenantId, "printers"),
      (snapshot) => {
        const printers: PrinterWithId[] = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as Printer),
        }));
        queryClient.setQueryData(queryKey, printers);
      },
      (error) => {
        console.error(
          `usePrinters: falha ao ouvir tenants/${tenantId}/printers (possível permission-denied por claims desatualizadas):`,
          error,
        );
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<PrinterWithId[]>({
    queryKey,
    queryFn: () => [],
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: [],
  });
}

export async function createPrinter(tenantId: string, input: PrinterInput): Promise<void> {
  await addDoc(collection(firestore, "tenants", tenantId, "printers"), input);
}

export async function updatePrinter(
  tenantId: string,
  printerId: string,
  input: PrinterInput,
): Promise<void> {
  await updateDoc(doc(firestore, "tenants", tenantId, "printers", printerId), input);
}

export async function deletePrinter(tenantId: string, printerId: string): Promise<void> {
  await deleteDoc(doc(firestore, "tenants", tenantId, "printers", printerId));
}
