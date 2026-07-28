import type { Metadata } from "next";
import { AuthForm } from "../AuthForm";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Crear cuenta · parla" };

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthForm
      mode="registro"
      action={signUp}
      next={next ?? "/app"}
    />
  );
}
