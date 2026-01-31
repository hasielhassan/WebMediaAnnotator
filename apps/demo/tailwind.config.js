/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "../../packages/ui/src/**/*.{js,ts,jsx,tsx}", // Include UI package
        "../../packages/react/src/**/*.{js,ts,jsx,tsx}" // Include React package
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}
