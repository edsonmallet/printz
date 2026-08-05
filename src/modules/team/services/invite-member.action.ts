"use server";

import { randomUUID } from "node:crypto";
import { sendEmail } from "@/shared/services/email";
import { getAdminAuth, getAdminFirestore } from "@/shared/services/firebase-admin";
import type { PendingInvite } from "@/shared/types/tenant";

interface InviteMemberActionInput {
  idToken: string;
  email: string;
  role: "admin" | "member";
}

export async function inviteMember(input: InviteMemberActionInput): Promise<void> {
  const decoded = await getAdminAuth().verifyIdToken(input.idToken);
  const tenantId = decoded.tenantId as string | undefined;
  const role = decoded.role as string | undefined;

  if (!tenantId || role !== "admin") {
    throw new Error("Apenas administradores podem convidar membros");
  }

  const token = randomUUID();
  const invite: PendingInvite = {
    email: input.email,
    tenantId,
    role: input.role,
    createdAt: Date.now(),
  };

  await getAdminFirestore().collection("pendingInvites").doc(token).set(invite);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${appUrl}/signup?invite=${token}`;

  await sendEmail({
    to: input.email,
    subject: "Você foi convidado pra um time no Printz",
    html: `<p>Você foi convidado a entrar num time no Printz.</p><p><a href="${inviteUrl}">Clique aqui pra criar sua conta</a></p>`,
  });
}
