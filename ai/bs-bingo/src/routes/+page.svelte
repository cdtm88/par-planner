<script lang="ts">
  import { goto } from "$app/navigation";
  import Button from "$lib/components/Button.svelte";
  import TextInput from "$lib/components/TextInput.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import { normalizeCode } from "$lib/util/roomCode";
  import { setDisplayName } from "$lib/session";
  import { ArrowRight } from "lucide-svelte";

  let joinCodeInput = $state("");
  let modalOpen = $state(false);
  let modalMode = $state<"create" | "join">("create");
  let pendingJoinCode = $state<string | null>(null);
  let displayNameInput = $state("");
  let modalError = $state<string | null>(null);
  let busy = $state(false);

  const joinCodeValid = $derived(joinCodeInput.length === 6);

  function handleCodeInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    joinCodeInput = normalizeCode(raw).slice(0, 6);
  }

  function openCreate() {
    modalMode = "create";
    pendingJoinCode = null;
    modalError = null;
    displayNameInput = "";
    modalOpen = true;
  }

  function openJoin() {
    if (!joinCodeValid) return;
    modalMode = "join";
    pendingJoinCode = joinCodeInput;
    modalError = null;
    displayNameInput = "";
    modalOpen = true;
  }

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
    busy = true;
    try {
      let code: string;
      if (modalMode === "create") {
        const res = await fetch("/api/rooms", { method: "POST" });
        if (!res.ok) throw new Error("Could not create room");
        const data = (await res.json()) as { code: string; shareUrl: string };
        code = data.code;
      } else {
        code = pendingJoinCode!;
      }
      setDisplayName(code, trimmed);
      await goto(`/room/${code}`);
    } catch {
      modalError = "Something went wrong. Try again.";
      busy = false;
    }
  }
</script>

<main
  class="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink-primary)] flex flex-col items-center justify-center px-4 py-12 sm:py-16 lg:py-24"
>
  <div class="w-full max-w-[480px] flex flex-col gap-8">
    <header class="text-center">
      <h1 class="font-display text-[40px] sm:text-[56px] font-semibold leading-[1.1]">
        Bullshit Bingo<span class="text-[var(--color-accent)]">.</span>
      </h1>
      <p class="mt-4 text-[var(--color-ink-secondary)]">
        The meeting game. Mark the buzzwords, first to a line wins.
      </p>
    </header>

    <Button variant="primary" onclick={openCreate}>
      {#snippet children()}
        Create a game
      {/snippet}
    </Button>

    <div
      class="flex items-center gap-4 text-[var(--color-ink-secondary)] text-sm font-semibold uppercase"
    >
      <span class="flex-1 h-px bg-[var(--color-divider)]"></span>
      <span>or</span>
      <span class="flex-1 h-px bg-[var(--color-divider)]"></span>
    </div>

    <form
      class="flex flex-col gap-4"
      onsubmit={(e) => {
        e.preventDefault();
        openJoin();
      }}
    >
      <TextInput
        label="Join with code"
        variant="code"
        value={joinCodeInput}
        maxlength={6}
        placeholder="ABC234"
        oninput={handleCodeInput}
        helper={joinCodeInput && !joinCodeValid
          ? "Codes are 6 letters and numbers. Try again."
          : ""}
      />
      <Button variant="primary" type="submit" disabled={!joinCodeValid}>
        {#snippet children()}
          Join
        {/snippet}
      </Button>
    </form>
  </div>

  <Modal
    bind:open={modalOpen}
    title="What should we call you?"
    onclose={() => {
      modalOpen = false;
    }}
  >
    {#snippet children()}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          submitModal();
        }}
        class="flex flex-col gap-4"
      >
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
            {modalMode === "create" ? "Create game" : "Join game"}
            <ArrowRight size={16} />
          {/snippet}
        </Button>
      </form>
    {/snippet}
  </Modal>
</main>
