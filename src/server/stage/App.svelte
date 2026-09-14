<script lang="ts">
    import { onMount } from "svelte"
    import Button from "../common/components/Button.svelte"
    import Icon from "../common/components/Icon.svelte"
    import { requestWakeLock } from "../common/util/wakeLock"
    import Slide from "./components/Slide.svelte"
    import TtsSettings from "./components/TtsSettings.svelte"
    import { openLayout, translate } from "./util/helpers"
    import { initSocket } from "./util/socket"
    import { _set, dictionary, errors, layouts, output, passwordRequiredLayout, selectedLayout, stageLayout } from "./util/stores"
    import { getCurrentSlideText, speakText, stopSpeech } from "./util/tts"

    initSocket()

    const freeshowLogo = new URL("../../../public/import-logos/freeshow.webp", import.meta.url).href

    let inputPassword: string = ""

    function submitPassword() {
        if (!$passwordRequiredLayout || !inputPassword.trim()) return
        _set("errors", [])
        const id = $passwordRequiredLayout.id
        openLayout(id, inputPassword)
        inputPassword = ""
    }
    function cancelPassword() {
        _set("errors", [])
        _set("passwordRequiredLayout", null)
        _set("selectedLayout", "")
        inputPassword = ""
    }

    let clicked: boolean = false
    const click = (e: any) => {
        if (e.target.closest(".clicked")) return

        // wait for actions to maybe open
        setTimeout(() => {
            if (document.querySelector(".actions")?.children?.length) return

            clicked = !clicked
        })
    }

    let timeout: NodeJS.Timeout | null = null
    $: {
        if (clicked) {
            if (timeout !== null) clearTimeout(timeout)
            timeout = setTimeout(() => {
                clicked = false
                timeout = null
            }, 3000)
        }
    }

    function goHome() {
        if (($layouts?.length || 0) < 2) return

        const currentId = $selectedLayout || $stageLayout?.id
        _set("selectedLayout", "")

        localStorage.removeItem("selectedLayout")
        localStorage.removeItem("show")
        localStorage.removeItem("password")
        if (currentId) localStorage.removeItem("password_" + currentId)
    }

    let isFullscreen: boolean = false
    function toggleFullscreen() {
        var doc = window.document
        var docElem = doc.documentElement

        if (!doc.fullscreenElement) {
            docElem.requestFullscreen.call(docElem)
            isFullscreen = true
        } else {
            doc.exitFullscreen.call(doc)
            isFullscreen = false
        }
    }

    onMount(() => {
        const handler = async () => {
            requestWakeLock()
            window.removeEventListener("click", handler)
            window.removeEventListener("touchstart", handler)
        }
        window.addEventListener("click", handler, { once: true })
        window.addEventListener("touchstart", handler, { once: true })
    })

    // Text-to-speech
    let ttsEnabled: boolean = false
    let lastSpokenSlideKey: string = ""
    let showTtsSettings: boolean = false
    function toggleTts() {
        if (!ttsEnabled) {
            ttsEnabled = true
            showTtsSettings = true
        } else {
            ttsEnabled = false
            stopSpeech()
        }
    }
    $: if (ttsEnabled && $output) {
        const slide = $output?.out?.slide
        const key = slide ? `${slide.id}-${slide.index}` : ""
        if (key && key !== lastSpokenSlideKey) {
            lastSpokenSlideKey = key
            const text = getCurrentSlideText()
            if (text) speakText(text)
        }
    }
</script>

<svelte:window on:click={click} />

{#if $errors.length && !$passwordRequiredLayout}
    <div class="error">
        {#each $errors as error}
            <span>{error}</span>
        {/each}
    </div>
{/if}

{#if $passwordRequiredLayout}
    <div class="auth-page">
        <div class="panel">
            <div class="brand">
                <h1>{$passwordRequiredLayout.name || "StageShow"}</h1>
            </div>

            <form on:submit|preventDefault={submitPassword} class="auth-form">
                {#if $errors.length}
                    <div class="auth-error">
                        {#each $errors as error}
                            <span>{error}</span>
                        {/each}
                    </div>
                {/if}

                <div class="field-group">
                    <div class="field">
                        <span class="icon" aria-hidden="true">
                            <Icon id="locked" size={1.1} white />
                        </span>
                        <input id="password-input" class="input" type="password" name="password" autocomplete="current-password" placeholder={translate("remote.password", $dictionary, "Password")} bind:value={inputPassword} autofocus />
                    </div>
                </div>

                <div class="actions">
                    <div style="display: flex; gap: 10px; width: 100%; justify-content: flex-end;">
                        <button type="button" class="cancel-button" on:click={cancelPassword} style="flex: 1;">
                            {translate("actions.cancel", $dictionary, "Cancel")}
                        </button>
                        <button type="submit" class="submit-button" disabled={!inputPassword.trim()} style="flex: 1;">
                            {translate("remote.submit", $dictionary, "Submit")}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>
{:else if $layouts === null}
    <div class="auth-page">
        <div class="panel" style="align-items: center; text-align: center;">
            <div class="brand">
                <img class="logo" src={freeshowLogo} alt="FreeShow logo" draggable="false" />
                <h1>StageShow</h1>
            </div>
            <p style="opacity: 0.7; font-size: 0.95em;">{translate("remote.loading", $dictionary, "Loading...")}</p>
        </div>
    </div>
{:else if !$selectedLayout}
    {#if $layouts.length}
        <div class="auth-page">
            <div class="panel">
                <div class="brand">
                    <img class="logo" src={freeshowLogo} alt="FreeShow logo" draggable="false" />
                    <h1>StageShow</h1>
                </div>

                <div class="stage-selection-list">
                    <div class="layout-buttons">
                        {#each $layouts as layout}
                            <button type="button" class="layout-button" on:click={() => openLayout(layout.id)}>
                                <span class="layout-name">{layout.name || "—"}</span>
                                {#if layout.password}
                                    <span class="lock-badge" title="Password protected">
                                        <Icon id="locked" size={1} white />
                                    </span>
                                {/if}
                            </button>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    {:else}
        <div class="auth-page">
            <div class="panel" style="align-items: center; text-align: center;">
                <div class="brand">
                    <img class="logo" src={freeshowLogo} alt="FreeShow logo" draggable="false" />
                    <h1>StageShow</h1>
                </div>
                <p style="opacity: 0.6; padding: 12px 0;">{translate("empty.shows", $dictionary, "No stage layouts found")}</p>
            </div>
        </div>
    {/if}
{:else if $stageLayout}
    <Slide />

    {#if showTtsSettings}
        <TtsSettings on:close={() => (showTtsSettings = false)} />
    {/if}

    {#if clicked}
        <div class="clicked">
            <h5 style="text-align: center;">{$stageLayout.name || "—"}</h5>
            <div style="display: flex;gap: 10px;">
                <Button on:click={goHome} style="flex: 1;" center>
                    <Icon id="home" />
                </Button>
                <Button on:click={toggleTts} center class={ttsEnabled ? "active" : ""}>
                    <Icon id={ttsEnabled ? "volume" : "muted"} />
                </Button>
                <Button on:click={toggleFullscreen} center>
                    <Icon id={isFullscreen ? "exitFullscreen" : "fullscreen"} />
                </Button>
            </div>
        </div>
    {/if}
{/if}

<style>
    :global(*) {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        user-select: none;
        -webkit-user-select: none; /* Safari/iOS specific */
        -webkit-touch-callout: none; /* Prevents iOS callout menu */
        -webkit-tap-highlight-color: transparent; /* Removes tap highlight on iOS */

        outline-offset: -4px;
        outline-color: var(--secondary);
    }

    :global(html) {
        height: 100%;
    }

    :global(body) {
        background-color: var(--primary);
        color: var(--text);
        /* transition: background-color 0.5s; */

        font-family: system-ui;
        font-size: 1.5em;

        height: 100%;

        /* iOS Safari touch optimizations */
        touch-action: manipulation;
        -webkit-text-size-adjust: 100%; /* Prevents iOS Safari from auto-zooming */

        /* width: 100vw;
  height: 100vh; */
    }

    :root {
        --primary: #242832;
        --primary-lighter: #2f3542;
        --primary-darker: #191923;
        --primary-darkest: #12121c;
        --text: #f0f0ff;
        --textInvert: #131313;
        --secondary: #f0008c;
        --secondary-opacity: rgba(240, 0, 140, 0.5);
        --secondary-text: #f0f0ff;

        --hover: rgb(255 255 255 / 0.05);
        --focus: rgb(255 255 255 / 0.1);
        /* --active: rgb(230 52 156 / .8); */

        /* --navigation-width: 18vw; */
        --navigation-width: 300px;
    }

    .error {
        color: #ff6b6b;
        position: absolute;
        margin: 10px;
        padding: 10px;
        width: calc(100% - 20px);
        text-align: center;
        background-color: var(--primary-darker);
        display: flex;
        flex-direction: column;
        z-index: 100;
        border-radius: 8px;
    }

    h1 {
        color: var(--secondary);
        text-align: center;
        padding-bottom: 20px;
    }

    .clicked {
        position: absolute;
        bottom: 0;
        left: 0;
        width: calc(100% - 20px);
        margin: 10px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background-color: var(--primary);
    }

    /* AUTH UI STYLES */
    .auth-page {
        position: relative;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: var(--primary-darkest);
    }

    .panel {
        position: relative;
        z-index: 1;
        width: min(520px, 94vw);
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 28px;
        border-radius: 18px;
        background: linear-gradient(160deg, rgb(255 255 255 / 0.06), rgb(255 255 255 / 0.03));
        border: 1px solid color-mix(in oklab, var(--primary-lighter) 80%, transparent);
        backdrop-filter: blur(12px);
    }

    .brand {
        display: inline-flex;
        gap: 12px;
        align-items: center;
        justify-content: center;
        align-self: center;
    }
    .logo {
        width: 44px;
        height: 44px;
        object-fit: contain;
        flex-shrink: 0;
        display: block;
    }
    .brand h1 {
        margin: 0;
        font-size: 1.2em;
        color: var(--text);
        letter-spacing: 0.4px;
        line-height: 1;
        padding-bottom: 0;
    }

    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 18px;
    }

    .auth-error {
        background: color-mix(in oklab, red 15%, transparent);
        border: 1px solid color-mix(in oklab, red 45%, transparent);
        color: #ff6b6b;
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 0.9em;
        text-align: center;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .field {
        position: relative;
        display: flex;
        align-items: center;
    }
    .icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: color-mix(in oklab, var(--text) 65%, transparent);
        pointer-events: none;
        z-index: 1;
    }
    .input {
        width: 100%;
        background: rgb(255 255 255 / 0.06);
        color: var(--text);
        padding: 12px 16px 12px 44px;
        border: 1.5px solid color-mix(in oklab, var(--primary-lighter) 75%, transparent);
        border-radius: 12px;
        font-size: 0.95em;
        transition: all 140ms ease;
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04);
    }
    .input:hover {
        border-color: color-mix(in oklab, var(--primary-lighter) 65%, var(--secondary) 35%);
        background: rgb(255 255 255 / 0.08);
    }
    .input:focus-visible {
        outline: none;
        border-color: var(--secondary);
        box-shadow:
            0 0 0 3px var(--secondary-opacity),
            inset 0 1px 0 rgb(255 255 255 / 0.08);
        background: rgb(255 255 255 / 0.1);
    }

    .actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 4px;
    }

    .submit-button {
        padding: 10px 18px;
        background: var(--secondary);
        color: var(--secondary-text);
        border: none;
        border-radius: 10px;
        font-family: inherit;
        font-size: 0.9em;
        font-weight: 600;
        cursor: pointer;
        transition: all 140ms ease;
    }
    .submit-button:hover:not(:disabled) {
        filter: brightness(1.08);
    }
    .submit-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .cancel-button {
        padding: 10px 18px;
        background: rgb(255 255 255 / 0.1);
        color: var(--text);
        border: 1px solid color-mix(in oklab, var(--primary-lighter) 75%, transparent);
        border-radius: 10px;
        font-family: inherit;
        font-size: 0.9em;
        font-weight: 500;
        cursor: pointer;
        transition: all 140ms ease;
    }
    .cancel-button:hover {
        background: rgb(255 255 255 / 0.16);
    }

    /* STAGE SELECTION STYLES */
    .stage-selection-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
    }

    .layout-buttons {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 55vh;
        overflow-y: auto;
        padding-right: 2px;
    }

    .layout-button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: rgb(255 255 255 / 0.06);
        color: var(--text);
        border: 1.5px solid color-mix(in oklab, var(--primary-lighter) 75%, transparent);
        border-radius: 12px;
        font-family: inherit;
        font-size: 1em;
        font-weight: 500;
        cursor: pointer;
        transition: all 140ms ease;
        text-align: left;
    }

    .layout-button:hover {
        border-color: color-mix(in oklab, var(--primary-lighter) 65%, var(--secondary) 35%);
        background: rgb(255 255 255 / 0.1);
        transform: translateY(-1px);
    }

    .layout-button:active {
        transform: translateY(0);
    }

    .layout-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .lock-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.85;
        margin-left: 10px;
        flex-shrink: 0;
    }
</style>
