import { AppShell } from "@/components/AppShell";

type LegalSection = {
  title: string;
  paragraphs: string[];
};

const termsSections: LegalSection[] = [
  {
    title: "Identificacion de la tienda",
    paragraphs: [
      "Sweet Silvia es una tienda virtual operada por Silvia Ortiz S.A.C. La informacion comercial, los precios, la disponibilidad y las condiciones aplicables a cada producto se muestran antes de confirmar la compra.",
    ],
  },
  {
    title: "Pedidos y disponibilidad",
    paragraphs: [
      "El pedido queda sujeto a confirmacion de stock y de pago. Si una variante deja de estar disponible antes de completar la operacion, la tienda informara al cliente y no confirmara esa unidad.",
      "Los datos ingresados por el cliente deben ser verdaderos y suficientes para procesar la compra, contactar al destinatario y coordinar la entrega.",
    ],
  },
  {
    title: "Precios, pagos y comprobantes",
    paragraphs: [
      "Los precios se muestran en soles peruanos e incluyen los conceptos indicados durante el checkout. El costo de envio y cualquier descuento se detallan antes de confirmar la orden.",
      "Los pagos manuales requieren validacion del comprobante. Cuando Izipay este habilitado, el pago se procesara en su plataforma segura y la orden se confirmara despues de recibir una respuesta valida del proveedor.",
    ],
  },
  {
    title: "Envios",
    paragraphs: [
      "Los plazos dependen del destino y del operador logistico seleccionado. El cliente es responsable de proporcionar una direccion, telefono y referencia correctos. Una vez generado el envio, la tienda mostrara el numero de seguimiento disponible.",
    ],
  },
  {
    title: "Cambios, cancelaciones y devoluciones",
    paragraphs: [
      "Las solicitudes se evaluan segun el estado del pedido, las condiciones de la prenda y la normativa peruana aplicable. Los productos deben conservar sus etiquetas, no presentar uso ni alteraciones y ser entregados con sus accesorios originales cuando corresponda.",
      "Si se confirma un cobro y posteriormente no es posible atender el pedido, la tienda coordinara el cambio o reembolso por el mismo medio disponible para la operacion.",
    ],
  },
  {
    title: "Atencion al cliente",
    paragraphs: [
      "Las consultas sobre pedidos, pagos, envios o ejercicio de derechos pueden realizarse mediante los canales de contacto publicados en la tienda. Para ubicar una compra se podra solicitar el numero de pedido y los datos del titular.",
    ],
  },
];

const privacySections: LegalSection[] = [
  {
    title: "Datos que tratamos",
    paragraphs: [
      "Podemos tratar nombres, apellidos, correo, telefono, direcciones, documento de identidad cuando lo requiera el medio de pago, historial de pedidos, comprobantes y datos tecnicos necesarios para mantener una sesion segura.",
      "Sweet Silvia no almacena numeros completos de tarjetas ni codigos de seguridad. Cuando Izipay este habilitado, esos datos se ingresan y procesan en los servicios del proveedor de pagos.",
    ],
  },
  {
    title: "Finalidades",
    paragraphs: [
      "Usamos la informacion para crear y proteger cuentas, atender pedidos, validar pagos, coordinar envios, emitir comunicaciones transaccionales, prevenir fraude y cumplir obligaciones legales.",
    ],
  },
  {
    title: "Proveedores",
    paragraphs: [
      "La informacion estrictamente necesaria puede compartirse con proveedores que participan en la operacion, como Izipay para pagos, Olva u otros operadores para entregas, Google para autenticacion y el proveedor de correo transaccional.",
    ],
  },
  {
    title: "Conservacion y seguridad",
    paragraphs: [
      "Los datos se conservan durante el tiempo necesario para atender la relacion comercial y las obligaciones aplicables. Aplicamos controles de acceso, conexiones cifradas y almacenamiento privado para comprobantes y documentos.",
    ],
  },
  {
    title: "Preferencias del navegador",
    paragraphs: [
      "La tienda puede usar almacenamiento local para recordar el carrito, la presentacion inicial y el estado temporal del checkout. El usuario puede borrar esta informacion desde la configuracion de su navegador.",
    ],
  },
  {
    title: "Derechos del titular",
    paragraphs: [
      "El titular puede solicitar acceso, actualizacion, rectificacion o eliminacion de sus datos mediante los canales de contacto publicados en la tienda, sujeto a las obligaciones legales de conservacion que correspondan.",
    ],
  },
];

export function TermsAndConditionsPage() {
  return <LegalDocument eyebrow="Informacion de compra" sections={termsSections} title="Terminos y condiciones" />;
}

export function PrivacyPolicyPage() {
  return <LegalDocument eyebrow="Proteccion de datos" sections={privacySections} title="Politica de privacidad" />;
}

function LegalDocument({ eyebrow, sections, title }: { eyebrow: string; sections: LegalSection[]; title: string }) {
  return (
    <AppShell>
      <article className="mx-auto max-w-4xl py-4 sm:py-8">
        <header className="border-b border-zinc-200 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800">{eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-normal sm:text-5xl">{title}</h1>
          <p className="mt-4 text-sm text-zinc-500">Ultima actualizacion: 11 de septiembre de 2026</p>
        </header>

        <div className="divide-y divide-zinc-200">
          {sections.map((section) => (
            <section className="grid gap-3 py-7 md:grid-cols-[14rem_1fr] md:gap-8" key={section.title}>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <div className="space-y-3 text-sm leading-7 text-zinc-600">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </AppShell>
  );
}
