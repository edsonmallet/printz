"use server";

import { z } from "zod";
import { getAdminAuth, getAdminFirestore } from "@/shared/services/firebase-admin";
import type { Member, MemberRole, PendingInvite, Tenant } from "@/shared/types/tenant";

const provisionAccountSchema = z.object({
  idToken: z.string().min(1),
  inviteToken: z.string().optional(),
});

interface ProvisionAccountInput {
  idToken: string;
  inviteToken?: string;
}

interface ProvisionAccountResult {
  tenantId: string;
  role: "admin" | "member";
}

export async function provisionAccount(
  rawInput: ProvisionAccountInput,
): Promise<ProvisionAccountResult> {
  const input = provisionAccountSchema.parse(rawInput);
  const decoded = await getAdminAuth().verifyIdToken(input.idToken);
  const { uid, email } = decoded;

  if (!email) {
    throw new Error("Token não contém e-mail");
  }

  if (decoded.tenantId) {
    return {
      tenantId: decoded.tenantId as string,
      role: decoded.role as MemberRole,
    };
  }

  const firestore = getAdminFirestore();

  if (input.inviteToken) {
    const inviteRef = firestore.collection("pendingInvites").doc(input.inviteToken);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      throw new Error("Convite inválido ou expirado");
    }

    const invite = inviteSnap.data() as PendingInvite;

    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error("E-mail não corresponde ao convite");
    }

    const member: Member = {
      email,
      displayName: decoded.name ?? email,
      role: invite.role,
    };

    await firestore
      .collection("tenants")
      .doc(invite.tenantId)
      .collection("members")
      .doc(uid)
      .set(member);

    await getAdminAuth().setCustomUserClaims(uid, {
      tenantId: invite.tenantId,
      role: invite.role,
    });

    await inviteRef.delete();

    return { tenantId: invite.tenantId, role: invite.role };
  }

  const tenantRef = firestore.collection("tenants").doc();
  const tenant: Tenant = {
    name: `Tenant de ${decoded.name ?? email}`,
    plan: "free",
    createdAt: Date.now(),
    ownerId: uid,
  };
  await tenantRef.set(tenant);

  const member: Member = {
    email,
    displayName: decoded.name ?? email,
    role: "admin",
  };
  await tenantRef.collection("members").doc(uid).set(member);

  await getAdminAuth().setCustomUserClaims(uid, {
    tenantId: tenantRef.id,
    role: "admin",
  });

  return { tenantId: tenantRef.id, role: "admin" };
}
