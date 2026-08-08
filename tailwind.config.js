/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a191e",
        foreground: "#ffffff",
        brand: {
          DEFAULT: "#f05a28",
          light: "#ff8c5a",
          dark: "#e04d1e",
        },
        surface: {
          DEFAULT: "#0a191e",
          card: "#0d2530",
          deep: "#081419",
          footer: "#060f13",
        },
        ink: {
          DEFAULT: "#ffffff",
          dim: "rgba(255, 255, 255, 0.50)",
        },
        rim: "rgba(255, 255, 255, 0.08)",
      },
    },
  },
  plugins: [],
};
