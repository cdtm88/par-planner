import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { browser } from "$app/environment";

export const load: PageLoad = async ({ params, fetch }) => {
  if (!browser) return { code: params.code };
  const res = await fetch(`/api/rooms/${params.code}/exists`);
  if (!res.ok) error(404, { message: "Room not found" });
  return { code: params.code };
};
