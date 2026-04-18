<script lang="ts">
  import type { BoardCell, WinningLine } from "$lib/protocol/messages";
  import WinLineIcon from "./WinLineIcon.svelte";
  import Button from "./Button.svelte";
  import { formatWinLine } from "$lib/util/winLine";

  type Props = {
    winner: { playerId: string; displayName: string };
    winningLine: WinningLine;
    winningCellIds: string[];
    winningWords: string[];
    board: BoardCell[] | null;
    markedCellIds: Set<string>;
    isHost: boolean;
    isWinner: boolean;
    gridSize: 3 | 4 | 5;
    onStartNewGame: () => void;
  };
  let {
    winner,
    winningLine,
    winningWords,
    isHost,
    isWinner,
    gridSize,
    onStartNewGame,
  }: Props = $props();

  const winLineLabel = $derived(formatWinLine(winningLine));
</script>

<section class="flex flex-col items-center text-center gap-6 pt-8 pb-12">
  {#if isWinner}
    <h1
      class="font-display text-[40px] sm:text-[56px] font-semibold text-[var(--color-accent)] tracking-[0.02em] leading-[1.1]"
      aria-live="polite"
    >
      BINGO!
    </h1>
    <p class="text-[24px] font-semibold text-[var(--color-ink-primary)]">{winner.displayName}</p>
  {:else}
    <h1
      class="text-[24px] font-semibold text-[var(--color-ink-primary)]"
      aria-live="polite"
    >
      {winner.displayName} got Bingo!
    </h1>
  {/if}

  <WinLineIcon {gridSize} {winningLine} />

  <p class="text-base text-[var(--color-ink-secondary)]">
    {isWinner ? "You called it." : ""} {winLineLabel}{isWinner ? "." : " completed."}
  </p>

  {#if winningWords.length > 0}
    <div class="flex flex-wrap justify-center gap-2" aria-label="Winning words">
      {#each winningWords as word}
        <span
          class="px-3 py-1.5 rounded-full text-sm font-semibold
                 bg-[var(--color-accent)] text-[var(--color-ink-inverse)]"
        >
          {word}
        </span>
      {/each}
    </div>
  {/if}

  {#if !isWinner}
    <p class="text-base text-[var(--color-ink-secondary)]">Nice try. One more round?</p>
  {/if}

  {#if isHost}
    <div class="flex flex-col items-center gap-2 w-full sm:w-auto">
      <Button variant="primary" onclick={onStartNewGame}>
        {#snippet children()}Start new game{/snippet}
      </Button>
      <p class="text-sm text-[var(--color-ink-secondary)]">
        Word pool and players are kept. You can tweak the pool before starting.
      </p>
    </div>
  {:else}
    <p class="text-base text-[var(--color-ink-secondary)]">
      Waiting for the host to start a new game.
    </p>
  {/if}
</section>
