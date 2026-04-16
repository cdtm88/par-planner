<script lang="ts">
  type TextInputProps = {
    label: string;
    value: string;
    variant?: "default" | "code";
    maxlength?: number;
    placeholder?: string;
    helper?: string;
    error?: string;
    autofocus?: boolean;
    onsubmit?: () => void;
    oninput?: (e: Event) => void;
    id?: string;
  };

  let {
    label,
    value = $bindable(""),
    variant = "default",
    maxlength,
    placeholder,
    helper,
    error,
    autofocus = false,
    onsubmit,
    oninput,
    id,
  }: TextInputProps = $props();

  const inputId = $derived(id ?? `input-${label.toLowerCase().replace(/\s+/g, "-")}`);

  const baseInputClasses =
    "w-full bg-[var(--color-surface)] border border-[var(--color-divider)] focus:border-[var(--color-ink-secondary)] focus:outline-2 focus:outline-[var(--color-ink-secondary)] focus:outline-offset-0 rounded-lg px-4 min-h-11 text-[var(--color-ink-primary)] transition-colors motion-reduce:transition-none";

  const codeInputClasses =
    "font-mono uppercase tracking-[0.2em] text-center text-lg";

  const inputClasses = $derived(
    variant === "code"
      ? `${baseInputClasses} ${codeInputClasses}`
      : baseInputClasses
  );
</script>

<div class="flex flex-col gap-1">
  <label
    for={inputId}
    class="text-sm font-semibold leading-[1.4] text-[var(--color-ink-primary)]"
  >
    {label}
  </label>
  <input
    id={inputId}
    class={inputClasses}
    bind:value
    {maxlength}
    {placeholder}
    {autofocus}
    {oninput}
    onkeydown={(e) => {
      if (e.key === "Enter" && onsubmit) {
        e.preventDefault();
        onsubmit();
      }
    }}
    type="text"
    autocomplete="off"
    spellcheck="false"
  />
  {#if error}
    <p class="text-sm text-[var(--color-destructive)]">{error}</p>
  {:else if helper}
    <p class="text-sm text-[var(--color-ink-secondary)]">{helper}</p>
  {/if}
</div>
