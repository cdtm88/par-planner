<script lang="ts">
  import { fade } from "svelte/transition";
  import { X } from "lucide-svelte";

  type WordChipProps = {
    word: string;
    canDelete?: boolean;
    onDelete?: () => void;
  };

  let { word, canDelete = false, onDelete }: WordChipProps = $props();
</script>

<span
  in:fade={{ duration: 120 }}
  out:fade={{ duration: 120 }}
  class="inline-flex items-center gap-1 py-2 px-3 rounded-lg
    bg-[var(--color-surface)] border border-[var(--color-divider)]
    text-[var(--color-ink-primary)] text-base
    hover:border-[#3A3A48] transition-colors motion-reduce:transition-none"
>
  {word}
  {#if canDelete}
    <button
      onclick={onDelete}
      aria-label={`Remove "${word}"`}
      class="flex items-center justify-center
             min-h-11 min-w-11 -my-2 -mr-3
             text-[var(--color-ink-secondary)]
             hover:text-[var(--color-ink-primary)]
             active:scale-[0.92] transition-transform motion-reduce:transition-none
             focus-visible:outline-2 focus-visible:outline-offset-2
             focus-visible:outline-[var(--color-ink-secondary)]
             cursor-pointer"
    >
      <X size={14} />
    </button>
  {/if}
</span>
