<script lang="ts">
    import { onDestroy, tick } from "svelte"

    // Stage messenger flash background. Pure renderer (no store deps), driven by Web Animations API.

    export let flash: boolean | undefined = false
    export let flashColor: string | undefined = ""
    export let flashCount: number | undefined = 0
    // Playback is driven exclusively by burstId (play) and stopId (cancel) bumps from the parent,
    // emitted only on real variable false->true / true->false transitions. flash/color/count are
    // just rendering inputs; toggling them never auto-plays or auto-stops.
    export let burstId: number | undefined = 0
    export let stopId: number | undefined = 0

    const FLASH_PULSE_DURATION = 600 // ms per pulse
    const DEFAULT_FLASH_COLOR = "#FF0000"
    const DEFAULT_FLASH_COUNT = 3
    const MAX_FLASH_COUNT = 20

    $: resolvedColor = flashColor || DEFAULT_FLASH_COLOR
    $: resolvedCount = clampCount(Number(flashCount))

    function clampCount(value: number) {
        if (!Number.isFinite(value) || value < 1) value = DEFAULT_FLASH_COUNT
        return Math.min(MAX_FLASH_COUNT, Math.max(1, Math.floor(value)))
    }

    let el: HTMLDivElement | undefined
    let currentAnim: Animation | null = null

    // lastBurst / lastStop start undefined: the first reactive call only records them, never fires.
    // Guards mount / {#key} remount with burst/stop already non-zero. flash/color/count are pure
    // rendering inputs and have no `last*` because they never gate playback in either direction.
    let lastBurst: number | undefined = undefined
    let lastStop: number | undefined = undefined

    $: trigger(!!flash, resolvedCount, burstId ?? 0, stopId ?? 0)

    function trigger(isOn: boolean, count: number, burst: number, stopSignal: number) {
        const burstChanged = lastBurst !== undefined && burst !== lastBurst
        const stopChanged = lastStop !== undefined && stopSignal !== lastStop

        lastBurst = burst
        lastStop = stopSignal

        // stop wins over burst in the same tick
        if (stopChanged) {
            stop()
            return
        }
        if (burstChanged && isOn) play(count)
    }

    async function play(count: number) {
        await tick()
        if (!el) return
        if (currentAnim) currentAnim.cancel()
        currentAnim = el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }], {
            duration: FLASH_PULSE_DURATION,
            iterations: count,
            easing: "ease-out",
            fill: "forwards"
        })
    }

    function stop() {
        if (currentAnim) currentAnim.cancel()
        currentAnim = null
    }

    onDestroy(stop)
</script>

{#if flash}
    <div bind:this={el} class="flashBackground" style="background-color: {resolvedColor};"></div>
{/if}

<style>
    .flashBackground {
        position: absolute;
        inset: 0;
        opacity: 0;
        pointer-events: none;
        z-index: 0;
    }
</style>
