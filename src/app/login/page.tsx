"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useAuth } from "@/lib/auth";
import { canManageCatalog } from "@/lib/roles";
import type { ApiRole } from "@/lib/types";

type LoginMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle, register } = useAuth();
  const [mode, setMode] = useState<LoginMode>("login");
  const [name, setName] = useState("");
  const [paternalSurname, setPaternalSurname] = useState("");
  const [maternalSurname, setMaternalSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function navigateByRole(role: ApiRole | undefined) {
    router.push(role && canManageCatalog(role) ? "/dashboard" : "/");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const nextUser = mode === "login"
        ? await login(email.trim(), password)
        : await register({
            name: name.trim(),
            paternalSurname: paternalSurname.trim(),
            maternalSurname: maternalSurname.trim() || null,
            phone: phone.trim(),
            email: email.trim(),
            password,
          });
      navigateByRole(nextUser?.role);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : mode === "login" ? "No se pudo iniciar sesion." : "No se pudo crear la cuenta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleCredential(credential: string) {
    setIsSubmitting(true);
    setMessage("");
    try {
      const nextUser = await loginWithGoogle(credential);
      navigateByRole(nextUser?.role);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesion con Google.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-stone-50 px-4 py-10 text-zinc-950 lg:grid-cols-[1fr_480px]">
      <section className="mx-auto flex w-full max-w-3xl flex-col justify-center">
        <Link className="font-serif text-3xl font-semibold" href="/">Sweet Silvia</Link>
        <h1 className="mt-8 font-serif text-5xl font-semibold tracking-normal">{mode === "login" ? "Ingresa a tu cuenta" : "Crea tu cuenta"}</h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-600">Compra tus prendas, guarda direcciones y consulta el avance de tus pedidos.</p>
      </section>

      <section className="mx-auto flex w-full max-w-md items-center">
        <form className="w-full space-y-5 rounded-md border border-zinc-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
          <div className="flex rounded-lg bg-stone-100 p-1 text-xs font-semibold uppercase tracking-[0.1em]">
            <button className={"flex-1 rounded-md px-3 py-2 " + (mode === "login" ? "bg-zinc-950 text-white" : "text-zinc-600")} onClick={() => { setMode("login"); setMessage(""); }} type="button">Ingresar</button>
            <button className={"flex-1 rounded-md px-3 py-2 " + (mode === "register" ? "bg-zinc-950 text-white" : "text-zinc-600")} onClick={() => { setMode("register"); setMessage(""); }} type="button">Registrarme</button>
          </div>

          {mode === "register" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium sm:col-span-2">Nombre<input className="admin-input mt-2" value={name} onChange={(event) => setName(event.target.value)} required /></label>
              <label className="block text-sm font-medium">Apellido paterno<input className="admin-input mt-2" value={paternalSurname} onChange={(event) => setPaternalSurname(event.target.value)} required /></label>
              <label className="block text-sm font-medium">Apellido materno<input className="admin-input mt-2" value={maternalSurname} onChange={(event) => setMaternalSurname(event.target.value)} /></label>
              <label className="block text-sm font-medium sm:col-span-2">Telefono<input className="admin-input mt-2" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
            </div>
          ) : null}

          <label className="block text-sm font-medium">Email<input className="admin-input mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className="block text-sm font-medium">Password<input className="admin-input mt-2" minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="admin-primary-button w-full" disabled={isSubmitting} type="submit">{isSubmitting ? "Procesando..." : mode === "login" ? "Ingresar" : "Crear cuenta"}</button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-zinc-400"><span className="h-px flex-1 bg-zinc-200" />o<span className="h-px flex-1 bg-zinc-200" /></div>
          <GoogleSignInButton onCredential={handleGoogleCredential} onError={setMessage} />
          {message ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</p> : null}
        </form>
      </section>
    </main>
  );
}

