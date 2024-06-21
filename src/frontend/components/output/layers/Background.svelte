<script lang="ts">
    import type { OutBackground, Transition } from "../../../../types/Show"
    import { clone } from "../../helpers/array"
    import BackgroundMedia from "./BackgroundMedia.svelte"

    export let data: OutBackground
    export let outputId: string
    export let transition: Transition
    export let currentStyle: any = {}
    export let slideFilter: string = ""

    export let ratio: number = 1
    export let isKeyOutput: boolean = false

    export let animationStyle: string = ""
    export let mirror: boolean = false

    $: duration = transition.duration ?? 800
    $: style = `height: 100%;zoom: ${1 / ratio};transition: filter ${duration}ms, backdrop-filter ${duration}ms;${slideFilter}`

    let firstActive: boolean = true
    let background1: any = null
    let background2: any = null
    let firstFadingOut: boolean = false

    let loading: boolean = false
    let timeout: any = null
    $: if (data) createBackground()
    function createBackground() {
        // clearing
        if (!data.path && !data.id) {
            background1 = null
            background2 = null
            return
        }

        // update existing background, if same
        let activeId = firstActive ? background1?.path || background1?.id : background2?.path || background2?.id
        if (activeId === (data.path || data.id)) {
            if (firstActive) background1 = clone(data)
            else background2 = clone(data)
            return
        }

        if (loading) loading = false

        // prevent svelte bug creating multiple items if creating new while old clears
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(
            () => {
                loading = true
                let loadingFirst = !background1
                firstFadingOut = !loadingFirst

                if (!background1) background1 = clone(data)
                else background2 = clone(data)

                // max 2 seconds loading time
                timeout = setTimeout(() => {
                    if (loading) loaded(loadingFirst)
                    timeout = null
                }, 2000)
            },
            duration / 4 + 20
        )
    }

    function loaded(isFirst: boolean) {
        if (!loading) return

        loading = false
        firstActive = isFirst

        // allow firstActive to trigger first
        setTimeout(() => {
            if (isFirst) {
                background2 = null
            } else {
                background1 = null
            }
        })
    }

    // don't remove data when clearing
    let background1Data: OutBackground = {}
    let background2Data: OutBackground = {}
    $: if (background1) background1Data = clone(background1)
    $: if (background2) background2Data = clone(background2)
</script>

<div class="media" {style} class:key={isKeyOutput}>
    {#if background1}
        <div class="media" class:hidden={loading && !firstActive}>
            <BackgroundMedia data={background1Data} fadingOut={firstFadingOut} {outputId} {transition} {currentStyle} {animationStyle} {duration} mirror={mirror || !firstActive} on:loaded={() => loaded(true)} />
        </div>
    {/if}
    {#if background2}
        <div class="media" class:hidden={loading && firstActive}>
            <BackgroundMedia data={background2Data} fadingOut={!firstFadingOut} {outputId} {transition} {currentStyle} {animationStyle} {duration} mirror={mirror || firstActive} on:loaded={() => loaded(false)} />
        </div>
    {/if}
</div>

<style>
    .key {
        /* filter: brightness(50); */
        filter: grayscale(1) brightness(1000) contrast(100);
        /* filter: invert(1) grayscale(1) brightness(1000); */
    }

    .hidden {
        opacity: 0;
    }

    .media {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        transform: translate(-50%, -50%);
    }
</style>
