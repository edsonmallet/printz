"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { type SignupInput, signupSchema } from "@/modules/auth/services/auth.schema";
import {
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from "@/modules/auth/services/auth.service";
import { provisionAccount } from "@/modules/auth/services/provision-account.action";
import { auth } from "@/shared/services/firebase-client";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? undefined;
  const queryClient = useQueryClient();

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  async function provisionAndRedirect(idToken: string) {
    await provisionAccount({ idToken, inviteToken });
    await auth.currentUser?.getIdToken(true);
    queryClient.invalidateQueries({ queryKey: ["auth", "tenant-claims"] });
    router.push("/");
  }

  async function onSubmit(values: SignupInput) {
    let accountCreated = false;
    try {
      const user = await signUpWithEmail(values.email, values.password, values.displayName);
      accountCreated = true;
      const idToken = await user.getIdToken();
      await provisionAndRedirect(idToken);
    } catch (error) {
      if (accountCreated) {
        // A conta de autenticação já foi criada, mas o provisionamento (vínculo
        // ao tenant/convite) falhou. Desloga pra não deixar o usuário numa
        // sessão autenticada porém sem tenant, e mostra o motivo real.
        await signOutUser();
        const message =
          error instanceof Error
            ? error.message
            : "Conta criada, mas não conseguimos vincular ao convite.";
        toast.error(
          `${message} Você já tem uma conta — tente entrar em vez de criar conta, ou peça um novo convite.`,
        );
      } else {
        toast.error("Não foi possível criar sua conta");
      }
    }
  }

  async function onGoogleSignUp() {
    try {
      const user = await signInWithGoogle();
      const idToken = await user.getIdToken();
      await provisionAndRedirect(idToken);
    } catch {
      toast.error("Não foi possível criar sua conta com Google");
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Criar conta
          </Button>
        </form>
      </Form>
      <Button variant="outline" onClick={onGoogleSignUp}>
        Criar conta com Google
      </Button>
      <p className="text-sm text-muted-foreground text-center">
        Já tem conta?{" "}
        <Link href="/login" className="underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
