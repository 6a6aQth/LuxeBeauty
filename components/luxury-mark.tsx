import { cn } from "@/lib/utils"

type LuxuryMarkProps = {
  variant?: "page" | "inline"
  /** `button` sits beside an existing label. `block` centers the mark in the page. */
  size?: "button" | "block"
  /** `ink` is the white wordmark for a colored button. `paper` is the dark wordmark for a light surface. */
  tone?: "paper" | "ink"
  label?: string
  className?: string
}

export function LuxuryMark({
  variant = "inline",
  size = "block",
  tone = "paper",
  label,
  className,
}: LuxuryMarkProps) {
  if (variant === "page") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={label || "Loading"}
        className={cn("fixed inset-0 z-[80] flex items-center justify-center bg-black", className)}
      >
        <div className="relative flex flex-col items-center px-6">
          <div
            aria-hidden
            className="luxury-glow pointer-events-none absolute left-1/2 top-[46%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(233,30,99,0.42)_0%,rgba(233,30,99,0.12)_38%,transparent_70%)] blur-3xl"
          />
          <img
            src="/llogo-mark.png"
            alt=""
            className="luxury-breathe relative w-[min(84vw,440px)] mix-blend-screen"
          />
          {label ? (
            <p className="relative mt-8 text-[11px] font-light uppercase tracking-[0.34em] text-stone-400">
              {label}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  if (size === "button") {
    return (
      <img
        src="/llogo-mark.png"
        alt=""
        aria-hidden
        className={cn(
          "luxury-breathe h-6 w-auto max-w-[7rem] shrink-0 object-contain object-left",
          tone === "ink" ? "mix-blend-screen" : "luxury-paper",
          className,
        )}
      />
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || "Loading"}
      className={cn("flex flex-col items-center justify-center gap-3 py-8", className)}
    >
      <img
        src="/llogo-mark.png"
        alt=""
        className="luxury-breathe luxury-paper w-52 max-w-[78%]"
      />
      {label ? (
        <p className="text-[11px] font-light uppercase tracking-[0.28em] text-stone-400">{label}</p>
      ) : null}
    </div>
  )
}
