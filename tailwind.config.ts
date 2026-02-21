import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#F5EFE6",
                surface: "#FFFFFF",
                border: "#E5D9C5",
                textMain: "#3E3124",
                textMuted: "#8C7E6D",
                primary: {
                    DEFAULT: "#C06C53", // Terracotta
                    foreground: "#ffffff",
                },
                sage: {
                    DEFAULT: "#899B82",
                    foreground: "#ffffff",
                },
                mustard: {
                    DEFAULT: "#D29C42",
                    foreground: "#ffffff",
                },
            },
        },
    },
    plugins: [],
};

export default config;
