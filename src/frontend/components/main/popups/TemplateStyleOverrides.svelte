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
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Icon from "../../helpers/Icon.svelte"

    const initialData = get(popupData)
    let templateId: string = initialData.templateId || ""

    $: template = $templates[templateId] || {}
    $: overrides = clone(template.settings?.styleOverrides || [])

    type FormatToggleKey = "bold" | "italic" | "underline" | "uppercase"
    const formatOptions: { key: FormatToggleKey; label: string; icon?: string }[] = [
        { key: "bold", label: "edit._title_bold", icon: "bold" },
        { key: "italic", label: "edit._title_italic", icon: "italic" },
        { key: "underline", label: "edit._title_underline", icon: "underline" },
        { key: "uppercase", label: "edit.uppercase", icon: "capitalize" }
    ]

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

    function toggleOverrideFlag(id: string, key: FormatToggleKey) {
        const target = overrides.find((override) => override.id === id)
        if (!target) return

        const active = !!target[key]
        updateOverride(id, key, !active)
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
                            style="flex: 2 1 240px;min-width: 200px;"
                            label="edit.style_override_pattern"
                            value={override.pattern}
                            on:change={(e) => updateOverride(override.id, "pattern", e.detail)}
                            autofocus={!override.pattern}
                        />
                        <MaterialColorInput
                            style="flex: 0 0 190px;min-width: 170px;"
                            label="edit.style_override_color"
                            value={override.color || ""}
                            allowEmpty
                            on:change={(e) => updateOverride(override.id, "color", e.detail)}
                        />
                        <div class="toggles">
                            {#each formatOptions as option}
                                {@const isActive = !!override[option.key]}
                                <MaterialButton
                                    class="toggleButton"
                                    title={option.label}
                                    aria-pressed={isActive ? "true" : "false"}
                                    on:click={() => toggleOverrideFlag(override.id, option.key)}
                                >
                                    {#if option.icon}
                                        <Icon id={option.icon} size={1.2} white />
                                    {:else}
                                        <span class="toggleGlyph">Aa</span>
                                    {/if}
                                    <div class="highlight" class:active={isActive}></div>
                                </MaterialButton>
                            {/each}
                        </div>
                        <MaterialButton icon="delete" title="actions.delete" style="flex: 0 0 52px;min-width: 52px;" on:click={() => removeOverride(override.id)} white />
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
            <T id="popup.apply" />
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
        gap: 8px;
        flex-wrap: nowrap;
    }
    .overrideRow :global(.textfield) {
        min-height: 50px;
    }

    .toggles {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 4px;
        flex: 1 1 320px;
        min-height: 50px;
    }
    .toggles :global(.toggleButton) {
        flex: 1;
        min-width: 64px;
        padding: 0.5rem 0.75rem;
    }

    .toggleGlyph {
        font-size: 1.05rem;
        font-weight: 600;
        letter-spacing: 0.02em;
    }

    .highlight {
        position: absolute;
        bottom: 5px;
        left: 50%;
        transform: translateX(-50%);
        height: 2px;
        width: 80%;
        background-color: var(--primary-lighter);
        transition: 0.2s background-color ease;
    }
    .highlight.active {
        background-color: var(--secondary);
        box-shadow: 0 0 3px rgb(255 255 255 / 0.2);
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
