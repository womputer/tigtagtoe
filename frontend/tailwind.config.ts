import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#08090B",
        ink: {
          50: "rgba(255,255,255,0.94)",
          200: "rgba(255,255,255,0.78)",
          400: "rgba(255,255,255,0.64)",
          600: "rgba(255,255,255,0.40)",
          800: "rgba(255,255,255,0.22)",
        },
        surface: {
          1: "rgba(255,255,255,0.035)",
          2: "rgba(255,255,255,0.06)",
          3: "rgba(255,255,255,0.10)",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.14)",
        },
        accent: {
          DEFAULT: "#7C5CFF",
          soft: "rgba(124,92,255,0.18)",
          glow: "rgba(124,92,255,0.45)",
        },
        tool: {
          meeting: "#7C5CFF",
          response: "#60A5FA",
          escalate: "#FF6B7A",
          task: "#4FD1C7",
          urgent: "#F5C46B",
          archive: "#9CA3AF",
        },
        good: "#4FD1C7",
        warn: "#F5C46B",
        bad: "#FF6B7A",
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      backdropBlur: {
        xs: '4px',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(124,92,255,0.20), 0 12px 40px -12px rgba(124,92,255,0.35)',
        soft: '0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 32px -16px rgba(0,0,0,0.6)',
        ring: '0 0 0 1px rgba(255,255,255,0.08)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124,92,255,0.0)' },
          '50%': { boxShadow: '0 0 0 8px rgba(124,92,255,0.18)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'shimmer': 'shimmer 1.4s linear infinite',
        'pulse-glow': 'pulse-glow 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
