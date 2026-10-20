import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          foreground: "var(--accent-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          soft: "var(--success-soft)",
          foreground: "var(--success-foreground)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
          foreground: "var(--danger-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          soft: "var(--warning-soft)",
          foreground: "var(--warning-foreground)",
        },
        info: {
          DEFAULT: "var(--info)",
          soft: "var(--info-soft)",
          foreground: "var(--info-foreground)",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Fraunces", "Playfair Display", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        input: "8px",
        card: "12px",
        modal: "16px",
        pill: "999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(15, 27, 45, 0.04)",
        md: "0 4px 16px rgba(15, 27, 45, 0.06)",
        lg: "0 12px 40px rgba(15, 27, 45, 0.12)",
      },
      transitionTimingFunction: {
        academic: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
