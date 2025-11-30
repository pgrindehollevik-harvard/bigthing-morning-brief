import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Party colors - explicit list to ensure Tailwind includes them
    'bg-red-600', 'text-white', 'border-red-700',
    'bg-red-800', 'border-red-900',
    'bg-blue-600', 'border-blue-700',
    'bg-cyan-500', 'border-cyan-600',
    'bg-green-600', 'border-green-700',
    'bg-yellow-400', 'text-gray-900', 'border-yellow-500',
    'bg-emerald-400', 'border-emerald-500',
    'bg-rose-700', 'border-rose-800',
    'bg-lime-500', 'border-lime-600',
    'bg-gray-500', 'border-gray-600',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;

