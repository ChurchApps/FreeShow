<script lang="ts">
    import { onDestroy } from "svelte"
    import type { Scene } from "../../../../types/Show"
    import { activeEdit, activePage, labelsDisabled, mediaOptions, outLocked, outputs, scenes, styles } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { findMatchingOut, getResolution, startScene } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import Center from "../../system/Center.svelte"
    import DropArea from "../../system/DropArea.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"
    import SceneActions from "./SceneActions.svelte"
    import ScenePreview from "./ScenePreview.svelte"

    export let searchValue = ""

    const profile = getAccess("scenes")
    $: readOnly = profile.global === "read"

    $: resolution = getResolution(null, { $outputs, $styles })

    let filteredScenes: (Scene & { id: string })[] = []
    $: filteredScenes = sortByName(keysToID($scenes)).filter((s) => profile[s.id] !== "none")

    // search
    $: if (filteredScenes || searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    let fullFilteredScenes: (Scene & { id: string })[] = []
    function filterSearch() {
        fullFilteredScenes = clone(filteredScenes)
        if (searchValue.length > 1) fullFilteredScenes = fullFilteredScenes.filter((a) => filter(a.name || "").includes(filter(searchValue)))
    }

    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })

        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    // lazy loader
    let lazyLoader = 0
    let timeout: NodeJS.Timeout | null = null
    let loaded = false

    onDestroy(() => {
        if (timeout) clearTimeout(timeout)
    })

    $: if (searchValue !== undefined) {
        loaded = false
        lazyLoader = 0
    }

    $: if (!loaded && fullFilteredScenes?.length) {
        if (lazyLoader >= fullFilteredScenes.length) {
            loaded = true
        } else {
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(
                () => {
                    const batch = lazyLoader === 0 ? 4 : Math.min(32, lazyLoader * 2)
                    lazyLoader += batch
                },
                lazyLoader === 0 ? 60 : 30
            )
        }
    }

    function sceneClick(e: any, id: string) {
        if ($outLocked || e.ctrlKey || e.metaKey) return
        if (e.target?.closest?.(".edit") || e.target?.closest?.(".icons")) return

        startScene(id)
    }

    function openSceneEditor(id: string) {
        activeEdit.set({ type: "scene", id, items: [] })
        activePage.set("edit")
    }
</script>

<div style="position: relative;height: 100%;overflow-y: auto;" class="context #drawer_scenes{readOnly ? '_readonly' : ''}" on:wheel={wheel}>
    <DropArea id="scenes">
        {#if fullFilteredScenes.length}
            <div class="grid" style="--width: {100 / $mediaOptions.columns}%;">
                {#each fullFilteredScenes as scene, i (scene.id)}
                    {@const isReadOnly = readOnly || profile[scene.id] === "read"}
                    {@const isActive = findMatchingOut(scene.id, $outputs) !== null}

                    <SelectElem id="scene" data={scene.id} class="context #scene_card{isReadOnly ? '_readonly' : ''}" draggable fill>
                        <Card
                            width={100}
                            preview={$activePage === "edit" ? $activeEdit.type === "scene" && $activeEdit.id === scene.id : false}
                            outlineColor={findMatchingOut(scene.id, $outputs)}
                            active={isActive}
                            label={scene.name}
                            renameId="scene_{scene.id}"
                            {resolution}
                            showPlayOnHover={!isActive}
                            on:click={(e) => sceneClick(e, scene.id)}
                            on:dblclick={(e) => {
                                if (e.ctrlKey || e.metaKey) return
                                if (e.target?.closest?.(".edit") || e.target?.closest?.(".icons")) return
                                openSceneEditor(scene.id)
                            }}
                        >
                            {#if loaded || i < lazyLoader}
                                <Zoomed {resolution}>
                                    <ScenePreview {scene} miniPreview />
                                </Zoomed>

                                <SceneActions columns={$mediaOptions.columns} sceneId={scene.id} />
                            {/if}
                        </Card>
                    </SelectElem>
                {/each}
            </div>
        {:else}
            <Center size={1.2} faded>
                {#if filteredScenes.length}
                    <T id="empty.search" />
                {:else}
                    <T id="empty.general" />
                {/if}
            </Center>
        {/if}
    </DropArea>
</div>

<FloatingInputs onlyOne>
    <MaterialButton disabled={readOnly} icon="add" title="new.scene" on:click={() => history({ id: "UPDATE", location: { page: "drawer", id: "scene" } })}>
        {#if !$labelsDisabled}<T id="new.scene" />{/if}
    </MaterialButton>
</FloatingInputs>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
        padding-bottom: 60px;
    }

    .grid :global(.selectElem) {
        width: var(--width);
        outline-offset: -3px;
    }
    .grid :global(.isSelected) {
        border-radius: 0 !important;
    }
</style>
