<script lang="ts">
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";

  type BannerProps = {
    visible: boolean;
    children: Snippet;
  };

  let { visible, children }: BannerProps = $props();
</script>

{#if visible}
  <div
    class="fixed top-0 inset-x-0 z-50 bg-[var(--color-surface)] border-b border-[var(--color-divider)] px-4 py-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-ink-primary)] motion-reduce:transition-none"
    transition:fly={{ y: -40, duration: 150 }}
    role="status"
    aria-live="polite"
  >
    {@render children()}
  </div>
{/if}
