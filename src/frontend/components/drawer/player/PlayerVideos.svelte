<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import { OUTPUT } from "../../../../types/Channels"
    import { Main } from "../../../../types/IPC/Main"
    import type { PlayerVideo } from "../../../../types/Tabs"
    import { sendMain } from "../../../IPC/main"
    import { activeFocus, activePlayerTagFilter, activeShow, focusMode, outLocked, outputs, playerTags, playerVideos } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { destroy, receive } from "../../../utils/request"
    import { clone, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { encodeFilePath } from "../../helpers/media"
    import { findMatchingOut, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import { clearBackground, clearSlide } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"

    export let active: string
    export let searchValue = ""

    $: videos = sortByName(
        Object.entries($playerVideos)
            .map(([id, video]) => ({ rid: id, ...video }))
            .filter((a) => a.type === active)
    )

    // search
    $: if (videos || searchValue !== undefined || $activePlayerTagFilter) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    let fullFilteredVideos: (PlayerVideo & { rid: string })[] = []
    function filterSearch() {
        fullFilteredVideos = clone(videos)

        // filter by tag
        if ($activePlayerTagFilter.length) {
            fullFilteredVideos = fullFilteredVideos.filter((a) => a.tags?.length && !$activePlayerTagFilter.find((tagId) => !a.tags!.includes(tagId)))
        }

        if (searchValue.length > 1) fullFilteredVideos = fullFilteredVideos.filter((a) => filter(a.name).includes(searchValue))
    }

    let loaded: { [key: string]: boolean } = {}

    // thumbnail
    // https://stackoverflow.com/a/20542029
    // https://stackoverflow.com/a/61662687
    function getThumbnail(videoId: string) {
        if (!videoId) return ""

        if (active === "youtube") {
            return `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
        }
        if (active === "vimeo") {
            return `https://vumbnail.com/${videoId}_medium.jpg`
        }

        return ""
    }

    let iconClicked: NodeJS.Timeout | null = null
    function removeStyle(key: string, id: string | undefined) {
        if (!id) return
        iconClicked = setTimeout(() => (iconClicked = null), 50)

        playerVideos.update((a) => {
            if (!a[id]) return a

            if (key === "tags") {
                a[id].tags = []
            }

            return a
        })
    }

    function openPreview(id: string) {
        if ($focusMode) activeFocus.set({ id, type: "player" })
        else activeShow.set({ id, type: "player" })
    }

    // WEBSITE (Thumbnail)

    const THUMBNAIL_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 days
    const requestedThumbnails = new Set<string>()
    const listenerId = "WEBSITE_THUMBS_" + uid()

    onMount(() => {
        receive(
            OUTPUT,
            {
                WEBSITE_THUMBNAIL: (data: { websiteId: string; path: string; updated: number }) => {
                    if (!data?.websiteId || !data.path) return
                    playerVideos.update((a) => {
                        if (!a[data.websiteId]) return a
                        a[data.websiteId].thumbnail = data.path
                        a[data.websiteId].thumbnailUpdated = data.updated
                        return a
                    })
                }
            },
            listenerId
        )
    })
    onDestroy(() => destroy(OUTPUT, listenerId))

    $: if (active === "website" && videos.length) {
        const now = Date.now()
        for (const video of videos) {
            if (!video.id || requestedThumbnails.has(video.rid)) continue
            if (!video.thumbnail || !video.thumbnailUpdated || now - video.thumbnailUpdated > THUMBNAIL_MAX_AGE) {
                requestedThumbnails.add(video.rid)
                sendMain(Main.WEBSITE_CAPTURE, { id: video.rid, action: "thumbnail", url: video.id })
            }
        }
    }
</script>

{#if fullFilteredVideos.length}
    {#each fullFilteredVideos as video}
        {@const tags = video.tags || []}

        <Card
            loaded={active === "website" || loaded[video.rid]}
            class="context #player_button"
            preview={$activeShow?.id === video.rid}
            active={findMatchingOut(video.rid, $outputs) !== null}
            outlineColor={findMatchingOut(video.rid, $outputs)}
            label={video.name || ""}
            renameId="player_{video.rid}"
            title={video.id || ""}
            showPlayOnHover
            on:click={(e) => {
                if ($outLocked || e.ctrlKey || e.metaKey || iconClicked) return
                if (e.target?.closest?.(".edit")) return

                if (findMatchingOut(video.rid, $outputs)) {
                    clearBackground()
                    return
                }

                // set as "foreground" type (clear slide & ignore "background" layer)
                clearSlide(true)
                setOutput("background", { id: video.rid, type: "player", muted: false, loop: false, startAt: 0, ignoreLayer: true })
            }}
            on:dblclick={() => {
                if (iconClicked) return
                openPreview(video.rid)
            }}
        >
            <!-- icons -->
            <div class="icons">
                {#if tags.length}
                    <div style="max-width: 100%;">
                        <div class="button">
                            <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeStyle("tags", video.rid)}>
                                <Icon id="tag" size={0.9} white />
                            </Button>
                        </div>
                        <span style="max-width: 100%;">
                            <p>{tags.length === 1 ? $playerTags[tags[0]]?.name || "—" : tags.length}</p>
                        </span>
                    </div>
                {/if}
            </div>

            <SelectElem id="player" data={video.rid} style="width: 100%;height: 100%;" draggable>
                {#if active === "website" && !video.thumbnail}
                    <div class="website" data-title={video.id || ""}><Icon id="web" size={3} white /></div>
                {:else}
                    <img src={active === "website" ? `${encodeFilePath(video.thumbnail || "")}?v=${video.thumbnailUpdated || 0}` : getThumbnail(video.id || "")} alt="Thumbnail for {video.name || 'video'}" style="width: 100%;height: 100%;aspect-ratio: 19/9;object-fit: cover;" on:load={() => (loaded[video.rid] = true)} />
                {/if}
            </SelectElem>
        </Card>
    {/each}
{:else}
    <Center size={1.2} faded>
        <T id="empty.{videos.length ? 'search' : 'general'}" />
    </Center>
{/if}

<style>
    .website {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--primary-darker);
        opacity: 0.8;
    }

    /* icons */

    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        left: 0;
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap;

        max-width: calc(100% - 21px);
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
