<script lang="ts">
    import { onDestroy } from "svelte"
    import { MAIN, OUTPUT } from "../../../../types/Channels"
    import { activeShow, dictionary, driveData, media, midiIn, outLocked, outputs, playingAudio, showsCache } from "../../../stores"
    import { playMidiIn } from "../../../utils/midi"
    import { destroy, receive, send } from "../../../utils/request"
    import MediaLoader from "../../drawer/media/MediaLoader.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clearAudioStreams, playAudio, startMicrophone } from "../../helpers/audio"
    import { getExtension, getMediaStyle, getMediaType, isMediaExtension } from "../../helpers/media"
    import { findMatchingOut, getActiveOutputs, setOutput } from "../../helpers/output"
    import { sendMidi } from "../../helpers/showActions"
    import { _show } from "../../helpers/shows"
    import Button from "../../inputs/Button.svelte"
    import HoverButton from "../../inputs/HoverButton.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    $: show = $showsCache[$activeShow!.id]

    $: outputId = getActiveOutputs($outputs, true, true, true)[0]

    let layoutBackgrounds: any[] = []
    let layoutAudio: any[] = []
    let layoutMics: any[] = []

    $: {
        if (show) {
            layoutBackgrounds = []
            layoutAudio = []
            layoutMics = []

            let refs = _show("active").layouts().ref()
            refs.forEach((slides: any) => {
                layoutBackgrounds.push(...slides.map((a: any) => a.data.background).filter((a: any) => a !== undefined))
                layoutAudio.push(
                    ...slides
                        .map((a: any) => a.data.audio)
                        .filter((a: any) => a !== undefined)
                        .flat()
                )
                layoutMics.push(
                    ...slides
                        .map((a: any) => a.data.mics)
                        .filter((a: any) => a !== undefined)
                        .flat()
                )
            })
        }
    }

    let backgrounds: any = {}
    let bgs: any = []

    $: if (layoutBackgrounds.length) {
        backgrounds = {}
        bgs = []
        layoutBackgrounds.forEach((a: any) => {
            if (!show.media[a]) return
            let path: string = show.media[a].path || show.media[a].id || ""
            let cloudId = $driveData.mediaId
            if (cloudId && cloudId !== "default") path = show.media[a].cloud?.[cloudId] || path

            const extension = getExtension(path)
            let type = getMediaType(extension)

            if (backgrounds[path]) backgrounds[path].count++
            else backgrounds[path] = { id: a, ...show.media[a], path, type, count: 1 }
        })
        Object.values(backgrounds).forEach((a) => bgs.push(a))
        bgs = bgs.sort((a: any, b: any) => a.name.localeCompare(b.name))
    } else bgs = []

    let audio: any = []
    $: if (layoutAudio.length) {
        audio = {}
        layoutAudio.forEach((a: any) => {
            let path = show.media[a].path!
            // no need for cloud when audio can be stacked
            // let cloudId = $driveData.mediaId
            // if (cloudId && cloudId !== "default") path = show.media[a].cloud?.[cloudId] || path

            let type = "audio"

            if (audio[path]) audio[path].count++
            else audio[path] = { id: a, ...show.media[a], path, type, count: 1 }
        })

        audio = Object.values(audio)
    } else audio = []

    let mics: any = []
    $: if (layoutMics.length) {
        mics = {}
        layoutMics.forEach((a: any) => {
            let id = a.id

            if (mics[id]) mics[id].count++
            else mics[id] = { ...a, count: 1 }
        })

        mics = Object.values(mics)
    } else mics = []

    function setBG(id: string, key: string, value: boolean) {
        showsCache.update((a: any) => {
            let bgs = a[$activeShow!.id].media
            if (value) delete bgs[id][key]
            else bgs[id][key] = value
            return a
        })
    }

    let midi: any[] = []
    $: showMidi = show?.midi || {}
    // $activePopup !== "midi" &&
    $: if (Object.keys(showMidi).length || Object.keys($midiIn).length) {
        midi = []
        Object.entries(showMidi).forEach(([id, value]: any) => {
            midi.push({ id, ...value })
        })
        Object.entries($midiIn).forEach(([id, value]: any) => {
            if (value.shows.find((a) => a.id === $activeShow!.id)) {
                midi.push({ id, ...value, sendType: "in" })
            }
        })
    } else if (!Object.keys(showMidi).length) midi = []

    // TODO: check if file exists!!!

    let simularBgs: any[] = []
    $: if (bgs.length) send(MAIN, ["GET_SIMULAR"], { paths: bgs.map((a) => a.path) })
    receive(MAIN, { GET_SIMULAR: (data: any[]) => (simularBgs = data.filter((a) => isMediaExtension(getExtension(a.path))).slice(0, 3)) }, "media_simular")
    onDestroy(() => destroy(MAIN, "media_simular"))
</script>

<!-- TODO: transition type & duration -->

<div class="main">
    {#if bgs.length || audio.length || mics.length || midi.length}
        {#if bgs.length}
            <!-- <h5><T id="tools.media" /></h5> -->
            {#each bgs as background}
                <!-- TODO: cameras -->
                {@const mediaStyle = getMediaStyle($media[background.path], { name: "" })}
                <SelectElem id="media" data={{ ...background }} draggable>
                    <div class="media_item item context #show_media" class:active={findMatchingOut(background.path, $outputs)}>
                        <HoverButton
                            style="flex: 2;height: 50px;max-width: 100px;"
                            icon="play"
                            size={3}
                            on:click={() => {
                                if (!$outLocked) {
                                    setOutput("background", { path: background.path, type: background.type, loop: background.loop !== false, muted: background.muted !== false, ...mediaStyle })
                                    if (background.type === "video") send(OUTPUT, ["DATA"], { [outputId]: { duration: 0, paused: false, muted: background.muted !== false, loop: background.loop !== false } })
                                }
                            }}
                            title={$dictionary.media?.play}
                        >
                            <!-- <div style="flex: 2;height: 50px;"> -->
                            <MediaLoader name={background.name} path={background.path} type={background.type} {mediaStyle} />
                            <!-- </div> -->
                        </HoverButton>
                        <!-- on:click={() => activeShow.set({ id: background.path, name: background.name, type: background.type })} -->
                        <p title={background.path}>{background.name}</p>
                        {#if background.count > 1}
                            <span style="color: var(--secondary);font-weight: bold;">{background.count}</span>
                        {/if}
                        {#if background.type === "video"}
                            <Button
                                style="flex: 0;padding: 14px 5px;"
                                center
                                title={background.muted !== false ? $dictionary.actions?.unmute : $dictionary.actions?.mute}
                                on:click={() => setBG(background.id, "muted", background.muted === false)}
                                dark
                            >
                                <Icon id={background.muted !== false ? "muted" : "volume"} white={background.muted !== false} size={1.2} />
                            </Button>
                            <Button style="flex: 0;padding: 14px 5px;" center title={$dictionary.media?._loop} on:click={() => setBG(background.id, "loop", background.loop === false)} dark>
                                <Icon id="loop" white={background.loop === false} size={1.2} />
                            </Button>
                        {/if}
                    </div>
                </SelectElem>
            {/each}

            {#if simularBgs.length}
                <h5><T id="media.recommended" /></h5>

                {#each simularBgs as background}
                    {@const mediaStyle = getMediaStyle($media[background.path], { name: "" })}
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
                                title={$dictionary.media?.play}
                            >
                                <MediaLoader name={background.name} path={background.path} {type} {mediaStyle} />
                            </HoverButton>
                            <p title={background.path}>{background.name}</p>
                        </div>
                    </SelectElem>
                {/each}
            {/if}
        {/if}

        {#if audio.length}
            <h5><T id="preview.audio" /></h5>
            {#each audio as file}
                <SelectElem id="audio" data={{ path: file.path, name: file.name }} draggable>
                    <Button class="context #show_audio" on:click={() => playAudio(file)} outline={$playingAudio[file.path]} style="padding: 8px;width: 100%;" title={file.path} bold={false}>
                        <Icon id={$playingAudio[file.path]?.paused === true ? "play" : $playingAudio[file.path]?.paused === false ? "pause" : "music"} size={1.2} right />
                        <p style="width: 100%;text-align: left;">{file.name.slice(0, file.name.lastIndexOf("."))}</p>

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
                    <Button
                        style="padding: 8px;width: 100%;"
                        bold={false}
                        on:click={() => {
                            if ($outLocked) return

                            if (muted) {
                                startMicrophone(mic)
                                return
                            }

                            playingAudio.update((a) => {
                                delete a[mic.id]
                                return a
                            })
                            clearAudioStreams(mic.id)
                        }}
                    >
                        <Icon id="microphone" white={muted} right />
                        <p style="width: 100%;text-align: left;">{mic.name}</p>

                        {#if mic.count > 1}
                            <span style="color: var(--secondary);font-weight: bold;">{mic.count}</span>
                        {/if}
                    </Button>
                </SelectElem>
            {/each}
        {/if}

        {#if midi.length}
            <h5><T id="popup.midi" /></h5>
            {#each midi as midi}
                <SelectElem id="midi" data={midi} draggable>
                    <Button class="context #midi" on:click={() => (midi.sendType === "in" ? playMidiIn(midi) : sendMidi(midi))} style="padding: 8px;width: 100%;" title={midi.name} bold={false}>
                        <Icon id={midi.sendType === "in" ? "play" : "music"} size={1.2} right />
                        <p>{midi.name}</p>
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
        padding-right: 2px;
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
        z-index: -1;
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
