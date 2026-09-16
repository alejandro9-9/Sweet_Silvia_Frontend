import { useNavigate } from "react-router-dom";
import { Link } from "@/components/RouterLink";
import { FormEvent, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useAuth } from "@/lib/auth";
import { canManageCatalog } from "@/lib/roles";
import type { ApiRole } from "@/lib/types";

type LoginMode = "login" | "register";

const brandImages = [
  { src: "/mock-products/vestido-slip-champagne.jpg", alt: "Vestido champagne de Sweet Silvia" },
  { src: "/mock-products/blusa-satin-marfil.jpg", alt: "Blusa marfil de Sweet Silvia" },
  { src: "/mock-products/bolso-mini-rosa.jpg", alt: "Bolso rosa de Sweet Silvia" },
];

export default function LoginPage() {
  const navigate = useNavigate();
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
  const [isPersonalDataOpen, setIsPersonalDataOpen] = useState(false);

  function navigateByRole(role: ApiRole | undefined) {
    navigate(role && canManageCatalog(role) ? "/dashboard" : "/");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      if (mode === "register" && (!name.trim() || !paternalSurname.trim() || !phone.trim())) {
        setIsPersonalDataOpen(true);
        setMessage("Completa tus datos personales para registrarte.");
        return;
      }

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
    <main className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-[#f2eeec] text-[#241d20] sm:px-4 sm:py-4 lg:px-8 lg:py-8" style={{ width: "100%", maxWidth: "100vw" }}>
      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] min-w-0 grid-cols-1 overflow-hidden bg-white shadow-[0_24px_80px_rgba(62,38,45,0.12)] sm:min-h-[calc(100vh-2rem)] sm:rounded-[24px] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.08fr_0.92fr]" style={{ width: "100%", maxWidth: "1440px", minWidth: 0 }}>
        <section className="relative hidden min-w-0 overflow-hidden bg-[#30272b] lg:flex">
          <div className="absolute inset-0 grid grid-cols-2 gap-3 p-3 opacity-90">
            <div className="relative row-span-2 min-h-full overflow-hidden rounded-[18px]">
              <img alt={brandImages[0].alt} className="absolute inset-0 h-full w-full object-cover" loading="eager" src={brandImages[0].src} />
            </div>
            <div className="relative min-h-0 overflow-hidden rounded-[18px]">
              <img alt={brandImages[1].alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" src={brandImages[1].src} />
            </div>
            <div className="relative min-h-0 overflow-hidden rounded-[18px]">
              <img alt={brandImages[2].alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" src={brandImages[2].src} />
            </div>
          </div>
          <div className="absolute inset-0 bg-[#30272b]/65" />

          <div className="relative z-10 flex min-h-full w-full flex-col justify-between p-10 text-white xl:p-14">
            <Link aria-label="Ir al inicio de Sweet Silvia" className="inline-flex w-fit" href="/">
              <BrandLogo className="w-44" priority />
            </Link>

            <div className="max-w-xl py-16">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#e6c5c7]">Estilo para todos los dias</p>
              <h2 className="mt-5 max-w-lg font-serif text-6xl font-semibold leading-[0.98] tracking-normal xl:text-7xl">Tu estilo, a tu manera.</h2>
              <p className="mt-7 max-w-md text-base leading-7 text-white/75">Descubre prendas pensadas para acompanarte en cada momento y arma looks que hablan por ti.</p>
              <div className="mt-10 flex items-center gap-4 text-xs text-white/65">
                <span className="h-px w-12 bg-[#d7aeb4]" />
                <span>Moda contemporanea peruana</span>
              </div>
            </div>

            <p className="text-xs text-white/50">2026 Sweet Silvia. Todos los derechos reservados.</p>
          </div>
        </section>

        <section className="flex min-h-screen w-full max-w-full min-w-0 flex-col justify-center overflow-hidden bg-[#fffdfb] px-5 py-8 sm:px-10 lg:min-h-0 lg:px-14 lg:py-12 xl:px-24" style={{ boxSizing: "border-box" }}>
          <div className="mx-auto w-full max-w-full min-w-0 sm:max-w-[430px]">
            <div className="mb-10 flex items-center justify-between lg:mb-14">
              <Link aria-label="Ir al inicio de Sweet Silvia" className="inline-flex lg:hidden" href="/">
                <BrandLogo className="w-32" priority />
              </Link>
              <span className="ml-4 hidden max-w-[120px] shrink text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8588] sm:inline">Acceso seguro</span>
            </div>

            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#a35d6c]">Bienvenido a casa</p>
              <h1 className="mt-4 max-w-[330px] break-words font-serif text-4xl font-semibold leading-tight tracking-normal text-[#30272b] sm:max-w-full sm:text-5xl">{mode === "login" ? "Ingresa a tu cuenta" : "Crea tu cuenta"}</h1>
              <p className="mt-4 max-w-[330px] break-words text-sm leading-6 text-[#806f73] sm:max-w-full">{mode === "login" ? "Guarda tus favoritos, direcciones y pedidos en un solo lugar." : "Unete para guardar tus favoritos y disfrutar una compra mas simple."}</p>
            </div>

            <form className="min-w-0 space-y-6" onSubmit={handleSubmit} style={{ width: "calc(100vw - 40px)", maxWidth: "100%" }}>
              <div className="grid grid-cols-2 gap-6 border-b border-[#e6dcda]">
                <button className={"relative pb-3 text-left text-xs font-bold uppercase tracking-[0.16em] transition " + (mode === "login" ? "text-[#30272b]" : "text-[#a9989b] hover:text-[#6d5b60]")} onClick={() => { setMode("login"); setMessage(""); setIsPersonalDataOpen(false); }} type="button">
                  Ingresar
                  {mode === "login" ? <span className="absolute -bottom-px left-0 h-0.5 w-full bg-[#a35d6c]" /> : null}
                </button>
                <button className={"relative pb-3 text-left text-xs font-bold uppercase tracking-[0.16em] transition " + (mode === "register" ? "text-[#30272b]" : "text-[#a9989b] hover:text-[#6d5b60]")} onClick={() => { setMode("register"); setMessage(""); setIsPersonalDataOpen(false); }} type="button">
                  Registrarme
                  {mode === "register" ? <span className="absolute -bottom-px left-0 h-0.5 w-full bg-[#a35d6c]" /> : null}
                </button>
              </div>

              {mode === "register" ? (
                <section className="overflow-hidden rounded-[10px] border border-[#e2d6d3] bg-[#fbf6f4]">
                  <button
                    aria-expanded={isPersonalDataOpen}
                    className="flex min-h-14 w-full items-center justify-between gap-4 px-4 text-left transition hover:bg-[#f7eeeb]"
                    onClick={() => setIsPersonalDataOpen((isOpen) => !isOpen)}
                    type="button"
                  >
                    <span>
                      <span className="block text-xs font-bold uppercase tracking-[0.14em] text-[#59484c]">Datos personales</span>
                      <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-[#8e7c80]">Nombre, apellidos y telefono</span>
                    </span>
                    <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#d8c8c8] bg-white text-lg font-normal text-[#59484c]">
                      {isPersonalDataOpen ? "-" : "+"}
                    </span>
                  </button>

                  {isPersonalDataOpen ? (
                    <div className="grid gap-4 border-t border-[#e2d6d3] px-4 pb-4 pt-4 sm:grid-cols-2">
                      <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#59484c] sm:col-span-2">Nombre<input autoComplete="given-name" className="mt-2 h-12 w-full rounded-[10px] border border-[#ded2d0] bg-white px-4 text-sm font-normal normal-case tracking-normal text-[#30272b] shadow-[0_4px_14px_rgba(70,40,48,0.04)] transition placeholder:text-[#b3a4a6] focus:border-[#a35d6c] focus:ring-4 focus:ring-[#a35d6c]/10" value={name} onChange={(event) => setName(event.target.value)} required /></label>
                      <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#59484c]">Apellido paterno<input autoComplete="family-name" className="mt-2 h-12 w-full rounded-[10px] border border-[#ded2d0] bg-white px-4 text-sm font-normal normal-case tracking-normal text-[#30272b] shadow-[0_4px_14px_rgba(70,40,48,0.04)] transition focus:border-[#a35d6c] focus:ring-4 focus:ring-[#a35d6c]/10" value={paternalSurname} onChange={(event) => setPaternalSurname(event.target.value)} required /></label>
                      <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#59484c]">Apellido materno<input autoComplete="additional-name" className="mt-2 h-12 w-full rounded-[10px] border border-[#ded2d0] bg-white px-4 text-sm font-normal normal-case tracking-normal text-[#30272b] shadow-[0_4px_14px_rgba(70,40,48,0.04)] transition focus:border-[#a35d6c] focus:ring-4 focus:ring-[#a35d6c]/10" value={maternalSurname} onChange={(event) => setMaternalSurname(event.target.value)} /></label>
                      <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#59484c] sm:col-span-2">Telefono<input autoComplete="tel" className="mt-2 h-12 w-full rounded-[10px] border border-[#ded2d0] bg-white px-4 text-sm font-normal normal-case tracking-normal text-[#30272b] shadow-[0_4px_14px_rgba(70,40,48,0.04)] transition focus:border-[#a35d6c] focus:ring-4 focus:ring-[#a35d6c]/10" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#59484c]">Email<input autoComplete="email" className="mt-2 h-12 w-full rounded-[10px] border border-[#ded2d0] bg-white px-4 text-sm font-normal normal-case tracking-normal text-[#30272b] shadow-[0_4px_14px_rgba(70,40,48,0.04)] transition placeholder:text-[#b3a4a6] focus:border-[#a35d6c] focus:ring-4 focus:ring-[#a35d6c]/10" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[#59484c]">Password<input autoComplete={mode === "login" ? "current-password" : "new-password"} className="mt-2 h-12 w-full rounded-[10px] border border-[#ded2d0] bg-white px-4 text-sm font-normal normal-case tracking-normal text-[#30272b] shadow-[0_4px_14px_rgba(70,40,48,0.04)] transition placeholder:text-[#b3a4a6] focus:border-[#a35d6c] focus:ring-4 focus:ring-[#a35d6c]/10" minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              <button className="inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-[#30272b] px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_8px_18px_rgba(48,39,43,0.16)] transition hover:bg-[#8c4c5c] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "Procesando..." : mode === "login" ? "Ingresar" : "Crear cuenta"}</button>

              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#ad9c9f]"><span className="h-px flex-1 bg-[#e6dcda]" />{mode === "register" ? "Registrarme con Google" : "Ingresar con Google"}<span className="h-px flex-1 bg-[#e6dcda]" /></div>
              <GoogleSignInButton actionLabel={mode === "register" ? "Registrarme con Google" : "Ingresar con Google"} onCredential={handleGoogleCredential} onError={setMessage} />
              {message ? <p className="rounded-[10px] border border-[#e8bfc4] bg-[#fff1f2] p-3 text-sm leading-5 text-[#923f50]" role="alert">{message}</p> : null}
              {mode === "register" ? <p className="text-center text-[11px] leading-5 text-[#8e7c80]">Al crear tu cuenta aceptas los <Link className="font-semibold underline decoration-[#c99da5] underline-offset-2" href="/terms-and-conditions">terminos y condiciones</Link> y reconoces la <Link className="font-semibold underline decoration-[#c99da5] underline-offset-2" href="/privacy-policy">politica de privacidad</Link>.</p> : null}
              <p className="text-center text-[11px] leading-5 text-[#a9989b]">Tus datos se protegen con una conexion segura.</p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
