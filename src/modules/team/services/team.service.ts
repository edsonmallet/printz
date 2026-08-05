"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect } from "react";
import { firestore } from "@/shared/services/firebase-client";
import type { Member } from "@/shared/types/tenant";

interface MemberWithId extends Member {
  id: string;
}

export function useMembers(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["team", "members", tenantId] as const;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from tenantId, already a dependency
  useEffect(() => {
    if (!tenantId) return;
    const unsubscribe = onSnapshot(
      collection(firestore, "tenants", tenantId, "members"),
      (snapshot) => {
        const members: MemberWithId[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Member),
        }));
        queryClient.setQueryData(queryKey, members);
      },
    );
    return unsubscribe;
  }, [tenantId, queryClient]);

  return useQuery<MemberWithId[]>({
    queryKey,
    queryFn: () => [],
    enabled: !!tenantId,
    staleTime: Infinity,
    initialData: [],
  });
}
