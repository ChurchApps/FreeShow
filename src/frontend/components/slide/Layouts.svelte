<script lang="ts">
    import { uid } from "uid"
    import { activePopup, activeProject, activeShow, dictionary, projects, showsCache, slidesOptions } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { duplicate } from "../helpers/clipboard"
    import { history } from "../helpers/history"
    import Button from "../inputs/Button.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import Center from "../system/Center.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import Reference from "./Reference.svelte"
    import { slide } from "svelte/transition"

    $: showId = $activeShow?.id || ""
    $: layouts = $showsCache[showId]?.layouts
    $: activeLayout = $showsCache[showId]?.settings?.activeLayout

    $: sortedLayouts = Object.entries(layouts || {})
        .map(([id, layout]: any) => ({ id, ...layout }))
        .sort((a, b) => a.name?.localeCompare(b.name))

    function addLayout(e: any): any {
        if (e.ctrlKey || e.metaKey) return duplicate({ id: "layout" })

        history({ id: "UPDATE", newData: { key: "layouts", subkey: uid() }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
    }

    const slidesViews: any = { grid: "list", list: "lyrics", lyrics: "text", text: "grid" }

    function changeName(e: any) {
        let currentLayout = e.detail?.id?.slice("layout_".length)
        if (!currentLayout) return

        history({ id: "UPDATE", newData: { key: "layouts", keys: [currentLayout], subkey: "name", data: e.detail.value }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
    }

    function setLayout(id: string, layoutInfo) {
        showsCache.update((s) => {
            s[showId].settings.activeLayout = id
            return s
        })

        // set active layout in project
        if (sortedLayouts?.length < 2) return
        if (($activeShow?.type === undefined || $activeShow?.type === "show") && $activeShow?.index !== undefined && $activeProject && $projects[$activeProject].shows[$activeShow.index]) {
            projects.update((a) => {
                a[$activeProject!].shows[$activeShow!.index!].layout = id
                a[$activeProject!].shows[$activeShow!.index!].layoutInfo = layoutInfo
                return a
            })
        }
    }

    let edit: boolean = false

    let zoomOpened: boolean = false
    function mousedown(e: any) {
        if (e.target.closest(".zoom_container") || e.target.closest("button")) return

        zoomOpened = false
    }

    let loading: boolean = false
    $: if (showId) startLoading()
    function startLoading() {
        loading = true
        setTimeout(() => {
            loading = false
        }, 8000)
    }
</script>

<svelte:window on:mousedown={mousedown} />

<div>
    {#if $showsCache[showId]?.reference}
        <Reference show={$showsCache[showId]} />
    {:else if layouts}
        <!-- TODO: rename glitching -->
        <span style="display: flex;overflow-x: auto;">
            <!-- width: 100%; -->
            {#each sortedLayouts as layout}
                <!-- <SelectElem id="layout" data={id} borders="edges" trigger="row" draggable fill> -->
                <SelectElem id="layout" data={layout.id} fill>
                    <Button
                        class="context #layout"
                        on:click={() => {
                            if (!edit) setLayout(layout.id, { name: layout.name })
                        }}
                        active={activeLayout === layout.id}
                        center
                    >
                        <!-- style="width: 100%;" -->
                        <HiddenInput value={layout.name} id={"layout_" + layout.id} on:edit={changeName} bind:edit />
                    </Button>
                </SelectElem>
            {/each}
        </span>
    {:else}
        <Center faded>
            {#if loading}
                <T id="remote.loading" />
            {:else}
                <T id="error.no_layouts" />
            {/if}
        </Center>
    {/if}
    <span style="display: flex; align-items: center;position: relative;">
        <!-- TODO: CTRL click = copy current layout, also right click... -->
        {#if layouts && !$showsCache[showId]?.reference}
            <Button on:click={addLayout} title={$dictionary.show?.new_layout}>
                <Icon size={1.3} id="add" />
            </Button>
        {/if}
        <div class="seperator" />
        <Button on:click={() => activePopup.set("transition")} title={$dictionary.popup?.transition}>
            <Icon size={1.3} id="transition" white />
        </Button>
        <Button class="context #slideViews" on:click={() => slidesOptions.set({ ...$slidesOptions, mode: slidesViews[$slidesOptions.mode] })} title={$dictionary.show?.[$slidesOptions.mode]}>
            <Icon size={1.3} id={$slidesOptions.mode} white />
        </Button>
        <Button on:click={() => (zoomOpened = !zoomOpened)} title={$dictionary.actions?.zoom}>
            <Icon size={1.3} id="zoomIn" white />
        </Button>
        {#if zoomOpened}
            <div class="zoom_container" transition:slide>
                <p class="text" on:click={() => slidesOptions.set({ ...$slidesOptions, columns: 4 })} title={$dictionary.actions?.resetZoom}>{(100 / $slidesOptions.columns).toFixed()}%</p>
                <Button disabled={$slidesOptions.columns <= 2} on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.max(2, $slidesOptions.columns - 1) })} title={$dictionary.actions?.zoomIn} center>
                    <Icon size={1.3} id="add" white />
                </Button>
                <Button disabled={$slidesOptions.columns >= 10} on:click={() => slidesOptions.set({ ...$slidesOptions, columns: Math.min(10, $slidesOptions.columns + 1) })} title={$dictionary.actions?.zoomOut} center>
                    <Icon size={1.3} id="remove" white />
                </Button>
            </div>
        {/if}
    </span>
</div>

<style>
    div {
        display: flex;
        justify-content: space-between;
        width: 100%;
        /* height: 50px; */
        background-color: var(--primary);
        border-top: 3px solid var(--primary-lighter);
        /* box-shadow: 0px -2px 2px rgb(0 0 0 / 40%); */
    }

    /* fixed height for consistent heights */
    div :global(button) {
        min-height: 35px;
        padding: 0.2em 0.8em !important;
    }

    .text {
        opacity: 0.8;
        text-align: center;
        padding: 0.5em 0;
    }
    div .zoom_container :global(button) {
        padding: 0.3em calc(0.8em - 1px) !important;
    }

    .seperator {
        width: 3px;
        height: 100%;
        background-color: var(--primary-lighter);
        /* margin: 0 10px; */
    }

    .zoom_container {
        position: absolute;
        right: 0;
        top: -3px;
        transform: translateY(-100%);
        overflow: hidden;

        flex-direction: column;
        width: auto;
        border-left: 3px solid var(--primary-lighter);
    }
</style>
