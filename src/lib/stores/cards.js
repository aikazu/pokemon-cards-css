import { writable } from "svelte/store";

/**
 * Shared store for all card data fetched from cards.json.
 * Replaces the legacy window.cards global assignment.
 * @type {import("svelte/store").Writable<any[]>}
 */
export const cards = writable([]);
