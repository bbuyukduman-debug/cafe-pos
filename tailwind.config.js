/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind'in hangi dosyaları tarayacağını kesin olarak belirtiyoruz
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./App.jsx", // Eğer App.jsx ana dizindeyse
  ],
  theme: {
    // v4 mimarisinde konfigürasyon artık opsiyonel olsa da, 
    // geriye dönük uyumluluk için bu yapıyı koruyoruz.
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}