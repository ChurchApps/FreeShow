<script lang="ts">
    import { uid } from "uid"
    import type { AspectRatio, Resolution } from "../../../../types/Settings"
    import { activePopup, activeStyle, dictionary, outputs, popupData, scriptures, styles, templates } from "../../../stores"
    import { transitionTypes } from "../../../utils/transitions"
    import { mediaExtensions } from "../../../values/extensions"
    import { mediaFitOptions } from "../../edit/values/boxes"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, removeDuplicates, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getFileName } from "../../helpers/media"
    import { defaultLayers } from "../../helpers/output"
    import { metadataDisplayValues } from "../../helpers/show"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import MediaPicker from "../../inputs/MediaPicker.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

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

    const isChecked = (e: any) => e.target.checked

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

    const defaultStyle = {
        name: $dictionary.example?.default || "Default"
    }

    $: stylesList = sortByName(keysToID($styles))

    // set id after deletion
    $: if (Object.keys($styles)?.length && !$styles[styleId]) styleId = $styles.default ? "default" : Object.keys($styles)[0]

    let styleId = $activeStyle || Object.keys($styles)[0] || ""
    $: currentStyle = $styles[styleId] || clone(defaultStyle)

    $: activeStyle.set(styleId || "")
    $: if ($activeStyle) updateStyleId()
    function updateStyleId() {
        styleId = $activeStyle
    }

    $: styleTemplate = $templates[currentStyle.template || ""] || {}
    $: styleTemplateScripture = $templates[currentStyle.templateScripture || ""] || {}
    $: templateBackground = styleTemplate.settings?.backgroundColor || styleTemplateScripture.settings?.backgroundColor
    $: templateBackgroundImage = styleTemplate.settings?.backgroundPath || styleTemplateScripture.settings?.backgroundPath

    let scriptureTemplateTypes = Object.values($scriptures).find((a) => a.collection)
        ? [
              { id: "", name: "$:example.default:$ (1)" },
              { id: "_2", name: "2" },
              { id: "_3", name: "3" },
              { id: "_4", name: "4" }
          ]
        : []

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

    // text divider
    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            currentStyle.metadataDivider = (currentStyle.metadataDivider || "; ") + "<br>"
            updateStyle(currentStyle.metadataDivider, "metadataDivider")
        }
    }

    let edit: any

    $: mediaFit = currentStyle.fit || "contain"
    $: aspectRatio = currentStyle.aspectRatio || getAspectRatio(currentStyle.resolution)
    $: maxLines = Number(currentStyle.lines || 0)
    $: metadataDisplay = currentStyle.displayMetadata || "never"
    $: textTransitionData = transitionTypes.find((a) => a.id === currentStyle.transition?.text?.type)
</script>

<div class="info">
    <p><T id="settings.styles_hint" /></p>
</div>

<!-- TODO: use stage (dropdown) -->
<CombinedInput>
    <p>
        <T id="edit.background_color" />
        {#if templateBackground}
            <span style="display: flex;align-items: center;padding: 0 10px;font-size: 0.8em;opacity: 0.7;"><T id="settings.overrided_value" /></span>
        {/if}
    </p>
    <span>
        <Color value={currentStyle.background || "#000000"} on:input={(e) => updateStyle(e, "background")} />
    </span>
</CombinedInput>
<CombinedInput>
    <p>
        <T id="edit.background_media" />
        {#if templateBackgroundImage}
            <span style="display: flex;align-items: center;padding: 0 10px;font-size: 0.8em;opacity: 0.7;"><T id="settings.overrided_value" /></span>
        {/if}
    </p>
    <MediaPicker
        id="styles"
        title={currentStyle.backgroundImage}
        filter={{ name: "Media files", extensions: mediaExtensions }}
        center={false}
        style="overflow: hidden;"
        on:picked={(e) => {
            if (e.detail) updateStyle(e, "backgroundImage")
        }}
    >
        <Icon id="image" style="margin-inline-start: 0.5em;" right />
        <p style="overflow: hidden;">
            {#if currentStyle.backgroundImage}
                {getFileName(currentStyle.backgroundImage)}
            {:else}
                <T id="edit.choose_media" />
            {/if}
        </p>
    </MediaPicker>
    {#if currentStyle.backgroundImage}
        <Button
            title={$dictionary.actions?.remove}
            on:click={() => {
                updateStyle("", "backgroundImage")
            }}
            redHover
        >
            <Icon id="close" size={1.2} white />
        </Button>
    {/if}
</CombinedInput>
{#if currentStyle.backgroundImage && (currentStyle.clearStyleBackgroundOnText || activeLayers.includes("slide"))}
    <CombinedInput>
        <p><T id="settings.clear_style_background_on_text" /></p>
        <div class="alignRight">
            <Checkbox checked={currentStyle.clearStyleBackgroundOnText} on:change={(e) => updateStyle(isChecked(e), "clearStyleBackgroundOnText")} />
        </div>
    </CombinedInput>
{/if}

<CombinedInput>
    <p><T id="popup.transition" /></p>
    <Button
        on:click={() => {
            if (!$styles[styleId]) updateStyle("", "transition") // set initial style
            popupData.set({ action: "style_transition", id: styleId })
            activePopup.set("transition")
        }}
        title={$dictionary.actions?.change_transition}
        bold={!currentStyle.transition}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="transition" style="margin-inline-start: 0.5em;" right />
            <p>
                {#if currentStyle.transition}
                    <T id={textTransitionData?.name || "actions.change_transition"} />
                {:else}
                    <T id="actions.change_transition" />
                {/if}
            </p>
        </div>
    </Button>
    {#if currentStyle.transition}
        <Button
            title={$dictionary.remove?.transition}
            on:click={() => {
                updateStyle("", "transition")
            }}
            redHover
        >
            <Icon id="close" size={1.2} white />
        </Button>
    {/if}
</CombinedInput>

<CombinedInput>
    <p><T id="edit.media_fit" /></p>
    <Button
        on:click={() => {
            popupData.set({ action: "style_fit", id: styleId })
            activePopup.set("media_fit")
        }}
        title={$dictionary.popup?.media_fit}
        bold={false}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="media_fit" style="margin-inline-start: 0.5em;" right />
            <p>
                <!-- <T id="popup.media_fit" />: -->
                {#key mediaFit}
                    <T id={mediaFitOptions.find((a) => a.id === mediaFit)?.name || ""} />
                {/key}
            </p>
        </div>
    </Button>
</CombinedInput>
<!-- WIP object-position -->

<!-- TODO: transparency? -->
<!-- WIP background image (clear to image...) -->
<!-- WIP foreground: mask/overlay -->

<CombinedInput>
    <p><T id="settings.aspect_ratio" /></p>
    <Button
        on:click={() => {
            popupData.set({ action: "style_ratio", active: aspectRatio, trigger: (value) => updateStyle(value, "aspectRatio") })
            activePopup.set("aspect_ratio")
        }}
        title={$dictionary.popup?.aspect_ratio}
        bold={false}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="aspect_ratio" style="margin-inline-start: 0.5em;" right />
            <p>
                {#if aspectRatio.outputResolutionAsRatio}
                    <T id="settings.output_resolution_ratio" />
                {:else}
                    {aspectRatio.width}:{aspectRatio.height}
                {/if}
            </p>
        </div>
    </Button>
    <!-- <span class="inputs">
        <NumberInput
            title={$dictionary.screen?.width}
            value={currentStyle.resolution?.width || 1920}
            min={100}
            max={10000}
            buttons={false}
            on:change={(e) => updateStyle({ width: Number(e.detail), height: currentStyle.resolution?.height || 1080 }, "resolution")}
        />
        <NumberInput
            title={$dictionary.screen?.height}
            value={currentStyle.resolution?.height || 1080}
            min={100}
            max={10000}
            buttons={false}
            on:change={(e) => updateStyle({ height: Number(e.detail), width: currentStyle.resolution?.width || 1920 }, "resolution")}
        />
        <Dropdown
            arrow
            value={resolutions.find((a) => a.data.height === (currentStyle.resolution?.height || 1080) && a.data.width === (currentStyle.resolution?.width || 1920))?.name || ""}
            options={resolutions}
            title={$dictionary.settings?.resolution}
            on:click={(e) => updateStyle(e.detail?.data, "resolution")}
        />
    </span> -->
</CombinedInput>

<h3><T id="preview.slide" /></h3>
<CombinedInput>
    <p><T id="settings.active_layers" /></p>
    <span class="flex">
        <!-- active={activeLayers.includes("background")} -->
        <Button
            on:click={() => {
                if (activeLayers.includes("background")) activeLayers.splice(activeLayers.indexOf("background"), 1)
                else activeLayers = removeDuplicates([...activeLayers, "background"])
                updateStyle(activeLayers, "layers")
            }}
            style={activeLayers.includes("background") ? "border-bottom: 2px solid var(--secondary) !important;" : "border-bottom: 2px solid var(--primary-lighter);"}
            bold={false}
            center
            dark
        >
            <Icon id="background" right />
            <T id="preview.background" />
        </Button>
        <!-- active={activeLayers.includes("slide")} -->
        <Button
            on:click={() => {
                if (activeLayers.includes("slide")) activeLayers.splice(activeLayers.indexOf("slide"), 1)
                else activeLayers = removeDuplicates([...activeLayers, "slide"])
                updateStyle(activeLayers, "layers")
            }}
            style={activeLayers.includes("slide") ? "border-bottom: 2px solid var(--secondary) !important;" : "border-bottom: 2px solid var(--primary-lighter);"}
            bold={false}
            center
            dark
        >
            <Icon id="slide" right />
            <T id="preview.slide" />
        </Button>
        <!-- active={activeLayers.includes("overlays")} -->
        <Button
            on:click={() => {
                if (activeLayers.includes("overlays")) activeLayers.splice(activeLayers.indexOf("overlays"), 1)
                else activeLayers = removeDuplicates([...activeLayers, "overlays"])
                updateStyle(activeLayers, "layers")
            }}
            style={activeLayers.includes("overlays") ? "border-bottom: 2px solid var(--secondary) !important;" : "border-bottom: 2px solid var(--primary-lighter);"}
            bold={false}
            center
            dark
        >
            <Icon id="overlays" right />
            <T id="preview.overlays" />
        </Button>
    </span>
</CombinedInput>
<!-- WIP toggle meta -->

<CombinedInput>
    <p><T id="settings.lines" /></p>
    <Button
        on:click={() => {
            popupData.set({ active: maxLines, trigger: (value) => updateStyle(value, "lines") })
            activePopup.set("max_lines")
        }}
        title={$dictionary.popup?.max_lines}
        bold={!maxLines}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="lines" style="margin-inline-start: 0.5em;" right />
            <p>
                {#if maxLines}
                    {maxLines}
                {:else}
                    <T id="popup.max_lines" />
                {/if}
            </p>
        </div>
    </Button>
    {#if maxLines}
        <Button
            title={$dictionary.actions?.remove}
            on:click={() => {
                updateStyle("", "lines")
            }}
            redHover
        >
            <Icon id="close" size={1.2} white />
        </Button>
    {/if}
</CombinedInput>

<CombinedInput>
    <p><T id="settings.override_with_template" /></p>
    <Button
        on:click={() => {
            popupData.set({ action: "select_template", doubleClick: true, active: currentStyle.template || "", trigger: (id) => updateStyle(id, "template") })
            activePopup.set("select_template")
        }}
        bold={!currentStyle.template}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="templates" style="margin-inline-start: 0.5em;" right />
            <p>
                {#if currentStyle.template}
                    {$templates[currentStyle.template || ""]?.name || "—"}
                {:else}
                    <T id="popup.select_template" />
                {/if}
            </p>
        </div>
    </Button>
    {#if currentStyle.template}
        <Button
            title={$dictionary.actions?.remove}
            on:click={() => {
                updateStyle("", "template")
            }}
            redHover
        >
            <Icon id="close" size={1.2} white />
        </Button>
    {/if}
</CombinedInput>
<CombinedInput>
    <p><T id="settings.override_scripture_with_template" /></p>
    <Button
        on:click={() => {
            popupData.set({
                action: "select_template",
                doubleClick: true,
                active: currentStyle.templateScripture || "",
                types: scriptureTemplateTypes,
                values: scriptureTemplateTypes.map((a) => currentStyle["templateScripture" + a.id] || ""),
                trigger: (id, type) => updateStyle(id, "templateScripture" + type)
            })
            activePopup.set("select_template")
        }}
        bold={!(currentStyle.templateScripture || currentStyle.templateScripture_2 || currentStyle.templateScripture_3 || currentStyle.templateScripture_4)}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="templates" style="margin-inline-start: 0.5em;" right />
            <p>
                {#if currentStyle.templateScripture}
                    {$templates[currentStyle.templateScripture || ""]?.name || "—"}
                {:else if currentStyle.templateScripture_2}
                    {$templates[currentStyle.templateScripture_2 || ""]?.name || "—"} (2)
                {:else if currentStyle.templateScripture_3}
                    {$templates[currentStyle.templateScripture_3 || ""]?.name || "—"} (3)
                {:else if currentStyle.templateScripture_4}
                    {$templates[currentStyle.templateScripture_4 || ""]?.name || "—"} (4)
                {:else}
                    <T id="popup.select_template" />
                {/if}
            </p>
        </div>
    </Button>
    {#if currentStyle.templateScripture || currentStyle.templateScripture_2 || currentStyle.templateScripture_3 || currentStyle.templateScripture_4}
        <Button
            title={$dictionary.actions?.remove}
            on:click={() => {
                updateStyle("", "templateScripture")
                if (currentStyle.templateScripture_2) updateStyle("", "templateScripture_2")
                if (currentStyle.templateScripture_3) updateStyle("", "templateScripture_3")
                if (currentStyle.templateScripture_4) updateStyle("", "templateScripture_4")
            }}
            redHover
        >
            <Icon id="close" size={1.2} white />
        </Button>
    {/if}
</CombinedInput>

<!-- meta -->
<h3><T id="tools.metadata" /></h3>
<CombinedInput>
    <p><T id="meta.display_metadata" /></p>
    <Button
        on:click={() => {
            popupData.set({ action: "style_metadata", id: styleId })
            activePopup.set("metadata_display")
        }}
        title={$dictionary.popup?.metadata_display}
        bold={false}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="info" style="margin-inline-start: 0.5em;" right />
            <p>
                {#key metadataDisplay}
                    <T id={metadataDisplayValues.find((a) => a.id === metadataDisplay)?.name || ""} />
                {/key}
            </p>
        </div>
    </Button>
</CombinedInput>
{#if (currentStyle.displayMetadata || "never") !== "never"}
    <CombinedInput>
        <p><T id="meta.text_divider" /></p>
        <TextInput value={currentStyle.metadataDivider === undefined ? "; " : currentStyle.metadataDivider} on:change={(e) => updateStyle(e, "metadataDivider")} on:keydown={keydown} />
    </CombinedInput>
    <CombinedInput>
        <p><T id="meta.meta_template" /></p>
        <Button
            on:click={() => {
                popupData.set({ action: "select_template", doubleClick: true, active: currentStyle.metadataTemplate || "metadata", trigger: (id) => updateStyle(id, "metadataTemplate") })
                activePopup.set("select_template")
            }}
            bold={false}
        >
            <div style="display: flex;align-items: center;padding: 0;">
                <Icon id="templates" style="margin-inline-start: 0.5em;" right />
                <p>{$templates[currentStyle.metadataTemplate || "metadata"]?.name || "—"}</p>
            </div>
        </Button>
        {#if (currentStyle.metadataTemplate || "metadata") !== "metadata"}
            <Button
                title={$dictionary.actions?.remove}
                on:click={() => {
                    updateStyle("", "metadataTemplate")
                }}
                redHover
            >
                <Icon id="close" size={1.2} white />
            </Button>
        {/if}
    </CombinedInput>
    <!-- <CombinedInput>
        <p><T id="meta.metadata_layout" /></p>
        <TextInput value={currentStyle.metadataLayout || DEFAULT_META_LAYOUT} on:change={(e) => updateStyle(e, "metadataLayout")} on:keydown={keydown} />
    </CombinedInput> -->
{/if}
<CombinedInput>
    <p><T id="meta.message_template" /></p>
    <Button
        on:click={() => {
            popupData.set({ action: "select_template", doubleClick: true, active: currentStyle.messageTemplate || "message", trigger: (id) => updateStyle(id, "messageTemplate") })
            activePopup.set("select_template")
        }}
        bold={false}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="templates" style="margin-inline-start: 0.5em;" right />
            <p>{$templates[currentStyle.messageTemplate || "message"]?.name || "—"}</p>
        </div>
    </Button>
    {#if (currentStyle.messageTemplate || "message") !== "message"}
        <Button
            title={$dictionary.actions?.remove}
            on:click={() => {
                updateStyle("", "messageTemplate")
            }}
            redHover
        >
            <Icon id="close" size={1.2} white />
        </Button>
    {/if}
</CombinedInput>

<!-- TODO: override transition ? -->

<div class="filler" style={stylesList.length > 1 ? "height: 76px;" : ""} />
<div class="bottom">
    {#if stylesList.length > 1}
        <div style="display: flex;overflow-x: auto;">
            {#each stylesList as currentStyle}
                {@const active = styleId === currentStyle.id}

                <SelectElem id="style" data={{ id: currentStyle.id }} fill>
                    <Button border={active} class="context #style" {active} style="width: 100%;" on:click={() => (styleId = currentStyle.id)} bold={false} center>
                        {#if Object.values($outputs).find((a) => a.style === currentStyle.id)}<Icon id="check" size={0.7} white right />{/if}
                        <HiddenInput value={currentStyle.name} id={"style_" + currentStyle.id} on:edit={(e) => updateStyle(e.detail.value, "name", currentStyle.id)} bind:edit />
                    </Button>
                </SelectElem>
            {/each}
        </div>
    {/if}

    <div style="display: flex;">
        <Button
            style="width: 100%;"
            on:click={() => {
                if (!stylesList.length) {
                    history({ id: "UPDATE", newData: { data: clone(currentStyle) }, oldData: { id: "default" }, location: { page: "settings", id: "settings_style" } })
                }

                styleId = uid()
                history({ id: "UPDATE", newData: { data: clone(defaultStyle), replace: { name: currentStyle.name + " 2" } }, oldData: { id: styleId }, location: { page: "settings", id: "settings_style" } })
            }}
            center
        >
            <Icon id="add" right />
            <T id="settings.add" />
        </Button>
    </div>
</div>

<style>
    .info {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        min-height: 38px;
        margin: 5px 0;
        margin-bottom: 15px;
        font-style: italic;
        opacity: 0.8;
    }

    .info p {
        white-space: initial;
    }

    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }

    .flex {
        display: flex;
    }
    .flex :global(button) {
        flex: 1;
    }

    .filler {
        height: 48px;
    }
    .bottom {
        position: absolute;
        bottom: 0;
        inset-inline-start: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;
    }
</style>
