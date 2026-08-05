"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect } from "react";
import type { MaterialInput } from "@/modules/materials/services/materials.schema";
import { firestore } from "@/shared/services/firebase-client";
import type { Material } from "@/shared/types/resources";

export interface MaterialWithId extends Material {
  id: string;
}

export function useMaterials(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["materials", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      collection(firestore, "tenants", tenantId, "materials"),
      (snapshot) => {
        const materials: MaterialWithId[] = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as Material),
        }));
        queryClient.setQueryData(queryKey, materials);
      },
      (error) => {
        console.error(
          `useMaterials: falha ao ouvir tenants/${tenantId}/materials (possível permission-denied por claims desatualizadas):`,
          error,
        );
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<MaterialWithId[]>({
    queryKey,
    queryFn: () => [],
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: [],
  });
}

export async function createMaterial(tenantId: string, input: MaterialInput): Promise<void> {
  await addDoc(collection(firestore, "tenants", tenantId, "materials"), input);
}

export async function updateMaterial(
  tenantId: string,
  materialId: string,
  input: MaterialInput,
): Promise<void> {
  await updateDoc(doc(firestore, "tenants", tenantId, "materials", materialId), input);
}

export async function deleteMaterial(tenantId: string, materialId: string): Promise<void> {
  await deleteDoc(doc(firestore, "tenants", tenantId, "materials", materialId));
}
