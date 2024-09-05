<script lang="ts">
    import { onDestroy } from "svelte"
    import { MAIN } from "../../../../types/Channels"
    import { activeProject, outLocked, outputs, projects, special } from "../../../stores"
    import { destroy, receive, send } from "../../../utils/request"
    import { getFileName, removeExtension } from "../../helpers/media"
    import { getActiveOutputs } from "../../helpers/output"
    import Window from "../../output/Window.svelte"
    import Center from "../../system/Center.svelte"
    import T from "../../helpers/T.svelte"

    export let path: string = ""

    // get window

    let findWindowTimeout: any = null
    $: if (path) {
        if (findWindowTimeout) clearTimeout(findWindowTimeout)
        send(MAIN, ["GET_WINDOWS"])
    }

    let chooseWindow: any[] = []
    let chosenWindow: any = null

    receive(
        MAIN,
        {
            GET_WINDOWS: (a: any) => {
                chooseWindow = []
                chosenWindow = null

                let savedScreen = $projects[$activeProject || ""].shows.find((a) => a.id === path)?.data?.screenName
                if (savedScreen) {
                    let window = a.find((a) => a.name === savedScreen)
                    if (window) {
                        selectWindow(window)
                        return
                    }
                }

                let fileName = getFileName(path)
                let appName = ($special.presentationApp || "PowerPoint").split(" ")[0]

                let windows = a.filter((a) => a.name.includes(appName) && a.name.includes(fileName) && !a.name.includes(fileName + " - " + appName))
                if (!windows.length) windows = a.filter((a) => a.name.includes(removeExtension(fileName)) && a.name.includes(appName))
                if (!windows.length) windows = a.filter((a) => a.name.toLowerCase().includes(appName.toLowerCase()))

                if (windows.length === 1) {
                    selectWindow(windows[0])
                } else if (windows.length > 1) {
                    chooseWindow = windows
                } else {
                    if (findWindowTimeout) clearTimeout(findWindowTimeout)
                    if (!chosenWindow)
                        findWindowTimeout = setTimeout(() => {
                            send(MAIN, ["GET_WINDOWS"])
                        })
                }
            },
        },
        "GET_WINDOWS_PPT"
    )
    onDestroy(() => destroy(MAIN, "GET_WINDOWS_PPT"))

    function selectWindow(screenData: any, save: boolean = false) {
        chosenWindow = screenData

        // save chosen screen in project item
        if (save) {
            projects.update((a) => {
                let projectIndex = a[$activeProject || ""]?.shows?.findIndex((a) => a.id === path)
                if (projectIndex < 0) return a

                a[$activeProject!].shows[projectIndex].data = { screenName: chosenWindow.name }
                return a
            })
        }

        // update output with screen
        if ($outLocked) return

        let outputIds = getActiveOutputs()
        outputs.update((a) => {
            outputIds.forEach((id) => {
                if (a[id].out?.slide?.type !== "ppt") return
                a[id].out.slide.screen = chosenWindow
            })
            return a
        })
    }
</script>

{#if chosenWindow}
    <Window id={chosenWindow.id} class="media" style="width: 100%;height: 100%;pointer-events: none;position: absolute;" />
{:else if chooseWindow.length}
    <div style="display: flex;flex-direction: column;width: 100%;height: 100%;">
        <p style="padding: 0 10px;"><T id="presentation_control.choose_window" />:</p>
        <div class="choose">
            {#each chooseWindow as screen}
                <div class="screen" on:click={() => selectWindow(screen, true)}>
                    <Window id={screen.id} class="media" style="width: 100%;height: 100%;pointer-events: none;position: absolute;" />
                    <p title={screen.name}>{screen.name}</p>
                </div>
            {/each}
        </div>
    </div>
{:else}
    <Center faded><T id="remote.loading" /></Center>
{/if}

<style>
    .choose {
        width: 100%;
        height: 100%;

        display: flex;
    }

    .screen {
        position: relative;
        display: flex;
        flex-direction: column;
        flex: 1;

        cursor: pointer;
        transition: 0.3s filter;
    }

    .screen p {
        position: absolute;
        bottom: 10px;

        width: 100%;
        padding: 0 4px;
        text-align: center;

        background-color: var(--primary-darker);
    }

    .screen:hover {
        filter: brightness(0.8);
    }
</style>
