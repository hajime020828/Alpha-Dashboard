/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}", // Next.js 13+ App Router用（今回はpages Routerですが念のため）
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};