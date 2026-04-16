<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "./Button.svelte";

  type ErrorPageProps = {
    icon?: Snippet;
    heading: string;
    body: string;
    primaryAction: { label: string; href: string };
  };

  let { icon, heading, body, primaryAction }: ErrorPageProps = $props();
</script>

<div
  class="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4"
>
  <div class="w-full max-w-[480px] flex flex-col items-center text-center gap-6">
    {#if icon}
      <div class="text-[var(--color-destructive)]" aria-hidden="true">
        {@render icon()}
      </div>
    {/if}
    <h1 class="text-2xl font-semibold leading-[1.2] text-[var(--color-ink-primary)]">
      {heading}
    </h1>
    <p class="text-base text-[var(--color-ink-secondary)] leading-relaxed">
      {body}
    </p>
    <a href={primaryAction.href} class="w-full">
      <Button variant="primary">
        {#snippet children()}
          {primaryAction.label}
        {/snippet}
      </Button>
    </a>
  </div>
</div>
