<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { currentWindow, outputs } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import Button from "../../inputs/Button.svelte"

    export let src: string
    export let navigation = true
    export let clickable = false

    let webview: any
    export let ratio: number

    let parsedSrc = ""
    $: if (src) checkURL()

    function checkURL() {
        let valid = false

        // format url
        src = src.replaceAll("&amp;", "&").replaceAll("{", "%7B").replaceAll("}", "%7D")
        if (!src.includes("://")) src = "http://" + src

        try {
            new URL(src)
            valid = true
        } catch (err) {
            console.error(err)
        }

        parsedSrc = valid ? src : ""
    }

    let loaded = false
    $: if (parsedSrc) loaded = false

    $: if (webview && ratio) setWebpageRatio()
    function setWebpageRatio() {
        // custom scale does often not work on embeds (Presentations)
        if (src.includes("embed")) return

        // if preview is fullscreen, don't set ratio
        let isFullscreen = (webview.closest(".previewOutput")?.offsetWidth || 0) > 450
        const inverse = isFullscreen ? 100 : Math.round(100 / ratio)

        if (loaded) setStyle()
        else {
            webview?.addEventListener("dom-ready", websiteLoaded)
            webview?.addEventListener("did-finish-load", setStyle)
            webview?.addEventListener("did-navigate", () => {
                checkNavigation()
                url = webview?.getURL() || parsedSrc
            })
        }

        function setStyle() {
            if (!webview) return
            loaded = true

            webview.executeJavaScript(`
            document.body.style.transform = 'scale(${isFullscreen ? 1 : ratio})';
            document.body.style.transformOrigin = '0 0';
            document.body.style.width = '${inverse}%';  // Scale factor inverse to maintain full width
            document.body.style.height = '${inverse}%';  // Scale factor inverse to maintain full height
        `)
        }
    }

    function websiteLoaded() {
        if ($currentWindow !== "output") return

        // set focus on website
        send(OUTPUT, ["FOCUS"], { id: Object.keys($outputs)[0] })
        setTimeout(() => webview?.focus())
    }

    let hover = false
    function mouseover() {
        hover = true
        checkNavigation()
    }
    function mouseleave() {
        hover = false
    }

    let backDisabled = true
    let forwardDisabled = true
    function navigate(back = true) {
        if (!webview) return

        if (back) webview.goBack()
        else webview.goForward()

        setTimeout(checkNavigation)
    }

    function checkNavigation() {
        backDisabled = !webview?.canGoBack()
        forwardDisabled = !webview?.canGoForward()
    }

    $: url = parsedSrc
    function formatUrl(url: string) {
        url = url.split("://")[1] || url
        url = url.replace("www.", "")
        if (url[url.length - 1] === "/") url = url.slice(0, -1)
        return url
    }
</script>

<div class="website" class:clickable on:mouseover={mouseover} on:focus={mouseover} on:mouseleave={mouseleave}>
    {#if navigation && hover && $currentWindow === "output"}
        <div class="controls" style="zoom: {1 / ratio};">
            {#if !backDisabled || !forwardDisabled}
                <Button on:click={() => navigate(true)} disabled={backDisabled}>
                    <Icon id="back" white />
                </Button>
                <Button on:click={() => navigate(false)} disabled={forwardDisabled}>
                    <Icon id="arrow_forward" white />
                </Button>
            {/if}

            <p class="url" style="zoom: {ratio};">{formatUrl(url)}</p>
        </div>
    {/if}
    <webview id="webview" src={parsedSrc} bind:this={webview} />
</div>

<style>
    .website {
        position: absolute;
        width: 100%;
        height: 100%;

        pointer-events: none;
    }

    .website.clickable {
        pointer-events: initial;
    }

    webview {
        width: 100%;
        height: 100%;
    }

    .controls {
        z-index: 1;
        position: absolute;
        bottom: 0;
        inset-inline-start: 0;

        background-color: black;
        border-start-end-radius: 3px;
        display: flex;

        opacity: 0.4;
    }
    .controls :global(button) {
        padding: 2px 4px !important;
    }

    .url {
        font-size: 0.15em;
        display: flex;
        align-items: center;
        padding: 2px 10px;
    }
</style>
