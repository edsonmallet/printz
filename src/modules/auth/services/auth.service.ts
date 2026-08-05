import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/shared/services/firebase-client";

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  return credential.user;
}
