<script lang="ts">
    import { onDestroy } from "svelte"
    import { MAIN, OUTPUT } from "../../../types/Channels"
    import { activePopup, alertMessage, currentOutputSettings, outputDisplay, outputs } from "../../stores"
    import { destroy, receive, send } from "../../utils/request"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import { keysToID, sortByName } from "../helpers/array"

    export let activateOutput: boolean = false

    let options: any[] = []
    $: options = sortByName(keysToID($outputs))
    $: if (options.length && (!$currentOutputSettings || !$outputs[$currentOutputSettings])) currentOutputSettings.set(options[0].id)

    let screens: any[] = []

    let screenId: string | null = null
    $: screenId = $currentOutputSettings
    let currentScreen: any = {}
    $: currentScreen = screenId ? $outputs[screenId] || {} : {}

    // find matching screen
    $: if (!currentScreen.screen && screens.length) {
        let match = screens.find((screen) => JSON.stringify(screen.bounds) === JSON.stringify(currentScreen.bounds))
        if (match?.id) {
            outputs.update((a: any) => {
                a[screenId!].screen = match.id.toString()
                return a
            })
        }
    }

    let totalScreensWidth: number = 0

    let listenerId = "SCREENS"
    send(MAIN, ["GET_DISPLAYS"])
    // send(MAIN, ["GET_SCREENS"])
    receive(
        MAIN,
        {
            GET_DISPLAYS: (d: any) => {
                // d.push(fakeScreen0)
                // d.push(fakeScreen)
                // d.push(fakeScreen2)
                // d.push(fakeScreen3)

                let sortedScreens = d.sort(sortScreensByPosition)
                screens = sortedScreens.sort(internalFirst)

                let negativeWidth = screens.reduce((value, current) => (current.bounds.x < 0 ? value + current.bounds.width : value), 0)
                let positiveWidth = screens.reduce((value, current) => (current.bounds.x >= 0 ? value + current.bounds.width : value), 0)
                totalScreensWidth = (positiveWidth - negativeWidth) / 2
            },
            SET_SCREEN: (d: any) => {
                if (currentScreen.screen) return

                outputs.update((a) => {
                    a[screenId!].screen = d.id.toString()
                    return a
                })
            },
            // GET_SCREENS: (d: any) => (screens = d),
        },
        listenerId
    )
    onDestroy(() => destroy(MAIN, listenerId))

    // const fakeScreen0 = {
    //     bounds: { x: -864 - 1536, y: -452, width: 1536, height: 1536 },
    //     id: 2528732444,
    //     internal: false,
    // }
    // const fakeScreen = {
    //     bounds: { x: -864, y: -452, width: 864, height: 1536 },
    //     id: 2528732444,
    //     internal: false,
    // }
    // const fakeScreen2 = {
    //     bounds: { x: 1920 + 1536, y: 0, width: 1536, height: 1536 },
    //     id: 2528732444,
    //     internal: false,
    // }
    // const fakeScreen3 = {
    //     bounds: { x: 1920 + 1536 + 1536, y: 0, width: 1536, height: 1536 },
    //     id: 2528732444,
    //     internal: false,
    // }

    function internalFirst(a, b) {
        return b.internal - a.internal
    }
    function sortScreensByPosition(a, b) {
        let aX = a.bounds.x
        let bX = b.bounds.x

        return aX - bX
    }

    function changeOutputScreen(e: any) {
        if (!currentScreen) return

        let bounds = e.detail.bounds
        let keyOutput = currentScreen.keyOutput
        outputs.update((a) => {
            if (!a[screenId!]) return a

            a[screenId!].bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
            a[screenId!].screen = e.detail.id.toString()
            // a[screenId!].kiosk = true

            if (keyOutput && a[keyOutput]) {
                a[keyOutput].bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
                a[keyOutput].screen = e.detail.id.toString()
            }
            return a
        })

        setTimeout(() => {
            let enabled = activateOutput || $outputDisplay
            send(OUTPUT, ["DISPLAY"], { enabled, output: { id: screenId, ...currentScreen }, reset: true })
            // send(OUTPUT, ["TOGGLE_KIOSK"], { id: screenId, enabled: true })
            // setTimeout(() => {
            send(OUTPUT, ["UPDATE_BOUNDS"], { id: screenId, ...currentScreen })
            // }, 100)

            if (keyOutput) {
                send(OUTPUT, ["DISPLAY"], { enabled, output: { id: keyOutput, ...currentScreen }, reset: true })
                send(OUTPUT, ["UPDATE_BOUNDS"], { id: keyOutput, ...currentScreen })
            }
        }, 100)

        if (activateOutput) {
            activePopup.set(null)
            alertMessage.set("")
        }
    }

    function identifyScreens() {
        send(OUTPUT, ["IDENTIFY_SCREENS"], screens)
    }
</script>

<p style="margin-bottom: 10px;"><T id="settings.select_display" /></p>
<Button on:click={() => activePopup.set("change_output_values")} style="width: 100%;" dark center>
    <Icon id="screen" right />
    <p><T id="settings.manual_input_hint" /></p>
</Button>

<Button on:click={identifyScreens} style="width: 100%;" dark center>
    <Icon id="search" right />
    <p><T id="settings.identify_screens" /></p>
</Button>

<br />

<div class="content">
    {#if screens.length}
        <div class="screens" style="transform: translateX(-{totalScreensWidth}px)">
            {#each screens as screen, i}
                <div
                    class="screen"
                    class:disabled={currentScreen?.forcedResolution}
                    class:active={$outputs[screenId || ""]?.screen === screen.id.toString()}
                    style="width: {screen.bounds.width}px;height: {screen.bounds.height}px;left: {screen.bounds.x}px;top: {screen.bounds.y}px;"
                    on:click={() => {
                        if (!currentScreen?.forcedResolution) changeOutputScreen({ detail: { id: screen.id, bounds: screen.bounds } })
                    }}
                >
                    {i + 1}
                </div>
            {/each}
        </div>
    {:else}
        <T id="remote.loading" />
    {/if}
</div>

<style>
    .content {
        width: 100%;
        display: flex;
        /* justify-content: center; */
        /* transform: translateX(-20%); */
    }
    .screens {
        zoom: 0.08;
        font-size: 20em;
        overflow: visible;
        /* position: relative;
        margin-top: auto; */
        position: absolute;
        left: 50%;
        top: calc(50% + 350px);
        transform: translateX(-1080px);

        /* width: 30%;
    position: absolute;
    left: 50%;
    transform: translateX(-50%); */
    }

    .screen {
        position: absolute;
        /* transform: translateX(-50%); */

        display: flex;
        align-items: center;
        justify-content: center;

        background-color: var(--primary);
        outline: 40px solid var(--primary-lighter);
        transition: background-color 0.1s;
    }

    .screen:hover:not(.disabled) {
        background-color: var(--primary-lighter);
        cursor: pointer;
    }

    .screen.active {
        background-color: var(--secondary);
        color: var(--secondary-text);
    }

    .screen.disabled {
        opacity: 0.5;
    }
</style>
