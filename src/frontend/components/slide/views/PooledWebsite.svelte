<script lang="ts">
    import { onDestroy } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import { currentWindow, websiteReload, websiteSlideControl } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import Button from "../../inputs/Button.svelte"
    import type { WebsiteSlot } from "./websitePool"

    // a website kept loaded in an output view, placed over its slide placeholder while shown
    export let website: WebsiteSlot
    export let container: HTMLElement | undefined
    export let outputId = ""
    export let ratio = 1

    $: visible = !!website.element
    $: src = website.src

    // POSITION

    let rect = { left: 0, top: 0, width: 0, height: 0 }
    let frame = 0
    // follow the placeholder (slide transitions, resizing) only while shown
    $: if (visible && !frame) followPlaceholder()
    function followPlaceholder() {
        const update = () => {
            if (!website.element) {
                frame = 0
                return
            }
            updateRect()
            frame = requestAnimationFrame(update)
        }
        update()
    }
    onDestroy(() => cancelAnimationFrame(frame))

    function updateRect() {
        if (!website.element || !container) return
        const c = container.getBoundingClientRect()
        const r = website.element.getBoundingClientRect()
        // the output is scaled, so convert back to the container's own coordinates
        const scale = container.offsetWidth ? c.width / container.offsetWidth : 1
        const newRect = { left: (r.left - c.left) / scale, top: (r.top - c.top) / scale, width: r.width / scale, height: r.height / scale }
        if (newRect.left !== rect.left || newRect.top !== rect.top || newRect.width !== rect.width || newRect.height !== rect.height) rect = newRect
    }

    // WEBVIEW

    let webview: any
    let webviewReady = false

    function initWebview(node: HTMLElement) {
        node.addEventListener("dom-ready", onDomReady)
        node.addEventListener("did-finish-load", setStyle)
        node.addEventListener("did-navigate", checkNavigation)

        return {
            destroy() {
                node.removeEventListener("dom-ready", onDomReady)
                node.removeEventListener("did-finish-load", setStyle)
                node.removeEventListener("did-navigate", checkNavigation)
            }
        }
    }

    function onDomReady() {
        webviewReady = true
        checkNavigation()
        setStyle()
        if (visible) focusWebsite()
    }

    $: if (webviewReady) setStyle(website.zoom)
    // only the output window plays audio, and only while the website is shown
    $: if (webviewReady) setMuted($currentWindow !== "output" || !visible)

    function setStyle(_updater: any = null) {
        if (!webview || !webviewReady) return
        const factor = (parseFloat(website.zoom?.toString() || "100") || 100) / 100

        try {
            webview.setZoomFactor(factor)
        } catch (err) {
            console.debug("Failed to set webview zoom factor:", err)
        }

        // custom scale does often not work on embeds (Presentations)
        if (src.includes("embed")) return

        webview
            .executeJavaScript(
                `
                if (document.documentElement) document.documentElement.style.zoom = '${factor}';
                if (document.body) {
                    document.body.style.transformOrigin = '0 0';
                    document.body.style.width = '100%';
                    document.body.style.height = '100%';
                }
            `
            )
            ?.catch((err: any) => console.debug("Webview executeJavaScript failed:", err))
    }

    function setMuted(muted: boolean) {
        try {
            webview.setAudioMuted(muted)
        } catch (err) {
            console.debug("Failed to mute webview audio:", err)
        }
    }

    function focusWebsite() {
        if ($currentWindow !== "output" || !outputId) return

        send(OUTPUT, ["FOCUS"], { id: outputId })
        setTimeout(() => {
            try {
                webview?.focus()
            } catch (err) {
                console.debug("Webview focus failed:", err)
            }
        })
    }

    // SLIDE CONTROLS & REFRESH

    let lastSlideControl = 0
    $: if ($websiteSlideControl && $websiteSlideControl.time !== lastSlideControl) sendSlideControl($websiteSlideControl)
    function sendSlideControl(data: { outputId: string; keyCode: "Right" | "Left"; src?: string; time: number }) {
        lastSlideControl = data.time
        if (!visible || data.outputId !== outputId || !webview || !webviewReady) return
        // slide controls go to websites with the option on, buttons (src) to that website
        if (data.src ? data.src !== src : !website.slideControls) return

        try {
            webview.sendInputEvent({ type: "keyDown", keyCode: data.keyCode })
            webview.sendInputEvent({ type: "keyUp", keyCode: data.keyCode })
        } catch (err) {
            console.debug("Could not send key to website:", err)
        }
    }

    let lastReload = 0
    $: if ($websiteReload && $websiteReload.time !== lastReload) reload($websiteReload)
    function reload(data: { outputId: string; src: string; time: number }) {
        lastReload = data.time
        if (data.outputId !== outputId || data.src !== src || !webview || !webviewReady) return

        try {
            webview.reload()
        } catch (err) {
            console.debug("Could not reload website:", err)
        }
    }

    // NAVIGATION

    let hover = false
    let backDisabled = true
    let forwardDisabled = true
    let url = src

    function navigate(back = true) {
        if (!webview || !webviewReady) return

        try {
            if (back) webview.goBack()
            else webview.goForward()
        } catch (err) {
            console.debug("Webview navigation failed:", err)
        }

        setTimeout(checkNavigation)
    }

    function checkNavigation() {
        if (!webviewReady || !webview) return

        try {
            backDisabled = !webview.canGoBack()
            forwardDisabled = !webview.canGoForward()
            url = webview.getURL() || src
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

<div class="website" class:visible class:clickable={visible && $currentWindow === "output"} style="left: {rect.left}px;top: {rect.top}px;width: {rect.width}px;height: {rect.height}px;" on:mouseover={() => (hover = true)} on:focus={() => (hover = true)} on:mouseleave={() => (hover = false)}>
    {#if website.navigation && hover && visible && $currentWindow === "output"}
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
    <webview {src} bind:this={webview} use:initWebview />
</div>

<style>
    .website {
        position: absolute;
        pointer-events: none;
        /* keep rendering while hidden (display: none would unload the view) */
        visibility: hidden;
    }
    .website.visible {
        visibility: visible;
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
</style>
