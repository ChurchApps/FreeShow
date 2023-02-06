<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { activePopup, activeShow, dictionary, media, outLocked, playingAudio, showsCache } from "../../../stores"
    import { send } from "../../../utils/request"
    import MediaLoader from "../../drawer/media/MediaLoader.svelte"
    import { playAudio } from "../../helpers/audio"
    import Icon from "../../helpers/Icon.svelte"
    import { getMediaType } from "../../helpers/media"
    import { findMatchingOut, setOutput } from "../../helpers/output"
    import { getMediaFilter, sendMidi } from "../../helpers/showActions"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import HoverButton from "../../inputs/HoverButton.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    $: show = $showsCache[$activeShow!.id]

    let layoutBackgrounds: any[] = []
    let layoutAudio: any[] = []

    $: {
        if (show) {
            layoutBackgrounds = []
            layoutAudio = []
            let refs = _show("active").layouts().ref()
            refs.forEach((slides: any) => {
                layoutBackgrounds.push(...slides.map((a: any) => a.data.background).filter((a: any) => a !== undefined))
                layoutAudio.push(
                    ...slides
                        .map((a: any) => a.data.audio)
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
            let id = show.media[a].path || show.media[a].id!

            const extension = id.slice(id.lastIndexOf(".") + 1, id.length) || ""
            let type = getMediaType(extension)

            if (backgrounds[id]) backgrounds[id].count++
            else backgrounds[id] = { id: a, ...show.media[a], type, count: 1 }
        })
        Object.values(backgrounds).forEach((a) => bgs.push(a))
    } else bgs = []

    let audio: any = []
    $: if (layoutAudio.length) {
        audio = {}
        // TODO: count...
        layoutAudio.forEach((a: any) => {
            let id = show.media[a].path!
            let type = "audio"

            if (audio[id]) audio[id].count++
            else audio[id] = { id: a, ...show.media[a], type, count: 1 }
        })

        audio = Object.values(audio)
        console.log(audio)
    } else audio = []

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
    $: if ($activePopup !== "midi" && Object.values(showMidi).length) {
        midi = []
        Object.entries(showMidi).forEach(([id, value]: any) => {
            midi.push({ id, ...value })
        })
        console.log(midi)
    } else if (!Object.values(showMidi).length) midi = []

    // TODO: check if file exists!!!
</script>

<!-- TODO: transition type & duration -->

<div class="main">
    {#if bgs.length || audio.length || midi.length}
        {#if bgs.length}
            <h5><T id="tools.media" /></h5>
            {#each bgs as background}
                {@const filter = getMediaFilter(background.path)}
                {@const flipped = $media[background.path]?.flipped || false}
                {@const fit = $media[background.path]?.fit || "contain"}
                <SelectElem id="media" data={{ ...background }} draggable>
                    <div class="item context #show_media" class:active={findMatchingOut(background.path)}>
                        <HoverButton
                            style="flex: 2;height: 50px;max-width: 100px;"
                            icon="play"
                            size={3}
                            on:click={() => {
                                if (!$outLocked) {
                                    setOutput("background", { path: background.path, loop: background.loop !== false, muted: background.muted !== false, filter, flipped, fit })
                                    if (background.type === "video")
                                        send(OUTPUT, ["UPDATE_VIDEO"], { data: { duration: 0, paused: false, muted: background.muted !== false, loop: background.loop !== false } })
                                }
                            }}
                            title={$dictionary.media?.play}
                        >
                            <!-- <div style="flex: 2;height: 50px;"> -->
                            {#key background.path}
                                <MediaLoader name={background.name} path={background.path} type={background.type} {filter} {flipped} {fit} />
                            {/key}
                            <!-- </div> -->
                        </HoverButton>
                        <p on:click={() => activeShow.set({ id: background.path, name: background.name, type: background.type })} title={background.path}>{background.name}</p>
                        {#if background.count > 1}
                            <span style="color: var(--secondary);">{background.count}</span>
                        {/if}
                        {#if background.type === "video"}
                            <Button
                                style="flex: 0"
                                center
                                title={background.muted !== false ? "Unmute" : "Mute"}
                                on:click={() => setBG(background.id, "muted", background.muted === false)}
                            >
                                <Icon id={background.muted !== false ? "muted" : "volume"} white={background.muted !== false} size={1.2} />
                            </Button>
                            <Button style="flex: 0" center title={$dictionary.media?._loop} on:click={() => setBG(background.id, "loop", background.loop === false)}>
                                <Icon id="loop" white={background.loop === false} size={1.2} />
                            </Button>
                        {/if}
                    </div>
                </SelectElem>
            {/each}
        {/if}

        {#if audio.length}
            <h5><T id="preview.audio" /></h5>
            {#each audio as file}
                <SelectElem id="audio" data={{ path: file.path, name: file.name }} draggable>
                    <Button on:click={() => playAudio(file)} outline={$playingAudio[file.path]} style="width: 100%;" title={file.path} bold={false}>
                        <Icon id={$playingAudio[file.path]?.paused === true ? "play" : $playingAudio[file.path]?.paused === false ? "pause" : "music"} size={1.2} right />
                        <p>{file.name.slice(0, file.name.lastIndexOf("."))}</p>

                        {#if file.count > 1}
                            <span style="color: var(--secondary);">{file.count}</span>
                        {/if}
                    </Button>
                </SelectElem>
            {/each}
        {/if}

        {#if midi.length}
            <h5><T id="popup.midi" /></h5>
            {#each midi as midi}
                <SelectElem id="midi" data={midi} draggable>
                    <Button class="context #midi" on:click={() => sendMidi(midi)} style="padding: 8px;width: 100%;" title={midi.name} bold={false}>
                        <Icon id="music" size={1.2} right />
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
        text-transform: uppercase;
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
        cursor: pointer;
    }
    .item p:hover {
        background-color: var(--hover);
    }
    .item p:active,
    .item p:focus {
        background-color: var(--focus);
    }

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
