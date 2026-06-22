<script lang="ts">
    import { onDestroy, tick } from "svelte"

    // Stage messenger flash background.
    // Pure renderer with no store dependencies so the same source can be duplicated in the server bundle.
    // Animation is driven by the Web Animations API: every meaningful change cancels the current run and
    // starts a fresh one, which is deterministic regardless of how Svelte reconciles the DOM.

    export let flash: boolean | undefined = false
    export let flashColor: string | undefined = ""
    export let flashCount: number | undefined = 0
    // External burst signal: incrementing this prop while flash is on forces a replay.
    // Used by the parent Stagebox to fire the stage-messenger pulse when a referenced text variable
    // transitions enabled: false -> true. Starts as undefined-equivalent (0) and the first reading is
    // only seeded into lastBurst, so a non-zero value at mount does not auto-fire.
    export let burstId: number | undefined = 0
    // External stop signal: incrementing this prop cancels any running pulse immediately.
    // Bumped by the parent Stagebox when a referenced text variable transitions enabled: true -> false
    // (variable goes away -> text disappears -> flash must die with it).
    export let stopId: number | undefined = 0

    // ---- Tunable constants -----------------------------------------------------------------
    // Total duration of a single pulse (rise + fade). Lower = more urgent feel.
    // Total runtime is FLASH_PULSE_DURATION * flashCount.
    const FLASH_PULSE_DURATION = 600 // ms per pulse (was 1200; ~600ms feels urgent without being epileptic)
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

    // Memo so unrelated re-renders (item sync, autosize, slide change, etc.) do not restart the pulse.
    // Initialized to sentinels that differ from any real state, so the first matching call always fires.
    let lastFlash = false
    let lastCount = 0
    let lastColor = ""
    // lastBurst / lastStop start undefined so the very first prop reading is only recorded
    // (no auto-fire / no auto-stop), even if the parent recreates this component with non-zero values.
    let lastBurst: number | undefined = undefined
    let lastStop: number | undefined = undefined

    $: trigger(!!flash, resolvedCount, resolvedColor, burstId ?? 0, stopId ?? 0)

    function trigger(isOn: boolean, count: number, color: string, burst: number, stopSignal: number) {
        const burstChanged = lastBurst !== undefined && burst !== lastBurst
        const stopChanged = lastStop !== undefined && stopSignal !== lastStop
        lastBurst = burst
        lastStop = stopSignal

        // External stop signal: cancel any running animation immediately.
        // Takes precedence over the burst signal so if both fire in the same tick, "stop" wins
        // (variable disabled => no text => no flash).
        if (stopChanged) {
            stop()
            return
        }

        // External burst takes precedence over the memo while flash is on
        if (burstChanged && isOn) {
            lastFlash = isOn
            lastCount = count
            lastColor = color
            play()
            return
        }

        // Existing memo for the other fields: replay only when flash/count/color actually change
        if (isOn === lastFlash && count === lastCount && color === lastColor) return
        lastFlash = isOn
        lastCount = count
        lastColor = color
        if (isOn) play()
        else stop()
    }

    async function play() {
        // Wait for Svelte to mount the div (it lives inside {#if flash}) before grabbing the binding.
        await tick()
        if (!el) return
        if (currentAnim) currentAnim.cancel()
        currentAnim = el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }], {
            duration: FLASH_PULSE_DURATION,
            iterations: lastCount,
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
