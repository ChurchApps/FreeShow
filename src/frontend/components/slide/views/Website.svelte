<script lang="ts">
    import { currentWindow } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import Button from "../../inputs/Button.svelte"
    import { attachPersistentWebview } from "./websiteDomPool"

    export let src: string
    export let navigation = true
    export let zoom: number | undefined = undefined
    export let clickable = false
    export let disablePreview = false
    export let outputId = ""
    export let ratio: number

    let webview: any
    let parsedSrc = ""
    let url = ""

    $: if (src) checkURL()

    function checkURL() {
        let valid = false
        src = src.replaceAll("&amp;", "&").replaceAll("{", "%7B").replaceAll("}", "%7D")
        if (!src.includes("://")) src = "http://" + src

        try {
            new URL(src)
            valid = true
        } catch (err) {
            console.error(err)
        }

        parsedSrc = valid ? src : ""
        url = parsedSrc
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
        try {
            if (back) webview.goBack?.()
            else webview.goForward?.()
        } catch (err) {
            console.debug("Webview navigation failed:", err)
        }
        setTimeout(checkNavigation)
    }

    function checkNavigation() {
        if (!webview) {
            backDisabled = true
            forwardDisabled = true
            return
        }
        try {
            backDisabled = !webview.canGoBack?.()
            forwardDisabled = !webview.canGoForward?.()
        } catch (err) {
            console.debug("Webview navigation check failed:", err)
        }
    }

    function formatUrl(url: string) {
        url = url.split("://")[1] || url
        url = url.replace("www.", "")
        if (url[url.length - 1] === "/") url = url.slice(0, -1)
        return url
    }
</script>

{#if disablePreview}
    <div class="iconPreview">
        <Icon id="web" size={3} white />
    </div>
{:else if parsedSrc}
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

        <div
            class="webview-container"
            use:attachPersistentWebview={{
                src: parsedSrc,
                zoom,
                isOutput: $currentWindow === "output",
                outputId,
                onReady: (wv) => {
                    webview = wv
                    checkNavigation()
                },
                onNavigate: (newUrl) => {
                    url = newUrl
                    checkNavigation()
                }
            }}
        />
    </div>
{/if}

<style>
    .website,
    .webview-container {
        position: absolute;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .website.clickable,
    .website.clickable .webview-container {
        pointer-events: initial;
    }

    .controls {
        z-index: 1;
        position: absolute;
        bottom: 0;
        left: 0;

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

    .iconPreview {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 100%;
        height: 100%;

        border: 2px solid white;
        background-color: rgb(0 50 100 / 0.3);

        zoom: 8;
    }
</style>
