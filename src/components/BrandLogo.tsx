import Image from "next/image";

export function BrandLogo({ className = "w-40", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span aria-label="Sweet Silvia Store" className={`relative inline-block aspect-[688/254] overflow-hidden ${className}`}>
      <Image
        alt="Sweet Silvia Store"
        className="object-cover"
        fill
        priority={priority}
        sizes="160px"
        src="/sweet-silvia-logo.png"
        style={{ objectPosition: "50% 52%" }}
      />
    </span>
  );
}
