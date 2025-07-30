import { brandColors, warmGray, softWhite, softWhite90, cream } from './src/shared/constants/colors';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      colors: {
        'soft-white': softWhite,
        'soft-white-90': softWhite90,
        'cream': cream,
        'warm-gray': warmGray,
        'sage': brandColors.sage,
        'terracotta': brandColors.terracotta,
        'dusty-rose': brandColors.dustyRose,
        'sky': brandColors.sky,
        'amber': brandColors.amber,
      }
    },
  },
  plugins: [],
}

