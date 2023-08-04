<script lang="ts">
    import { slide } from "svelte/transition"
    import { uid } from "uid"
    import { activePopup, activeProject, activeShow, dictionary, labelsDisabled, notFound, projects, showsCache, slidesOptions } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { duplicate } from "../helpers/clipboard"
    import { history } from "../helpers/history"
    import { _show } from "../helpers/shows"
    import { joinTime, secondsToTime } from "../helpers/time"
    import Button from "../inputs/Button.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import Center from "../system/Center.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import Reference from "./Reference.svelte"

    $: showId = $activeShow?.id || ""
    $: currentShow = $showsCache[showId] || {}
    $: layouts = currentShow.layouts
    $: activeLayout = currentShow.settings?.activeLayout

    $: sortedLayouts = Object.entries(layouts || {})
        .map(([id, layout]: any) => ({ id, ...layout }))
        .sort((a, b) => a.name?.localeCompare(b.name))

    let totalTime: string = "0s"
    $: if (layouts?.[activeLayout]?.slides?.length) getTotalTime()
    function getTotalTime() {
        let ref = _show()
            .layouts("active")
            .ref()[0]
            .filter((a) => !a.data.disabled)
        let total = ref.reduce((value, slide) => (value += Number(slide.data.nextTimer || 0)), 0)

        totalTime = total ? (total > 59 ? joinTime(secondsToTime(total)) : total + "s") : "0s"
    }

    function addLayout(e: any): any {
        if (!e.ctrlKey && !e.metaKey) return duplicate({ id: "layout" })

        history({ id: "UPDATE", newData: { key: "layouts", subkey: uid() }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
    }

    const slidesViews: any = { grid: "simple", simple: "list", list: "lyrics", lyrics: "text", text: "grid" }

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
    $: if ($notFound.show?.includes(showId)) loading = false
    function startLoading() {
        loading = true
        setTimeout(() => {
            loading = false
        }, 8000)
    }

    $: reference = currentShow.reference
    $: multipleLayouts = sortedLayouts.length > 1
</script>

<svelte:window on:mousedown={mousedown} />

{#if $slidesOptions.mode === "grid"}
    <!-- one at a time, in prioritized order -->
    {#if layouts?.[activeLayout]?.notes}
        <div class="notes" title={$dictionary.tools?.notes}>
            <Icon id="notes" right white />
            <p>{@html layouts[activeLayout].notes.replaceAll("\n", "&nbsp;")}</p>
        </div>
    {:else if currentShow.message?.text}
        <div class="notes" title={$dictionary.meta?.message}>
            <Icon id="message" right white />
            <p>{@html currentShow.message?.text.replaceAll("\n", "&nbsp;")}</p>
        </div>
    {:else if !currentShow.metadata?.autoMedia && Object.values(currentShow.meta || {}).reduce((v, a) => (v += a), "").length}
        <div class="notes" title={$dictionary.tools?.metadata}>
            <Icon id="info" right white />
            <p>
                {@html Object.values(currentShow.meta)
                    .filter((a) => a.length)
                    .join("; ")}
            </p>
        </div>
    {/if}
{/if}

<div>
    {#if reference}
        <Reference show={$showsCache[showId]} />
    {:else if layouts}
        <!-- TODO: rename glitching -->
        <span style="display: flex;overflow-x: auto;">
            <!-- width: 100%; -->
            {#if multipleLayouts}
                {#each sortedLayouts as layout}
                    <!-- <SelectElem id="layout" data={id} borders="edges" trigger="row" draggable fill> -->
                    <SelectElem id="layout" data={layout.id} fill={!edit || edit === layout.id}>
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
            {/if}
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
    <span style="display: flex; align-items: center;position: relative;{multipleLayouts || reference || !layouts ? '' : 'width: 100%;'}">
        <!-- TODO: right click to create empty layout... -->
        {#if layouts && !reference}
            <Button on:click={addLayout} style="white-space: nowrap;{multipleLayouts ? '' : 'width: 100%;'}" center>
                <Icon size={1.3} id="add" right={!$labelsDisabled && !multipleLayouts} />
                {#if !$labelsDisabled && !multipleLayouts}<T id="show.new_layout" />{/if}
            </Button>
        {/if}

        <div class="seperator" />

        <Button on:click={() => activePopup.set("next_timer")} title="{$dictionary.popup?.next_timer}{totalTime !== '0s' ? ': ' + totalTime : ''}">
            <Icon size={1.1} id="clock" white={totalTime === "0s"} />
        </Button>

        <Button class="context #slideViews" on:click={() => slidesOptions.set({ ...$slidesOptions, mode: slidesViews[$slidesOptions.mode] })} title={$dictionary.show?.[$slidesOptions.mode]}>
            <Icon size={1.3} id={$slidesOptions.mode} white />
        </Button>
        <Button on:click={() => (zoomOpened = !zoomOpened)} title={$dictionary.actions?.zoom}>
            <Icon size={1.3} id="zoomIn" white />
        </Button>
        {#if zoomOpened}
            <div class="zoom_container" transition:slide>
                <Button style="padding: 0 !important;" on:click={() => slidesOptions.set({ ...$slidesOptions, columns: 4 })} bold={false} center>
                    <p class="text" title={$dictionary.actions?.resetZoom}>{(100 / $slidesOptions.columns).toFixed()}%</p>
                </Button>
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
    .notes {
        background-color: var(--primary);
        /* position: absolute;bottom: 0;transform: translateY(-100%); */
        padding: 0 8px;
        height: 28px;

        display: flex;
        align-items: center;
        justify-content: left;
        /* justify-content: center; */
    }

    .notes p :global(*) {
        display: inline;
    }

    div {
        display: flex;
        justify-content: space-between;
        width: 100%;
        /* height: 50px; */
        /* background-color: var(--primary); */
        background-color: var(--primary-darkest);
        /* border-top: 3px solid var(--primary-lighter); */
    }

    /* fixed height for consistent heights */
    div :global(button) {
        min-height: 28px;
        padding: 0 0.8em !important;
    }
    div :global(button.active) {
        /* color: var(--secondary) !important; */
        /* color: rgb(255 255 255 /0.5) !important; */
        background-color: var(--primary) !important;
    }

    .seperator {
        width: 2px;
        height: 100%;
        background-color: var(--primary);
        /* margin: 0 10px; */
    }

    .text {
        opacity: 0.8;
        text-align: center;
        padding: 0.5em 0;
    }

    /* div .zoom_container :global(button) {
        padding: 0.3em calc(0.8em - 1px) !important;
    } */
    .zoom_container {
        position: absolute;
        right: 0;
        top: 0;
        transform: translateY(-100%);
        overflow: hidden;

        flex-direction: column;
        width: auto;
        /* border-left: 3px solid var(--primary-lighter); */

        z-index: 2;
    }
</style>
