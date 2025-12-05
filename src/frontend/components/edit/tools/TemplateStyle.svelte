<script lang="ts">
    import type { TemplateSettings } from "../../../../types/Show"
    import { activeEdit, activePopup, overlays, popupData, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { mediaExtensions } from "../../../values/extensions"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import { convertToScriptureTemplate, hasScripturePlaceholders, getCurrentStrategyName, getStrategyCount, canUndoConversion, getOriginalItems, clearConversionState } from "../scripts/convertScriptureTemplate"

    $: templateId = $activeEdit?.id || ""
    $: template = $templates[templateId] || {}

    let settings: TemplateSettings = {}

    $: if (template) setValues()
    function setValues() {
        settings = {
            backgroundColor: template?.settings?.backgroundColor || "",
            ...(template.settings || {})
        }
    }

    function update() {
        if (!template) return

        let newData = { key: "settings", data: clone(settings) }

        history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "edit", id: "template_settings", override: templateId } })
    }

    function setValue(e: any, key: string) {
        let value = e?.detail ?? e
        settings[key] = value

        update()
    }

    $: overlayList = sortByName(keysToID($overlays))
        .filter(a => a.name)
        .map(a => ({ value: a.id, label: a.name }))

    const modes = [
        { value: "default", label: translateText("example.default") },
        { value: "scripture", label: translateText("tabs.scripture") }
    ]
    $: mode = template.settings?.mode || "default"

    // Scripture template conversion
    $: isScriptureMode = mode === "scripture"
    $: alreadyConverted = template ? hasScripturePlaceholders(template) : false
    $: strategyCount = getStrategyCount()

    // Local state to trigger reactivity when conversion state changes
    let conversionTrigger = 0
    $: currentStrategy = templateId && conversionTrigger >= 0 ? getCurrentStrategyName(templateId) : ""
    $: canUndo = templateId && conversionTrigger >= 0 ? canUndoConversion(templateId) : false

    function handleConvertTemplate() {
        if (!template || !templateId) return

        // Convert the template (cycle strategy if already converted)
        const converted = convertToScriptureTemplate(templateId, template, alreadyConverted)

        // Save the converted template
        history({
            id: "UPDATE",
            newData: { key: "items", data: converted.items },
            oldData: { id: templateId },
            location: { page: "edit", id: "template_items", override: templateId + "_convert" }
        })

        // Also update settings if needed
        if (converted.settings && JSON.stringify(converted.settings) !== JSON.stringify(template.settings)) {
            history({
                id: "UPDATE",
                newData: { key: "settings", data: converted.settings },
                oldData: { id: templateId },
                location: { page: "edit", id: "template_settings", override: templateId + "_convert_settings" }
            })
        }

        // Trigger reactivity update for strategy name
        conversionTrigger++
    }

    function handleUndoConversion() {
        if (!templateId) return

        const originalItems = getOriginalItems(templateId)
        if (!originalItems) return

        // Restore original items
        history({
            id: "UPDATE",
            newData: { key: "items", data: originalItems },
            oldData: { id: templateId },
            location: { page: "edit", id: "template_items", override: templateId + "_undo_convert" }
        })

        // Clear the conversion state
        clearConversionState(templateId)

        // Trigger reactivity update
        conversionTrigger++
    }
</script>

<div class="tools">
    <div>
        <MaterialDropdown label="actions.mode" options={modes} value={mode} defaultValue="default" on:change={e => setValue(e.detail, "mode")} />

        {#if isScriptureMode}
            <div class="convert-section">
                <div class="convert-buttons">
                    <MaterialButton
                        variant="outlined"
                        icon={alreadyConverted ? "refresh" : "stars"}
                        style="flex: 1;"
                        on:click={handleConvertTemplate}
                        title={alreadyConverted ? `Try different conversion (${currentStrategy})` : "Auto-convert to scripture template"}
                    >
                        {alreadyConverted ? `Retry (${currentStrategy})` : "Auto-Convert"}
                    </MaterialButton>
                    {#if canUndo && alreadyConverted}
                        <MaterialButton
                            variant="outlined"
                            icon="undo"
                            on:click={handleUndoConversion}
                            title="Undo conversion and restore original items"
                        >
                            Undo
                        </MaterialButton>
                    {/if}
                </div>
                {#if alreadyConverted}
                    <p class="hint">Click Retry to try a different conversion strategy ({strategyCount} available)</p>
                {/if}
            </div>
        {/if}
    </div>

    <div>
        <MaterialColorInput
            label="edit.background_color"
            value={settings.backgroundColor}
            on:input={e => {
                settings.backgroundColor = e.detail
                update()
            }}
            allowEmpty
            noLabel
        />

        <InputRow>
            <MaterialFilePicker label="edit.background_media" value={settings.backgroundPath} filter={{ name: "Media files", extensions: mediaExtensions }} on:change={e => setValue(e, "backgroundPath")} allowEmpty />
            <!-- {#if settings.backgroundPath}<MaterialButton title="titlebar.edit" icon="edit" on:click={editBackgroundImage} />{/if} -->
        </InputRow>
    </div>

    <div>
        <div class="title">
            <span style="display: flex;gap: 8px;align-items: center;padding: 8px 12px;">
                <Icon id="text" white />
                <p>{translateText("edit.text")}</p>
            </span>
        </div>

        <MaterialNumberInput label="edit.max_lines_per_slide" value={settings?.maxLinesPerSlide || 0} max={100} on:change={e => setValue(e, "maxLinesPerSlide")} />
        <MaterialNumberInput label="edit.break_long_lines_tip" value={settings?.breakLongLines || 0} max={100} on:change={e => setValue(e, "breakLongLines")} />
    </div>

    <div>
        <div class="title">
            <span style="display: flex;gap: 8px;align-items: center;padding: 8px 12px;">
                <Icon id="special" white />
                <p>{translateText("edit.special")}</p>
            </span>
        </div>

        <MaterialDropdown label="edit.overlay_content" options={overlayList} value={settings.overlayId || ""} on:change={e => setValue(e.detail, "overlayId")} allowEmpty />

        <InputRow>
            <MaterialPopupButton
                label="edit.different_first_template"
                value={settings.firstSlideTemplate}
                name={$templates[settings.firstSlideTemplate || ""]?.name}
                popupId="select_template"
                icon="templates"
                on:change={e => {
                    settings.firstSlideTemplate = e.detail
                    update()
                }}
                allowEmpty
            />
            <!-- {#if settings.firstSlideTemplate && $templates[settings.firstSlideTemplate]}
                    <MaterialButton title="titlebar.edit" icon="edit" on:click={() => editTemplate(settings.firstSlideTemplate || "")} />
                {/if} -->
        </InputRow>

        <MaterialButton
            variant="outlined"
            icon="text"
            style="width: 100%;"
            on:click={() => {
                popupData.set({ templateId })
                activePopup.set("template_style_overrides")
            }}
        >
            {translateText("popup.template_style_overrides")}
        </MaterialButton>
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

    .convert-section {
        margin-top: 8px;
    }

    .convert-buttons {
        display: flex;
        gap: 8px;
    }

    .hint {
        font-size: 0.7rem;
        opacity: 0.6;
        margin-top: 4px;
        text-align: center;
    }
</style>
