<script lang="ts">
  import type { Snippet } from "svelte";

  type ButtonProps = {
    variant?: "primary" | "secondary" | "icon";
    type?: "button" | "submit";
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    "aria-label"?: string;
    children: Snippet;
    leadingIcon?: Snippet;
    trailingIcon?: Snippet;
  };

  let {
    variant = "primary",
    type = "button",
    disabled = false,
    onclick,
    "aria-label": ariaLabel,
    children,
    leadingIcon,
    trailingIcon,
  }: ButtonProps = $props();

  const baseClasses =
    "inline-flex items-center justify-center gap-2 font-semibold transition-transform motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink-secondary)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

  const variantClasses = $derived(
    variant === "primary"
      ? "bg-[var(--color-accent)] text-[var(--color-ink-inverse)] hover:brightness-110 active:translate-y-px min-h-11 px-4 rounded-lg"
      : variant === "secondary"
        ? "bg-[var(--color-surface)] border border-[var(--color-divider)] text-[var(--color-ink-primary)] hover:border-[#3A3A48] active:translate-y-px min-h-11 px-4 rounded-lg"
        : "min-h-11 min-w-11 bg-[var(--color-surface)] text-[var(--color-ink-primary)] hover:bg-[#2A2A36] active:scale-[0.97] rounded-lg"
  );
</script>

<button
  {type}
  {disabled}
  {onclick}
  aria-label={ariaLabel}
  class="{baseClasses} {variantClasses}"
>
  {#if leadingIcon}
    {@render leadingIcon()}
  {/if}
  {@render children()}
  {#if trailingIcon}
    {@render trailingIcon()}
  {/if}
</button>
