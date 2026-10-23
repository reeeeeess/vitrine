// One way of moving for everything that opens or answers a gesture (after Apple Music): a spring with
// barely a bounce. Pages keep mysticsaba.com's curve.
import type { Transition } from "framer-motion";

/** opening, closing, the artwork breathing with the music */
export const SPRING: Transition = { type: "spring", stiffness: 260, damping: 24, mass: 0.9 };

/** mysticsaba.com's curve, for pages and fades */
export const EASE = [0.22, 1, 0.36, 1] as const;
