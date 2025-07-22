/** @type {import('tailwindcss').Config} */
module.exports = {
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
        // Soft cream/off-white colors
        'soft-white': '#fdfcfb',
        'soft-white-90': 'rgba(253, 252, 251, 0.9)',
        'cream': '#faf9f7',
        
        // Warm grays
        'warm-gray': {
          50: '#faf9f7',
          100: '#f5f3f0',
          200: '#e8e5e0',
          300: '#d6d2cc',
          400: '#b8b2a8',
          500: '#948b7f',
          600: '#6b635a',
          700: '#514b44',
          800: '#3d3835',
          '800-90': 'rgba(61, 56, 53, 0.9)',
          900: '#2d2926',
        },
        
        // Soft sage green (replacing teal)
        'sage': {
          50: '#f7f9f7',
          100: '#e8ede8',
          200: '#d0ddd0',
          300: '#a8c3a8',
          400: '#7fa57f',
          500: '#5e8b5e',
          600: '#4a724a',
          700: '#3b5a3b',
          800: '#2f472f',
          900: '#253825',
        },
        
        // Soft terracotta (replacing orange/yellow)
        'terracotta': {
          50: '#fdf9f5',
          100: '#f9ede3',
          200: '#f2d9c4',
          300: '#e8bb99',
          400: '#db9a6d',
          500: '#cc7d4a',
          600: '#b86538',
          700: '#975230',
          800: '#78422a',
          900: '#623624',
        },
        
        // Soft dusty rose (for destructive actions)
        'dusty-rose': {
          50: '#fdf7f7',
          100: '#f9e8e8',
          200: '#f2d0d0',
          300: '#e5a8a8',
          400: '#d57f7f',
          500: '#c25e5e',
          600: '#a84a4a',
          700: '#853b3b',
          800: '#682f2f',
          900: '#532525',
        }
      }
    },
  },
  plugins: [],
}

