<script lang="ts">
    import { getContext, onDestroy } from "svelte"
    import { uid } from "uid"
    import type { Styles } from "../../../../types/Settings"
    import type { OutBackground, Transition } from "../../../../types/Show"
    import { clone } from "../../helpers/array"
    import type { RevealSync } from "../revealSync"
    import { REVEAL_SYNC_KEY } from "../revealSync"
    import BackgroundMedia from "./BackgroundMedia.svelte"

    export let data: OutBackground
    export let outputId: string
    export let transition: Transition
    export let currentStyle: Styles | null = null
    export let slideFilter = ""

    export let ratio = 1

    export let animationStyle = ""
    export let mirror = false

    $: duration = transition.duration ?? 800
    $: noTransition = transition.type === "none" || !duration
    $: style = `height: 100%;zoom: ${1 / ratio};transition: filter ${duration}ms, backdrop-filter ${duration}ms;${slideFilter}`

    let firstActive = true
    let background1: any = null
    let background2: any = null
    let firstFadingOut = false
    let currentlyLoadingFirst = false

    // WIP changing media while another transitions is not smooth
    // WIP changing quicly between media might make it not receive updates

    // don't show a new background before the new slide text is ready (and the other way around)
    const revealSync = getContext<RevealSync | undefined>(REVEAL_SYNC_KEY)
    const revealId = `background_${uid(5)}`
    let cancelReveal: (() => void) | null = null
    $: maxLoadTime = Math.max(2000, duration)
    function holdReveal() {
        revealSync?.hold(revealId, duration + maxLoadTime)
    }
    function releaseReveal() {
        cancelReveal?.()
        cancelReveal = null
        revealSync?.release(revealId)
    }
    onDestroy(releaseReveal)

    let loading = false
    let timeout: NodeJS.Timeout | null = null
    let tooRapid: NodeJS.Timeout | null = null
    let tryAgain = false
    $: if (data) createBackground()
    function createBackground() {
        // prevent svelte bug creating multiple items if creating new while old clears
        if (tooRapid) {
            tryAgain = true
            holdReveal()
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
            releaseReveal()
            background1 = null
            background2 = null
            return
        }

        let newData = clone(data)

        // update existing background, if same
        let activeId = firstActive ? background1?.path || background1?.id : background2?.path || background2?.id
        if (activeId === (data.path || data.id)) {
            releaseReveal()
            if (firstActive) {
                background1 = newData
                transition1 = clone(transition)
            } else {
                background2 = newData
                transition2 = clone(transition)
            }
            return
        }

        // Online player videos (YouTube/Vimeo) should not have dual overlapping iframes during transitions
        const isPlayer = newData?.type === "player" || background1?.type === "player" || background2?.type === "player"
        if (isPlayer) {
            releaseReveal()
            background1 = newData
            background2 = null
            transition1 = clone(transition)
            firstActive = true
            loading = false
            return
        }

        const hasActiveBg = !!(background1 || background2)
        const mountDelay = hasActiveBg ? duration / 4 + 20 : 0
        cancelReveal?.()
        cancelReveal = null
        holdReveal()
        timeout = setTimeout(() => {
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

            // max loading time fallback
            timeout = setTimeout(() => {
                if (loading) loaded(loadingFirst)
            }, maxLoadTime)
        }, mountDelay)
    }

    function loaded(isFirst: boolean) {
        if (!loading || currentlyLoadingFirst !== isFirst) return // media loaded, but probably fading out
        if (!revealSync) return showLoaded(isFirst)

        // wait for the slide text to be ready before swapping
        cancelReveal?.()
        revealSync.release(revealId)
        cancelReveal = revealSync.whenClear(() => {
            cancelReveal = null
            showLoaded(isFirst)
        }, maxLoadTime)
    }

    function showLoaded(isFirst: boolean) {
        if (!loading || currentlyLoadingFirst !== isFirst) return

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

<!-- without a transition the previous media is hidden right away (it's removed on the next tick) -->
<div class="media" {style}>
    {#if background1}
        <div class="media" class:hidden={!firstActive && (loading || noTransition)}>
            <BackgroundMedia data={background1Data} fadingOut={firstFadingOut} {outputId} transition={transition1} {currentStyle} animationStyle={animation1} {mirror} on:loaded={() => loaded(true)} />
        </div>
    {/if}
    {#if background2}
        <div class="media" class:hidden={firstActive && (loading || noTransition)}>
            <BackgroundMedia data={background2Data} fadingOut={!firstFadingOut} {outputId} transition={transition2} {currentStyle} animationStyle={animation2} {mirror} on:loaded={() => loaded(false)} />
        </div>
    {/if}
</div>

<style>
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
