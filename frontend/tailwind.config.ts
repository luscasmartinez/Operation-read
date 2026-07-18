import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        panel: {
          DEFAULT: "#12161c",
          light: "#1a2029",
          border: "#242c38",
        },
        accent: {
          DEFAULT: "#3ea6ff",
          muted: "#2c7bc4",
        },
      },
      boxShadow: {
        panel: "0 8px 32px rgba(0,0,0,0.45)",
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-in": "slideIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideIn: {
          "0%": { transform: "translateX(-12px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
