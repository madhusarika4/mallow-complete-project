/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF8F0', paper: '#FFFDF9',
        blush: { DEFAULT: '#FBDDE3', soft: '#FDEEF1', deep: '#F2B8C6' },
        rose: { DEFAULT: '#D99AAA', deep: '#B87489', soft: '#EBC3CC' },
        lav: { DEFAULT: '#E4DAF5', soft: '#F1ECFA', deep: '#9D86C9' },
        mint: { DEFAULT: '#D6EFE3', soft: '#EAF7F1', deep: '#6FB79A' },
        peach: { DEFAULT: '#FFDCC4', soft: '#FFEEE0', deep: '#E9A27E' },
        butter: { DEFAULT: '#FFF0B8', soft: '#FFF8DA', deep: '#E8C95A' },
        teal: { DEFAULT: '#BFDCDC', soft: '#E3F0F0', deep: '#4F8A8B' },
        ink: { DEFAULT: '#4A3B4F', soft: '#7C6B80', faint: '#A899AC' },
        line: '#EADCE8',
      },
      fontFamily: {
        sans: ['"Nunito Variable"', 'ui-rounded', 'system-ui', 'sans-serif'],
        display: ['"Fredoka Variable"', '"Nunito Variable"', 'ui-rounded', 'sans-serif'],
        hand: ['Caveat', '"Nunito Variable"', 'cursive'],
      },
      borderRadius: { '4xl': '2rem', '5xl': '2.5rem' },
      boxShadow: {
        soft: '0 6px 24px -8px rgba(120, 86, 130, 0.18)',
        lift: '0 12px 32px -10px rgba(120, 86, 130, 0.28)',
        inset: 'inset 0 0 0 1.5px rgba(184, 116, 137, 0.18)',
      },
      keyframes: {
        bob: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
        pop: { '0%': { transform: 'scale(.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        rise: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        ring: { '0%': { transform: 'scale(.9)', opacity: '.7' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
        wiggle: { '0%,100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } },
        twinkle: { '0%,100%': { opacity: '.5', transform: 'scale(.9)' }, '50%': { opacity: '1', transform: 'scale(1.1)' } },
      },
      animation: {
        bob: 'bob 4s ease-in-out infinite', pop: 'pop .25s ease-out both', rise: 'rise .35s ease-out both',
        ring: 'ring 1.4s ease-out infinite', wiggle: 'wiggle 2.4s ease-in-out infinite', twinkle: 'twinkle 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
