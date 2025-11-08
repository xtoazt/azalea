import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Lavender Sapphire Mist Palette - Pastel
        lavender: {
          50: '#F0DAD5',
          100: '#F0DAD5',
          200: '#D9A69F',
          300: '#BABBB1',
          400: '#6C739C',
          500: '#6C739C',
          600: '#424658',
          700: '#424658',
          800: '#424658',
          900: '#424658',
        },
        sapphire: {
          50: '#F0DAD5',
          100: '#F0DAD5',
          200: '#D9A69F',
          300: '#BABBB1',
          400: '#6C739C',
          500: '#6C739C',
          600: '#424658',
          700: '#424658',
          800: '#424658',
          900: '#424658',
        },
        mist: {
          50: '#F0DAD5',
          100: '#F0DAD5',
          200: '#D9A69F',
          300: '#BABBB1',
          400: '#6C739C',
          500: '#6C739C',
          600: '#424658',
          700: '#424658',
          800: '#424658',
          900: '#424658',
        },
        coral: {
          light: '#D9A69F',
          dark: '#C56B62',
        },
        peach: {
          light: '#F0DAD5',
          tan: '#DEA785',
        },
        terminal: {
          bg: '#F0DAD5',
          fg: '#424658',
          cursor: '#6C739C',
        },
      },
      boxShadow: {
        'lavender': '0 2px 4px rgba(66, 70, 88, 0.1)',
        'sapphire': '0 2px 4px rgba(66, 70, 88, 0.1)',
        'mist': '0 2px 4px rgba(66, 70, 88, 0.1)',
      },
    },
  },
  plugins: [],
} satisfies Config;


