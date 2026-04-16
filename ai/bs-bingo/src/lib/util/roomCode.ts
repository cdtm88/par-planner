import { customAlphabet } from "nanoid";

// Per CONTEXT D-05/D-06: visually unambiguous — removes 0/O/1/I/L
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const makeRoomCode = customAlphabet(ROOM_CODE_ALPHABET, 6);

/** Strip characters not in the unambiguous alphabet (for paste normalization on the join input). */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g, "");
}
