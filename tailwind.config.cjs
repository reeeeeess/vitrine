const path = require("node:path");

// Two looks, both by mysticsaba: "movix" (black, red, Inter and Archivo Black) and "mystic"
// (mysticsaba.com: warm black, cream, amber to red, Clash Display, Satoshi and JetBrains Mono).
// As in Movix, the colours the components use are read from CSS variables that each theme sets
// (src/renderer/styles.css), so a theme changes them without touching a component.
const themable = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const shades = (family, steps) => Object.fromEntries(steps.map((step) => [step, themable(`${family}-${step}`)]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [path.join(__dirname, "src/renderer/**/*.{ts,tsx,html}")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        white: themable("white"),
        black: themable("black"),
        gray: shades("gray", [300, 400, 500, 600, 700, 800, 950]),
        red: shades("red", [100, 200, 300, 400, 500, 600, 900]),
        panel: themable("panel"),
        "accent-fg": themable("accent-fg"),
      },
      borderRadius: {
        btn: "var(--radius-btn)",
      },
      animation: {
        fadeIn: "fadeIn 0.5s ease-in-out",
        "card-enter": "cardEnter 0.3s ease-out both",
        "skeleton-fade": "skeletonFade 0.3s ease-out",
        "slow-pan": "slowPan 40s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0", transform: "translateY(-20px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        cardEnter: { "0%": { opacity: "0", transform: "translateY(20px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        skeletonFade: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slowPan: { "0%": { transform: "scale(1.25) translate(-3%, -2%)" }, "100%": { transform: "scale(1.35) translate(3%, 2%)" } },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
