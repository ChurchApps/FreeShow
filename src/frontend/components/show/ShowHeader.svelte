<script lang="ts">
    import { fade } from "svelte/transition"
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"
    import { activePopup, openToolsTab, outputs, showNotesActive, shows, showsCache, special, styles, templates } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { allOutputsHasStyleTemplate, getFirstActiveOutput } from "../helpers/output"
    import { removeTemplatesFromShow } from "../helpers/show"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"

    export let showId: string
    export let hideOptions = false

    $: currentShow = $showsCache[showId]
    $: layouts = currentShow?.layouts

    let notes: { text: string; id: string; title: string; icon: string; tab: string } | null = null
    $: if (layouts || currentShow) updateNotes()
    function updateNotes() {
        notes = null

        const metadataValues = Object.values(currentShow.meta || {}).filter((a) => a !== currentShow?.name)
        const metadataText = metadataValues.reduce((v, a) => (v += a), "")
        if (metadataText.length) {
            const divider = "; "
            const text = metadataValues
                .filter((a) => a?.length)
                .join(divider)
                .replaceAll("<br>", " ")
            notes = { text: text, id: "metadata", title: "tools.metadata", icon: "info", tab: "metadata" }
            return
        }
    }

    const openTab = (e: Event, id: string) => {
        if (e.target?.closest("a")) {
            e.preventDefault()
            const url = (e.target as HTMLElement).closest("a")?.getAttribute("href") || ""
            sendMain(Main.URL, url)
            return
        }

        openToolsTab.set(id)
    }

    function mousedown(e) {
        if (!e.target.closest(".showDropdown") && !e.target.closest(".header .right")) showDropdown = false
    }

    let showDropdown = false
    let listScrollY = 0

    function toggleShowLock() {
        const shouldBeLocked = !currentShow?.locked

        showsCache.update((a) => {
            if (!a[showId]) return a
            a[showId].locked = shouldBeLocked

            removeTemplatesFromShow(showId)
            return a
        })
        shows.update((a) => {
            if (shouldBeLocked) a[showId].locked = true
            else delete a[showId].locked
            return a
        })
    }

    // TEMPLATE

    $: referenceType = currentShow?.reference?.type
    $: outputStyleId = getFirstActiveOutput($outputs)?.style || ""
    $: outputStyleTemplate = allOutputsHasStyleTemplate(referenceType === "scripture") ? $styles[outputStyleId]?.[referenceType === "scripture" ? "templateScripture" : "template"] || "" : ""
    $: enableStylePreview = !!(outputStyleTemplate && $special.styleTemplatePreview !== false && $templates[outputStyleTemplate])

    $: showTemplateId = currentShow?.settings?.template || ""
    $: showTemplateIcon = !!(showTemplateId && $templates[showTemplateId])
    $: enableShowTemplate = showTemplateIcon && (!referenceType || referenceType === "scripture" || open)
</script>

<svelte:window on:mousedown={mousedown} />

<div class="header" class:shadow={listScrollY > 0}>
    <p style="width: 100%;max-width: 98%;display: flex;align-items: center;gap: 0.5em;font-size: 0.9em;" data-title={currentShow?.name}>
        {#if currentShow?.name}
            {currentShow.name}
        {:else}
            <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
        {/if}

        {#if notes}
            <span class="notes" role="none" data-title={translateText(notes.title)} on:click={(e) => openTab(e, notes?.tab || "")}>
                <Icon id={notes.icon} size={0.8} right white />
                <p>{@html notes.text}</p>
            </span>
        {/if}
    </p>

    <div class="right">
        <!-- template icon -->
        {#if enableStylePreview}
            <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;" title="formats.template: <b>{$templates[outputStyleTemplate]?.name || ''}</b>" on:click={() => activePopup.set("template_info")}>
                <Icon size={0.8} id="styles" white />
            </MaterialButton>
        {:else if enableShowTemplate}
            <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;" class="context #show_template" title="formats.template: <b>{$templates[showTemplateId]?.name || 'info.template'}</b>" on:click={() => activePopup.set("template_info")}>
                <Icon size={0.8} id="templates" white />
            </MaterialButton>
        {/if}

        {#if !hideOptions}
            <!-- show more -->
            <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;border-bottom-right-radius: 10px;{showDropdown ? '' : 'opacity: 0.8;'}" title="create_show.more_options" icon="more" on:click={() => (showDropdown = !showDropdown)} white={!showDropdown}>
                <!-- prevent force "white" -->
                <span style="display: none;"></span>
            </MaterialButton>
        {/if}

        {#if showDropdown && currentShow}
            <div class="showDropdown" transition:fade={{ duration: 100 }} role="none" on:click={() => (showDropdown = false)}>
                <MaterialButton title="tooltip.notes" on:click={() => showNotesActive.set(!$showNotesActive)}>
                    <Icon id="notes" white={!$showNotesActive} />

                    {#if $showNotesActive}
                        <Icon id="check" size={0.7} white />
                    {/if}

                    <p><T id="tools.notes" /></p>
                </MaterialButton>

                <div class="DIVIDER"></div>

                <MaterialButton title="timeline.toggle_timeline" on:click={() => special.update((a) => ({ ...a, timelineActive: !a.timelineActive }))}>
                    <Icon id="timeline" white={!$special.timelineActive} />

                    {#if $special.timelineActive}
                        <Icon id="check" size={0.7} white />
                    {/if}

                    <p><T id="timeline.toggle_timeline" /></p>
                </MaterialButton>

                <div class="DIVIDER"></div>

                <MaterialButton title="context.lockForChanges" on:click={toggleShowLock}>
                    <Icon id="lock" white={!currentShow.locked} />

                    {#if currentShow.locked}
                        <Icon id="check" size={0.7} white />
                    {/if}

                    <p><T id="context.lockForChanges" /></p>
                </MaterialButton>
            </div>
        {/if}
    </div>
</div>

<style>
    /* header */

    .header {
        position: sticky;
        top: 0;
        left: 0;
        width: 100%;

        padding: 0.2em 0.8em;
        font-weight: 600;

        height: 30px;

        display: flex;
        align-items: center;

        backdrop-filter: blur(10px);

        border-bottom-left-radius: 10px;
        border-bottom-right-radius: 10px;

        background-color: rgb(0 0 10 / 0.3);

        z-index: 200;
        transition: box-shadow 0.2s ease;
    }
    .header.shadow {
        background-color: rgb(0 0 10 / 0.12);
        box-shadow: 0 2px 4px rgb(0 0 10 / 0.3);
    }

    .header .right {
        position: absolute;
        top: 0;
        height: 100%;

        display: flex;
    }
    .header .right {
        right: 0;
    }

    /* notes */

    .notes {
        padding: 0 8px;
        min-height: 30px;

        display: flex;
        align-items: center;
        justify-content: start;

        opacity: 0.7;
        font-size: 0.7em;
        font-weight: normal;
        max-width: 78%;
    }

    .notes p :global(*) {
        display: inline;
    }

    .notes :global(a) {
        color: var(--text);
        opacity: 0.7;

        display: inline-flex;
        gap: 5px;
        align-items: flex-end;

        -webkit-user-drag: none;
    }
    .notes :global(a:hover) {
        opacity: 0.75;
    }
    .notes :global(a:active) {
        opacity: 0.9;
    }

    /* dropdown */

    .showDropdown {
        position: absolute;
        top: 31px;
        right: 5px;
        overflow: hidden;

        display: flex;
        flex-direction: column;
        align-items: flex-start;

        /* backdrop-filter: blur(10px);
        background-color: rgb(0 0 10 / 0.3); */

        background-color: var(--primary-darkest);
        border-radius: 6px;

        border: 1px solid var(--primary-lighter);

        z-index: 1;
        box-shadow: 0 2px 5px rgb(0 0 0 / 0.3);
    }

    .showDropdown :global(button) {
        width: 100%;
        justify-content: start;
        padding: 8px 12px;
        border-radius: 0;

        font-weight: normal;
        font-size: 0.9em;
    }

    .showDropdown .DIVIDER {
        width: 100%;
        height: 1px;
        background-color: var(--primary-lighter);
    }
</style>
