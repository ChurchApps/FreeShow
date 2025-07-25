<script lang="ts">
    import { slide } from "svelte/transition"
    import { uid } from "uid"
    import { changeSlidesView } from "../../show/slides"
    import { actions, activePopup, activeProject, activeShow, alertMessage, dictionary, labelsDisabled, notFound, openToolsTab, projects, showsCache, slidesOptions } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import { getActionIcon, runAction } from "../actions/actions"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { keysToID, sortByName } from "../helpers/array"
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

    $: sortedLayouts = sortByName(keysToID(layouts || {}))

    let totalTime = "0s"
    let isTranslated = false
    $: layoutSlides = layouts?.[activeLayout]?.slides || []
    $: if (layoutSlides.length) getTotalTime()
    function getTotalTime() {
        let ref = _show()
            .layouts("active")
            .ref()[0]
            .filter((a) => !a.data.disabled)
        let total = ref.reduce((value, slide) => (value += Number(slide.data.nextTimer || 0)), 0)

        totalTime = total ? (total > 59 ? joinTime(secondsToTime(total)) : total + "s") : "0s"

        isTranslated = !!layoutSlides.find((a) =>
            _show()
                .slides([a.id])
                .get("items")
                .flat()
                .find((a) => a?.language)
        )
    }

    function addLayout(e: any) {
        if (!e.ctrlKey && !e.metaKey) {
            duplicate({ id: "layout" })
            return
        }

        history({ id: "UPDATE", newData: { key: "layouts", subkey: uid() }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
    }

    function changeName(e: any) {
        let currentLayout = e.detail?.id?.slice("layout_".length)
        if (!currentLayout) return

        const newName = e.detail.value
        history({ id: "UPDATE", newData: { key: "layouts", keys: [currentLayout], subkey: "name", data: newName }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })

        if ($projects[$activeProject!]?.shows?.[$activeShow?.index ?? -1]?.layout === currentLayout) {
            projects.update((a) => {
                a[$activeProject!].shows[$activeShow!.index!].layoutInfo = { name: newName }
                return a
            })
        }
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

    let edit: string | boolean = false

    let zoomOpened = false
    function mousedown(e: any) {
        if (e.target.closest(".zoom_container") || e.target.closest("button")) return

        zoomOpened = false
    }

    let loading = false
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

    const openTab = (id: string) => openToolsTab.set(id)

    $: customActionId = currentShow?.settings?.customAction
    $: customAction = customActionId && $actions[customActionId] ? customActionId : ""
    function runCustomAction() {
        if (!customAction) {
            activePopup.set("custom_action")
            return
        }

        runAction($actions[customAction])
    }
</script>

<svelte:window on:mousedown={mousedown} />

{#if $slidesOptions.mode === "grid"}
    <!-- one at a time, in prioritized order -->
    {#if layouts?.[activeLayout]?.notes}
        <div class="notes" role="button" tabindex="0" title={$dictionary.tools?.notes} on:click={() => openTab("notes")} on:keydown={triggerClickOnEnterSpace}>
            <Icon id="notes" right white />
            {#if typeof layouts[activeLayout].notes === "string"}
                <p>{@html layouts[activeLayout].notes.replaceAll("\n", "&nbsp;")}</p>
            {/if}
        </div>
    {:else if currentShow.message?.text}
        <div class="notes" role="button" tabindex="0" title={$dictionary.meta?.message} on:click={() => openTab("metadata")} on:keydown={triggerClickOnEnterSpace}>
            <Icon id="message" right white />
            <p>{@html currentShow.message?.text.replaceAll("\n", "&nbsp;")}</p>
        </div>
    {:else if !currentShow.metadata?.autoMedia && Object.values(currentShow.meta || {}).reduce((v, a) => (v += a), "").length}
        <div class="notes" role="button" tabindex="0" title={$dictionary.tools?.metadata} on:click={() => openTab("metadata")} on:keydown={triggerClickOnEnterSpace}>
            <Icon id="info" right white />
            <p>
                <!-- currentStyle.metadataDivider -->
                {@html Object.values(currentShow.meta)
                    .filter((a) => a?.length)
                    .join("; ")
                    .replaceAll("<br>", " ")}
            </p>
        </div>
    {/if}
{/if}

<div>
    {#if reference}
        <Reference show={currentShow} />
    {:else if layouts}
        <span style="display: flex;overflow-x: hidden;">
            {#if multipleLayouts}
                <span style="display: flex;overflow-x: auto;">
                    {#each sortedLayouts as layout}
                        <SelectElem id="layout" data={layout.id} fill={!edit || edit === layout.id}>
                            <Button
                                class={currentShow.locked ? "" : "context #layout"}
                                on:click={() => {
                                    if (!edit) setLayout(layout.id, { name: layout.name })
                                }}
                                active={activeLayout === layout.id}
                                center
                            >
                                <HiddenInput value={layout.name} id={"layout_" + layout.id} on:edit={changeName} bind:edit />
                            </Button>
                        </SelectElem>
                    {/each}
                </span>

                <Button disabled={currentShow.locked} on:click={addLayout} style="white-space: nowrap;" title={$dictionary.show?.new_layout} center>
                    <Icon id="add" />
                </Button>
            {/if}
        </span>
    {:else}
        <Center faded size={0.8}>
            {#if loading}
                <T id="remote.loading" />
            {:else}
                <T id="error.no_layouts" />
            {/if}
        </Center>
    {/if}
    <span style="display: flex; align-items: center;position: relative;{multipleLayouts || reference || !layouts ? '' : 'width: 100%;'}">
        {#if !multipleLayouts && layouts && !reference}
            <!-- left aligned to prevent accidental clicks -->
            <span style="width: 100%;">
                <Button disabled={!layoutSlides.length || currentShow.locked} on:click={addLayout} style="white-space: nowrap;" title={$dictionary.show?.new_layout} center>
                    <Icon id="add" right={!$labelsDisabled} />
                    {#if !$labelsDisabled}<T id="show.new_layout" />{/if}
                </Button>
            </span>
        {/if}

        <!-- RIGHT BUTTONS -->

        <!-- action button -->
        {#if Object.keys($actions).length && !reference}
            <div class="seperator" />

            <Button class="context #edit_custom_action" on:click={runCustomAction} title={customAction ? `${$dictionary.actions?.run_action}: ${$actions[customAction].name}` : $dictionary.show?.custom_action_tip}>
                <Icon size={1.1} id={customAction ? getActionIcon(customAction) : "actions"} white={!customAction} right={!!customAction} />
                {#if customAction}<p>{$actions[customAction].name}</p>{/if}
            </Button>
        {/if}

        <div class="seperator" />

        {#if currentShow.locked}
            <Button
                on:click={() => {
                    alertMessage.set("show.locked_info")
                    activePopup.set("alert")
                }}
                title={$dictionary.show?.locked}
            >
                <Icon size={1.1} id="locked" />
            </Button>
        {:else}
            <Button disabled={!layoutSlides.length} on:click={() => activePopup.set("translate")} title={$dictionary.popup?.translate}>
                <Icon size={1.1} id="translate" white={!isTranslated} />
            </Button>
            <Button disabled={!layoutSlides.length} on:click={() => activePopup.set("next_timer")} title="{$dictionary.popup?.next_timer}{totalTime !== '0s' ? ': ' + totalTime : ''}">
                <Icon size={1.1} id="clock" white={totalTime === "0s"} />
            </Button>
        {/if}

        <div class="seperator" />

        <Button class="context #slideViews" on:click={changeSlidesView} title="{$dictionary.show?.change_view}: {$dictionary.show?.[$slidesOptions.mode]} [Ctrl+Shift+V]">
            <Icon size={1.3} id={$slidesOptions.mode} white />
        </Button>
        <Button on:click={() => (zoomOpened = !zoomOpened)} title={$dictionary.actions?.zoom}>
            <Icon size={1.3} id="zoomIn" white />
        </Button>
        {#if zoomOpened}
            <div class="zoom_container" transition:slide={{ duration: 150 }}>
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
        border-radius: var(--border-radius);
        /* position: absolute;bottom: 0;transform: translateY(-100%); */
        padding: 0 8px;
        min-height: 28px;

        display: flex;
        align-items: center;
        justify-content: start;
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
        width: 1px;
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
        inset-inline-end: 0;
        top: 0;
        transform: translateY(-100%);
        overflow: hidden;

        flex-direction: column;
        width: auto;
        /* border-left: 3px solid var(--primary-lighter); */

        z-index: 2;
    }
</style>
