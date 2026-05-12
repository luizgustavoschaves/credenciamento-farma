import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sefaz: {
          blue:  '#003580',
          green: '#00703C',
          gray:  '#F4F6F9',
        },
      },
    },
  },
  plugins: [],
}
export default config
