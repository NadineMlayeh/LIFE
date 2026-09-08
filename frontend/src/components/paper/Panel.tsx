import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";

/**
 * Content opens *in* the room, never instead of it. The room stays rendered behind, pushed
 * out of focus, and the content arrives as a sheet of paper settling onto it.
 *
 * `variant` decides how the paper behaves:
 *  - `sheet`   a single page — identity, notes, most forms
 *  - `spread`  a two-page book opening — the library
 *  - `scroll`  a tall narrow column — the timeline
 */
export type PanelVariant = "sheet" | "spread" | "scroll";

const WIDTHS: Record<PanelVariant, string> = {
  sheet: "max-w-2xl",
  spread: "max-w-5xl",
  scroll: "max-w-xl",
};

export function Panel({
  open,
  onClose,
  title,
  subtitle,
  variant = "sheet",
  actions,
  steady,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  variant?: PanelVariant;
  /** Rendered in the header's right-hand side — usually a privacy control. */
  actions?: ReactNode;
  /**
   * Hold the sheet at one height regardless of what is on it.
   *
   * For a panel with tabs this is the difference between a document and a jumping box: a short
   * tab and a long one otherwise resize the paper under the reader's hands, and the tabs
   * themselves move as a result. The body scrolls inside the fixed height instead.
   */
  steady?: boolean;
  children: ReactNode;
}) {
  // Escape closes, and the room shouldn't scroll behind an open sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
        >
          {/* The room, dimmed and defocused rather than replaced. */}
          {/* A plain wash, not a backdrop-filter. `backdrop-blur` re-blurs everything behind it
              on every repaint, so each keystroke in the form re-filtered the entire room. */}
          <motion.button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default"
            style={{ backgroundColor: "rgba(44, 32, 18, 0.55)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            /* The sheet must never exceed the window. Without a cap it grew past the viewport
               and flex-centred itself, putting the header and the search out of reach with no
               way to scroll to them. */
            className={`relative flex max-h-[calc(100dvh-3rem)] w-full ${WIDTHS[variant]} flex-col rounded-[5px]`}
            initial={{ opacity: 0, y: 26, scale: 0.985, rotateX: 6 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 14, scale: 0.99 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 30,
              mass: 0.9,
            }}
            style={{
              transformPerspective: 1200,
              // The moulding itself: real width, so the frame has somewhere to be.
              padding: 13,
              backgroundImage:
                "linear-gradient(138deg, #F2DCA6 0%, #C9A24A 16%, #8A6A2C 34%, #E8CE8C 52%," +
                "#A8863C 70%, #6E5322 88%, #C9A24A 100%)",
              boxShadow: `${FRAME_PROFILE}, 0 24px 58px rgba(0,0,0,0.48), 0 5px 14px rgba(0,0,0,0.3)`,
            }}
          >
            {/* The sheet the moulding holds. Its own element now, so the frame can have real
                width without the paper's texture running underneath it. */}
            <div className="paper relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1px]">
              <PaperEdge />

              <header className="flex shrink-0 items-start justify-between gap-4 px-8 pt-7 pb-4">
                <div>
                  {subtitle && <p className="small-caps mb-1">{subtitle}</p>}
                  <h2 className="display text-[26px] leading-tight">{title}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {actions}
                  <button
                    onClick={onClose}
                    className="quiet-button"
                    aria-label="Close"
                  >
                    Close
                  </button>
                </div>
              </header>

              <div className="mx-8 hairline-double shrink-0" />

              {/*
              A steady panel is a fixed height and scrolls inside it; an ordinary one takes
              whatever is left in the capped sheet.

              `shrink-0` rather than `flex-1` is load-bearing. In a flex column `flex: 1 1 0%`
              sets the basis to zero and lets the item grow, which silently overrides an
              explicit `height` — the fixed size was being set and then ignored.
            */}
              <div
                className={`paper-scroll overflow-y-auto px-8 py-6 ${
                  steady ? "shrink-0" : "min-h-0 flex-1"
                }`}
                style={
                  steady
                    ? { height: "min(36rem, 70vh)" }
                    : { minHeight: "min(22rem, 40vh)" }
                }
              >
                {children}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The gilt frame around every document — a moulding, not an outline.
 *
 * A picture frame is a *profile*: an outer edge catching the light, a face, a groove, a lip
 * stepping down to what it holds. A flat 2px line cannot read as that, whatever the gold.
 *
 * Built from inset shadows on a padded surface, each ring one step further in than the last.
 * **Four rings, not eight** — the first attempt stacked every bevel a real moulding has and
 * the result was busy rather than rich. One groove is enough to say "carved"; past that they
 * stop reading as depth and start reading as stripes.
 */
const FRAME_PROFILE = [
  // the bright outer edge, and the dark it turns into underneath
  "inset 0 0 0 1px rgba(255,246,214,0.8)",
  "inset 0 0 0 2px rgba(132,98,40,0.5)",
  // one groove across the face — a single step is all it takes to read as moulded
  "inset 0 0 0 7px rgba(96,70,26,0.45)",
  // the lip that meets the paper
  "inset 0 0 0 8px rgba(255,240,198,0.5)",
].join(",");

/**
 * A torn deckle down both sides of the sheet, drawn as a repeating gradient rather than an
 * image. Small thing, but a perfectly straight edge is what makes paper read as a div.
 */
function PaperEdge() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[6px]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(160,132,86,0.22) 0 3px, transparent 3px 7px, rgba(160,132,86,0.12) 7px 10px, transparent 10px 15px)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[6px]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(160,132,86,0.18) 0 4px, transparent 4px 9px, rgba(160,132,86,0.14) 9px 12px, transparent 12px 16px)",
        }}
      />
    </>
  );
}
