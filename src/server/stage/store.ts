import { type Writable, writable } from "svelte/store"

export const events: Writable<any> = writable({})
export const timers: Writable<any> = writable({})
export const variables: Writable<any> = writable({})
export const activeTimers: Writable<any[]> = writable([])
export const timeFormat: Writable<"12" | "24"> = writable("24")
export const progressData: Writable<any> = writable({})
