<script lang="ts">
  import type { Snippet } from "svelte";

  type ModalProps = {
    open: boolean;
    title: string;
    onclose?: () => void;
    children: Snippet;
    footer?: Snippet;
  };

  let {
    open = $bindable(false),
    title,
    onclose,
    children,
    footer,
  }: ModalProps = $props();

  let dialogEl = $state<HTMLDivElement | null>(null);

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onclose?.();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onclose?.();
      return;
    }
    // Focus trap
    if (e.key === "Tab" && dialogEl) {
      const focusable = dialogEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
  }

  $effect(() => {
    if (open && dialogEl) {
      // Autofocus first focusable element
      const focusable = dialogEl.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      // Use setTimeout to ensure DOM is rendered
      setTimeout(() => focusable?.focus(), 0);
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40 bg-[var(--color-bg)]/80 flex items-center justify-center px-4 transition-opacity duration-[120ms] motion-reduce:transition-none"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <!-- Sheet -->
    <div
      bind:this={dialogEl}
      class="relative z-50 w-full max-w-[480px] bg-[var(--color-surface)] rounded-xl p-6 shadow-xl transition-all duration-150 motion-reduce:transition-none scale-100 opacity-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <h2
        id="modal-title"
        class="text-2xl font-semibold leading-[1.2] text-[var(--color-ink-primary)] mb-4"
      >
        {title}
      </h2>
      {@render children()}
      {#if footer}
        <div class="mt-4">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
