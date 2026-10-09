import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#f1f5fe", 100: "#e1eafd", 500: "#3b64e8", 600: "#2c4fc9", 700: "#243fa3" },
      },
    },
  },
  plugins: [],
} satisfies Config;
