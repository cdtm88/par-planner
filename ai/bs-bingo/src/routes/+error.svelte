<script lang="ts">
  import { page } from "$app/state";
  import ErrorPage from "$lib/components/ErrorPage.svelte";
  import { AlertTriangle } from "lucide-svelte";

  const heading = $derived(page.status === 404 ? "Room not found" : "Something went wrong");
  const body = $derived(
    page.status === 404
      ? "That game is over, the code is wrong, or the room expired. Want to kick off a new one?"
      : (page.error?.message ?? "An unexpected error occurred.")
  );
</script>

<ErrorPage
  {heading}
  {body}
  primaryAction={{ label: "Create a new game", href: "/" }}
>
  {#snippet icon()}
    <AlertTriangle size={48} class="text-[var(--color-destructive)]" />
  {/snippet}
</ErrorPage>
