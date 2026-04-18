<script lang="ts">
  import type { WinningLine } from "$lib/protocol/messages";
  import { winLineCellIndices } from "$lib/util/winLine";

  type Props = {
    gridSize: 3 | 4 | 5;
    winningLine: WinningLine;
  };
  let { gridSize, winningLine }: Props = $props();

  // Tailwind v4 scanner safety: enumerate literal class tokens via $derived ternary.
  // Template-literal class composition (grid-cols-${n}) is NOT safe for Oxide.
  const colsClass = $derived(
    gridSize === 3 ? "grid-cols-3" : gridSize === 4 ? "grid-cols-4" : "grid-cols-5"
  );
  const highlightedSet = $derived(new Set(winLineCellIndices(winningLine, gridSize)));
  const totalCells = $derived(gridSize * gridSize);
</script>

<div
  class={["grid gap-[2px] w-16 h-16 p-1.5 bg-[var(--color-surface)] rounded border border-[var(--color-divider)]", colsClass].join(" ")}
  aria-label="Winning line indicator"
  role="img"
>
  {#each Array(totalCells) as _, i}
    <div
      class={highlightedSet.has(i)
        ? "bg-[var(--color-ink-primary)] rounded-[1px]"
        : "bg-[var(--color-divider)] rounded-[1px]"}
    ></div>
  {/each}
</div>
