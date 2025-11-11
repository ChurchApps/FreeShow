<script lang="ts">
    import { get } from "svelte/store"
    import { uid } from "uid"
    import type { TemplateStyleOverride } from "../../../../types/Show"
    import { activePopup, popupData, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../../inputs/MaterialCheckbox.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

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
        const next: TemplateStyleOverride[] = [...overrides, { id: uid(6), pattern: "", color: "", bold: false, italic: false, underline: false, uppercase: false }]
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

    function closePopup() {
        activePopup.set(null)
    }
</script>

<div class="popupRoot">
    <header>
        <h2>{translateText("popup.template_style_overrides")}</h2>
        <p>{translateText("edit.style_overrides_hint")}</p>
    </header>

    <section class="list">
        {#if overrides.length}
            {#each overrides as override (override.id)}
                <div class="overrideRow">
                    <InputRow>
                    <MaterialTextInput
                        style="flex: 2;"
                        label="edit.style_override_pattern"
                        value={override.pattern}
                        on:change={(e) => updateOverride(override.id, "pattern", e.detail)}
                        autofocus={!override.pattern}
                    />
                    <MaterialColorInput
                        style="flex: 0 0 210px;"
                        label="edit.style_override_color"
                        value={override.color || ""}
                        allowEmpty
                        on:change={(e) => updateOverride(override.id, "color", e.detail)}
                    />
                    <div class="toggles">
                        <MaterialCheckbox label="edit._title_bold" checked={!!override.bold} on:change={(e) => updateOverride(override.id, "bold", e.detail)} />
                        <MaterialCheckbox label="edit._title_italic" checked={!!override.italic} on:change={(e) => updateOverride(override.id, "italic", e.detail)} />
                        <MaterialCheckbox label="edit._title_underline" checked={!!override.underline} on:change={(e) => updateOverride(override.id, "underline", e.detail)} />
                        <MaterialCheckbox label="edit.uppercase" checked={!!override.uppercase} on:change={(e) => updateOverride(override.id, "uppercase", e.detail)} />
                    </div>
                    <MaterialButton icon="delete" title="actions.delete" on:click={() => removeOverride(override.id)} white />
                    </InputRow>
                </div>
            {/each}
        {:else}
            <div class="empty">
                <T id="empty.general" />
            </div>
        {/if}
    </section>

    <footer>
        <MaterialButton variant="outlined" icon="add" style="width: 100%;" on:click={addOverride}>
            <T id="settings.add" />
        </MaterialButton>
        <MaterialButton variant="text" style="width: 100%;" on:click={closePopup}>
            <T id="popup.continue" />
        </MaterialButton>
    </footer>
</div>

<style>
    .popupRoot {
        display: flex;
        flex-direction: column;
        gap: 15px;
        width: clamp(500px, 75vw, 900px);
        max-height: 80vh;
    }

    header h2 {
        margin: 0 0 4px;
        font-size: 1.4rem;
        font-weight: 600;
    }
    header p {
        margin: 0;
        opacity: 0.7;
        font-size: 0.9rem;
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow-y: auto;
    }

    .overrideRow {
        display: flex;
        flex-direction: column;
    }
    .overrideRow :global(.row) {
        align-items: stretch;
    }
    .overrideRow :global(.textfield) {
        min-height: 50px;
    }

    .toggles {
        display: grid;
        grid-template-columns: repeat(2, minmax(140px, 1fr));
        gap: 4px;
        padding: 4px;
        flex: 1;
    }
    .toggles :global(.checkboxfield) {
        height: 50px;
    }

    .empty {
        padding: 20px;
        text-align: center;
        opacity: 0.6;
    }

    footer {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
</style>
