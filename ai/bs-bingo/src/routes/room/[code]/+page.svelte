<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { PageData } from "./$types";
  import Button from "$lib/components/Button.svelte";
  import PlayerRow from "$lib/components/PlayerRow.svelte";
  import WordPool from "$lib/components/WordPool.svelte";
  import PackPills from "$lib/components/PackPills.svelte";
  import GridProgress from "$lib/components/GridProgress.svelte";
  import TextInput from "$lib/components/TextInput.svelte";
  import { createRoomStore } from "$lib/stores/room.svelte";
  import type { RoomState, WordEntry, ClientMessage } from "$lib/protocol/messages";
  import { Clipboard, Check, Play } from "lucide-svelte";

  let { data }: { data: PageData } = $props();

  const shareUrl = $derived(
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${data.code}`
      : `/join/${data.code}`
  );

  type CopyLabel = "Copy code" | "Copied";
  type CopyLinkLabel = "Copy link" | "Copied";

  // Explicit interface for the store reference (avoids Svelte 5 rune type inference issues)
  interface RoomStore {
    state: RoomState | null;
    status: "connecting" | "open" | "reconnecting" | "closed";
    words: WordEntry[];
    usedPacks: Set<string>;
    lastError: { code: string; message?: string } | null;
    send(msg: ClientMessage): void;
    clearError(): void;
    disconnect(): void;
  }

  // $state<T>(initialValue) generic form avoids Svelte 5 narrowing `null` to `never`
  let store = $state<RoomStore | null>(null);
  let copyCodeLabel = $state<CopyLabel>("Copy code");
  let copyLinkLabel = $state<CopyLinkLabel>("Copy link");
  let wordInput = $state<string>("");
  let wordError = $state<string>("");
  let inputShake = $state<boolean>(false);

  onMount(() => {
    store = createRoomStore(data.code);

    // `onDestroy` fires for SPA navigations but NOT when a tab is closed on mobile.
    // `pagehide` fires reliably on iOS Safari for both tab-close and navigation.
    function handlePageHide() {
      store?.disconnect();
    }
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  });

  onDestroy(() => {
    store?.disconnect();
  });

  const roomState = $derived<RoomState | null>(store ? store.state : null);
  const playerCount = $derived(roomState?.players.length ?? 0);

  const myPlayerId = $derived.by(() => {
    if (typeof window === "undefined") return "";
    const raw = sessionStorage.getItem(`bsbingo_player_${data.code}`);
    return raw ? (JSON.parse(raw).playerId as string) : "";
  });

  const iAmHost = $derived(
    roomState?.hostId != null && roomState.hostId === myPlayerId && myPlayerId !== ""
  );

  const hostName = $derived(
    roomState?.players.find((p) => p.isHost)?.displayName ?? "the host"
  );
  const wordCount = $derived(store ? store.words.length : 0);
  const canStart = $derived(wordCount >= 5);
  const gameStarted = $derived(roomState?.phase === "playing");

  async function copyCode() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(data.code);
    copyCodeLabel = "Copied";
    setTimeout(() => (copyCodeLabel = "Copy code"), 2000);
  }

  async function copyLink() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(shareUrl);
    copyLinkLabel = "Copied";
    setTimeout(() => (copyLinkLabel = "Copy link"), 2000);
  }

  function submitWord() {
    const text = wordInput.trim();
    if (!text) return;
    store?.send({ type: "submitWord", text });
    wordInput = "";
    wordError = "";
  }

  function removeWord(wordId: string) {
    store?.send({ type: "removeWord", wordId });
  }

  function loadPack(pack: string) {
    store?.send({
      type: "loadStarterPack",
      pack: pack as "corporate-classics" | "agile" | "sales",
    });
  }

  function startGame() {
    store?.send({ type: "startGame" });
  }

  function handleWordInput() {
    if (wordError) {
      wordError = "";
      inputShake = false;
    }
  }

  $effect(() => {
    const err = store?.lastError;
    if (err && err.code === "duplicate_word") {
      wordError = err.message ?? "Word already in the pool";
      inputShake = true;
      store?.clearError();
      setTimeout(() => { inputShake = false; }, 300);
    }
  });
</script>

<main class="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink-primary)] px-4 py-8 md:py-12">
  <div class="mx-auto max-w-[640px] flex flex-col gap-8">
    {#if gameStarted}
      <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h1 class="font-display text-[40px] sm:text-[56px] font-semibold text-[var(--color-accent)]">
          Game on!
        </h1>
        <p class="text-[var(--color-ink-secondary)]">
          Board generation coming in the next phase.
        </p>
      </div>
    {:else}
      <header
        class="flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-6 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-divider)]"
      >
        <div>
          <p class="text-sm font-semibold text-[var(--color-ink-secondary)]">Room code</p>
          <p
            class="font-display text-[40px] sm:text-[56px] font-semibold tracking-[0.1em] text-[var(--color-accent)] leading-[1.1]"
          >
            {data.code}
          </p>
        </div>
        <div class="flex flex-col gap-2 md:items-end">
          <Button variant="secondary" onclick={copyCode} aria-label="Copy room code">
            {#snippet children()}
              {#if copyCodeLabel === "Copied"}
                <Check size={16} />
              {:else}
                <Clipboard size={16} />
              {/if}
              {copyCodeLabel}
            {/snippet}
          </Button>
          <Button variant="secondary" onclick={copyLink} aria-label="Copy share link">
            {#snippet children()}
              {#if copyLinkLabel === "Copied"}
                <Check size={16} />
              {:else}
                <Clipboard size={16} />
              {/if}
              {copyLinkLabel}
            {/snippet}
          </Button>
        </div>
      </header>

      <section class="flex flex-col gap-4">
        <h2 class="text-2xl font-semibold">Players · {playerCount}</h2>
        {#if playerCount < 2}
          <p class="text-[var(--color-ink-secondary)]">
            Waiting for players. Share the code or link to get going.
          </p>
        {/if}
        <ul class="flex flex-col gap-2">
          {#each roomState?.players ?? [] as player (player.playerId)}
            <PlayerRow {player} />
          {/each}
        </ul>
      </section>

      <WordPool
        words={store?.words ?? []}
        playerId={myPlayerId}
        onDelete={removeWord}
      />

      <div class="flex flex-col gap-2">
        <div class="flex flex-col sm:flex-row gap-2">
          <div class="flex-1">
            <TextInput
              label="Add a buzzword"
              bind:value={wordInput}
              placeholder="Add a buzzword…"
              maxlength={30}
              error={wordError}
              shake={inputShake}
              onsubmit={submitWord}
              oninput={handleWordInput}
              id="word-input"
            />
          </div>
          <div class="sm:self-end">
            <Button
              variant="primary"
              onclick={submitWord}
              disabled={wordInput.trim().length === 0}
            >
              {#snippet children()}Add{/snippet}
            </Button>
          </div>
        </div>
      </div>

      {#if iAmHost}
        <PackPills
          usedPacks={store?.usedPacks ?? new Set()}
          onLoad={loadPack}
        />
      {/if}

      <footer class="flex flex-col gap-4">
        <GridProgress
          {wordCount}
          isHost={iAmHost}
          {hostName}
        />
        {#if iAmHost}
          <div class="w-full sm:min-w-[180px]">
            <Button
              variant="primary"
              onclick={startGame}
              disabled={!canStart}
            >
              {#snippet children()}
                <Play size={16} />
                Start Game
              {/snippet}
            </Button>
          </div>
        {:else}
          <p class="text-base text-[var(--color-ink-secondary)]">
            Waiting for {hostName} to start the game…
          </p>
        {/if}
      </footer>
    {/if}
  </div>
</main>
