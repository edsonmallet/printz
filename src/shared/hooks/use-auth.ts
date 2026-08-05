"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { auth } from "@/shared/services/firebase-client";

const AUTH_QUERY_KEY = ["auth", "current-user"] as const;

export function useAuth() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      queryClient.setQueryData<User | null>(AUTH_QUERY_KEY, user);
    });
    return unsubscribe;
  }, [queryClient]);

  const { data, isLoading } = useQuery<User | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => auth.currentUser,
    initialData: auth.currentUser,
    staleTime: Infinity,
  });

  return { user: data, isLoading };
}
