import { defineConfig } from "astro/config";

// https://astro.build/config
import vue from "@astrojs/vue";

// https://astro.build/config
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  integrations: [vue()],
  output: "server",
  adapter: node({
    mode: "middleware",
  }),
});
