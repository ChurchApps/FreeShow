<script lang="ts">
    import { dictionary, labelsDisabled, mediaOptions, outLocked, outputs, overlayCategories, overlays, styles } from "../../../stores"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { findMatchingOut, getResolution, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import Center from "../../system/Center.svelte"
    import DropArea from "../../system/DropArea.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"

    export let active: string | null
    export let searchValue: string = ""

    $: resolution = getResolution(null, { $outputs, $styles })

    let filteredOverlays: any[] = []
    $: filteredOverlays = sortByName(keysToID($overlays).filter((s: any) => active === "all" || active === s.category || (active === "unlabeled" && (s.category === null || !$overlayCategories[s.category]))))

    // search
    $: if (filteredOverlays || searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    let fullFilteredOverlays: any[] = []
    function filterSearch() {
        fullFilteredOverlays = clone(filteredOverlays)
        if (searchValue.length > 1) fullFilteredOverlays = fullFilteredOverlays.filter((a) => filter(a.name || "").includes(filter(searchValue)))
    }

    let nextScrollTimeout: any = null
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
</script>

<div style="position: relative;height: 100%;overflow-y: auto;" on:wheel={wheel}>
    <DropArea id="overlays">
        {#if fullFilteredOverlays.length}
            <div class="grid">
                {#each fullFilteredOverlays as overlay}
                    <Card
                        class="context #overlay_card"
                        outlineColor={findMatchingOut(overlay.id, $outputs)}
                        active={findMatchingOut(overlay.id, $outputs) !== null}
                        label={overlay.name}
                        renameId="overlay_{overlay.id}"
                        color={overlay.color}
                        icon={overlay.placeUnderSlide ? "under" : overlay.locked ? "locked" : null}
                        {resolution}
                        showPlayOnHover
                        on:click={(e) => {
                            if ($outLocked || e.ctrlKey || e.metaKey) return
                            if (e.target?.closest(".edit")) return

                            setOutput("overlays", overlay.id, true)
                        }}
                    >
                        <SelectElem id="overlay" data={overlay.id} fill draggable>
                            <Zoomed {resolution} background={overlay.items.length ? "black" : "transparent"}>
                                {#each overlay.items as item}
                                    <Textbox {item} ref={{ type: "overlay", id: overlay.id }} />
                                {/each}
                            </Zoomed>
                        </SelectElem>
                    </Card>
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
</div>
<div class="tabs">
    <Button
        style="flex: 1;"
        on:click={() => {
            history({ id: "UPDATE", location: { page: "drawer", id: "overlay" } })
        }}
        center
        title={$dictionary.new?.overlay}
    >
        <Icon id="add" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<T id="new.overlay" />{/if}
    </Button>
</div>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
    }

    .grid :global(.isSelected) {
        outline: 5px solid var(--secondary-text) !important;
    }

    .tabs {
        display: flex;
        background-color: var(--primary-darkest);
    }
</style>
