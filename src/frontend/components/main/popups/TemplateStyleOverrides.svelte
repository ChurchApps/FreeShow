<script lang="ts">
    import { uid } from "uid"
    import type { Template, TemplateStyleOverride } from "../../../../types/Show"
    import { activeEdit, activePage, activePopup, globalRegexes, popupData, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { TemplateHelper } from "../../../utils/templates"
    import { DEFAULT_ITEM_STYLE } from "../../edit/scripts/itemHelpers"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Center from "../../system/Center.svelte"

    const initialData = $popupData
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
        const next = overrides.map((override) => (override.id === id ? { ...override, [key]: value } : override))
        commit(next)
    }

    function removeOverride(id: string) {
        const next = overrides.filter((override) => override.id !== id)
        commit(next)
    }

    $: templatesList = sortByName(
        keysToID($templates)
            .filter((a) => a.settings?.mode === "text")
            .map((a) => ({ value: a.id, label: a.name, style: new TemplateHelper(a.id).getTextStyle() + ";font-size: unset;" })),
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
        templates.update((a) => {
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

    $: regexes = Object.entries($globalRegexes).map(([id, regex]) => ({ value: id, label: regex.label }))
    function setRegex(id: string, regexId: string) {
        updateOverride(id, "globalRegex", regexId)
    }

    function editRegexes(id: string, regexId: string | undefined, name?: string) {
        if (!regexId) {
            regexId = uid()
            updateOverride(id, "globalRegex", regexId)
        }

        if (name) {
            globalRegexes.update((a) => {
                a[regexId!] = { label: name, value: "" }
                return a
            })
        }

        popupData.set({ id: regexId, previousData: clone($popupData), previousPopup: "template_style_overrides" })
        activePopup.set("regex_manager")
    }

    function deleteRegex(id: string) {
        globalRegexes.update((a) => {
            delete a[id]
            return a
        })
    }
</script>

<section style="width: clamp(500px, 75vw, 900px);">
    <p class="tip"><T id="edit.style_overrides_tip" /></p>

    {#if overrides.length}
        {#each overrides as override (override.id)}
            {@const pattern = override.globalRegex ? `${$globalRegexes[override.globalRegex]?.label || ""}: ${$globalRegexes[override.globalRegex]?.value || ""}` : override.pattern}

            <InputRow>
                <MaterialTextInput label="edit.style_override_pattern" style="flex: 4;" disabled={!!override.globalRegex} value={pattern} on:change={(e) => updateOverride(override.id, "pattern", e.detail)} autofocus={!pattern} />
                {#if override.globalRegex}
                    <MaterialButton title="titlebar.edit" icon="edit" on:click={() => editRegexes(override.id, override.globalRegex)} />
                {/if}
                <MaterialDropdown label="/regex/" options={regexes} value={override.globalRegex || ""} on:change={(e) => setRegex(override.id, e.detail)} on:new={(e) => editRegexes(override.id, "", e.detail)} addNew="Create Regex" on:delete={(e) => deleteRegex(e.detail)} allowDeleting onlyArrow />

                <MaterialDropdown label="formats.template" style="flex: 2;border-left: 3px solid var(--primary-lighter) !important;" options={templatesList} value={override.templateId || ""} on:change={(e) => updateOverride(override.id, "templateId", e.detail)} on:new={(e) => updateOverride(override.id, "templateId", createTemplate(e))} addNew="new.template" on:delete={(e) => deleteTemplate(e.detail)} allowDeleting />
                {#if override.templateId && $templates[override.templateId]}
                    <MaterialButton title="titlebar.edit" icon="edit" on:click={() => editTemplate(override.templateId)} white />
                {/if}

                <MaterialButton icon="delete" title="actions.delete" style="border-left: 3px solid var(--primary-lighter) !important;" on:click={() => removeOverride(override.id)} white />
            </InputRow>
        {/each}
    {:else}
        <Center faded style="margin: 20px 0;">
            <T id="empty.general" />
        </Center>
    {/if}

    <MaterialButton variant="outlined" icon="add" style="width: 100%;margin-top: 10px;" on:click={addOverride}>
        <T id="settings.add" />
    </MaterialButton>
</section>

<style>
    .tip {
        margin-bottom: 10px;

        opacity: 0.7;
        font-size: 0.8em;
    }
</style>
