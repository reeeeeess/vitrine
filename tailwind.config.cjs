const path = require("node:path");

// The look of Movix (by mysticsaba): black, white at low opacity for surfaces, red for actions,
// Inter for text and Archivo Black for display titles, and the same entrance animations.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [path.join(__dirname, "src/renderer/**/*.{ts,tsx,html}")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Archivo Black", "Inter", "sans-serif"],
      },
      colors: {
        gray: { 950: "#030712" },
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
