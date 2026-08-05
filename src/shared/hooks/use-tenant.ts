"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/shared/hooks/use-auth";

interface TenantClaims {
  tenantId: string | undefined;
  role: "admin" | "member" | undefined;
}

export function useTenant() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data, isLoading: isClaimsLoading } = useQuery<TenantClaims>({
    queryKey: ["auth", "tenant-claims", user?.uid],
    queryFn: async () => {
      if (!user) return { tenantId: undefined, role: undefined };
      const result = await user.getIdTokenResult();
      return {
        tenantId: result.claims.tenantId as string | undefined,
        role: result.claims.role as "admin" | "member" | undefined,
      };
    },
    enabled: !isAuthLoading,
    staleTime: 5 * 60 * 1000,
  });

  return {
    tenantId: data?.tenantId,
    role: data?.role,
    isLoading: isAuthLoading || isClaimsLoading,
  };
}
