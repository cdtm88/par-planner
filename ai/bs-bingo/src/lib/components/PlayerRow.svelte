<script lang="ts">
  import { fade } from "svelte/transition";
  import { Crown } from "lucide-svelte";
  import Badge from "./Badge.svelte";
  import { getPlayerColor } from "$lib/util/playerColor";
  import { getInitials } from "$lib/util/initials";

  type PlayerRowProps = {
    player: {
      playerId: string;
      displayName: string;
      isHost: boolean;
    };
  };

  let { player }: PlayerRowProps = $props();

  const color = $derived(getPlayerColor(player.playerId));
  const initials = $derived(getInitials(player.displayName));
</script>

<li
  class="flex items-center gap-3 py-3"
  in:fade={{ duration: 120 }}
  out:fade={{ duration: 120 }}
>
  <!-- Color circle with initials -->
  <div
    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-[#0F0F14]"
    style="background-color: {color}"
    aria-hidden="true"
  >
    {initials}
  </div>
  <!-- Display name -->
  <span class="flex-1 text-base text-[var(--color-ink-primary)]">
    {player.displayName}
  </span>
  <!-- Host badge -->
  {#if player.isHost}
    <Badge>
      {#snippet icon()}
        <Crown size={12} />
      {/snippet}
      {#snippet children()}
        Host
      {/snippet}
    </Badge>
  {/if}
</li>
