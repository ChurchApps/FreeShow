import { writable, Writable } from "svelte/store"

export let events: Writable<any> = writable({})
export let timers: Writable<any> = writable({})
export let activeTimers: Writable<any[]> = writable([])
