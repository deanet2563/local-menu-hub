/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        moss: {
          DEFAULT: "#3f6b4a",
          deep: "#28432f",
          soft: "#e6ede4",
        },
        clay: {
          DEFAULT: "#c9793e",
          deep: "#a85f2c",
          soft: "#faeadb",
        },
        ink: {
          DEFAULT: "#232620",
          soft: "#6b7166",
          faint: "#a3a99c",
        },
        cream: "#f7f5f0",
      },
      fontFamily: {
        community: ["Noto Sans Thai", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
