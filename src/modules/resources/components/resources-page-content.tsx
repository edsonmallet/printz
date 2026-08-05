"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CostsSettingsForm } from "@/modules/costs-settings/components/costs-settings-form";
import { MaterialsSection } from "@/modules/materials/components/materials-section";
import { PrintersSection } from "@/modules/printers/components/printers-section";
import { useTenant } from "@/shared/hooks/use-tenant";

export function ResourcesPageContent() {
  const { tenantId } = useTenant();

  if (!tenantId) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Materiais e impressoras</h1>
      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">Materiais</TabsTrigger>
          <TabsTrigger value="printers">Impressoras</TabsTrigger>
          <TabsTrigger value="costs">Custos</TabsTrigger>
        </TabsList>
        <TabsContent value="materials">
          <MaterialsSection tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="printers">
          <PrintersSection tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="costs">
          <CostsSettingsForm tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
