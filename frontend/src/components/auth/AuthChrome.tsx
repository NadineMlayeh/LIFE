import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { Curtains } from "./Curtains";

/**
 * The Victorian chrome for the doors into LIFE.
 *
 * This is the first thing anyone ever sees, and the room behind it is generated entirely from
 * code — so this is too. Every ornament here is an SVG path or a CSS gradient: gilt is drawn
 * as a metal *gradient* rather than painted a flat yellow, because what makes brass read as
 * brass is a bright edge above a dark one, not the hue.
 *
 * The parts:
 *  - `AuthStage`  — the dark room the card sits in, with lamplight and papered walls
 *  - `GildedCard` — the framed cartouche itself
 *  - `Plaque`     — engraved title and rule
 *  - `EngravedField` — a recessed plate you write on
 *  - `BrassButton`   — a struck, bevelled plate
 */

/**
 * The pane is **dark**, and that is the whole reason it can read as glass.
 *
 * Glass shows you what is behind it. A cream panel over a dark brown room cannot: at 0.85 it
 * is still cream, and by the time it is transparent enough to show the room, dark ink on it
 * has no contrast left. The way out is the one every real smoked-glass panel takes — make the
 * pane dark and the writing light. Then transparency and legibility pull in the same
 * direction instead of against each other, because the room behind is dark too.
 */
const GLASS = {
  ink: "#F4E9D2",
  soft: "#D6C29C",
  faint: "#A8916B",
  line: "rgba(201,162,74,0.30)",
} as const;

/* -------------------------------------------------------------------------- */
/*  Ornament                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A corner fleuron — the scrolled acanthus that finishes a printed border. One path, mirrored
 * into all four corners, which is exactly how a real engraver's block was reused.
 */
function Fleuron({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const flipX = corner === "tr" || corner === "br";
  const flipY = corner === "bl" || corner === "br";

  return (
    <svg
      viewBox="0 0 60 60"
      aria-hidden
      className="pointer-events-none absolute h-[46px] w-[46px]"
      style={{
        top: corner.startsWith("t") ? 6 : undefined,
        bottom: corner.startsWith("b") ? 6 : undefined,
        left: corner.endsWith("l") ? 6 : undefined,
        right: corner.endsWith("r") ? 6 : undefined,
        transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
        opacity: 0.85,
      }}
    >
      <g
        fill="none"
        stroke="var(--brass)"
        strokeWidth={1.1}
        strokeLinecap="round"
      >
        <path d="M2 22 C2 10, 10 2, 22 2" />
        <path d="M7 24 C7 14, 14 7, 24 7" opacity={0.65} />
        {/* the scroll curling back on itself */}
        <path d="M22 7 C31 7, 34 12, 31 16 C29 19, 24 18, 24 14 C24 11, 27 10, 29 12" />
        <path d="M7 24 C7 33, 12 36, 16 33 C19 31, 18 26, 14 26 C11 26, 10 29, 12 31" />
      </g>
      <circle cx={22} cy={22} r={1.6} fill="var(--brass-lit)" />
    </svg>
  );
}

/** A printer's flourish: a rule that swells at the centre and ends in a lozenge. */
export function Flourish({ width = 200 }: { width?: number }) {
  return (
    <svg
      viewBox="0 0 200 14"
      width={width}
      height={14}
      aria-hidden
      className="mx-auto block"
      style={{ maxWidth: "100%" }}
    >
      <g
        stroke="var(--brass)"
        fill="none"
        strokeWidth={1}
        strokeLinecap="round"
      >
        <path d="M6 7 H78" opacity={0.75} />
        <path d="M122 7 H194" opacity={0.75} />
        <path d="M84 7 C90 2, 96 2, 100 7 C104 12, 110 12, 116 7" />
      </g>
      <path d="M100 3.4 L103 7 L100 10.6 L97 7 Z" fill="var(--brass-lit)" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  The room the card stands in                                                */
/* -------------------------------------------------------------------------- */

/**
 * An evening interior: papered walls, a warm pool of lamplight behind the card, and darkness
 * at the edges. The vignette is doing real work — it is what stops a gold card on a dark field
 * from looking like a button floating in space.
 */
export function AuthStage({ children }: { children: ReactNode }) {
  const patternId = useId();

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-6"
      // A warmer base than pure dark brown: the whole card is gold, and gold on a cold ground
      // looks like jewellery on velvet rather than a lit room.
      style={{ backgroundColor: "#241708" }}
    >
      {/* Papered wall. A damask motif at low contrast — you should feel it rather than see it,
          the way a real wallpaper reads across a dark room. It is also the only structure the
          glass card has to reveal, so it carries more weight than decoration: if this were any
          fainter, there would be nothing to see through the pane and no transparency to read. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <defs>
          <pattern
            id={patternId}
            width="80"
            height="110"
            patternUnits="userSpaceOnUse"
          >
            <g fill="none" stroke="#E0B368" strokeWidth={1} opacity={0.11}>
              <path d="M40 8 C54 22, 54 38, 40 52 C26 38, 26 22, 40 8 Z" />
              <path d="M40 58 C50 68, 50 82, 40 92 C30 82, 30 68, 40 58 Z" />
              <path d="M0 55 C10 62, 14 74, 10 86" />
              <path d="M80 55 C70 62, 66 74, 70 86" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      {/* Drapes, hung against the papered wall. Deliberately *under* the lamplight below, so
          the glow falls across the cloth as it would in the room rather than behind it. */}
      <Curtains />

      {/* Lamplight. Two sources, warm, offset — a single centred glow reads as a spotlight. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            // The main pool the card sits in, then the two lamps, then a low wash of warmth
            // lying across the whole wall. The wash is what turns three separate glows into
            // one lit room.
            "radial-gradient(64% 52% at 50% 36%, rgba(255,198,118,0.36), transparent 72%)," +
            "radial-gradient(34% 30% at 15% 20%, rgba(255,170,78,0.26), transparent 70%)," +
            "radial-gradient(34% 30% at 86% 24%, rgba(255,170,78,0.22), transparent 70%)," +
            "radial-gradient(120% 90% at 50% 58%, rgba(190,116,44,0.20), transparent 70%)",
        }}
        // A gas lamp is never quite still. Slow and shallow, or it reads as a fault.
        animate={{ opacity: [0.92, 1, 0.95, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Darkness closing in at the corners. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            // Pulled back from the centre so the glow has room to read before the dark closes
            // in, and browner than black so the shadows stay warm.
            "radial-gradient(86% 78% at 50% 44%, transparent 46%, rgba(26,13,4,0.86) 100%)",
        }}
      />

      <div className="relative w-full max-w-[26rem]">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  The card                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The framed cartouche. Three nested edges do the work of a real gilt frame: a metal gradient
 * on the outside, a dark channel, then a hairline rule inside the parchment — the same
 * arrangement as a bound cover, and the reason the border reads as thickness rather than as a
 * coloured outline.
 */
export function GildedCard({ children }: { children: ReactNode }) {
  const grainId = useId();

  return (
    <motion.div
      initial={{ opacity: 0, y: 26, rotateX: 9 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.72, ease: [0.2, 0.7, 0.3, 1] }}
      style={{ transformPerspective: 1400, transformOrigin: "center top" }}
      className="relative"
    >
      {/*
        The glass itself, sitting directly on the room. Nothing opaque is layered behind it.

        The frame used to be its parent, and a parent paints its background across its whole
        box — including behind the pane. That was fine while the pane was nearly opaque, but at
        this transparency you would be looking through the glass at the frame's own gold rather
        than at the room. So the frame is now an overlay drawn *around* the glass, further
        down, with a genuinely empty middle.
      */}
      <div
        className="relative overflow-hidden rounded-[4px] px-6 pt-6 pb-6"
        style={{
          backgroundImage:
            "radial-gradient(130% 100% at 50% 0%, rgba(40,32,22,0.24) 0%," +
            "rgba(24,19,12,0.18) 52%, rgba(13,10,6,0.26) 100%)",
          /*
            `backdrop-filter` blurs whatever is painted behind the element — which is now the
            room, because nothing else is in the way.

            Two settings here are deliberate and were both wrong before:

            **The blur is gentle.** At 26px it erased the wall's damask, and the damask is the
            only structure behind the card. Blur away the thing the glass is supposed to reveal
            and no amount of transparency reads as transparent — you just get a flat tinted
            rectangle. Transparency is only legible when there is something behind it to see.

            **Saturation is pulled slightly down, never up.** `saturate(1.4)` intensified an
            already warm brown wall into orange, and that orange then sat over the whole card.
            Anything above 1 here tips the room straight into orange.
          */
          backdropFilter: "blur(2px) saturate(0.97) brightness(0.9)",
          WebkitBackdropFilter: "blur(2px) saturate(0.97) brightness(0.9)",
          boxShadow:
            "0 30px 70px rgba(0,0,0,0.62), 0 6px 16px rgba(0,0,0,0.45)," +
            "inset 0 1px 0 rgba(255,225,170,0.26), inset 0 -1px 0 rgba(0,0,0,0.35)",
        }}
      >
        {/* The light lying across the top of the pane, as on any piece of glass. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{
            background:
              "linear-gradient(158deg, rgba(255,247,232,0.13) 0%, rgba(255,247,232,0.035) 40%, transparent 66%)",
          }}
        />

        {/* A breath of dust and imperfection in the glass, so it is not a flat wash. */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <filter id={grainId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter={`url(#${grainId})`} opacity={0.028} />
        </svg>

        {/* The inner hairline rule, inset the way a printed border sits in from the trim. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[9px] rounded-[1px]"
          style={{ border: "1px solid rgba(201,162,74,0.34)" }}
        />

        <Fleuron corner="tl" />
        <Fleuron corner="tr" />
        <Fleuron corner="bl" />
        <Fleuron corner="br" />

        <div className="relative">{children}</div>
      </div>

      {/*
        The gilt frame and its dark channel, drawn as rings *over* the edge of the glass.

        The mask is what makes the middle genuinely empty: two identical fills, one clipped to
        the padding box and one to the border box, composited so they cancel everywhere except
        the border itself. It is the standard recipe for a gradient border that does not fill
        what it surrounds — and a mask applies to an element's descendants too, which is why
        these are childless overlays rather than wrappers.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[4px]"
        style={{
          border: "3px solid transparent",
          backgroundImage:
            "linear-gradient(155deg, #E4C579 0%, #A8863C 26%, #6E5322 52%," +
            "#C9A24A 74%, #7A5B26 100%)",
          backgroundOrigin: "border-box",
          WebkitMask:
            "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[3px] rounded-[2px]"
        style={{ border: "2px solid rgba(38,26,11,0.62)" }}
      />
    </motion.div>
  );
}

/** The engraved title block: name, rule, and a line of small caps beneath. */
export function Plaque({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-5 text-center">
      <h1
        className="text-[26px] leading-none tracking-[0.10em] uppercase"
        style={{
          color: GLASS.ink,
          // Cut *into* a dark surface rather than raised off a light one, so the shadow goes
          // above the letter and the catch-light below it — the reverse of the paper panels.
          textShadow:
            "0 -1px 0 rgba(0,0,0,0.55), 0 1px 0 rgba(255,224,163,0.28)",
        }}
      >
        {title}
      </h1>
      <div className="mt-2">
        <Flourish width={170} />
      </div>
      <p className="small-caps mt-1.5" style={{ color: GLASS.soft }}>
        {subtitle}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Controls                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A field as a recessed plate: the light falls from above, so the top inner edge is dark and
 * the bottom is bright. Inverting those two shadows is the entire difference between something
 * that looks pressed *in* and something that looks stuck *on*.
 */
export function EngravedField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  note,
  tone,
  right,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  /** A line under the field — a hint, or why it was refused. */
  note?: string;
  tone?: "ok" | "bad";
  /** Something small at the right-hand end, such as a reveal toggle. */
  right?: ReactNode;
}) {
  const id = useId();

  return (
    <label htmlFor={id} className="block">
      <span className="small-caps mb-1 block" style={{ color: GLASS.soft }}>
        {label}
      </span>

      <div
        className="relative flex items-center rounded-[2px] transition"
        style={{
          // A recess cut into dark glass: shadow along the top inside edge, a thin warm
          // catch-light along the bottom. The same two-shadow rule as before, inverted for a
          // dark surface.
          backgroundImage:
            "linear-gradient(180deg, rgba(6,4,2,0.30) 0%, rgba(14,11,7,0.14) 70%," +
            "rgba(20,16,10,0.10) 100%)",
          border: `1px solid ${GLASS.line}`,
          boxShadow:
            "inset 0 2px 5px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,224,163,0.16)",
        }}
      >
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="glass-field w-full bg-transparent px-3 py-1.5 text-[15px] outline-none placeholder:italic"
          style={{ color: GLASS.ink, caretColor: "var(--brass-lit)" }}
        />
        {right && <div className="shrink-0 pr-2">{right}</div>}
      </div>

      {note && (
        <p
          className="mt-0.5 text-[11.5px] leading-snug"
          style={{
            // Oxblood and forest vanish on a dark pane; these carry the same two meanings at
            // a lightness that can actually be read here.
            color:
              tone === "bad"
                ? "#E8927F"
                : tone === "ok"
                  ? "#9DC49B"
                  : GLASS.faint,
          }}
        >
          {note}
        </p>
      )}
    </label>
  );
}

/**
 * A struck brass plate. Raised by a light top edge over a dark bottom one, and it *sinks* when
 * pressed by swapping them — the press is what makes it feel like metal rather than a
 * rectangle that changes colour.
 */
export function BrassButton({
  children,
  busy,
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  const off = busy || disabled;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={off}
      whileHover={off ? undefined : { y: -1 }}
      whileTap={off ? undefined : { y: 1 }}
      transition={{ duration: 0.12 }}
      className="relative w-full overflow-hidden rounded-[2px] px-4 py-2.5 text-[15px] tracking-[0.16em] uppercase disabled:opacity-55"
      style={{
        color: "#2C1F0C",
        backgroundImage:
          "linear-gradient(180deg, #EBCE86 0%, #C9A24A 38%, #A8863C 62%, #8A6A2C 100%)",
        border: "1px solid #6E5322",
        boxShadow:
          "inset 0 1px 0 rgba(255,244,214,0.85), inset 0 -2px 3px rgba(58,32,8,0.35)," +
          "0 3px 8px rgba(0,0,0,0.42)",
        textShadow: "0 1px 0 rgba(255,240,200,0.55)",
      }}
    >
      {/* A shine that crosses the plate on hover, as a light would over polished metal. */}
      {!off && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3"
          style={{
            background:
              "linear-gradient(100deg, transparent, rgba(255,247,222,0.55), transparent)",
          }}
          initial={{ left: "-40%" }}
          whileHover={{ left: "120%" }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        />
      )}
      <span className="relative">{busy ? "One moment…" : children}</span>
    </motion.button>
  );
}

/** A quiet line of text under the card — the way out to the other door. */
export function UnderCard({ children }: { children: ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="mt-5 text-center text-[13px] text-[#C8B189]"
    >
      {children}
    </motion.p>
  );
}

/** Something has gone wrong: a wax-red note pressed into the paper. */
export function Notice({
  children,
  tone = "bad",
}: {
  children: ReactNode;
  tone?: "bad" | "ok";
}) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-[2px] px-3 py-2 text-[13px] leading-snug"
      style={{
        color: tone === "bad" ? "#F0A392" : "#A9CFA6",
        backgroundColor:
          tone === "bad" ? "rgba(150,58,44,0.22)" : "rgba(70,102,74,0.22)",
        border: `1px solid ${tone === "bad" ? "rgba(226,140,120,0.38)" : "rgba(150,196,148,0.34)"}`,
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </motion.p>
  );
}
