<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import type { ShowType } from "../../../../types/Show"
    import { clearAudio } from "../../../audio/audioFading"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePopup, activeProject, dictionary, focusMode, media, outLocked, outputs, playingAudio, popupData, projects, styles } from "../../../stores"
    import { audioExtensions, imageExtensions, videoExtensions } from "../../../values/extensions"
    import Card from "../../drawer/Card.svelte"
    import MediaLoader from "../../drawer/media/MediaLoader.svelte"
    import { sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getMediaStyle, getMediaType, getVideoDuration } from "../../helpers/media"
    import { findMatchingOut, getActiveOutputs, setOutput, startFolderTimer } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { clearBackground, clearSlide } from "../../output/clear"
    import Center from "../../system/Center.svelte"

    export let path: string
    export let index: number

    let data: { timer?: number } | undefined
    $: data = $projects[$activeProject || ""]?.shows[index]?.data

    type TFile = { path: string; name: string; type: ShowType; thumbnail?: string }
    let folderFiles: TFile[] = []
    const mediaExtensions = [...videoExtensions, ...imageExtensions, ...audioExtensions]
    onMount(async () => {
        const files = await requestMain(Main.READ_FOLDER, { path })
        folderFiles = sortByName(files.files.filter((a) => mediaExtensions.includes(a.extension)).map((a) => ({ path: a.path, name: a.name, type: getMediaType(a.extension), thumbnail: a.thumbnailPath })))

        // get total time
        let total = 0
        for (const file of folderFiles) {
            if (file.type === "image") total += timer
            else if (file.type === "video") total += await getVideoDuration(file.path)
        }
        totalTime = Math.ceil(total)
    })

    $: currentOutput = $outputs[getActiveOutputs()[0]]
    $: currentStyle = $styles[currentOutput?.style || ""] || {}

    function playMedia(file: TFile) {
        if ($outLocked) return

        if (file.type === "audio") {
            if (AudioPlayer.getPlaying(file.path)) clearAudio(file.path)
            else AudioPlayer.start(file.path, { name: file.name })
            return
        }

        if (findMatchingOut(file.path, $outputs)) {
            clearBackground()
            return
        }

        // video/image

        const mediaStyle = getMediaStyle($media[file.path], currentStyle)

        let videoType = mediaStyle.videoType || ""
        let loop = videoType === "foreground" ? false : true
        let muted = videoType === "background" ? true : false
        if (videoType === "foreground") clearSlide()
        setOutput("background", { path: file.path, type: file.type, loop, muted, startAt: 0, ...mediaStyle, ignoreLayer: videoType === "foreground" })

        startFolderTimer(path, file)
    }

    $: timer = data?.timer ?? 10
    let totalTime = 0
</script>

<div class="grid">
    {#if folderFiles.length}
        {#each folderFiles as file}
            {@const outputted = file.type === "audio" ? [AudioPlayer.getPlaying(file.path), $playingAudio][0] : findMatchingOut(file.path, $outputs)}
            <Card
                resolution={{ width: 16, height: 9 }}
                width={25}
                outlineColor={typeof outputted === "string" ? outputted : null}
                active={file.type === "audio" ? !!outputted : outputted !== null}
                label={file.name}
                title={file.path}
                icon={file.type === "audio" ? "music" : file.type}
                white={file.type !== "video"}
                showPlayOnHover
                checkered={file.type !== "audio"}
                on:click={() => playMedia(file)}
            >
                <!-- icons -->
                <div class="icons">
                    {#if file.type === "image" && timer}
                        <div>
                            <div class="button">
                                <div style="padding: 3px;" data-title={$dictionary.preview?.nextTimer}>
                                    <Icon id="clock" size={0.9} white />
                                </div>
                            </div>
                            <span><p>{timer}</p></span>
                        </div>
                    {/if}
                </div>
                <div class="icons right">
                    {#if file.type === "video"}
                        <div>
                            <div class="button">
                                <div style="padding: 3px;" data-title={$dictionary.actions?.next_after_media}>
                                    <Icon id="forward" size={0.9} white />
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>

                {#if file.type === "audio"}
                    <Icon id="music" size={4} style="align-self: center;" />
                {:else}
                    <MediaLoader name={file.name} path={file.path} type={file.type} thumbnailPath={file.thumbnail || ""} mediaStyle={getMediaStyle($media[file.path], currentStyle)} />
                {/if}
            </Card>
        {/each}
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
</div>

{#if !$focusMode}
    <FloatingInputs side="left" onlyOne>
        <MaterialButton icon="folder" on:click={() => sendMain(Main.SYSTEM_OPEN, path)}>
            <T id="main.open" />
        </MaterialButton>
    </FloatingInputs>

    <FloatingInputs onlyOne>
        <MaterialButton
            disabled={!folderFiles.length}
            on:click={() => {
                popupData.set({ type: "folder", value: timer, totalTime })
                activePopup.set("next_timer")
            }}
            title="popup.next_timer{totalTime !== 0 ? `: ${totalTime}s` : ''}"
        >
            <Icon size={1.1} id="clock" white={totalTime === 0} />
            {joinTime(secondsToTime(totalTime))}
        </MaterialButton>
    </FloatingInputs>
{/if}

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        padding: 5px;

        height: 100%;
        align-content: start;
    }

    /* icons */

    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap;
        place-items: start;
        left: 0;
    }
    .icons.right {
        /* inset-inline-end: 2px; */
        flex-wrap: wrap-reverse;
        place-items: end;
        inset-inline-end: 0;
    }

    .icons div {
        opacity: 0.9;
        display: flex;
    }
    .icons .button {
        background-color: rgb(0 0 0 / 0.6);
        pointer-events: all;
    }
    .icons span {
        pointer-events: all;
        background-color: rgb(0 0 0 / 0.6);
        padding: 3px;
        font-size: 0.75em;
        font-weight: bold;
        display: flex;
        align-items: center;
    }
</style>
