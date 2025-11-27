<script lang="ts">
    import { activeDrawerTab, activeEdit, activePage, activeShow, activeTriggerFunction, showsCache, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialTextarea from "../../inputs/MaterialTextarea.svelte"

    $: slideId = getLayoutRef()[$activeEdit.slide || 0]?.id
    $: editSlide = $showsCache && $activeEdit.slide !== null && slideId ? _show().slides([slideId]).get()[0] : null

    // $: globalGroup = _show().get("slides")[slideId]?.globalGroup || ""
    // $: groupData = $groups[globalGroup] || {}
    // $: groupTemplate = groupData.template

    let notesElem: HTMLElement | undefined
    $: if (notesElem && $activeTriggerFunction === "slide_notes") {
        setTimeout(() => {
            if (!notesElem) return

            // focus after any textbox is focused
            notesElem.querySelector("textarea")?.focus()
            notesElem.scrollIntoView()

            activeTriggerFunction.set("")
        }, 20)
    }

    let settings: { template?: string; color?: string } = {}

    $: if ($showsCache || editSlide) setValues()
    function setValues() {
        settings = {
            template: editSlide?.settings?.template,
            color: editSlide?.settings?.color || ""
        }
    }

    function update() {
        if (!editSlide) return

        let newData = { style: clone(settings) }

        history({
            id: "slideStyle",
            oldData: { style: editSlide?.settings },
            newData,
            location: { page: "edit", show: $activeShow!, slide: slideId }
        })
    }

    let note = ""
    $: if ($activeEdit.slide !== null && $activeEdit.slide !== undefined) note = editSlide?.notes || ""

    function edit(e: any) {
        if (editSlide.notes === e.detail || !slideId) return

        _show($activeShow!.id).slides([slideId]).set({ key: "notes", value: e.detail })
    }

    function editTemplate(id: string) {
        activeDrawerTab.set("templates")
        activeEdit.set({ type: "template", id, items: [] })
        activePage.set("edit")
    }
</script>

<div class="tools">
    <div>
        <MaterialColorInput
            label="edit.background_color"
            value={settings.color}
            on:input={e => {
                settings.color = e.detail
                update()
            }}
            allowEmpty
            noLabel
        />
        <InputRow>
            <!-- {#if groupTemplate && !settings.template}
                <span style="display: flex;align-items: center;padding: 0 10px;font-size: 0.8em;opacity: 0.7;"><T id="settings.overrided_value" /></span>
            {/if} -->
            <MaterialPopupButton
                label="show.slide_template"
                value={settings.template}
                name={$templates[settings.template || ""]?.name}
                popupId="select_template"
                icon="templates"
                on:change={e => {
                    settings.template = e.detail
                    update()
                }}
                allowEmpty
            />
            {#if settings.template && $templates[settings.template]}
                <MaterialButton title="titlebar.edit" icon="edit" on:click={() => editTemplate(settings.template || "")} />
            {/if}
        </InputRow>
    </div>

    <div>
        <div class="title">
            <span style="display: flex;gap: 8px;align-items: center;padding: 8px 12px;">
                <Icon id="notes" white />
                <p>{translateText("tools.notes")}</p>
            </span>
        </div>

        <MaterialTextarea label="items.slide_notes" value={note} rows={3} on:change={edit} />
    </div>
</div>

<style>
    .tools {
        padding: 8px 5px;

        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    /* title */

    .title {
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);

        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        overflow: hidden;
    }
    .title p {
        font-weight: 500;
        font-size: 0.8rem;
        opacity: 0.8;
    }
</style>
