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
    markCount?: number;
  };

  let { player, markCount = 0 }: PlayerRowProps = $props();

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
  <!-- Mark-count badge (Phase 3 — D-07) -->
  {#if markCount > 0}
    <span
      data-testid="mark-badge"
      class="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-2 text-sm font-semibold
             bg-[var(--color-accent)] text-[var(--color-ink-inverse)]
             transition-[background-color,transform] duration-[120ms] ease-out
             motion-reduce:transition-none"
      aria-label="{markCount} {markCount === 1 ? 'mark' : 'marks'}"
    >
      {markCount}
    </span>
  {/if}
</li>
