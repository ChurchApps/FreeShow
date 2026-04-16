<script lang="ts">
    import { fade } from "svelte/transition"
    import { activeEdit, activePopup, groups, showsCache, slideNotesActive, special, templates } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { _show } from "../helpers/shows"
    import { getLayoutRef } from "../helpers/show"

    export let showId: string
    export let hideOptions = false

    $: currentShow = $showsCache[showId]

    function mousedown(e) {
        if (!e.target.closest(".showDropdown") && !e.target.closest(".header .right")) showDropdown = false
    }

    let showDropdown = false
    let listScrollY = 0

    // TEMPLATE

    $: ref = showId && currentShow ? getLayoutRef(showId) : []
    $: Slide = $activeEdit.slide !== null && ref?.[$activeEdit.slide!] ? _show(showId).slides([ref[$activeEdit.slide!]?.id]).get()?.[0] : null

    $: parentId = $activeEdit.slide !== null && ref?.[$activeEdit.slide!] ? ref[$activeEdit.slide!]?.parent?.id || ref[$activeEdit.slide!]?.id : ""
    $: slideGroup = _show(showId).slides([parentId]).get()?.[0]?.globalGroup || ""
    $: templateId = Slide?.settings?.template || $groups[slideGroup]?.template || currentShow?.settings?.template || ""
</script>

<svelte:window on:mousedown={mousedown} />

<div class="header" class:shadow={listScrollY > 0}>
    <p style="width: 100%;max-width: 98%;display: flex;align-items: center;gap: 0.5em;font-size: 0.9em;" data-title={currentShow?.name}>
        {#if currentShow?.name}
            {currentShow.name}
        {:else}
            <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
        {/if}
    </p>

    <div class="right">
        {#if templateId}
            <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;" title="formats.template: <b>{$templates[templateId]?.name || 'info.template'}</b>" on:click={() => activePopup.set("template_info")}>
                <Icon size={0.8} id="templates" white />
            </MaterialButton>
        {/if}

        {#if !hideOptions}
            <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;border-bottom-right-radius: 10px;{showDropdown ? '' : 'opacity: 0.8;'}" title="create_show.more_options" icon="more" on:click={() => (showDropdown = !showDropdown)} white={!showDropdown}>
                <!-- prevent force "white" -->
                <span style="display: none;"></span>
            </MaterialButton>
        {/if}

        {#if showDropdown && currentShow}
            <div class="showDropdown" transition:fade={{ duration: 100 }} role="none" on:click={() => (showDropdown = false)}>
                <MaterialButton title="tooltip.notes" on:click={() => slideNotesActive.set(!$slideNotesActive)}>
                    <Icon id="notes" white={!$slideNotesActive} />

                    {#if $slideNotesActive}
                        <Icon id="check" size={0.7} white />
                    {/if}

                    <p><T id="items.slide_notes" /></p>
                </MaterialButton>

                <div class="DIVIDER"></div>

                <MaterialButton title="timeline.toggle_timeline" on:click={() => special.update((a) => ({ ...a, slideTimelineActive: !a.slideTimelineActive }))}>
                    <Icon id="timeline" white={!$special.slideTimelineActive} />

                    {#if $special.slideTimelineActive}
                        <Icon id="check" size={0.7} white />
                    {/if}

                    <p><T id="timeline.toggle_timeline" /></p>
                </MaterialButton>

                <!-- <div class="DIVIDER"></div> -->

                <!-- lock slide group from here? -->
                <!-- <MaterialButton title="context.lockForChanges" on:click={toggleSlideGroupLock}>
                    <Icon id="lock" white={!slide.locked} />

                    {#if slide.locked}
                        <Icon id="check" size={0.7} white />
                    {/if}

                    <p><T id="context.lockForChanges" /></p>
                </MaterialButton> -->
            </div>
        {/if}
    </div>
</div>

<style>
    /* header */

    .header {
        position: relative;
        width: 100%;
        height: 30px;

        padding: 0.2em 0.8em;
        font-weight: 600;

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
    }
    .header .right {
        right: 0;
    }

    /* dropdown */

    .showDropdown {
        position: absolute;
        top: 31px;
        right: 2px;
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
