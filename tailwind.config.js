// Tailwind v4 config (plugin-only usage)
// Keep HeroUI plugin and ensure our project files are scanned.
const { heroui } = require("@heroui/theme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Note: In Tailwind v4, content is optional, but some plugins still rely on it.
  // Include app, components, lib, and pages to avoid class pruning.
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    // HeroUI generated components (drawer/modal)
    "./node_modules/@heroui/theme/dist/components/(drawer|modal).js",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [heroui()],
};
