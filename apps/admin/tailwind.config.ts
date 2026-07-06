import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "#e2e8f0",
        background: "#f8fafc",
        foreground: "#0f172a",
        primary: "#16a34a",
        muted: "#64748b"
      },
      borderRadius: {
        lg: "8px",
        md: "6px"
      }
    }
  },
  plugins: []
};

export default config;
