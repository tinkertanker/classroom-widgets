/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./App.tsx",
    "./main.tsx",
    "./components/**/*.tsx",
    "./utils/**/*.ts",
    "./hooks/**/*.ts",
    "../../../src/shared/constants/**/*.ts",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      colors: {
        // Soft cream/off-white colors
        'soft-white': '#fdfcfb',
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
        },
        
        // Sky blue
        'sky': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        
        // Amber
        'amber': {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: {
            opacity: '0',
            transform: 'translateY(-10px)'
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)'
          }
        }
      }
    },
  },
  plugins: [],
}