export type MemberRole = "admin" | "member";

export interface Tenant {
  name: string;
  plan: string;
  createdAt: number;
  ownerId: string;
}

export interface Member {
  email: string;
  displayName: string;
  role: MemberRole;
}

export interface PendingInvite {
  email: string;
  tenantId: string;
  role: MemberRole;
  createdAt: number;
}
