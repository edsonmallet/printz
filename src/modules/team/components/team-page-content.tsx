"use client";

import { InviteMemberForm } from "@/modules/team/components/invite-member-form";
import { MemberList } from "@/modules/team/components/member-list";
import { useTenant } from "@/shared/hooks/use-tenant";

export function TeamPageContent() {
  const { tenantId } = useTenant();

  if (!tenantId) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Time</h1>
      <InviteMemberForm />
      <MemberList tenantId={tenantId} />
    </div>
  );
}
