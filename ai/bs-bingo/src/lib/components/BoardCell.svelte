<script lang="ts">
  import type { BoardCell as Cell } from "$lib/protocol/messages";

  type BoardCellProps = {
    cell: Cell;
    marked: boolean;
    onToggle?: () => void;
  };

  let { cell, marked, onToggle }: BoardCellProps = $props();

  function handleClick() {
    if (cell.blank) return; // defense-in-depth; blank cells have no onclick anyway
    onToggle?.();
  }
</script>

{#if cell.blank}
  <!-- D-14: blank/inert cell — no word, no text, non-interactive. Pitfall 6: must be a <div>, never a <button>. -->
  <div
    class="aspect-square min-h-11 min-w-11 rounded-lg
           bg-[var(--color-surface)]
           border border-dashed border-[var(--color-divider)]/40"
    aria-hidden="true"
    tabindex="-1"
  ></div>
{:else}
  <!-- D-12 (unmarked) / D-13 (marked) — variant-class swap per Button.svelte pattern. -->
  <button
    type="button"
    onclick={handleClick}
    aria-label={marked
      ? `${cell.text ?? ""}. Marked. Tap to unmark.`
      : `${cell.text ?? ""}. Tap to mark.`}
    aria-pressed={marked ? "true" : "false"}
    class={[
      "aspect-square min-h-11 min-w-11 rounded-lg font-semibold text-sm leading-tight",
      "transition-[background-color,color,border-color,transform] duration-[120ms] ease-out",
      "motion-reduce:transition-none",
      "active:scale-[0.97]",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink-secondary)]",
      "cursor-pointer",
      marked
        ? "bg-[var(--color-accent)] text-[var(--color-ink-inverse)] border border-[var(--color-accent)]"
        : "bg-[var(--color-surface)] text-[var(--color-ink-primary)] border border-[var(--color-divider)] hover:border-[#3A3A48]",
    ].join(" ")}
  >
    <span class="block px-[6px] break-words hyphens-auto">{cell.text}</span>
  </button>
{/if}
