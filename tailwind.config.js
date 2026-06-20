/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        screenplay: ['"Courier New"', "Courier", "monospace"],
      },
    },
  },
  plugins: [],
};
