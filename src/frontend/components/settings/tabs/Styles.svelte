<script lang="ts">
    import { uid } from "uid"
    import type { AspectRatio, Resolution, Styles } from "../../../../types/Settings"
    import { activeDrawerTab, activeEdit, activePage, activeStyle, dictionary, outputs, styles, templates } from "../../../stores"
    import { transitionTypes } from "../../../utils/transitions"
    import { mediaExtensions } from "../../../values/extensions"
    import { mediaFitOptions } from "../../edit/values/boxes"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { defaultLayers } from "../../helpers/output"
    import { metadataDisplayValues } from "../../helpers/show"
    import InputRow from "../../input/InputRow.svelte"
    import Title from "../../input/Title.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialMediaPicker from "../../inputs/MaterialMediaPicker.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleButtons from "../../inputs/MaterialToggleButtons.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    function updateStyle(e: any, key: string, currentId = "") {
        let value = e?.detail ?? e?.target?.value ?? e

        if (!currentId) currentId = styleId || "default"

        // create a style if nothing exists
        styles.update((a) => {
            if (!a[currentId]) a[currentId] = clone(currentStyle)

            return a
        })

        history({ id: "UPDATE", newData: { key, data: value }, oldData: { id: currentId }, location: { page: "settings", id: "settings_style", override: "style_" + key } })

        styleId = currentId
    }

    // pre v0.8.4: generate styles from old output "show" formatting
    if (!Object.keys($styles).length) createStylesFromOutputs()
    function createStylesFromOutputs() {
        Object.keys($outputs).forEach((outputId) => {
            let output = $outputs[outputId]

            let currentOutputStyle = output.show || {}
            if (!Object.keys(currentOutputStyle)?.length) return

            currentOutputStyle.name = output.name

            styles.update((a) => {
                a[uid()] = currentOutputStyle

                return a
            })
        })
    }

    const defaultStyle: Styles = {
        name: $dictionary.example?.default || "Default"
    }

    // set id after deletion
    $: if (Object.keys($styles)?.length && !$styles[styleId]) styleId = $styles.default ? "default" : Object.keys($styles)[0]

    $: styleId = $activeStyle || Object.keys($styles)[0] || ""
    $: currentStyle = $styles[styleId] || clone(defaultStyle)

    $: styleTemplate = $templates[currentStyle.template || ""] || {}
    $: styleTemplateScripture = $templates[currentStyle.templateScripture || ""] || {}
    $: templateBackground = styleTemplate.settings?.backgroundColor || styleTemplateScripture.settings?.backgroundColor
    $: templateBackgroundImage = styleTemplate.settings?.backgroundPath || styleTemplateScripture.settings?.backgroundPath

    function getAspectRatio(resolution: Resolution | undefined): AspectRatio {
        if (!resolution || (resolution.width === 1920 && resolution.height === 1080)) return { width: 16, height: 9 }

        let ratio = resolution
        if (ratio.width > 100 || ratio.height > 100) {
            let width = Number((ratio.width / ratio.height).toFixed(2))
            if (width === 1.78) return { width: 16, height: 9 }
            if (width === 1.33) return { width: 4, height: 3 }
            return { width, height: 1 }
        }

        return ratio
    }

    // slide

    $: activeLayers = Array.isArray(currentStyle.layers) ? currentStyle.layers : clone(defaultLayers)

    $: mediaFit = currentStyle.fit || "contain"
    $: defaultAspectRatio = getAspectRatio(currentStyle.resolution)
    $: aspectRatio = currentStyle.aspectRatio || defaultAspectRatio
    $: maxLines = Number(currentStyle.lines || 0)
    $: metadataDisplay = currentStyle.displayMetadata || "never"
    $: textTransitionData = transitionTypes.find((a) => a.id === currentStyle.transition?.text?.type)

    $: bgImage = currentStyle.backgroundImage
    function editBackgroundImage() {
        activeEdit.set({ type: "media", id: bgImage, items: [] })
        activePage.set("edit")
    }

    $: transitionLabel = textTransitionData?.name || ""
    $: mediaFitLabel = mediaFitOptions.find((a) => a.id === mediaFit)?.name || ""
    $: aspectRatioLabel = aspectRatio.outputResolutionAsRatio ? "settings.output_resolution_ratio" : `${aspectRatio.width}:${aspectRatio.height}`

    const layerOptions = [
        { label: "preview.background", icon: "background", value: "background" },
        { label: "preview.slide", icon: "slide", value: "slide" },
        { label: "preview.overlays", icon: "overlays", value: "overlays" }
    ]

    // TEMPLATE OVERRIDE

    $: templateOverride = currentStyle.template || ""
    $: templateOverrideScripture = currentStyle.templateScripture || ""
    $: scriptureTemplateLabel = currentStyle.templateScripture
        ? $templates[currentStyle.templateScripture || ""]?.name
        : currentStyle.templateScripture_2
          ? $templates[currentStyle.templateScripture_2 || ""]?.name + " (2)"
          : currentStyle.templateScripture_3
            ? $templates[currentStyle.templateScripture_3 || ""]?.name + " (3)"
            : currentStyle.templateScripture_4
              ? $templates[currentStyle.templateScripture_4 || ""]?.name + " (4)"
              : ""

    function editTemplate(id: string) {
        activeDrawerTab.set("templates")
        activeEdit.set({ type: "template", id, items: [] })
        activePage.set("edit")
    }
    function updateScriptureTemplate(e) {
        const type = e.detail?.type || ""
        const value = e.detail?.value ?? e.detail

        if (!value) {
            updateStyle("", "templateScripture")
            if (currentStyle.templateScripture_2) updateStyle("", "templateScripture_2")
            if (currentStyle.templateScripture_3) updateStyle("", "templateScripture_3")
            if (currentStyle.templateScripture_4) updateStyle("", "templateScripture_4")
            return
        }

        updateStyle(value, "templateScripture" + type)
    }

    // METADATA

    $: metadataDisplayLabel = metadataDisplayValues.find((a) => a.id === metadataDisplay)?.name || ""
    const defaultDivider = "; "
    $: metadataDividerValue = currentStyle.metadataDivider === undefined ? defaultDivider : currentStyle.metadataDivider
    $: metadataTemplate = currentStyle.metadataTemplate || "metadata"
    $: messageTemplate = currentStyle.messageTemplate || "message"
</script>

<MaterialColorInput
    label="edit.background_color{templateBackground ? ' <span style="color: var(--text);opacity: 0.5;font-weight: normal;font-size: 0.6em;">settings.overrided_value<span>' : ''}"
    value={currentStyle.background || "#000000"}
    defaultValue="#000000"
    on:input={(e) => updateStyle(e, "background")}
/>

<InputRow>
    <MaterialMediaPicker
        label="edit.background_media{templateBackgroundImage && bgImage ? ' <span style="color: var(--text);opacity: 0.5;font-weight: normal;">settings.overrided_value<span>' : ''}"
        value={bgImage}
        filter={{ name: "Media files", extensions: mediaExtensions }}
        on:change={(e) => updateStyle(e, "backgroundImage")}
        allowEmpty
    />
    {#if bgImage}
        <MaterialButton title="titlebar.edit" icon="edit" on:click={editBackgroundImage} />
    {/if}
</InputRow>
{#if currentStyle.backgroundImage && (currentStyle.clearStyleBackgroundOnText || activeLayers.includes("slide"))}
    <MaterialToggleSwitch label="settings.clear_style_background_on_text" checked={currentStyle.clearStyleBackgroundOnText} defaultValue={false} on:change={(e) => updateStyle(e.detail, "clearStyleBackgroundOnText")} />
{/if}

<MaterialPopupButton label="popup.transition" id="style" value={currentStyle.transition} name={transitionLabel} popupId="transition" icon="transition" on:change={(e) => updateStyle(e.detail || "", "transition")} allowEmpty />
<MaterialPopupButton label="edit.media_fit" value={mediaFit} defaultValue="contain" name={mediaFitLabel} popupId="media_fit" icon="media_fit" on:change={(e) => updateStyle(e.detail, "fit")} />
<MaterialPopupButton label="settings.aspect_ratio" value={aspectRatio} defaultValue={defaultAspectRatio} name={aspectRatioLabel} popupId="aspect_ratio" icon="aspect_ratio" on:change={(e) => updateStyle(e.detail, "aspectRatio")} />

<MaterialToggleButtons label="settings.active_layers" value={activeLayers} options={layerOptions} on:change={(e) => updateStyle(e.detail, "layers")} />
<!-- WIP toggle meta -->

<Title label="preview.slide" icon="slide" />

<MaterialPopupButton label="settings.lines" disabled={!activeLayers.includes("slide")} value={maxLines} name={maxLines.toString()} popupId="max_lines" icon="lines" on:change={(e) => updateStyle(e.detail, "lines")} allowEmpty />

<InputRow>
    <!-- WIP doubleClick ?? -->
    <MaterialPopupButton
        label="settings.override_with_template"
        disabled={!activeLayers.includes("slide")}
        value={templateOverride}
        name={$templates[templateOverride]?.name}
        popupId="select_template"
        icon="templates"
        on:change={(e) => updateStyle(e.detail, "template")}
        allowEmpty
    />
    {#if templateOverride && $templates[templateOverride] && !$templates[templateOverride]?.isDefault}
        <MaterialButton title="titlebar.edit" icon="edit" on:click={() => editTemplate(templateOverride)} />
    {/if}
</InputRow>

<InputRow>
    <MaterialPopupButton
        id="scripture"
        label="settings.override_scripture_with_template"
        disabled={!activeLayers.includes("slide")}
        value={templateOverrideScripture || currentStyle.templateScripture_2 || currentStyle.templateScripture_3 || currentStyle.templateScripture_4}
        name={scriptureTemplateLabel}
        popupId="select_template"
        icon="templates"
        on:change={updateScriptureTemplate}
        allowEmpty
    />
    {#if templateOverrideScripture && $templates[templateOverrideScripture] && !$templates[templateOverrideScripture]?.isDefault}
        <MaterialButton title="titlebar.edit" icon="edit" on:click={() => editTemplate(templateOverrideScripture)} />
    {/if}
</InputRow>

<!-- overlays -->
<Title label="tools.metadata" icon="info" />

<MaterialPopupButton
    label="meta.display_metadata"
    disabled={!activeLayers.includes("overlays")}
    value={metadataDisplay}
    defaultValue="never"
    name={metadataDisplayLabel}
    popupId="metadata_display"
    icon="info"
    on:change={(e) => updateStyle(e.detail, "displayMetadata")}
/>

{#if (currentStyle.displayMetadata || "never") !== "never"}
    <MaterialTextInput label="meta.text_divider" disabled={!activeLayers.includes("overlays")} value={metadataDividerValue} defaultValue={defaultDivider} on:change={(e) => updateStyle(e.detail, "metadataDivider")}></MaterialTextInput>
    <MaterialPopupButton
        label="meta.meta_template"
        disabled={!activeLayers.includes("overlays")}
        value={metadataTemplate}
        defaultValue="metadata"
        name={$templates[metadataTemplate]?.name}
        popupId="select_template"
        icon="templates"
        on:change={(e) => updateStyle(e.detail, "metadataTemplate")}
    />
    <!-- <CombinedInput>
        <p><T id="meta.metadata_layout" /></p>
        <TextInput value={currentStyle.metadataLayout || DEFAULT_META_LAYOUT} on:change={(e) => updateStyle(e, "metadataLayout")} on:keydown={keydown} />
    </CombinedInput> -->
{/if}

<MaterialPopupButton
    label="meta.message_template"
    disabled={!activeLayers.includes("overlays")}
    value={messageTemplate}
    defaultValue="message"
    name={$templates[messageTemplate]?.name}
    popupId="select_template"
    icon="templates"
    on:change={(e) => updateStyle(e.detail, "messageTemplate")}
/>
