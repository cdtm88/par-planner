<script lang="ts">
  import { Check } from "lucide-svelte";

  type PackPillsProps = {
    usedPacks: Set<string>;
    onLoad: (pack: string) => void;
  };

  const PACKS = [
    { id: "corporate-classics", label: "Corporate Classics" },
    { id: "agile", label: "Agile" },
    { id: "sales", label: "Sales" },
  ] as const;

  let { usedPacks, onLoad }: PackPillsProps = $props();
</script>

<section class="flex flex-col gap-3">
  <p class="text-sm font-semibold text-[var(--color-ink-secondary)]">
    Seed from a starter pack:
  </p>
  <div class="flex flex-wrap gap-2">
    {#each PACKS as pack (pack.id)}
      {@const used = usedPacks.has(pack.id)}
      <button
        onclick={() => { if (!used) onLoad(pack.id); }}
        disabled={used}
        aria-label={used ? "Already loaded" : `Load ${pack.label} pack`}
        class="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg
               bg-[var(--color-surface)] border border-[var(--color-divider)]
               text-sm font-semibold transition-colors motion-reduce:transition-none
               focus-visible:outline-2 focus-visible:outline-offset-2
               focus-visible:outline-[var(--color-ink-secondary)]
               {used
                 ? 'text-[var(--color-ink-disabled)] cursor-not-allowed'
                 : 'text-[var(--color-ink-primary)] hover:border-[#3A3A48] active:translate-y-px cursor-pointer'}"
      >
        {#if used}<Check size={14} />{/if}
        {pack.label}
      </button>
    {/each}
  </div>
</section>
