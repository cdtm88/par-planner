<script lang="ts">
  import type { BoardCell, WinningLine } from "$lib/protocol/messages";
  import BoardCellComp from "./BoardCell.svelte";
  import WinLineIcon from "./WinLineIcon.svelte";
  import Button from "./Button.svelte";
  import { formatWinLine } from "$lib/util/winLine";

  type Props = {
    winner: { playerId: string; displayName: string };
    winningLine: WinningLine;
    winningCellIds: string[];
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
    winningCellIds,
    board,
    markedCellIds,
    isHost,
    isWinner,
    gridSize,
    onStartNewGame,
  }: Props = $props();

  const winCellIdSet = $derived(new Set(winningCellIds));
  const winLineLabel = $derived(formatWinLine(winningLine));
  // Derive cols from board.length (identical to Board.svelte) — more reliable than gridSize prop.
  // Literal tokens so Tailwind scanner includes all three: grid-cols-3 grid-cols-4 grid-cols-5
  const boardColsClass = $derived(
    board?.length === 16 ? "grid-cols-4" : board?.length === 25 ? "grid-cols-5" : "grid-cols-3"
  );
  // WinLineIcon still uses gridSize prop (it doesn't have board cells to count from).
  const iconColsClass = $derived(
    gridSize === 3 ? "grid-cols-3" : gridSize === 4 ? "grid-cols-4" : "grid-cols-5"
  );
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
    <WinLineIcon {gridSize} {winningLine} />
    <p class="text-base text-[var(--color-ink-secondary)]">You called it. {winLineLabel}.</p>
  {:else}
    <h1
      class="text-[24px] font-semibold text-[var(--color-ink-primary)]"
      aria-live="polite"
    >
      {winner.displayName} got Bingo!
    </h1>
    <WinLineIcon {gridSize} {winningLine} />
    <p class="text-base text-[var(--color-ink-secondary)]">{winLineLabel} completed.</p>
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

  {#if board}
    <div class={["grid w-full gap-2 pointer-events-none", boardColsClass].join(" ")}>
      {#each board as cell (cell.cellId)}
        <div data-win-line={winCellIdSet.has(cell.cellId) ? "true" : undefined}>
          <BoardCellComp
            {cell}
            marked={markedCellIds.has(cell.cellId)}
            onToggle={undefined}
          />
        </div>
      {/each}
    </div>
  {/if}
</section>
