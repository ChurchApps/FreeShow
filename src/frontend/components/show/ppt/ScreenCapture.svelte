<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activeProject, outLocked, outputs, presentationData, projects, special } from "../../../stores"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"
    import { getFileName, removeExtension } from "../../helpers/media"
    import { getAllActiveOutputs } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Window from "../../output/Window.svelte"
    import Center from "../../system/Center.svelte"

    export let path = ""

    // get window

    let findWindowTimeout: NodeJS.Timeout | null = null
    $: if (path) requestWindows()
    function requestWindows() {
        if (findWindowTimeout) clearTimeout(findWindowTimeout)
        // give time for presentation window to start
        // this is needed if the window is being opened thile the presentation mode has already been active
        findWindowTimeout = setTimeout(
            () => requestMain(Main.GET_WINDOWS, undefined, receiveWindows),
            $presentationData?.id === path ? 1800 : 0 // 800 should be enough if the window is opened, but it might be closed
        )
    }

    let chooseWindow: any[] = []
    let chosenWindow: any = null

    function receiveWindows(a: any) {
        chosenWindow = null

        let savedScreen = $projects[$activeProject || ""]?.shows?.find(a => a.id === path)?.data?.screenName
        if (savedScreen) {
            let window = a.find(a => a.name === savedScreen)
            if (window) {
                selectWindow(window)
                return
            }
        }

        let fileName = getFileName(path)
        let appName = ($special.presentationApp || "PowerPoint").split(" ")[0]

        let windows = a.filter(a => a.name.includes(appName) && a.name.includes(fileName) && !a.name.includes(fileName + " - " + appName))
        if (!windows.length) windows = a.filter(a => a.name.includes(removeExtension(fileName)) && a.name.includes(appName))
        if (!windows.length) windows = a.filter(a => a.name.toLowerCase().includes(appName.toLowerCase()) || a.name.toLowerCase().includes(removeExtension(fileName).toLowerCase()))

        if (windows.length === 1) {
            selectWindow(windows[0])
        } else if (windows.length > 1) {
            chooseWindow = windows
        } else {
            chooseWindow = windows

            if (findWindowTimeout) clearTimeout(findWindowTimeout)
            if (!chosenWindow) {
                findWindowTimeout = setTimeout(() => {
                    requestMain(Main.GET_WINDOWS, undefined, receiveWindows)
                }, 800)
            }
        }
    }

    function selectWindow(screenData: any, save = false) {
        if (findWindowTimeout) clearTimeout(findWindowTimeout)

        chosenWindow = screenData

        // save chosen screen in project item
        if (save) {
            projects.update(a => {
                let projectIndex = a[$activeProject || ""]?.shows?.findIndex(a => a.id === path) ?? -1
                if (projectIndex < 0) return a

                a[$activeProject!].shows[projectIndex].data = { screenName: chosenWindow.name }
                return a
            })
        }

        // update output with screen
        if ($outLocked) return

        let outputIds = getAllActiveOutputs().map(({ id }) => id)
        outputs.update(a => {
            outputIds.forEach(id => {
                if (a[id].out?.slide?.type !== "ppt") return
                a[id].out.slide.screen = chosenWindow
            })
            return a
        })
    }
</script>

{#if chosenWindow}
    <!-- WIP save a snapshot of the first slide to preview? -->
    <Window id={chosenWindow.id} class="media" style="width: 100%;height: 100%;pointer-events: none;position: absolute;" />
{:else if chooseWindow.length}
    <div style="display: flex;flex-direction: column;width: 100%;height: 100%;">
        <p style="padding: 0 10px;"><T id="presentation_control.choose_window" />:</p>
        <div class="choose">
            {#each chooseWindow as screen}
                <div class="screen" role="button" tabindex="0" on:click={() => selectWindow(screen, true)} on:keydown={triggerClickOnEnterSpace}>
                    <Window id={screen.id} class="media" style="width: 100%;height: 100%;pointer-events: none;position: absolute;" />
                    <p data-title={screen.name}>{screen.name}</p>
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
    .screen:focus {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
    }
</style>
