import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Exclude /parties/* so our wrapper Worker in Plan 02 can handle WS upgrades.
      routes: { include: ["/*"], exclude: ["<all>", "/parties/*"] }
    }),
    alias: { $lib: "src/lib" }
  }
};
