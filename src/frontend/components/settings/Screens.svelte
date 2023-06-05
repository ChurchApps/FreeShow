<script lang="ts">
    import { MAIN, OUTPUT } from "../../../types/Channels"
    import { activePopup, alertMessage, currentOutputSettings, outputDisplay, outputs } from "../../stores"
    import { receive, send } from "../../utils/request"
    import T from "../helpers/T.svelte"

    export let activateOutput: boolean = false

    let options: any[] = []
    $: options = Object.entries($outputs)
        .map(([id, a]) => ({ id, ...a }))
        .sort((a, b) => a.name.localeCompare(b.name))
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

    send(MAIN, ["GET_DISPLAYS"])
    // send(MAIN, ["GET_SCREENS"])
    receive(MAIN, {
        GET_DISPLAYS: (d: any) => {
            // d.push(fakeScreen)
            // d.push(fakeScreen2)
            let sortedScreens = d.sort(sortScreensByPosition)
            screens = sortedScreens.sort(internalFirst)
            totalScreensWidth = screens.reduce((value, current) => (current.bounds.x >= 0 ? value + current.bounds.width : value), 0)
        },
        SET_SCREEN: (d: any) => {
            if (currentScreen.screen) return

            outputs.update((a) => {
                a[screenId!].screen = d.id.toString()
                return a
            })
        },
        // GET_SCREENS: (d: any) => (screens = d),
    })

    // const fakeScreen = {
    //     accelerometerSupport: "unknown",
    //     bounds: { x: -864, y: -452, width: 864, height: 1536 },
    //     colorDepth: 24,
    //     colorSpace: "{primaries:BT709, transfer:SRGB, matrix:RGB, range:FULL}",
    //     depthPerComponent: 8,
    //     displayFrequency: 144,
    //     id: 2528732444,
    //     internal: false,
    //     monochrome: false,
    //     rotation: 0,
    //     scaleFactor: 1.25,
    //     size: { width: 1536, height: 864 },
    //     touchSupport: "unknown",
    //     workArea: { x: 1920, y: 216, width: 1536, height: 824 },
    //     workAreaSize: { width: 1536, height: 824 },
    // }
    // const fakeScreen2 = {
    //     accelerometerSupport: "unknown",
    //     bounds: { x: 1920 + 1536, y: 0, width: 864, height: 1536 },
    //     colorDepth: 24,
    //     colorSpace: "{primaries:BT709, transfer:SRGB, matrix:RGB, range:FULL}",
    //     depthPerComponent: 8,
    //     displayFrequency: 144,
    //     id: 2528732444,
    //     internal: false,
    //     monochrome: false,
    //     rotation: 0,
    //     scaleFactor: 1.25,
    //     size: { width: 1536, height: 864 },
    //     touchSupport: "unknown",
    //     workArea: { x: 1920, y: 216, width: 1536, height: 824 },
    //     workAreaSize: { width: 1536, height: 824 },
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
            a[screenId!].bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
            a[screenId!].screen = e.detail.id.toString()
            // a[screenId!].kiosk = true

            if (keyOutput) {
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
</script>

<div class="content">
    {#if screens.length}
        <div class="screens" style="transform: translateX(-{totalScreensWidth / 2}px)">
            {#each screens as screen, i}
                <div
                    class="screen"
                    class:active={$outputs[screenId || ""]?.screen === screen.id.toString()}
                    style="width: {screen.bounds.width}px;height: {screen.bounds.height}px;left: {screen.bounds.x}px;top: {screen.bounds.y}px;"
                    on:click={() => changeOutputScreen({ detail: { id: screen.id, bounds: screen.bounds } })}
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
        top: calc(50% + 200px);
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
        cursor: pointer;
        transition: background-color 0.1s;
    }

    .screen:hover {
        background-color: var(--primary-lighter);
    }

    .screen.active {
        background-color: var(--secondary);
        color: var(--secondary-text);
    }
</style>
