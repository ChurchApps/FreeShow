<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { Main } from "../../../../types/IPC/Main"
    import type { Media, MediaType, SlideAction } from "../../../../types/Show"
    import { requestMain } from "../../../IPC/main"
    import { AudioMicrophone } from "../../../audio/audioMicrophone"
    import { AudioPlayer } from "../../../audio/audioPlayer"
    import { activePopup, activeShow, alertMessage, driveData, media, outLocked, outputs, playingAudio, showsCache, styles } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import { send } from "../../../utils/request"
    import { actionData } from "../../actions/actionData"
    import { getActionName, getActionTriggerId, runAction } from "../../actions/actions"
    import MediaLoader from "../../drawer/media/MediaLoader.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, sortByName } from "../../helpers/array"
    import { getExtension, getMediaStyle, getMediaType, isMediaExtension, loadThumbnail, mediaSize } from "../../helpers/media"
    import { findMatchingOut, getActiveOutputs, getCurrentStyle, setOutput } from "../../helpers/output"
    import { _show } from "../../helpers/shows"
    import Button from "../../inputs/Button.svelte"
    import HoverButton from "../../inputs/HoverButton.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    $: show = $showsCache[$activeShow!.id]

    $: outputId = getActiveOutputs($outputs, false, true, true)[0]
    $: outputStyle = getCurrentStyle($styles, $outputs[outputId]?.style)

    let layoutBackgrounds: string[] = []
    let layoutAudio: string[] = []
    let layoutMics: { id: string; name: string }[] = []
    let layoutActions: SlideAction[] = []

    $: {
        layoutBackgrounds = []
        layoutAudio = []
        layoutMics = []
        layoutActions = []

        if (show) {
            let refs = _show().layouts().ref()
            refs.forEach(slides => {
                layoutBackgrounds.push(...slides.map(a => a.data.background).filter(a => a !== undefined))
                layoutAudio.push(
                    ...slides
                        .map(a => a.data.audio)
                        .filter(a => a !== undefined)
                        .flat()
                )
                layoutMics.push(
                    ...slides
                        .map(a => a.data.mics)
                        .filter(a => a !== undefined)
                        .flat()
                )
                layoutActions.push(
                    ...slides
                        .map(a => a.data.actions?.slideActions)
                        .filter(a => a !== undefined)
                        .flat()
                )
            })
        }
    }

    let bgs: (Media & { count: number })[] = []
    $: if (layoutBackgrounds.length) {
        let tempBackgrounds: { [key: string]: Media & { count: number } } = {}
        layoutBackgrounds.forEach(a => {
            if (!show.media?.[a]) return

            let path: string = show.media[a].path || show.media[a].id || ""
            let cloudId = $driveData.mediaId
            if (cloudId && cloudId !== "default") path = show.media[a].cloud?.[cloudId] || path

            let type = (show.media[a].type || getMediaType(getExtension(path))) as MediaType

            let pathId = path.slice(0, 150)
            if (tempBackgrounds[pathId]) tempBackgrounds[pathId].count++
            else tempBackgrounds[pathId] = { id: a, name: "—", ...show.media[a], path, type, count: 1 }
        })
        bgs = sortByName(Object.values(tempBackgrounds))
    } else bgs = []

    let audio: (Media & { count: number })[] = []
    $: if (layoutAudio.length) {
        let tempAudio: { [key: string]: Media & { count: number } } = {}
        layoutAudio.forEach(a => {
            if (!show.media?.[a]) return

            let path = show.media[a].path!
            // no need for cloud when audio can be stacked
            // let cloudId = $driveData.mediaId
            // if (cloudId && cloudId !== "default") path = show.media[a].cloud?.[cloudId] || path

            let type: MediaType = "audio"

            if (tempAudio[path]) tempAudio[path].count++
            else tempAudio[path] = { id: a, ...show.media[a], path, type, count: 1 }
        })

        audio = Object.values(tempAudio)
    } else audio = []

    let mics: { id: string; name: string; count: number }[] = []
    $: if (layoutMics.length) {
        let tempMics: { [key: string]: { id: string; name: string; count: number } } = {}
        layoutMics.forEach(a => {
            let id = a.id

            if (tempMics[id]) tempMics[id].count++
            else tempMics[id] = { ...a, count: 1 }
        })

        mics = Object.values(tempMics)
    } else mics = []

    function setBG(id: string, key: string, value: boolean) {
        if (show.locked) {
            alertMessage.set("show.locked_info")
            activePopup.set("alert")
            return
        }

        const profile = getAccess("shows")
        const readOnly = profile.global === "read" || profile[show.category || ""] === "read"
        if (readOnly) {
            alertMessage.set("profile.locked")
            activePopup.set("alert")
            return
        }

        showsCache.update(a => {
            let bgs = a[$activeShow!.id].media
            if (!bgs[id]) return a // old media
            if (value) delete bgs[id][key]
            else bgs[id][key] = value
            return a
        })
    }

    let actions: SlideAction[] = []
    $: if (layoutActions.length) {
        actions = []
        layoutActions.forEach(action => {
            // check if another exact exists
            if (actions.find(a => JSON.stringify(a) === JSON.stringify(action))) return

            actions.push(action)
        })
    } else actions = []

    let similarBgs: { path: string; name: string }[] = []
    $: if (bgs.length) getSimularPaths()
    function getSimularPaths() {
        if (!bgs.filter(a => !a.path?.includes("http") && !a.path?.includes("data:")).length) return

        requestMain(Main.GET_SIMILAR, { paths: bgs.map(a => a.path || "") }, data => {
            similarBgs = data.filter(a => isMediaExtension(getExtension(a.path))).slice(0, 3)
        })
    }

    let newPaths: { [key: string]: string } = {}
    $: if (bgs) loadBackgrounds()
    function loadBackgrounds() {
        bgs.forEach(async background => {
            let path = background.path || ""
            let newBgPath = await loadThumbnail(path, mediaSize.small)

            if (newBgPath) newPaths[path] = newBgPath
            else newPaths[path] = path
        })
    }
</script>

<div class="main">
    {#if bgs.length || audio.length || mics.length || actions.length}
        {#if bgs.length}
            <!-- <h5><T id="tools.media" /></h5> -->
            {#each bgs as background}
                <!-- TODO: cameras -->
                {@const mediaStyle = getMediaStyle($media[background.path || ""], outputStyle)}
                {@const bgPath = newPaths[background.path || ""] || ""}

                <SelectElem id="media" data={{ ...background }} draggable>
                    <div class="media_item item context #show_media" class:active={findMatchingOut(background.path || "", $outputs)}>
                        <HoverButton
                            style="flex: 2;height: 50px;max-width: 100px;"
                            icon="play"
                            size={3}
                            on:click={() => {
                                if (!$outLocked) {
                                    let style = clone(mediaStyle)
                                    style.fit = $media[background.path || ""]?.fit || ""
                                    delete style.fitOptions

                                    setOutput("background", { path: background.path, type: background.type, loop: background.loop !== false, muted: background.muted !== false, ...style })
                                    if (background.type === "video") send(OUTPUT, ["DATA"], { [outputId]: { duration: 0, paused: false, muted: background.muted !== false, loop: background.loop !== false } })
                                }
                            }}
                        >
                            <MediaLoader name={background.name} path={background.path || ""} thumbnailPath={bgPath} type={background.type} {mediaStyle} />
                        </HoverButton>

                        <p data-title={background.path}>{background.name}</p>

                        {#if background.count > 1}
                            <span style="color: var(--secondary);font-weight: bold;">{background.count}</span>
                        {/if}

                        {#if background.type === "video"}
                            <Button style="flex: 0;padding: 14px 5px;" center title={translateText(background.muted !== false ? "actions.unmute" : "actions.mute")} on:click={() => setBG(background.id || "", "muted", background.muted === false)} dark>
                                <Icon id={background.muted !== false ? "muted" : "volume"} white={background.muted !== false} size={1.2} />
                            </Button>
                            <Button style="flex: 0;padding: 14px 5px;" center title={translateText("media._loop")} on:click={() => setBG(background.id || "", "loop", background.loop === false)} dark>
                                <Icon id="loop" white={background.loop === false} size={1.2} />
                            </Button>
                        {/if}
                    </div>
                </SelectElem>
            {/each}

            {#if similarBgs.length}
                <h5><T id="media.recommended" /></h5>

                {#each similarBgs as background}
                    {@const mediaStyle = getMediaStyle($media[background.path], outputStyle)}
                    {@const type = getMediaType(getExtension(background.path)) || "video"}

                    <SelectElem id="media" data={{ ...background, type }} draggable>
                        <div class="media_item item context #show_media" class:active={findMatchingOut(background.path, $outputs)}>
                            <HoverButton
                                style="flex: 2;height: 50px;max-width: 100px;"
                                icon="play"
                                size={3}
                                on:click={() => {
                                    if (!$outLocked) {
                                        setOutput("background", { path: background.path, type, loop: true, muted: true, ...mediaStyle })
                                        if (type === "video") send(OUTPUT, ["DATA"], { [outputId]: { duration: 0, paused: false, muted: true, loop: true } })
                                    }
                                }}
                            >
                                <MediaLoader name={background.name} path={background.path} {type} {mediaStyle} />
                            </HoverButton>
                            <p data-title={background.path}>{background.name}</p>
                        </div>
                    </SelectElem>
                {/each}
            {/if}
        {/if}

        {#if audio.length}
            <h5><T id="preview.audio" /></h5>
            {#each audio as file}
                {@const outline = !!$playingAudio[file.path || ""]}
                <SelectElem id="audio" data={{ path: file.path, name: file.name }} draggable>
                    <Button
                        class="context #show_audio"
                        on:click={() => {
                            if ($outLocked) return
                            AudioPlayer.start(file.path || "", { name: file.name || "" })
                        }}
                        {outline}
                        style="padding: 8px;width: 100%;"
                        title={file.path}
                        bold={false}
                    >
                        <Icon id={$playingAudio[file.path || ""]?.paused === true ? "play" : $playingAudio[file.path || ""]?.paused === false ? "pause" : "music"} size={1.2} right />
                        <p style="width: 100%;text-align: start;">{file.name?.includes(".") ? file.name.slice(0, file.name.lastIndexOf(".")) : file.name}</p>

                        {#if file.count > 1}
                            <span style="color: var(--secondary);font-weight: bold;">{file.count}</span>
                        {/if}
                    </Button>
                </SelectElem>
            {/each}
        {/if}

        {#if mics.length}
            <h5><T id="live.microphones" /></h5>
            {#each mics as mic}
                {@const muted = !$playingAudio[mic.id]}

                <SelectElem id="microphone" data={{ id: mic.id, type: "microphone", name: mic.name }} draggable>
                    <Button style="padding: 8px;width: 100%;" bold={false} on:click={() => AudioMicrophone.start(mic.id, { name: mic.name }, { pauseIfPlaying: true })}>
                        <Icon id="microphone" white={muted} right />
                        <p style="width: 100%;text-align: start;">{mic.name}</p>

                        {#if mic.count > 1}
                            <span style="color: var(--secondary);font-weight: bold;">{mic.count}</span>
                        {/if}
                    </Button>
                </SelectElem>
            {/each}
        {/if}

        {#if actions.length}
            <h5><T id="tabs.actions" /></h5>
            {#each actions as action}
                {@const actionId = getActionTriggerId(action.triggers?.[0])}
                {@const customData = actionData[actionId] || {}}
                {@const actionValue = action?.actionValues?.[actionId] || action?.actionValues?.[action.triggers?.[0]] || {}}
                {@const customName = getActionName(actionId, actionValue) || (action.name !== translateText(customData.name) ? action.name : "")}

                <SelectElem id="action" data={action} draggable>
                    <!-- class="context #action" -->
                    <Button on:click={() => runAction(action)} style="padding: 8px;width: 100%;" title={action.name} bold={false}>
                        <Icon id={customData.icon || "actions"} size={1.1} style="margin-inline-start: 0.5em;" right />
                        {#key customData.name}
                            <p>
                                <T id={customData.name || ""} />{#if customName}:
                                    <span style="padding: 0;opacity: 0.7;font-size: 0.8em;">{customName}</span>
                                {/if}
                            </p>
                        {/key}
                    </Button>
                </SelectElem>
            {/each}
        {/if}
    {:else}
        <Center faded>
            <T id="empty.media" />
        </Center>
    {/if}
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        height: 100%;
        /* justify-content: center;
    align-items: center;
    overflow: hidden;
    position: relative; */
    }

    h5 {
        overflow: visible;
        text-align: center;
        padding: 5px;
        background-color: var(--primary-darkest);
        color: var(--text);
        font-size: 0.8em;
        text-transform: uppercase;
    }

    .media_item {
        padding-inline-end: 2px;
    }

    .media_item:hover {
        background-color: var(--hover);
    }
    .media_item:active,
    .media_item:focus {
        background-color: var(--focus);
    }

    .item {
        display: flex;
        width: 100%;
        /* don't think fit-content is necessary */
        height: fit-content;
        /* justify-content: center; */
        align-items: center;
    }

    .item p {
        padding: 10px;
        flex: 3;
        /* cursor: pointer; */
    }
    /* .item p:hover {
        background-color: var(--hover);
    }
    .item p:active,
    .item p:focus {
        background-color: var(--focus);
    } */

    .item.active {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
    }

    p,
    span {
        padding: 0 10px;
        /* text-align: center; */
    }

    .main :global(img),
    .main :global(canvas) {
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 0;
        padding: 2px;
    }
    .main :global(video) {
        height: 100%;
    }

    .main :global(.video),
    .main :global(.main) {
        display: block;
    }
</style>
