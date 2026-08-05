"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { type LoginInput, loginSchema } from "@/modules/auth/services/auth.schema";
import { signInWithEmail, signInWithGoogle } from "@/modules/auth/services/auth.service";

const INVALID_CREDENTIAL_CODES = new Set([
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/user-not-found",
]);

function isFirebaseError(error: unknown): error is FirebaseError {
  return typeof error === "object" && error !== null && "code" in error;
}

export function LoginForm() {
  const router = useRouter();
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    try {
      await signInWithEmail(values.email, values.password);
      router.push("/");
    } catch (error) {
      if (isFirebaseError(error) && INVALID_CREDENTIAL_CODES.has(error.code)) {
        toast.error("E-mail ou senha inválidos");
      } else {
        toast.error("Não foi possível entrar. Tente novamente.");
      }
    }
  }

  async function onGoogleSignIn() {
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      router.push("/");
    } catch (error) {
      if (isFirebaseError(error) && error.code === "auth/popup-closed-by-user") {
        return;
      }
      toast.error("Não foi possível entrar com Google");
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Entrar
          </Button>
        </form>
      </Form>
      <Button
        type="button"
        variant="outline"
        onClick={onGoogleSignIn}
        disabled={isGoogleSubmitting}
      >
        Entrar com Google
      </Button>
    </div>
  );
}
