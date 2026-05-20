<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import { OUTPUT } from "../../../../types/Channels"
    import { currentWindow } from "../../../stores"
    import { send } from "../../../utils/request"

    export let item
    $: captionData = item?.captions || {}

    let preview = $currentWindow !== "output"

    // custom audio input... (has to be changed in browser)

    // Awesome tool: https://github.com/steveseguin/captionninja
    const ninjaURL = "https://caption.ninja/"

    // can't have more than one active per computer
    const defaultRoomId = "freeshow" + (item?.id ? item.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6) : uid(6))
    $: roomId = captionData.roomId || defaultRoomId

    $: if (item && !item.captions) item.captions = {}
    $: if (item && item.captions && !item.captions.roomId) item.captions.roomId = defaultRoomId

    $: language = captionData.language || "en-US"
    $: showtime = (captionData.showtime || 5) * 1000
    $: translate = captionData.translate || ""
    $: googlekey = captionData.googlekey || ""

    $: fromLang = language.split("-")[0]

    $: roomURL = `${ninjaURL}?room=${roomId}&lang=${language}`

    let prevRoomURL = ""
    $: if (!preview && roomURL && roomURL !== prevRoomURL) {
        prevRoomURL = roomURL
        send(OUTPUT, ["ALERT_MAIN"], "captions#" + roomURL)
    }

    let ready = false
    onMount(() => {
        if (!preview) {
            setTimeout(loaded, 1000)
        }
    })

    function loaded() {
        ready = true
        console.info("CAPTIONS READY!")
    }

    // custom style
    let webElem: any
    $: if (webElem) webElem.addEventListener("dom-ready", overlayReady)
    function overlayReady() {
        let customStyle = captionData.style || ""

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
            <webview bind:this={webElem} class="fill" src="{ninjaURL}overlay?room={roomId}&showtime={showtime}{translate ? '&translate=' + translate + '&fromlang=' + fromLang : ''}{googlekey ? '&googlekey=' + googlekey : ''}" />
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
