"use client";

import { useMembers } from "@/modules/team/services/team.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

export function MemberList({ tenantId }: { tenantId: string }) {
  const { data: members } = useMembers(tenantId);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Papel</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell>{member.displayName}</TableCell>
            <TableCell>{member.email}</TableCell>
            <TableCell>{member.role === "admin" ? "Administrador" : "Membro"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
