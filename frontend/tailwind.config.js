/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sokoni: {
          green:      "#25D366",
          darkgreen:  "#128C7E",
          teal:       "#075E54",
          light:      "#DCF8C6",
          bubble:     "#FFFFFF",
          bg:         "#ECE5DD",
          header:     "#075E54",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
