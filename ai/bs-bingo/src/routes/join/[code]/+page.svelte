<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import Modal from "$lib/components/Modal.svelte";
  import TextInput from "$lib/components/TextInput.svelte";
  import Button from "$lib/components/Button.svelte";
  import { setDisplayName } from "$lib/session";
  import { ArrowRight } from "lucide-svelte";

  let { data }: { data: PageData } = $props();

  let modalOpen = $state(true);
  let displayNameInput = $state("");
  let modalError = $state<string | null>(null);
  let busy = $state(false);

  async function submitModal() {
    const trimmed = displayNameInput.trim();
    if (!trimmed) {
      modalError = "Pick a name first.";
      return;
    }
    if (trimmed.length > 20) {
      modalError = "Max 20 characters.";
      return;
    }
    if (!browser) return;
    busy = true;
    setDisplayName(data.code, trimmed);
    await goto(`/room/${data.code}`);
  }
</script>

<!-- Background dims to a near-empty page; modal carries the entire interaction. -->
<main class="min-h-screen bg-[var(--color-bg)]"></main>

<Modal
  bind:open={modalOpen}
  title="What should we call you?"
  onclose={() => goto("/")}
>
  {#snippet children()}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        submitModal();
      }}
      class="flex flex-col gap-4"
    >
      <p class="text-sm text-[var(--color-ink-secondary)]">
        Joining room <span
          class="font-display text-[var(--color-accent)] tracking-[0.1em]"
          >{data.code}</span
        >
      </p>
      <TextInput
        label="Your name"
        placeholder="Your name"
        value={displayNameInput}
        oninput={(e) => {
          displayNameInput = (e.target as HTMLInputElement).value;
        }}
        maxlength={20}
        autofocus
        helper="Max 20 characters. Nothing permanent — just for this game."
        error={modalError ?? undefined}
      />
      <Button variant="primary" type="submit" disabled={busy}>
        {#snippet children()}
          Join game <ArrowRight size={16} />
        {/snippet}
      </Button>
    </form>
  {/snippet}
</Modal>
