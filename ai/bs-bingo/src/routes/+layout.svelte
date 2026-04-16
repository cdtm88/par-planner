<script lang="ts">
  import "../app.css";
  import "@fontsource-variable/inter";
  import "@fontsource-variable/space-grotesk";
  import Banner from "$lib/components/Banner.svelte";
  import { Loader2 } from "lucide-svelte";
  // Plan 04 will export `connectionStatus` from $lib/stores/room.svelte.ts
  // and set visible={connectionStatus === "reconnecting"}. For now: invisible.
  let { children } = $props();
  let reconnectingVisible = $state(false);
</script>

<Banner visible={reconnectingVisible}>
  {#snippet children()}
    <Loader2 size={16} class="animate-spin motion-reduce:animate-none" />
    Reconnecting…
  {/snippet}
</Banner>
{@render children()}
