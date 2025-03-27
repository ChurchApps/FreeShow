<script lang="ts">
    import { onMount } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import { currentWindow } from "../../../stores"
    import { send } from "../../../utils/request"
    import { uid } from "uid"

    export let item
    $: captionData = item?.captions || {}

    let preview = $currentWindow !== "output"

    // custom audio input... (has to be changed in browser)

    // Awesome tool: https://github.com/steveseguin/captionninja
    const ninjaURL = "https://caption.ninja/"

    // can't have more than one active per computer
    let roomId = "freeshow" + uid(6)
    let roomURL: string = ""

    let showtime = 5000
    let translate = ""

    let ready: boolean = false
    onMount(startRoom)
    function startRoom() {
        if (preview) return

        let language = "en-US"
        if (captionData.language) language = captionData.language

        if (captionData.showtime) showtime = captionData.showtime * 1000
        if (captionData.translate) translate = captionData.translate

        // &label=<b>steve</b>
        roomURL = `${ninjaURL}?room=${roomId}&lang=${language}`

        send(OUTPUT, ["ALERT_MAIN"], "captions#" + roomURL)

        setTimeout(loaded, 1000)
    }

    function loaded() {
        ready = true
        console.info("CAPTIONS READY!")
    }

    // custom style
    let webElem: any
    $: if (webElem) webElem.addEventListener("dom-ready", overlayReady)
    function overlayReady() {
        let customStyle = captionData.style

        let background = "" // "black"
        let bgIndex = customStyle.lastIndexOf("background")
        if (bgIndex > -1) {
            let bgEnd = customStyle.indexOf(";", bgIndex)
            background = customStyle.slice(bgIndex, bgEnd)
            customStyle = customStyle.slice(0, bgIndex) + customStyle.slice(bgEnd + 1)
        }

        let customCSS = `body div.output {${customStyle};}`
        if (background) customCSS += `body div.output span {${background};}`

        webElem.insertCSS(customCSS)
    }
</script>

{#if preview}
    <div class="preview fill"></div>
{:else}
    <main class="captions fill">
        <!-- {#if roomURL}
            <iframe class="hidden" src={roomURL} frameborder="0" on:load={loaded} allow="microphone {roomURL}"></iframe>
        {/if} -->
        {#if ready}
            <webview bind:this={webElem} class="fill" src="{ninjaURL}overlay?room={roomId}&showtime={showtime}{translate ? '&translate=' + translate : ''}" />
        {/if}
    </main>
{/if}

<style>
    .fill {
        width: 100%;
        height: 100%;
    }

    .preview {
        background-color: rgb(0 0 0 / 0.5);
    }
</style>
