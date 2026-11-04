import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"), surface: v("surface"), raised: v("raised"), line: v("line"),
        ink: v("ink"), muted: v("muted"), brand: v("brand"), brand2: v("brand2"),
        good: v("good"), bad: v("bad"), warn: v("warn"),
      },
      fontFamily: {
        sans: ['"Inter Variable"', "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        display: ['"Inter Variable"', "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(var(--shadow) / .06), 0 8px 24px -8px rgb(var(--shadow) / .12)",
        lift: "0 2px 4px rgb(var(--shadow) / .08), 0 18px 40px -12px rgb(var(--shadow) / .25)",
        glow: "0 0 0 4px rgb(var(--brand) / .15)",
      },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "none" } },
        pop: { "0%": { transform: "scale(.96)" }, "60%": { transform: "scale(1.02)" }, "100%": { transform: "scale(1)" } },
        shake: { "0%,100%": { transform: "none" }, "25%": { transform: "translateX(-5px)" }, "75%": { transform: "translateX(5px)" } },
        reveal: { "0%": { opacity: "0", transform: "translateY(-6px)", maxHeight: "0" }, "100%": { opacity: "1", transform: "none", maxHeight: "600px" } },
        sheet: { "0%": { transform: "translateY(100%)" }, "100%": { transform: "none" } },
      },
      animation: {
        rise: "rise .5s cubic-bezier(.2,.8,.2,1) both",
        pop: "pop .3s ease-out",
        shake: "shake .35s ease-in-out",
        reveal: "reveal .4s ease-out both",
        sheet: "sheet .32s cubic-bezier(.2,.8,.2,1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
