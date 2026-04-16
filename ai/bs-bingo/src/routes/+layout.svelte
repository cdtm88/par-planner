<script lang="ts">
  import "../app.css";
  import "@fontsource-variable/inter";
  import "@fontsource-variable/space-grotesk";
  import Banner from "$lib/components/Banner.svelte";
  import { connection } from "$lib/stores/room.svelte";
  import { Loader2 } from "lucide-svelte";
  let { children } = $props();
  const visible = $derived(connection.status === "reconnecting");
</script>

<Banner {visible}>
  {#snippet children()}
    <Loader2 size={16} class="animate-spin motion-reduce:animate-none" />
    <span>Reconnecting…</span>
  {/snippet}
</Banner>
{@render children()}
