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
        // Lavender Sapphire Mist Palette
        lavender: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        sapphire: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        mist: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        terminal: {
          bg: '#1e1e2e',
          fg: '#cdd6f4',
          cursor: '#cba6f7',
        },
      },
      backgroundImage: {
        'gradient-lavender-sapphire': 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #60A5FA 100%)',
        'gradient-mist': 'linear-gradient(180deg, rgba(249, 250, 251, 0.1) 0%, rgba(243, 244, 246, 0.05) 100%)',
        'gradient-hero': 'radial-gradient(ellipse at top, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
      },
      boxShadow: {
        'lavender': '0 10px 40px rgba(139, 92, 246, 0.3), 0 0 20px rgba(139, 92, 246, 0.1)',
        'sapphire': '0 10px 40px rgba(59, 130, 246, 0.3), 0 0 20px rgba(59, 130, 246, 0.1)',
        'mist': '0 10px 40px rgba(107, 114, 128, 0.2), 0 0 20px rgba(107, 114, 128, 0.1)',
        'glow-lavender': '0 0 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.3)',
        'glow-sapphire': '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)',
      },
    },
  },
  plugins: [],
} satisfies Config;


