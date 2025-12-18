<script lang="ts">
    import { uid } from "uid"
    import type { ClickEvent } from "../../../types/Main"
    import { changeSlidesView } from "../../show/slides"
    import { actions, activeEdit, activePage, activePopup, activeProject, activeShow, activeStyle, alertMessage, labelsDisabled, openToolsTab, outputs, projects, settingsTab, showsCache, slidesOptions, special, styles, templates } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { getActionIcon, runAction } from "../actions/actions"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { keysToID, sortByName } from "../helpers/array"
    import { duplicate } from "../helpers/clipboard"
    import { history } from "../helpers/history"
    import { getFirstActiveOutput } from "../helpers/output"
    import { removeTemplatesFromShow } from "../helpers/show"
    import { _show } from "../helpers/shows"
    import { joinTime, secondsToTime } from "../helpers/time"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialZoom from "../inputs/MaterialZoom.svelte"
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

    function addLayout(e: ClickEvent) {
        if (!e.detail.ctrl) {
            duplicate({ id: "layout" })
            return
        }

        history({ id: "UPDATE", newData: { key: "layouts", subkey: uid() }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
    }

    function changeName(e: any) {
        let currentLayout = e.detail?.id?.slice("layout_".length)
        if (!currentLayout || isLocked) return

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
        if (!$showsCache[showId]) return

        showsCache.update((a) => {
            if (!a[showId].settings) a[showId].settings = { activeLayout: "", template: null }
            a[showId].settings.activeLayout = id
            return a
        })

        // set active layout in project
        if (sortedLayouts?.length < 2) return
        if (($activeShow?.type === undefined || $activeShow?.type === "show") && $activeShow?.index !== undefined && $activeProject && $projects[$activeProject]?.shows?.[$activeShow.index]) {
            projects.update((a) => {
                a[$activeProject!].shows[$activeShow!.index!].layout = id
                a[$activeProject!].shows[$activeShow!.index!].layoutInfo = layoutInfo
                return a
            })
        }
    }

    let edit: string | boolean = false

    $: reference = currentShow.reference
    $: multipleLayouts = sortedLayouts.length > 1

    const openTab = (id: string) => openToolsTab.set(id)

    $: customActionId = currentShow?.settings?.customAction
    $: customAction = customActionId && $actions[customActionId] ? customActionId : ""
    function runCustomAction(edit = false) {
        if (edit || !customAction) {
            activePopup.set("custom_action")
            return
        }

        runAction($actions[customAction])
    }

    let profile = getAccess("shows")
    $: isLocked = currentShow?.locked || profile.global === "read" || profile[currentShow?.category || ""] === "read"

    // NOTES

    let bottomHeight = 40

    let notes: { text: string; id: string; title: string; icon: string; tab: string } | null = null
    $: if (layouts || currentShow) updateNotes()
    function updateNotes() {
        bottomHeight = 40
        notes = null

        const layoutNotes = layouts?.[activeLayout]?.notes
        if (layoutNotes) {
            if (typeof layoutNotes !== "string") return
            notes = { text: layoutNotes.replaceAll("\n", "&nbsp;"), id: "notes", title: "tools.notes", icon: "notes", tab: "notes" }
            if (layoutNotes.includes("<br>")) bottomHeight = 40 + 18 * (layoutNotes.split("<br>").length - 1)
            return
        }

        const messageText = currentShow.message?.text
        if (messageText?.length) {
            notes = { text: messageText.replaceAll("\n", "&nbsp;"), id: "message", title: "meta.message", icon: "message", tab: "metadata" }
            return
        }

        const metadataValues = Object.values(currentShow.meta || {})
        const metadataText = metadataValues.reduce((v, a) => (v += a), "")
        if (metadataText.length) {
            const divider = "; " // currentStyle.metadataDivider
            const text = metadataValues
                .filter((a) => a?.length)
                .join(divider)
                .replaceAll("<br>", " ")
            notes = { text: text, id: "metadata", title: "tools.metadata", icon: "info", tab: "metadata" }
            return
        }
    }

    $: referenceType = currentShow?.reference?.type
    $: notesVisible = $slidesOptions.mode !== "simple" && $slidesOptions.mode !== "groups" && notes && referenceType !== "lessons" // $slidesOptions.mode === "grid" &&

    // style template
    $: outputStyleId = getFirstActiveOutput($outputs)?.style || ""
    $: outputStyleTemplate = $styles[outputStyleId]?.[referenceType === "scripture" ? "templateScripture" : "template"] || ""
    function editStyleTemplate() {
        activeStyle.set(outputStyleId)
        settingsTab.set("styles")
        activePage.set("settings")
        // scroll to bottom
        setTimeout(() => {
            document.querySelector(".row")?.querySelector(".center")?.querySelector(".scroll")?.scrollTo(0, 1000)
        }, 80)
    }
</script>

{#if notesVisible && notes}
    <div class="notes" role="button" tabindex="0" data-title={translateText(notes.title)} on:click={() => openTab(notes?.tab || "")} on:keydown={triggerClickOnEnterSpace}>
        <Icon id={notes.icon} right white />
        <p>{@html notes.text}</p>
    </div>
{/if}

{#if referenceType === "lessons"}
    <MaterialZoom hidden columns={$slidesOptions.columns} on:change={(e) => slidesOptions.set({ ...$slidesOptions, columns: e.detail })} />
{:else if layoutSlides.length}
    <FloatingInputs arrow={!isLocked} bottom={notesVisible ? bottomHeight : 10} let:open>
        <div slot="menu">
            {#if Object.keys($actions).length && !reference && (!isLocked || customAction)}
                <MaterialButton title="show.custom_action_tip" on:click={() => runCustomAction(true)}>
                    <Icon size={1.1} id="actions" white={!customAction} />
                </MaterialButton>

                <div class="divider" />
            {/if}

            <MaterialButton on:click={() => activePopup.set("translate")} title="popup.translate">
                <Icon size={1.1} id="translate" white={!isTranslated} />
            </MaterialButton>
        </div>

        {#if !open && customAction}
            <MaterialButton style="aspect-ratio: unset;" class="context #edit_custom_action" title="actions.run_action: {$actions[customAction].name}" on:click={() => runCustomAction()}>
                <Icon size={1.1} id={getActionIcon(customAction)} />
                <p>{$actions[customAction].name}</p>
            </MaterialButton>

            <div class="divider" />
        {/if}

        {#if isLocked}
            <MaterialButton
                title="show.locked"
                on:click={() => {
                    alertMessage.set(currentShow?.locked ? "show.locked_info" : "profile.locked")
                    activePopup.set("alert")
                }}
            >
                <Icon size={1.1} id="locked" />
            </MaterialButton>
        {:else}
            {#if !open && (isTranslated || referenceType === "scripture")}
                <MaterialButton on:click={() => activePopup.set("translate")} title="popup.translate">
                    <Icon size={1.1} id="translate" white={!isTranslated} />
                </MaterialButton>
            {/if}

            {#if open || totalTime !== "0s" || referenceType !== "scripture"}
                <MaterialButton title="popup.next_timer{totalTime !== '0s' ? ': ' + totalTime : ''} [Ctrl+Shift+D]" on:click={() => activePopup.set("next_timer")}>
                    <Icon size={1.1} id="clock" white={totalTime === "0s"} />
                </MaterialButton>
            {/if}

            {#if (!referenceType || referenceType === "scripture" || open) && currentShow?.settings?.template && $templates[currentShow.settings.template]}
                {#if open}
                    <div class="divider"></div>
                {/if}

                <MaterialButton
                    title="menu.edit: {$templates[currentShow.settings.template].name || 'info.template'}"
                    on:click={() => {
                        activeEdit.set({ type: "template", id: currentShow.settings.template || "", items: [] })
                        activePage.set("edit")
                    }}
                >
                    <Icon size={1.1} id="templates" />
                </MaterialButton>
                {#if open}
                    <MaterialButton title="actions.remove_template_from_show" on:click={() => removeTemplatesFromShow($activeShow?.id || "", true)}>
                        <Icon size={1.1} id="remove_circle" />
                    </MaterialButton>
                {/if}
            {/if}

            <!-- output style template -->
            {#if outputStyleTemplate && $special.styleTemplatePreview !== false && $templates[outputStyleTemplate]}
                {#if open}
                    <div class="divider"></div>
                {/if}

                <MaterialButton title="formats.template: {$templates[outputStyleTemplate].name || ''}" on:click={editStyleTemplate}>
                    <Icon size={1.1} id="styles" />
                </MaterialButton>
            {/if}
        {/if}

        {#if open}
            <div class="divider"></div>
        {/if}

        <MaterialZoom hidden={!open} columns={$slidesOptions.columns} on:change={(e) => slidesOptions.set({ ...$slidesOptions, columns: e.detail })} />

        <MaterialButton class="context #slideViews" title="show.change_view: show.{$slidesOptions.mode} [Ctrl+Shift+V]" on:click={changeSlidesView}>
            <Icon size={1.3} id={$slidesOptions.mode} white={$slidesOptions.mode === "grid"} />
        </MaterialButton>
    </FloatingInputs>
{/if}

{#if $slidesOptions.mode !== "simple"}
    <FloatingInputs style="max-width: {referenceType ? 90 : 70}%;" side="left" bottom={notesVisible ? bottomHeight : 10} onlyOne={!reference && !multipleLayouts}>
        {#if reference}
            <Reference show={currentShow} />
        {:else if layouts}
            {#if multipleLayouts}
                <span class="layouts">
                    {#each sortedLayouts as layout}
                        <SelectElem id="layout" data={layout.id} fill={!edit || edit === layout.id}>
                            <MaterialButton
                                class={isLocked ? "" : "context #layout"}
                                on:click={() => {
                                    if (!edit) setLayout(layout.id, { name: layout.name })
                                }}
                                isActive={activeLayout === layout.id}
                            >
                                <HiddenInput value={layout.name} id={"layout_" + layout.id} on:edit={changeName} bind:edit allowEdit={!isLocked} />
                            </MaterialButton>
                        </SelectElem>
                    {/each}
                </span>
            {/if}

            <MaterialButton disabled={!layoutSlides.length || isLocked} on:click={addLayout} style="white-space: nowrap;" title="show.new_layout" center>
                <Icon id="add" size={1.1} white={multipleLayouts} />
                {#if !multipleLayouts && !$labelsDisabled}<T id="show.new_layout" />{/if}
            </MaterialButton>
        {/if}
    </FloatingInputs>
{/if}

<style>
    .layouts {
        display: flex;
        overflow-x: auto;
    }

    .notes {
        background-color: var(--primary-darkest);
        border-top: 1px solid var(--primary-lighter);
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        /* position: absolute;bottom: 0;transform: translateY(-100%); */
        padding: 0 8px;
        min-height: 30px;

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
</style>
