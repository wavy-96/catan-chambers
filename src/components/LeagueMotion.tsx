"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *    0ms   selected screen fades in, offset 10px → 0
 *   55ms   successive visible cards settle (55ms stagger)
 *  120ms   score values begin counting to the saved total
 * On tap  the navigation highlight springs to the selected tab
 * Reduced motion: content and values appear immediately.
 * ───────────────────────────────────────────────────────── */
const TIMING = {
  screenEnter: 0, // respond immediately to navigation
  cardStagger: 55, // small offset between adjacent cards
  numberStart: 120, // count after the card begins settling
};
const SCREEN = {
  offset: 10,
  spring: { type: "spring" as const, stiffness: 350, damping: 32 },
  exit: { duration: 0.1 },
};
const CARD = {
  offset: 14,
  maxStagger: 4,
  spring: { type: "spring" as const, stiffness: 350, damping: 29 },
};
const NUMBER = { duration: 0.65, ease: "easeOut" as const };
const TAB = { type: "spring" as const, stiffness: 450, damping: 34 };
const STILL = { duration: 0 };

export function MotionPage({
  children,
  className,
  direction = 0,
}: {
  children: ReactNode;
  className?: string;
  direction?: number;
}) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setStage(1), TIMING.screenEnter);
    return () => clearTimeout(timer);
  }, []);
  return (
    <motion.div
      className={className}
      initial={
        reduced
          ? false
          : {
              opacity: 0,
              x: direction * SCREEN.offset,
              y: direction ? 0 : SCREEN.offset,
            }
      }
      animate={{ opacity: reduced || stage >= 1 ? 1 : 0, x: 0, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, transition: SCREEN.exit }}
      transition={reduced ? STILL : SCREEN.spring}
    >
      {children}
    </motion.div>
  );
}

export function Reveal({
  children,
  className,
  index = 0,
  style,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(
      () => setStage(1),
      Math.min(index, CARD.maxStagger) * TIMING.cardStagger,
    );
    return () => clearTimeout(timer);
  }, [visible, index]);
  return (
    <motion.div
      ref={ref}
      layout={reduced ? false : "position"}
      className={className}
      style={style}
      initial={reduced ? false : { opacity: 0, y: CARD.offset }}
      animate={{
        opacity: reduced || stage >= 1 ? 1 : 0,
        y: reduced || stage >= 1 ? 0 : CARD.offset,
      }}
      transition={reduced ? STILL : CARD.spring}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const current = useMotionValue(0);
  const display = useTransform(current, (n) =>
    Number.isInteger(value) ? Math.round(n).toString() : n.toFixed(1),
  );
  useEffect(() => {
    if (reduced) {
      current.set(value);
      return;
    }
    if (!visible) return;
    const animation = animate(current, value, {
      ...NUMBER,
      delay: TIMING.numberStart / 1000,
    });
    return () => animation.stop();
  }, [current, value, visible, reduced]);
  return (
    <span ref={ref} className="animated-number">
      <span className="sr-only">{value}</span>
      <motion.span aria-hidden="true">{display}</motion.span>
    </span>
  );
}

export function TabIndicator() {
  const reduced = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      className="nav-highlight"
      layoutId="chambers-navigation"
      transition={reduced ? STILL : TAB}
    />
  );
}
