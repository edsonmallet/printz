import { z } from "zod";

export const inviteMemberSchema = z.object({
  email: z.email("E-mail inválido"),
  role: z.enum(["admin", "member"]),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
