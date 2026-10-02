import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        // Encaminha as chamadas /api para o backend (backend/ roda na porta 3333)
        proxy: {
            "/api": "http://localhost:3333",
        },
    },
});
