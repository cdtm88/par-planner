<script lang="ts">
  import { deriveGridTier, wordsNeededToStart, TIER_THRESHOLDS } from "$lib/util/gridTier";

  type GridProgressProps = {
    wordCount: number;
    isHost: boolean;
    hostName?: string;
  };

  let { wordCount, isHost, hostName = "the host" }: GridProgressProps = $props();

  const tier = $derived(deriveGridTier(wordCount));
  const needed = $derived(wordsNeededToStart(wordCount));
  const canStart = $derived(needed === 0);
  const fillPct = $derived(Math.min(100, (wordCount / 21) * 100));

  const hint = $derived(
    canStart
      ? isHost
        ? "Ready — start when you are."
        : `Ready for a ${tier} board — ${hostName} can start!`
      : `Need ${needed} more word${needed === 1 ? "" : "s"} to start a ${tier} board`
  );
</script>

<div class="flex flex-col gap-3">
  <div class="relative pt-5">
    {#each [{ tier: "3\u00d73", threshold: 5 }, { tier: "4\u00d74", threshold: 12 }, { tier: "5\u00d75", threshold: 21 }] as marker}
      <span
        class="absolute top-0 text-xs text-[var(--color-ink-secondary)] -translate-x-1/2"
        style="left: {(marker.threshold / 21) * 100}%"
      >
        {marker.tier}
      </span>
    {/each}
    <div class="h-2 w-full rounded-full bg-[var(--color-divider)] overflow-hidden">
      <div
        class="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-200 ease-out
               motion-reduce:transition-none"
        style="width: {fillPct}%"
      ></div>
    </div>
  </div>
  <p class="text-sm text-[var(--color-ink-secondary)]">{hint}</p>
</div>
