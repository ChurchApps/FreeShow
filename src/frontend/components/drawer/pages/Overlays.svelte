<script lang="ts">
    import { onMount } from "svelte"
    import type { Overlay } from "../../../../types/Show"
    import { activeEdit, activePage, activeShow, dictionary, focusMode, labelsDisabled, mediaOptions, outLocked, outputs, overlayCategories, overlays, styles } from "../../../stores"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { findMatchingOut, getResolution, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Loader from "../../main/Loader.svelte"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import Center from "../../system/Center.svelte"
    import DropArea from "../../system/DropArea.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import OverlayActions from "./OverlayActions.svelte"
    import Effects from "../effects/Effects.svelte"
    import { getAccess } from "../../../utils/profile"

    export let active: string | null
    export let searchValue = ""

    const profile = getAccess("overlays")
    $: readOnly = profile.global === "read" || profile[active || ""] === "read"

    $: resolution = getResolution(null, { $outputs, $styles })

    let filteredOverlays: (Overlay & { id: string })[] = []
    $: filteredOverlays = sortByName(
        keysToID($overlays).filter((s) => (active === "all" && !$overlayCategories[s?.category || ""]?.isArchive) || active === s.category || (active === "unlabeled" && (s.category === null || !$overlayCategories[s.category])))
    )

    // search
    $: if (filteredOverlays || searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    let fullFilteredOverlays: (Overlay & { id: string })[] = []
    function filterSearch() {
        fullFilteredOverlays = clone(filteredOverlays)
        if (searchValue.length > 1) fullFilteredOverlays = fullFilteredOverlays.filter((a) => filter(a.name || "").includes(filter(searchValue)))
    }

    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    // open drawer tab instantly before content has loaded
    let preloader = true
    onMount(() => setTimeout(() => (preloader = false), 20))
</script>

<div style="position: relative;height: 100%;overflow-y: auto;" on:wheel={wheel}>
    {#if active === "effects"}
        <Effects {searchValue} />
    {:else}
        <DropArea id="overlays">
            {#if preloader && fullFilteredOverlays.length > 10}
                <Center>
                    <Loader />
                </Center>
            {:else if fullFilteredOverlays.length}
                <div class="grid" style="--width: {100 / $mediaOptions.columns}%;">
                    {#each fullFilteredOverlays as overlay}
                        {@const isReadOnly = readOnly || profile[overlay.category || ""] === "read"}

                        <SelectElem id="overlay" data={overlay.id} class="context #overlay_card{overlay.isDefault && !isReadOnly ? '_default' : ''}{isReadOnly ? '_readonly' : ''}" draggable fill>
                            <Card
                                width={100}
                                preview={$activePage === "edit" ? $activeEdit.type === "overlay" && $activeEdit.id === overlay.id : $activeShow?.type === "overlay" && $activeShow?.id === overlay.id}
                                outlineColor={findMatchingOut(overlay.id, $outputs)}
                                active={findMatchingOut(overlay.id, $outputs) !== null}
                                label={overlay.name}
                                renameId="overlay_{overlay.id}"
                                icon={overlay.isDefault ? "protected" : null}
                                color={overlay.color}
                                {resolution}
                                showPlayOnHover
                                on:click={(e) => {
                                    if ($outLocked || e.ctrlKey || e.metaKey) return
                                    if (e.target?.closest(".edit") || e.target?.closest(".icons")) return

                                    setOutput("overlays", overlay.id, true)
                                }}
                                on:dblclick={(e) => {
                                    if (e.ctrlKey || e.metaKey) return
                                    if (e.target?.closest(".edit") || e.target?.closest(".icons")) return

                                    activeShow.set({ id: overlay.id, type: "overlay" })
                                    activePage.set("show")
                                    if ($focusMode) focusMode.set(false)
                                }}
                            >
                                <!-- icons -->
                                <OverlayActions columns={$mediaOptions.columns} overlayId={overlay.id} />

                                <Zoomed {resolution} background={overlay.items.length ? "var(--primary);" : overlay.color || "var(--primary);"} checkered={!!overlay.items.length}>
                                    {#each overlay.items as item}
                                        <Textbox {item} ref={{ type: "overlay", id: overlay.id }} />
                                    {/each}
                                </Zoomed>
                            </Card>
                        </SelectElem>
                    {/each}
                </div>
            {:else}
                <Center size={1.2} faded>
                    {#if filteredOverlays.length}
                        <T id="empty.search" />
                    {:else}
                        <T id="empty.general" />
                    {/if}
                </Center>
            {/if}
        </DropArea>
    {/if}
</div>

<div class="tabs">
    {#if active === "effects"}
        <Button
            style="flex: 1;"
            on:click={() => {
                history({ id: "UPDATE", location: { page: "drawer", id: "effect" } })
            }}
            center
            disabled={readOnly}
            title={$dictionary.new?.effect}
        >
            <Icon id="add" right={!$labelsDisabled} />
            {#if !$labelsDisabled}<T id="new.effect" />{/if}
        </Button>
    {:else}
        <Button
            style="flex: 1;"
            on:click={() => {
                history({ id: "UPDATE", location: { page: "drawer", id: "overlay" } })
            }}
            center
            disabled={readOnly}
            title={$dictionary.new?.overlay}
        >
            <Icon id="add" right={!$labelsDisabled} />
            {#if !$labelsDisabled}<T id="new.overlay" />{/if}
        </Button>
    {/if}
</div>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
    }

    .grid :global(.selectElem) {
        width: var(--width);
        outline-offset: -3px;
    }

    .tabs {
        display: flex;
        background-color: var(--primary-darkest);
    }
</style>
