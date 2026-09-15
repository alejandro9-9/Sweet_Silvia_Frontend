export function BrandLogo({ className = "w-40", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span aria-label="Sweet Silvia Store" className={`relative inline-block aspect-[688/286] overflow-hidden ${className}`}>
      <img
        alt="Sweet Silvia Store"
        className="absolute inset-0 h-full w-full object-cover"
        loading={priority ? "eager" : "lazy"}
        src="/sweet-silvia-logo.png"
        style={{ objectPosition: "50% 52.3%" }}
      />
    </span>
  );
}
