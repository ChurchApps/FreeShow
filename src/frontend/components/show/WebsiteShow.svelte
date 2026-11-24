<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import { OUTPUT } from "../../../types/Channels"
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"
    import { outputs, playerVideos, styles } from "../../stores"
    import { destroy, receive } from "../../utils/request"
    import Icon from "../helpers/Icon.svelte"
    import { findMatchingOut, getResolution } from "../helpers/output"
    import T from "../helpers/T.svelte"
    import { getWebsiteDomain, normalizeWebsiteUrl } from "../helpers/websiteControls"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialZoom from "../inputs/MaterialZoom.svelte"
    import WebsiteMirror from "../output/WebsiteMirror.svelte"
    import Center from "../system/Center.svelte"

    export let id: string

    const listenerId = "WEBSITE_SHOW_" + uid()

    $: website = $playerVideos[id]
    $: url = normalizeWebsiteUrl(website?.id || "")
    $: resolution = getResolution(null, { $outputs, $styles })
    $: captureWidth = resolution.width >= 640 ? resolution.width : 1920
    $: captureHeight = Math.round(captureWidth * (resolution.height / resolution.width))
    $: isOutputted = findMatchingOut(id, $outputs) !== null

    const capture = (payload: any) => sendMain(Main.WEBSITE_CAPTURE, { id, ...payload })
    const removeTrailingSlash = (value: string) => value.replace(/\/$/, "")

    let frameElem: HTMLDivElement
    let currentUrl = ""
    let canGoBack = false
    let canGoForward = false
    let zoom = 1

    $: domain = getWebsiteDomain(currentUrl || url, true) || currentUrl || url

    function setZoom(next: number) {
        zoom = Math.round(Math.min(3, Math.max(0.25, next)) * 100) / 100
        capture({ action: "zoom", zoom })
    }

    let startedKey = ""
    $: if (url) startIfNeeded(url, captureWidth, captureHeight)
    function startIfNeeded(nextUrl: string, width: number, height: number) {
        const key = `${id}|${nextUrl}|${width}x${height}`
        if (key === startedKey) return

        startedKey = key
        capture({ action: "start", url: nextUrl, width, height })
    }

    onMount(() => {
        receive(
            OUTPUT,
            {
                WEBSITE_NAV: (data: { websiteId: string; url: string; canGoBack: boolean; canGoForward: boolean }) => {
                    if (data?.websiteId !== id) return
                    currentUrl = data.url || ""
                    canGoBack = !!data.canGoBack
                    canGoForward = !!data.canGoForward
                }
            },
            listenerId
        )
    })

    onDestroy(() => {
        destroy(OUTPUT, listenerId)
    })

    function getCoords(e: MouseEvent) {
        const rect = frameElem.getBoundingClientRect()
        return {
            x: Math.round(((e.clientX - rect.left) / rect.width) * captureWidth),
            y: Math.round(((e.clientY - rect.top) / rect.height) * captureHeight)
        }
    }

    const mouseButton = (b: number) => (b === 1 ? "middle" : b === 2 ? "right" : "left")

    function sendMouse(type: "mouseMove" | "mouseDown" | "mouseUp", e: MouseEvent) {
        if (!frameElem) return

        if (type === "mouseDown") frameElem.focus()
        const { x, y } = getCoords(e)
        capture({ action: "input", input: { type, x, y, button: mouseButton(e.button), clickCount: type === "mouseMove" ? 0 : e.detail || 1 } })
    }

    function sendWheel(e: WheelEvent) {
        if (!frameElem || e.ctrlKey || e.metaKey) return
        e.preventDefault()

        const { x, y } = getCoords(e)
        capture({ action: "input", input: { type: "mouseWheel", x, y, deltaX: -e.deltaX, deltaY: -e.deltaY } })
    }

    function sendKey(type: "keyDown" | "keyUp", e: KeyboardEvent) {
        e.preventDefault()
        capture({ action: "input", input: { type, keyCode: e.key } })
        if (type === "keyDown" && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            capture({ action: "input", input: { type: "char", keyCode: e.key } })
        }
    }
</script>

{#if url}
    <div class="website">
        <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="frame"
            tabindex="0"
            bind:this={frameElem}
            style="aspect-ratio: {resolution.width} / {resolution.height};width: min(100cqw, calc(100cqh * {resolution.width / resolution.height}));"
            class:outputted={isOutputted}
            on:mousemove={(e) => sendMouse("mouseMove", e)}
            on:mousedown={(e) => sendMouse("mouseDown", e)}
            on:mouseup={(e) => sendMouse("mouseUp", e)}
            on:wheel={sendWheel}
            on:keydown={(e) => sendKey("keyDown", e)}
            on:keyup={(e) => sendKey("keyUp", e)}
            on:contextmenu|preventDefault
        >
            <WebsiteMirror {id} />
        </div>
    </div>

    <FloatingInputs side="left">
        <MaterialButton title="media.previous" disabled={!canGoBack} on:click={() => capture({ action: "nav", nav: "back" })}>
            <Icon id="previous" white />
        </MaterialButton>
        <MaterialButton title="media.next" disabled={!canGoForward} on:click={() => capture({ action: "nav", nav: "forward" })}>
            <Icon id="next" white />
        </MaterialButton>
        <MaterialButton title="preview.reload" on:click={() => capture({ action: "nav", nav: "reload" })}>
            <Icon id="refresh" white />
        </MaterialButton>
        <MaterialButton title="actions.home" disabled={removeTrailingSlash(currentUrl) === removeTrailingSlash(url)} on:click={() => capture({ action: "nav", nav: "home" })}>
            <Icon id="home" white />
        </MaterialButton>

        {#if domain}
            <div class="divider" />
            <p class="domain" data-title={currentUrl || url}>{domain}</p>
        {/if}
    </FloatingInputs>

    <FloatingInputs onlyOne>
        <MaterialZoom columns={zoom} defaultValue={1} min={0.25} max={3} addValue={-0.1} on:change={(e) => setZoom(e.detail)} />
    </FloatingInputs>
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

<style>
    .website {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        container-type: size;
        background-color: var(--primary-darkest);
    }

    .frame {
        position: relative;
        background-color: black;
        outline: none;
        cursor: pointer;
    }
    .frame.outputted {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
    }

    .domain {
        align-self: center;
        padding: 0 12px;
        font-size: 0.85em;
        opacity: 0.7;
        white-space: nowrap;
        max-width: 240px;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
