import "server-only";
import { type App, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY não configurada");
  }

  let parsedServiceAccount: ServiceAccount;
  try {
    parsedServiceAccount = JSON.parse(serviceAccountKey);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY não é um JSON válido");
  }

  return initializeApp({
    credential: cert(parsedServiceAccount),
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}
