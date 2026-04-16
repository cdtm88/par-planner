<script lang="ts">
  import type { Snippet } from "svelte";

  type BadgeProps = {
    icon?: Snippet;
    children: Snippet;
  };

  let { icon, children }: BadgeProps = $props();
</script>

<span
  class="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md bg-[var(--color-accent)] text-[var(--color-ink-inverse)]"
>
  {#if icon}
    {@render icon()}
  {/if}
  {@render children()}
</span>
