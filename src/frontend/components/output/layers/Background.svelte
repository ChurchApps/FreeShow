<script lang="ts">
    import type { Styles } from "../../../../types/Settings"
    import type { OutBackground, Transition } from "../../../../types/Show"
    import { clone } from "../../helpers/array"
    import BackgroundMedia from "./BackgroundMedia.svelte"

    export let data: OutBackground
    export let outputId: string
    export let transition: Transition
    export let currentStyle: Styles | null = null
    export let slideFilter: string = ""

    export let ratio: number = 1
    export let isKeyOutput: boolean = false

    export let animationStyle: string = ""
    export let mirror: boolean = false
    export let styleBackground: boolean = false

    $: duration = transition.duration ?? 800
    $: style = `height: 100%;zoom: ${1 / ratio};transition: filter ${duration}ms, backdrop-filter ${duration}ms;${slideFilter}`

    let firstActive: boolean = true
    let background1: any = null
    let background2: any = null
    let firstFadingOut: boolean = false
    let currentlyLoadingFirst: boolean = false

    // WIP changing media while another transitions is not smooth
    // WIP changing quicly between media might make it not receive updates

    let loading: boolean = false
    let timeout: NodeJS.Timeout | null = null
    let tooRapid: NodeJS.Timeout | null = null
    let tryAgain: boolean = false
    $: if (data) createBackground()
    function createBackground() {
        // prevent svelte bug creating multiple items if creating new while old clears
        if (tooRapid) {
            tryAgain = true
            return
        }
        tooRapid = setTimeout(() => {
            tooRapid = null
            if (tryAgain) createBackground()
            tryAgain = false
        }, duration / 2)

        if (timeout) {
            clearTimeout(timeout)
            firstActive = !background2?.path
        }
        if (loading) loading = false

        // clearing
        if (!data.path && !data.id) {
            background1 = null
            background2 = null
            return
        }

        let newData = clone(data)

        // update existing background, if same
        let activeId = firstActive ? background1?.path || background1?.id : background2?.path || background2?.id
        if (activeId === (data.path || data.id)) {
            if (firstActive) {
                background1 = newData
                transition1 = clone(transition)
            } else {
                background2 = newData
                transition2 = clone(transition)
            }
            return
        }

        timeout = setTimeout(
            () => {
                loading = true
                let loadingFirst = !background1 // && background2?.path ? background2?.path !== data.path : background2?.id !== data.id
                currentlyLoadingFirst = loadingFirst
                firstFadingOut = !loadingFirst

                if (loadingFirst) {
                    background1 = newData
                    transition1 = clone(transition)
                } else {
                    background2 = newData
                    transition2 = clone(transition)
                }

                // max 2 seconds loading time
                timeout = setTimeout(() => {
                    if (loading) loaded(loadingFirst)
                }, 2000)
            },
            duration / 4 + 20
        )
    }

    function loaded(isFirst: boolean) {
        if (!loading || currentlyLoadingFirst !== isFirst) return // media loaded, but probably fading out

        loading = false
        firstActive = isFirst

        // allow firstActive to trigger first
        timeout = setTimeout(() => {
            if (isFirst) {
                background2 = null
            } else {
                background1 = null
            }
            timeout = null
        })
    }

    // don't remove data when clearing
    let background1Data: OutBackground = {}
    let background2Data: OutBackground = {}
    $: if (background1) background1Data = clone(background1)
    $: if (background2) background2Data = clone(background2)

    let transition1 = transition
    let transition2 = transition

    // don't "refresh" animation when chaning slide
    let animation1 = ""
    let animation2 = ""
    $: updateAnimation(animationStyle)
    function updateAnimation(animation) {
        setTimeout(
            () => {
                if (background1 && !(loading && !firstActive)) animation1 = animation
                else animation2 = animation
            },
            duration / 4 + 60
        )
    }
</script>

<div class="media" {style} class:key={isKeyOutput}>
    {#if background1}
        <div class="media" class:hidden={loading && !firstActive}>
            <BackgroundMedia data={background1Data} fadingOut={firstFadingOut} {outputId} transition={transition1} {currentStyle} animationStyle={animation1} {duration} {mirror} {styleBackground} on:loaded={() => loaded(true)} />
        </div>
    {/if}
    {#if background2}
        <div class="media" class:hidden={loading && firstActive}>
            <BackgroundMedia data={background2Data} fadingOut={!firstFadingOut} {outputId} transition={transition2} {currentStyle} animationStyle={animation2} {duration} {mirror} {styleBackground} on:loaded={() => loaded(false)} />
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
        inset-inline-start: 50%;
        width: 100%;
        height: 100%;
        transform: translate(-50%, -50%);
    }
</style>
