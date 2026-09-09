import { motion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AuthStage,
  BrassButton,
  EngravedField,
  GildedCard,
  Notice,
  Plaque,
  UnderCard,
} from "../components/auth/AuthChrome";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage, getErrorStatus } from "../services/apiError";
import * as authService from "../services/authService";

type Mode = "login" | "signup";

/**
 * The two doors into LIFE, on one card.
 *
 * Login and signup keep their own URLs — people bookmark them and browsers remember them — but
 * they are the same object with two tabs, so choosing the other one turns a tab rather than
 * loading a different page.
 */
export function AuthDoors() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode: Mode = location.pathname === "/signup" ? "signup" : "login";

  return (
    <AuthStage>
      <GildedCard>
        <Plaque
          title="Life"
          subtitle={mode === "login" ? "Welcome back" : "Begin a life"}
        />

        <div className="mb-5 flex" role="tablist">
          <Tab
            active={mode === "login"}
            side="left"
            onClick={() => navigate("/login")}
          >
            Enter
          </Tab>
          <Tab
            active={mode === "signup"}
            side="right"
            onClick={() => navigate("/signup")}
          >
            Register
          </Tab>
        </div>

        {/*
          Both forms stay mounted side by side on a track that slides. Nothing unmounts, so
          nothing re-renders, nothing you half-typed is lost, and — because a flex row is as
          tall as its tallest child — the card is one fixed height that cannot jump between
          the two. The login form is centred in that height so its spare room looks deliberate.
        */}
        <div className="overflow-hidden">
          <motion.div
            className="flex w-full items-stretch"
            animate={{ x: mode === "login" ? "0%" : "-100%" }}
            transition={{ duration: 0.46, ease: [0.32, 0.72, 0.24, 1] }}
          >
            {/* Top-aligned, not centred. The row is as tall as the taller form, and centring
                the shorter one split its spare room above and below — which read as a gap
                under the tabs rather than as breathing space. Aligned to the top it sits where
                it belongs and the slack falls at the bottom, where nothing is looking. */}
            <div className="w-full shrink-0" aria-hidden={mode !== "login"}>
              <EnterForm active={mode === "login"} />
            </div>
            <div className="w-full shrink-0" aria-hidden={mode !== "signup"}>
              <RegisterForm active={mode === "signup"} />
            </div>
          </motion.div>
        </div>
      </GildedCard>

      <UnderCard>
        {mode === "login" ? (
          <>
            No life here yet?{" "}
            <Link
              to="/signup"
              className="underline decoration-[#A8863C] underline-offset-4"
            >
              Begin one
            </Link>
          </>
        ) : (
          <>
            Already have one?{" "}
            <Link
              to="/login"
              className="underline decoration-[#A8863C] underline-offset-4"
            >
              Let yourself in
            </Link>
          </>
        )}
      </UnderCard>
    </AuthStage>
  );
}

/**
 * A brass tab. The gilt itself is one element that *moves* between the two — a shared
 * `layoutId`, so React animates it from one tab to the other instead of fading one out and
 * another in. That is what makes the switch feel like one object rather than two.
 */
function Tab({
  active,
  side,
  onClick,
  children,
}: {
  active: boolean;
  side: "left" | "right";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="relative flex-1 py-2 text-[13px] tracking-[0.18em] uppercase transition-colors"
      style={{
        color: active ? "#2C1F0C" : "#BFA87E",
        // The recessed bed both tabs sit in — dark, like the pane it is cut into. Only the
        // gilt above it moves.
        backgroundImage:
          "linear-gradient(180deg, rgba(16,9,3,0.46) 0%, rgba(36,22,9,0.30) 100%)",
        border: "1px solid rgba(201,162,74,0.30)",
        borderRightWidth: side === "left" ? 0 : 1,
        borderRadius: side === "left" ? "2px 0 0 2px" : "0 2px 2px 0",
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
      }}
    >
      {active && (
        <motion.span
          layoutId="auth-tab-gilt"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #EBCE86 0%, #C9A24A 55%, #A8863C 100%)",
            borderRadius: side === "left" ? "2px 0 0 2px" : "0 2px 2px 0",
            boxShadow:
              "inset 0 1px 0 rgba(255,244,214,0.8), 0 2px 5px rgba(0,0,0,0.28)",
          }}
          transition={{ duration: 0.46, ease: [0.32, 0.72, 0.24, 1] }}
        />
      )}
      <span
        className="relative"
        style={{
          textShadow: active ? "0 1px 0 rgba(255,240,200,0.5)" : "none",
        }}
      >
        {children}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */

function EnterForm({ active }: { active: boolean }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setNeedsVerification(false);
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
      navigate("/room");
    } catch (err) {
      // 403 means the account exists but has not been verified — the one case where saying
      // more is helpful rather than a leak.
      setNeedsVerification(getErrorStatus(err) === 403);
      setError(getErrorMessage(err, "Could not let you in."));
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    setNotice(null);
    try {
      await authService.resendVerification(identifier.trim());
      setNotice("Sent. Look in your inbox again.");
    } catch (err) {
      setNotice(getErrorMessage(err, "Could not send it again."));
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5" inert={!active}>
      {error && <Notice>{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}

      {needsVerification && (
        <button
          type="button"
          onClick={onResend}
          className="w-full rounded-[2px] border py-1.5 text-[12px] tracking-[0.12em] uppercase"
          style={{ borderColor: "rgba(201,162,74,0.4)", color: "#D6C29C" }}
        >
          Send the verification letter again
        </button>
      )}

      <EngravedField
        label="Username or email"
        value={identifier}
        onChange={setIdentifier}
        autoComplete="username"
        placeholder="nadine, or nadine@…"
      />

      <EngravedField
        label="Password"
        type={reveal ? "text" : "password"}
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        right={<Reveal on={reveal} onToggle={() => setReveal((v) => !v)} />}
      />

      <div className="pt-1">
        <BrassButton
          busy={submitting}
          disabled={!identifier.trim() || !password}
        >
          Come in
        </BrassButton>
      </div>

      <p className="text-center text-[12px]">
        <Link
          to="/forgot"
          className="underline decoration-[#A8863C] underline-offset-4"
          style={{ color: "#A8916B" }}
        >
          Forgotten your password?
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

/** Mirrors the server's rule exactly, so the field can answer before the server is asked. */
const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,23}$/;

function RegisterForm({ active }: { active: boolean }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(true);

  const handle = useHandleCheck(username);

  const shaped = USERNAME_PATTERN.test(username);
  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit =
    email.trim().length > 3 &&
    shaped &&
    handle.state !== "taken" &&
    password.length >= 8 &&
    passwordsMatch;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await authService.signup(
        email.trim(),
        username.trim(),
        password,
      );
      setDelivered(result.delivered);
      setSentTo(email.trim());
    } catch (err) {
      setError(getErrorMessage(err, "Could not begin your life."));
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) return <LetterSent email={sentTo} delivered={delivered} />;

  // The two passwords sit side by side and the guidance lines only appear when they have
  // something to say. Four stacked fields each carrying a permanent hint made the card taller
  // than the window, and a sign-up form you have to scroll is a sign-up form people abandon.
  const passwordShort = password.length > 0 && password.length < 8;

  return (
    <form onSubmit={onSubmit} className="space-y-3.5" inert={!active}>
      {error && <Notice>{error}</Notice>}

      <EngravedField
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        placeholder="Only ever for signing in"
      />

      <EngravedField
        label="Username"
        value={username}
        onChange={setUsername}
        autoComplete="username"
        placeholder="How others will find you"
        note={handle.note}
        tone={handle.tone}
      />

      <div className="grid grid-cols-2 gap-3">
        <EngravedField
          label="Password"
          type={reveal ? "text" : "password"}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          note={passwordShort ? "Eight characters or more." : undefined}
          tone={passwordShort ? "bad" : undefined}
          right={<Reveal on={reveal} onToggle={() => setReveal((v) => !v)} />}
        />

        <EngravedField
          label="Again"
          type={reveal ? "text" : "password"}
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          note={
            confirm.length > 0 && !passwordsMatch ? "These differ." : undefined
          }
          tone={confirm.length > 0 && !passwordsMatch ? "bad" : undefined}
        />
      </div>

      <div className="pt-0.5">
        <BrassButton busy={submitting} disabled={!canSubmit}>
          Begin
        </BrassButton>
      </div>

      <p
        className="text-center text-[11.5px] leading-snug"
        style={{ color: "#A8916B" }}
      >
        Your email only signs you in. People find you by your username, which
        you can change whenever you like.
      </p>
    </form>
  );
}

/**
 * Asks the server whether a handle is free, but only once typing has stopped and only when the
 * shape is already valid — there is no point asking about something that cannot be accepted.
 */
function useHandleCheck(username: string) {
  const [state, setState] = useState<"idle" | "checking" | "free" | "taken">(
    "idle",
  );
  const seq = useRef(0);

  useEffect(() => {
    if (!USERNAME_PATTERN.test(username)) {
      setState("idle");
      return;
    }
    setState("checking");
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const free = await authService.isUsernameAvailable(username);
        // A slower earlier request must not overwrite a newer answer.
        if (seq.current === mine) setState(free ? "free" : "taken");
      } catch {
        if (seq.current === mine) setState("idle");
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [username]);

  if (username.length === 0)
    return { state, note: undefined, tone: undefined } as const;
  if (!USERNAME_PATTERN.test(username)) {
    return {
      state,
      note: "Letters, numbers and underscores. Start with a letter, 3–24 long.",
      tone: "bad",
    } as const;
  }
  if (state === "checking")
    return { state, note: "Checking…", tone: undefined } as const;
  if (state === "taken")
    return {
      state,
      note: "Someone already has that one.",
      tone: "bad",
    } as const;
  if (state === "free")
    return { state, note: `${username} is free.`, tone: "ok" } as const;
  return { state, note: undefined, tone: undefined } as const;
}

/**
 * The moment after registering.
 *
 * Usually a letter is on its way. Occasionally the server could not post it — the account is
 * made regardless, so this screen says which of the two happened rather than promising an
 * email that is never going to arrive. The button below is the same either way.
 */
function LetterSent({
  email,
  delivered,
}: {
  email: string;
  delivered: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <Envelope />
      <p
        className="mt-4 text-[15px] leading-relaxed"
        style={{ color: "#D6C29C" }}
      >
        {delivered ? "A letter is on its way to " : "Your account is made, but the letter to "}
        <span style={{ color: "#F4E9D2", overflowWrap: "anywhere" }}>
          {email}
        </span>
        {delivered ? ". Open it to unlock the door." : " could not be sent."}
      </p>
      <p className="mt-2 text-[12px]" style={{ color: "#A8916B" }}>
        {delivered
          ? "It keeps for twenty-four hours — and it often lands in spam, so look there too."
          : "Nothing is lost. Ask for it again below, and if it still will not go, the address may be one the mail service is not yet allowed to write to."}
      </p>

      {notice && (
        <div className="mt-4">
          <Notice tone="ok">{notice}</Notice>
        </div>
      )}

      <div className="mt-5">
        <BrassButton
          type="button"
          onClick={async () => {
            try {
              await authService.resendVerification(email);
              setNotice("Sent again.");
            } catch (err) {
              setNotice(getErrorMessage(err, "Could not send it again."));
            }
          }}
        >
          Send it again
        </BrassButton>
      </div>
    </motion.div>
  );
}

/** A sealed letter, drawn rather than fetched. */
export function Envelope() {
  return (
    <motion.svg
      viewBox="0 0 120 80"
      className="mx-auto block h-[76px] w-[114px]"
      aria-hidden
      initial={{ rotate: -3, y: -4 }}
      animate={{ rotate: [-3, 2, -3], y: [-4, 0, -4] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    >
      <rect
        x={4}
        y={8}
        width={112}
        height={66}
        rx={2}
        fill="#F6EEDC"
        stroke="var(--brass)"
        strokeWidth={1.2}
      />
      <path
        d="M4 10 L60 46 L116 10"
        fill="none"
        stroke="var(--brass)"
        strokeWidth={1.2}
      />
      <path
        d="M4 72 L44 42"
        fill="none"
        stroke="rgba(168,134,60,0.5)"
        strokeWidth={1}
      />
      <path
        d="M116 72 L76 42"
        fill="none"
        stroke="rgba(168,134,60,0.5)"
        strokeWidth={1}
      />
      <circle cx={60} cy={48} r={9} fill="var(--oxblood)" opacity={0.92} />
      <circle
        cx={60}
        cy={48}
        r={9}
        fill="none"
        stroke="rgba(58,20,16,0.5)"
        strokeWidth={0.8}
      />
      <text
        x={60}
        y={52}
        textAnchor="middle"
        fontSize={9}
        fill="rgba(255,238,214,0.85)"
        fontFamily="var(--serif)"
      >
        L
      </text>
    </motion.svg>
  );
}

/** A small eye that opens and closes, for showing what you typed. */
function Reveal({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={on ? "Hide password" : "Show password"}
      className="p-1 transition"
      style={{ color: "#A8916B" }}
    >
      <svg
        viewBox="0 0 24 16"
        className="h-4 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
      >
        <path d="M1 8 C6 1, 18 1, 23 8 C18 15, 6 15, 1 8 Z" />
        {on ? <circle cx={12} cy={8} r={3} /> : <path d="M3 2 L21 14" />}
      </svg>
    </button>
  );
}
