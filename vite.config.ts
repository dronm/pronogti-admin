import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	return {
		base: env.VITE_BASE_URL || "/",
		plugins: [vue(), tailwindcss()],
		resolve: {
			alias: {
				"@": fileURLToPath(
					new URL("./src", import.meta.url),
				),
			},
			dedupe: [
				"vue",
				"pinia",
				"vue-router",
				"vue-i18n",
				"primevue",
				"valibot",
			],
		},
		optimizeDeps: {
			exclude: [
				"@katren/vue-business-app",
				"@katren/vue-collection-lib",
			],
		},
		server: {
			port: 5174,
			strictPort: true,
			proxy: {
				"/api": {
					target:
						env.VITE_API_PROXY_TARGET ||
						"http://127.0.0.1:59000",
					changeOrigin: false,
					rewrite: (path: string): string =>
						path.replace(
							/^\/api(?=\/|$)/,
							"",
						),
				},
			},
		},
	};
});
