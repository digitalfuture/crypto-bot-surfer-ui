import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";
import node from "@astrojs/node";

export default defineConfig({
  integrations: [vue()],
  output: "server", // Server-side rendering
  adapter: node({
    mode: "middleware", // Running mode for the server
  }),
});
