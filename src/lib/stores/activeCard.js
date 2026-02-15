import { writable } from "svelte/store";

/**
 * @type {import("svelte/store").Writable<HTMLElement|undefined>}
 */
export const activeCard = writable(undefined);
