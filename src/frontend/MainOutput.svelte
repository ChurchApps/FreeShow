<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { fade } from "svelte/transition"
    import { OUTPUT } from "../types/Channels"
    import type { Resolution } from "../types/Settings"
    import { getResolution } from "./components/helpers/output"
    import Output from "./components/output/Output.svelte"
    import { getStyleResolution } from "./components/slide/getStyleResolution"
    import StageLayout from "./components/stage/StageLayout.svelte"
    import { currentWindow, livePrepare, outputs, presenting, special, styles } from "./stores"
    import { onStreamFrame } from "./utils/streamPort"
    import { StreamCanvasRenderer } from "./components/drawer/live/streamCanvas"
    import { hideDisplay } from "./utils/common"
    import { send } from "./utils/request"

    $: outputId = Object.keys($outputs)[0]

    $: sceneStyleId = $outputs[outputId]?.out?.scene?.style

    // get output resolution
    let width = 0
    let height = 0
    let resolution: Resolution = getResolution()
    $: if ($currentWindow === "output") resolution = getResolution(null, { $outputs, $styles }, true, "", sceneStyleId)

    // $: outputStyle = getCurrentStyle($styles, $outputs[outputId]?.style)

    // enable output window dragging
    let enableOutputMove = false
    function mousemoveOutput(e: MouseEvent) {
        if ($outputs[outputId]?.boundsLocked || $special.hideCursor) return
        if (e.ctrlKey || e.metaKey || e.target?.closest(".dragger")) enableOutputMove = true
        else enableOutputMove = false
    }
    $: if ($currentWindow === "output") send(OUTPUT, ["MOVE"], { enabled: enableOutputMove })

    // presenter mode: this window draws the capture's frames rather than rendering the content itself
    let presentCanvas: HTMLCanvasElement | null = null
    const presentRenderer = new StreamCanvasRenderer()
    let unlistenPresent: (() => void) | null = null
    $: listenPresent($presenting)
    function listenPresent(active: boolean) {
        unlistenPresent?.()
        unlistenPresent = null
        if (!active) return
        unlistenPresent = onStreamFrame("PRESENT", ({ frame }) => {
            if (presentCanvas) presentRenderer.draw(presentCanvas, frame)
        })
    }
    onDestroy(() => {
        unlistenPresent?.()
        presentRenderer.destroy()
    })

    // make sure it's loaded to prevent output not changing to stage output because of Svelte transition bug
    let loaded = false
    onMount(() => {
        setTimeout(() => {
            loaded = true
        }, 2000)
    })

    // What this page shows, for main to decide whether another output may show this page's frames instead
    // of its own (RenderGroups.ts): whether a transition or animation is running, and a hash of the page's
    // content once it is still. An output joins another's render only when both pages are still and show
    // the same content, so a fade is never cut short and nothing changes on the switch.
    let rootEl: HTMLElement | null = null
    let reported = ""
    // the number of the last message main sent this page (OutputSend.ts), reported with the state it produced
    let appliedSeq = 0
    let checkQueued = false
    function queueCheck() {
        if (checkQueued) return
        checkQueued = true
        // after the current task, so a burst of changes is looked at once, settled
        setTimeout(reportState, 0)
    }
    function reportState() {
        checkQueued = false
        if (!outputId || !rootEl) return
        // a canvas drawn every frame (an effect) is never still: two pages running one are at different points in it
        const busy = document.getAnimations().some((a) => a.playState === "running") || !!rootEl.querySelector("[data-animated]")
        // the content as markup, minus what differs between windows showing the same thing: element ids
        // (some are random) and this output's own id
        const dom = busy ? "" : contentHash(rootEl.innerHTML.replace(/ id="[^"]*"/g, "").split(outputId).join("~"))
        const state = `${busy}|${dom}|${appliedSeq}`
        if (state === reported) return
        reported = state
        send(OUTPUT, ["RENDER_BUSY"], { id: outputId, busy, dom, seq: appliedSeq })
    }
    function contentHash(str: string): string {
        let h1 = 0xdeadbeef
        let h2 = 0x41c6ce57
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i)
            h1 = Math.imul(h1 ^ ch, 2654435761)
            h2 = Math.imul(h2 ^ ch, 1597334677)
        }
        return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`
    }
    const animationEvents = ["animationstart", "animationend", "animationcancel", "transitionrun", "transitionend", "transitioncancel"]
    onMount(() => {
        if ($currentWindow !== "output" || !rootEl) return
        const observer = new MutationObserver(queueCheck)
        observer.observe(rootEl, { subtree: true, childList: true, attributes: true, characterData: true })
        for (const ev of animationEvents) document.addEventListener(ev, queueCheck, true)
        // the state is looked at after the task that applies the message, so it includes it
        window.api.receive(
            OUTPUT,
            (msg: any) => {
                if (typeof msg?.seq !== "number") return
                appliedSeq = msg.seq
                queueCheck()
            },
            "RENDER_SEQ"
        )
        queueCheck()
        return () => {
            observer.disconnect()
            window.api.removeListener(OUTPUT, "RENDER_SEQ")
            for (const ev of animationEvents) document.removeEventListener(ev, queueCheck, true)
        }
    })
    $: if (outputId && $currentWindow === "output") queueCheck()
</script>

<div
    bind:this={rootEl}
    class="fill context #output_window"
    style="flex-direction: {getStyleResolution(resolution, width, height, 'fit').includes('width') && !Object.values($outputs)[0]?.stageOutput ? 'row' : 'column'};"
    class:hideCursor={$special.hideCursor}
    on:mousemove={mousemoveOutput}
    bind:offsetWidth={width}
    bind:offsetHeight={height}
    on:dblclick={(e) => {
        if (e.target?.closest(".website") || e.target?.closest(".clickable")) return
        hideDisplay()
    }}
>
    {#if enableOutputMove}
        <div class="dragger">
            <p>Drag window</p>
        </div>
    {/if}

    {#if $presenting}
        <canvas class="presentCanvas" bind:this={presentCanvas}></canvas>
    {:else if $outputs[outputId]?.stageOutput}
        <StageLayout {outputId} stageId={$outputs[outputId].stageOutput} edit={false} />
    {:else if loaded}
        <Output {outputId} style={getStyleResolution(resolution, width, height, "fit")} />
    {/if}

    <!-- black overlay for live preparation/changes -->
    {#if $livePrepare[outputId]}
        <div class="blackOverlay" transition:fade></div>
    {/if}

    <!-- preload CMGSans font -->
    {#if !loaded}<div class="fontPreload">.</div>{/if}
</div>

<style>
    .presentCanvas {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background-color: black;
    }

    .dragger {
        -webkit-app-region: drag;
        position: absolute;
        top: 0;
        left: 0;
        height: 5vh;
        width: 100%;
        z-index: 10;

        display: flex;
        justify-content: center;
        align-items: center;

        background-color: rgb(255 255 255 / 0.2);
    }

    .fill {
        height: 100%;
        width: 100%;
        overflow: hidden;

        display: flex;
        /* enable this to see the actual output window cropped size */
        /* background: var(--primary-darkest); */
    }

    .fill.hideCursor {
        cursor: none;
    }

    .fontPreload {
        font-family: "CMGSans";
        position: absolute;
        opacity: 0;
    }

    .blackOverlay {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);

        width: 100%;
        height: 100%;

        background-color: black;
    }
</style>
