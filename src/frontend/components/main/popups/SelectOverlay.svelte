<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { activePopup, outputs, overlays, popupData, styles } from "../../../stores"
    import Card from "../../drawer/Card.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getResolution } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import Center from "../../system/Center.svelte"

    let active: string = $popupData.active || ""
    let hide: string[] = $popupData.hide || []

    let searchValue = ""

    $: resolution = getResolution(null, { $outputs, $styles })

    let allOverlays: any[] = []
    $: allOverlays = sortByName(keysToID($overlays)).filter((a) => !hide.includes(a.id))

    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    $: filteredOverlays = searchValue.length > 1 ? allOverlays.filter((a) => filter(a.name || "").includes(filter(searchValue))) : allOverlays

    // lazy loader
    const INITIAL_BATCH = 8
    let lazyLoader = INITIAL_BATCH
    let timeout: NodeJS.Timeout | null = null
    let loaded = false

    onDestroy(() => {
        if (timeout) clearTimeout(timeout)
    })

    let prevSearchValue = ""
    $: if (searchValue !== prevSearchValue) {
        prevSearchValue = searchValue
        loaded = false
        lazyLoader = INITIAL_BATCH
    }

    $: if (!loaded && filteredOverlays?.length) {
        if (lazyLoader >= filteredOverlays.length) {
            loaded = true
        } else {
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(() => {
                lazyLoader += 16
            }, 25)
        }
    }

    function select(selectedId: string) {
        active = selectedId

        if ($popupData.trigger) {
            $popupData.trigger(selectedId)
        }

        popupData.set({ id: "select_overlay", value: selectedId })

        setTimeout(() => {
            setTimeout(() => popupData.set({}), 500)
            activePopup.set(null)
        })
    }

    function createNew() {
        const overlayId = uid()
        history({ id: "UPDATE", oldData: { id: overlayId }, location: { page: "drawer", id: "overlay" } })
        select(overlayId)
    }
</script>

<MaterialButton class="popup-options" icon="add" iconSize={1.3} title="new.overlay" on:click={createNew} white />

{#if allOverlays.length > 8}
    <div style="margin-bottom: 10px;">
        <MaterialTextInput label="main.search" value={searchValue} on:input={(e) => (searchValue = e.detail || "")} autofocus />
    </div>
{/if}

<div style="position: relative;height: 100%;width: calc(100vw - (var(--navigation-width) + 20px) * 2);overflow-y: auto;">
    {#if filteredOverlays.length}
        <div class="grid">
            {#each filteredOverlays as overlay, i (overlay.id)}
                <Card width={25} active={active === overlay.id} label={overlay.name} color={overlay.color} {resolution} on:click={() => select(overlay.id)}>
                    {#if loaded || i < lazyLoader}
                        <Zoomed {resolution} background={overlay.items?.length ? "var(--primary);" : overlay.color || "var(--primary);"} checkered={!!overlay.items?.length}>
                            {#each overlay.items || [] as item}
                                <Textbox {item} ref={{ type: "overlay", id: overlay.id }} preview miniPreview />
                            {/each}
                        </Zoomed>
                    {/if}
                </Card>
            {/each}
        </div>
    {:else}
        <Center size={1.2} faded style="height: 100px;padding-top: 20px;">
            <T id={searchValue.length > 1 ? "empty.search" : "empty.general"} />
        </Center>
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

    .grid :global(.main) {
        align-self: center;
    }
</style>
