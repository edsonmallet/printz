import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(6, "Senha precisa ter no mínimo 6 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  displayName: z.string().min(2, "Nome precisa ter no mínimo 2 caracteres"),
  email: z.email("E-mail inválido"),
  password: z.string().min(6, "Senha precisa ter no mínimo 6 caracteres"),
});

export type SignupInput = z.infer<typeof signupSchema>;
