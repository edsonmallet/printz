"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { signOutUser } from "@/modules/auth/services/auth.service";
import { useAuth } from "@/shared/hooks/use-auth";
import { useTenant } from "@/shared/hooks/use-tenant";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { tenantId, isLoading: isTenantLoading } = useTenant();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [isAuthLoading, user, router]);

  if (isAuthLoading || isTenantLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p>Sua conta ainda não está associada a um tenant. Entre em contato com o suporte.</p>
      </div>
    );
  }

  async function handleSignOut() {
    await signOutUser();
    router.push("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <span className="font-semibold">Printz</span>
        <Button variant="outline" onClick={handleSignOut}>
          Sair
        </Button>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
