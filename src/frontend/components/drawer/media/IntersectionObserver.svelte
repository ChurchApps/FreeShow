<script lang="ts">
    import { onMount } from "svelte"

    export let once: boolean = false
    export let top: number = 0
    export let bottom: number = 0
    export let left: number = 0
    export let right: number = 0

    let intersecting: boolean = false
    let container: HTMLDivElement

    onMount(() => {
        if (typeof IntersectionObserver === "undefined") return false

        const rootMargin = `${bottom}px ${left}px ${top}px ${right}px`

        const observer = new IntersectionObserver(
            (entries) => {
                intersecting = entries[0].isIntersecting
                if (intersecting && once) observer.unobserve(container)
            },
            { rootMargin }
        )

        observer.observe(container)
        return () => observer.unobserve(container)
    })
</script>

<div class={$$props.class} bind:this={container}>
    <slot {intersecting} />
</div>

<style>
    div {
        width: 100%;
        height: 100%;
    }
</style>
