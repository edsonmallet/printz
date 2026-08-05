"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect } from "react";
import {
  type CostsSettingsInput,
  costsSettingsSchema,
} from "@/modules/costs-settings/services/costs-settings.schema";
import { firestore } from "@/shared/services/firebase-client";
import type { CostsSettings } from "@/shared/types/resources";

export function useCostsSettings(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["costs-settings", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      doc(firestore, "tenants", tenantId, "settings", "costs"),
      (snapshot) => {
        const rawData = snapshot.data();
        if (rawData === undefined) {
          queryClient.setQueryData(queryKey, null);
          return;
        }
        const result = costsSettingsSchema.safeParse(rawData);
        if (!result.success) {
          console.warn(
            `useCostsSettings: documento tenants/${tenantId}/settings/costs inválido, ignorando`,
            result.error,
          );
          return;
        }
        queryClient.setQueryData(queryKey, result.data);
      },
      (error) => {
        console.error(
          `useCostsSettings: falha ao ouvir tenants/${tenantId}/settings/costs (possível permission-denied por claims desatualizadas):`,
          error,
        );
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<CostsSettings | null>({
    queryKey,
    queryFn: () => null,
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: null,
  });
}

export async function saveCostsSettings(
  tenantId: string,
  input: CostsSettingsInput,
): Promise<void> {
  await setDoc(doc(firestore, "tenants", tenantId, "settings", "costs"), input);
}
