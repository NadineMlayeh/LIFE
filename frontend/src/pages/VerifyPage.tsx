import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AuthStage,
  BrassButton,
  Flourish,
  GildedCard,
  Notice,
  Plaque,
  UnderCard,
} from "../components/auth/AuthChrome";
import { getErrorMessage } from "../services/apiError";
import * as authService from "../services/authService";

type Status = "verifying" | "success" | "error";

/** Where the letter's link lands: the seal is broken and the door opens, or it does not. */
export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    if (!token) {
      setStatus("error");
      setMessage("This link is missing its token.");
      return;
    }

    authService
      .verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          getErrorMessage(err, "This link is not valid, or it has expired."),
        );
      });
  }, [token]);

  return (
    <AuthStage>
      <GildedCard>
        <Plaque
          title="Life"
          subtitle={
            status === "verifying"
              ? "Breaking the seal"
              : status === "success"
                ? "The door is open"
                : "The seal did not hold"
          }
        />

        <div className="text-center">
          <Seal status={status} />

          {status === "verifying" && (
            <p className="mt-4 text-[14px] italic" style={{ color: "#A8916B" }}>
              One moment…
            </p>
          )}

          {status !== "verifying" && (
            <>
              <div className="mt-4">
                {status === "error" ? (
                  <Notice>{message}</Notice>
                ) : (
                  <p
                    className="text-[15px] leading-relaxed"
                    style={{ color: "#D6C29C" }}
                  >
                    {message}
                  </p>
                )}
              </div>

              <div className="my-5">
                <Flourish width={160} />
              </div>

              <Link
                to={status === "success" ? "/login" : "/signup"}
                className="block"
              >
                <BrassButton type="button">
                  {status === "success" ? "Let yourself in" : "Try again"}
                </BrassButton>
              </Link>
            </>
          )}
        </div>
      </GildedCard>

      <UnderCard>
        {status === "success" ? (
          "Your room is waiting."
        ) : (
          <>
            Already verified?{" "}
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
 * A wax seal that breaks when the link is accepted. The two halves part and settle — the whole
 * screen is one moment, so it is worth animating properly rather than swapping an icon.
 */
function Seal({ status }: { status: Status }) {
  const broken = status === "success";
  const failed = status === "error";

  return (
    <div className="relative mx-auto h-[92px] w-[92px]">
      {/* The ribbon the seal was pressed onto. */}
      <svg viewBox="0 0 92 92" className="absolute inset-0" aria-hidden>
        <path
          d="M46 4 L46 88"
          stroke="rgba(122,59,51,0.28)"
          strokeWidth={16}
          strokeLinecap="butt"
        />
      </svg>

      {[-1, 1].map((side) => (
        <motion.svg
          key={side}
          viewBox="0 0 92 92"
          className="absolute inset-0"
          aria-hidden
          initial={{ x: 0, rotate: 0, opacity: 1 }}
          animate={
            broken
              ? { x: side * 17, rotate: side * 13, opacity: 1 }
              : failed
                ? { x: 0, rotate: 0, opacity: 0.55 }
                : { x: 0, rotate: 0 }
          }
          transition={{
            duration: 0.8,
            ease: [0.2, 0.8, 0.3, 1],
            delay: broken ? 0.15 : 0,
          }}
        >
          {/* Each copy shows only its own half, so together they read as one seal until it
              splits. */}
          <defs>
            <clipPath id={`half-${side}`}>
              <rect x={side < 0 ? 0 : 46} y={0} width={46} height={92} />
            </clipPath>
          </defs>
          <g clipPath={`url(#half-${side})`}>
            <circle
              cx={46}
              cy={46}
              r={26}
              fill={failed ? "#6E6156" : "#8E4238"}
              stroke="rgba(24,8,6,0.7)"
              strokeWidth={1.2}
            />
            <circle
              cx={46}
              cy={46}
              r={21}
              fill="none"
              stroke="rgba(255,232,214,0.25)"
              strokeWidth={1}
            />
            <text
              x={46}
              y={53}
              textAnchor="middle"
              fontSize={22}
              fill="rgba(255,238,214,0.9)"
              fontFamily="var(--serif)"
            >
              L
            </text>
          </g>
        </motion.svg>
      ))}
    </div>
  );
}
