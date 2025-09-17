<script lang="ts">
    import Button from "../common/components/Button.svelte"
    import Center from "../common/components/Center.svelte"
    import Icon from "../common/components/Icon.svelte"
    import Slide from "./components/Slide.svelte"
    import { openLayout } from "./util/helpers"
    import { initSocket } from "./util/socket"
    import { _set, dictionary, errors, layouts, selectedLayout, stageLayout } from "./util/stores"

    initSocket()

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

        _set("selectedLayout", "")

        localStorage.removeItem("selectedLayout")
        localStorage.removeItem("show")
        localStorage.removeItem("password")
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
</script>

<svelte:window on:click={click} />

{#if $errors.length}
    <div class="error">
        {#each $errors as error}
            <span>{error}</span>
        {/each}
    </div>
{/if}

{#if $layouts === null}
    <Center>{$dictionary.remote?.loading}</Center>
{:else if !$selectedLayout}
    {#if $layouts.length}
        <div class="center" style="padding: 20px;flex-direction: column;">
            <h1>StageShow</h1>
            <span style="overflow: auto;width: 100%;">
                {#each $layouts as layout}
                    <Button style="width: 100%;justify-content: center;" on:click={() => openLayout(layout.id)}>
                        {layout.name || "—"}
                        <!-- {#if layout.password}
                            <Icon id="locked" style="padding-left: 10px;" />
                        {/if} -->
                    </Button>
                {/each}
            </span>
        </div>
    {:else}
        <Center faded>
            {$dictionary.empty?.shows}
        </Center>
    {/if}
{:else if $stageLayout}
    <Slide />

    {#if clicked}
        <div class="clicked">
            <h5 style="text-align: center;">{$stageLayout.name || "—"}</h5>
            <div style="display: flex;gap: 10px;">
                <Button on:click={goHome} style="flex: 1;" center>
                    <Icon id="home" />
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
        color: red;
        position: absolute;
        margin: 10px;
        padding: 10px;
        width: calc(100% - 20px);
        text-align: center;
        background-color: var(--primary-darker);
        display: flex;
        flex-direction: column;
    }

    .center {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
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
</style>
