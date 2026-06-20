/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        reading: ['"Source Serif 4"', "Literata", "Georgia", "serif"],
        label: ['"Source Sans 3"', "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
