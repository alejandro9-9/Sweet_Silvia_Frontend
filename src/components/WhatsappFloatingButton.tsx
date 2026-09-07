const whatsappPhone = "51941872197";

type WhatsappFloatingButtonProps = {
  message?: string;
};

export function WhatsappFloatingButton({
  message = "Hola Sweet Silvia, quiero recibir ayuda para comprar en la tienda.",
}: WhatsappFloatingButtonProps) {
  return (
    <a
      aria-label="Escribir a Sweet Silvia por WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#128c7e] text-white shadow-lg shadow-zinc-950/20 transition hover:-translate-y-1 hover:bg-[#0f766c] sm:h-16 sm:w-16"
      href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`}
      rel="noreferrer"
      target="_blank"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-[#128c7e]/30" />
      <span className="relative grid h-full w-full animate-[sweet-float_2.2s_ease-in-out_infinite] place-items-center rounded-full">
        <WhatsappIcon />
      </span>
    </a>
  );
}

function WhatsappIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24">
      <path
        d="M5.35 18.7 6.2 15.8a7.15 7.15 0 1 1 2.25 2.05l-3.1.85Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.4 8.75c.18-.37.32-.38.56-.38h.45c.14 0 .34.04.48.36.18.42.58 1.42.62 1.52.05.1.08.24-.02.39-.2.29-.43.52-.6.73-.1.13-.2.25-.08.45.32.55.71 1.05 1.2 1.47.55.48 1.02.64 1.22.72.2.08.34.07.47-.08.18-.2.53-.62.68-.84.15-.22.31-.18.52-.1.22.08 1.37.64 1.6.76.24.12.4.18.46.28.06.1.06.58-.14 1.13-.2.56-1.14 1.07-1.58 1.1-.42.03-.95.15-3.2-.78-2.7-1.12-4.4-3.88-4.54-4.06-.13-.18-1.08-1.44-1.08-2.75 0-1.3.68-1.95.92-2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
