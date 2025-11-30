import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Party colors - muted/pastel versions
    'bg-red-100', 'text-red-800', 'border-red-200',
    'bg-blue-100', 'text-blue-800', 'border-blue-200',
    'bg-purple-100', 'text-purple-800', 'border-purple-200',
    'bg-green-100', 'text-green-800', 'border-green-200',
    'bg-yellow-100', 'text-yellow-800', 'border-yellow-200',
    'bg-emerald-100', 'text-emerald-800', 'border-emerald-200',
    'bg-rose-100', 'text-rose-800', 'border-rose-200',
    'bg-lime-100', 'text-lime-800', 'border-lime-200',
    'bg-gray-100', 'text-gray-800', 'border-gray-200',
    'bg-gray-200', 'text-gray-800', 'border-gray-300',
    'bg-slate-100', 'text-slate-700', 'border-slate-300',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;

