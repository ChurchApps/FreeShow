<script lang="ts">
    import { onDestroy } from "svelte"

    export let activeKey: string = ""
    export let breakDuration: number = 0
    export let ratio: number = 1

    let remaining = 0
    let rafId: number | null = null
    let startTime = 0
    let prevKey = ""

    $: if (activeKey !== prevKey) {
        prevKey = activeKey
        if (rafId !== null) {
            cancelAnimationFrame(rafId)
            rafId = null
            remaining = 0
        }
        if (activeKey && breakDuration > 0) {
            startTime = Date.now()
            remaining = breakDuration
            const tick = () => {
                remaining = Math.max(0, breakDuration - (Date.now() - startTime) / 1000)
                rafId = remaining > 0 ? requestAnimationFrame(tick) : null
            }
            rafId = requestAnimationFrame(tick)
        }
    }

    onDestroy(() => {
        if (rafId !== null) cancelAnimationFrame(rafId)
    })

    const RADIUS = 45
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS
    $: dashOffset = CIRCUMFERENCE * (1 - remaining / breakDuration)
    $: svgSize = 50 / ratio
</script>

{#if activeKey && remaining > 0}
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; pointer-events: none; opacity: 0.9;">
        <svg width={svgSize} height={svgSize} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8" />
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="8" stroke-linecap="round" stroke-dasharray={CIRCUMFERENCE} stroke-dashoffset={dashOffset} transform="rotate(-90 50 50)" />
        </svg>
    </div>
{/if}
