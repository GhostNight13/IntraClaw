import type { Config } from "tailwindcss";

/**
 * Tailwind v4 primarily uses CSS-first config via @theme in globals.css.
 * This file stays minimal and declares content globs for the IDE/plugin tooling.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
