<script lang="ts">
    import { get } from "svelte/store"
    import { uid } from "uid"
    import type { Template, TemplateStyleOverride } from "../../../../types/Show"
    import { activeEdit, activePage, activePopup, popupData, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { DEFAULT_ITEM_STYLE } from "../../edit/scripts/itemHelpers"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import { TemplateHelper } from "../../../utils/templates"

    const initialData = get(popupData)
    let templateId: string = initialData.templateId || ""

    $: template = $templates[templateId] || {}
    $: overrides = clone(template.settings?.styleOverrides || [])

    // push the updated override list back through history so undo still works
    function commit(nextOverrides: TemplateStyleOverride[]) {
        if (!templateId) return

        const settings = clone(template.settings || {})
        if (nextOverrides.length) settings.styleOverrides = clone(nextOverrides)
        else delete settings.styleOverrides

        history({ id: "UPDATE", newData: { key: "settings", data: settings }, oldData: { id: templateId }, location: { page: "edit", id: "template_settings", override: `${templateId}_styleOverrides` } })
    }

    // add a fresh empty rule the user can fill in
    function addOverride() {
        const next: TemplateStyleOverride[] = [...overrides, { id: uid(6), pattern: "", templateId: "" }]
        commit(next)
    }

    function updateOverride(id: string, key: keyof TemplateStyleOverride, value: string | boolean) {
        const next = overrides.map(override => (override.id === id ? { ...override, [key]: value } : override))
        commit(next)
    }

    // function toggleOverrideFlag(id: string, key: FormatToggleKey) {
    //     const target = overrides.find(override => override.id === id)
    //     if (!target) return

    //     const active = !!target[key]
    //     updateOverride(id, key, !active)
    // }

    function removeOverride(id: string) {
        const next = overrides.filter(override => override.id !== id)
        commit(next)
    }

    $: templatesList = sortByName(
        keysToID($templates)
            .filter(a => a.settings?.mode === "text")
            .map(a => ({ value: a.id, label: a.name, style: new TemplateHelper(a.id).getTextStyle() + ";font-size: unset;" })),
        "value"
    )

    function createTemplate(e: any) {
        const templateId = uid()
        const name = e.detail

        const newTemplate = {
            name,
            color: null,
            category: null,
            settings: { mode: "text" },
            items: [{ style: clone(DEFAULT_ITEM_STYLE), lines: [{ text: [{ style: "", value: name || translateText("example.text") }] }] }]
        } as Template

        // history({ id: "UPDATE", newData: defaultTemplate, oldData: {id: templateId}, location: { page: "drawer", id: "template" } })
        templates.update(a => {
            a[templateId] = newTemplate
            return a
        })

        return templateId
    }

    function editTemplate(templateId?: string) {
        activeEdit.set({ type: "template", id: templateId, items: [] })
        activePage.set("edit")
        activePopup.set(null)
    }

    function deleteTemplate(templateId: string) {
        history({ id: "UPDATE", newData: { id: templateId }, location: { page: "edit", id: "template" } })
    }
</script>

<div class="popupRoot">
    <p class="tip"><T id="edit.style_overrides_tip" /></p>

    <section class="list">
        {#if overrides.length}
            {#each overrides as override (override.id)}
                <InputRow style="background-color: var(--primary-darker);padding: 8px;border-radius: 6px;">
                    <MaterialTextInput label="edit.style_override_pattern" style="flex: 4;" value={override.pattern} on:change={e => updateOverride(override.id, "pattern", e.detail)} autofocus={!override.pattern} />

                    <MaterialDropdown label="formats.template" style="flex: 2;margin-left: 8px;" options={templatesList} value={override.templateId || ""} on:change={e => updateOverride(override.id, "templateId", e.detail)} on:new={e => updateOverride(override.id, "templateId", createTemplate(e))} addNew="new.template" on:delete={e => deleteTemplate(e.detail)} allowDeleting />
                    {#if override.templateId && $templates[override.templateId]}
                        <MaterialButton title="titlebar.edit" icon="edit" on:click={() => editTemplate(override.templateId)} white />
                    {/if}

                    <MaterialButton icon="delete" title="actions.delete" style="margin-left: 8px;" on:click={() => removeOverride(override.id)} white />
                </InputRow>
            {/each}
        {:else}
            <div class="empty">
                <T id="empty.general" />
            </div>
        {/if}
    </section>

    <MaterialButton variant="outlined" icon="add" style="width: 100%;" on:click={addOverride}>
        <T id="settings.add" />
    </MaterialButton>
</div>

<style>
    .popupRoot {
        display: flex;
        flex-direction: column;
        gap: 15px;
        width: clamp(500px, 75vw, 900px);
    }

    .tip {
        margin-bottom: 10px;

        opacity: 0.7;
        font-size: 0.8em;
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1 1 auto;
        overflow: visible;
    }

    .empty {
        padding: 20px;
        text-align: center;
        opacity: 0.6;
    }
</style>
