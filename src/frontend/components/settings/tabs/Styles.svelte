<script lang="ts">
    import { uid } from "uid"
    import { activePopup, activeStyle, dictionary, outputs, popupData, styles, templates } from "../../../stores"
    import { mediaExtensions } from "../../../values/extensions"
    import { mediaFitOptions } from "../../edit/values/boxes"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, removeDuplicates, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getFileName } from "../../helpers/media"
    import { defaultLayers } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import MediaPicker from "../../inputs/MediaPicker.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import { transitionTypes } from "../../../utils/transitions"

    function updateStyle(e: any, key: string, currentId: string = "") {
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
        name: $dictionary.example?.default || "Default",
    }

    $: stylesList = sortByName(keysToID($styles))

    // set id after deletion
    $: if (Object.keys($styles)?.length && !$styles[styleId]) styleId = $styles.default ? "default" : Object.keys($styles)[0]

    let styleId = $activeStyle || Object.keys($styles)[0] || ""
    $: currentStyle = $styles[styleId] || clone(defaultStyle)

    $: activeStyle.set(styleId || "")

    $: styleTemplate = $templates[currentStyle.template || ""] || {}
    $: styleTemplateScripture = $templates[currentStyle.templateScripture || ""] || {}
    $: templateBackground = styleTemplate.settings?.backgroundColor || styleTemplateScripture.settings?.backgroundColor
    $: templateBackgroundImage = styleTemplate.settings?.backgroundPath || styleTemplateScripture.settings?.backgroundPath
    // $: templateResolution = styleTemplate.settings?.resolution

    // resolutions
    // https://www.wearethefirehouse.com/aspect-ratio-cheat-sheet
    const resolutions = [
        { name: "720p 960x720 (4/3)", data: { width: 960, height: 720 } },
        { name: "720p 1280x720 (16/9)", data: { width: 1280, height: 720 } },
        { name: "1080p 1440x1080 (4/3)", data: { width: 1440, height: 1080 } },
        { name: "1080p 1920x1080 (16/9)", data: { width: 1920, height: 1080 } },
        { name: "2K 2048x1152 (16/9)", data: { width: 2048, height: 1152 } },
        { name: "4K 3840x2160 (16/9)", data: { width: 3840, height: 2160 } },
        { name: "8K 7680x4320 (16/9)", data: { width: 7680, height: 4320 } },
        { name: "Cinema Flat 2K 1998x1080 (1.85)", data: { width: 1998, height: 1080 } },
        { name: "Cinema Scope 2K 2048x858 (2.39)", data: { width: 2048, height: 858 } },
        { name: "Cinema Flat 4K 3996x2160 (1.85)", data: { width: 3996, height: 2160 } },
        { name: "Cinema Scope 4K 4096x1716 (2.39)", data: { width: 4096, height: 1716 } },
    ]

    // slide

    $: activeLayers = currentStyle.layers || clone(defaultLayers)

    // overlays

    const meta: any[] = [
        { id: "never", name: "$:show_at.never:$" },
        { id: "always", name: "$:show_at.always:$" },
        { id: "first", name: "$:show_at.first:$" },
        { id: "last", name: "$:show_at.last:$" },
        { id: "first_last", name: "$:show_at.first_last:$" },
    ]

    // text divider
    function keydown(e: any) {
        if (e.key === "Enter") {
            currentStyle.metadataDivider = (currentStyle.metadataDivider || "; ") + "<br>"
            updateStyle(currentStyle.metadataDivider, "metadataDivider")
        }
    }

    let edit: any

    $: mediaFit = currentStyle.fit || "contain"
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
        <Icon id="image" style="margin-left: 0.5em;" right />
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
        bold={!currentStyle.transition}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="transition" style="margin-left: 0.5em;" right />
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
        bold={false}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="media_fit" style="margin-left: 0.5em;" right />
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
    <p><T id="settings.resolution" /></p>
    <!-- {#if templateResolution}
        <span style="display: flex;align-items: center;padding: 0 10px;font-size: 0.9em;opacity: 0.7;"><T id="settings.overrided_value" /></span>
    {:else} -->
    <span class="inputs">
        <!-- defaults dropdown -->
        <!-- custom... -->
        <!-- <span class="text"><T id="screen.width" /></span> -->
        <NumberInput
            title={$dictionary.screen?.width}
            value={currentStyle.resolution?.width || 1920}
            min={100}
            max={10000}
            buttons={false}
            on:change={(e) => updateStyle({ width: Number(e.detail), height: currentStyle.resolution?.height || 1080 }, "resolution")}
        />
        <!-- <span class="text"><T id="screen.height" /></span> -->
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
    </span>
    <!-- {/if} -->
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
    <NumberInput
        value={currentStyle.lines || 0}
        min={0}
        max={99}
        on:change={(e) => {
            updateStyle(e, "lines")
        }}
    />
</CombinedInput>

<CombinedInput>
    <p><T id="settings.override_with_template" /></p>
    <Button
        on:click={() => {
            popupData.set({ action: "select_template", active: currentStyle.template || "", trigger: (id) => updateStyle(id, "template") })
            activePopup.set("select_template")
        }}
        bold={!currentStyle.template}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="templates" style="margin-left: 0.5em;" right />
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
            popupData.set({ action: "select_template", active: currentStyle.templateScripture || "", trigger: (id) => updateStyle(id, "templateScripture") })
            activePopup.set("select_template")
        }}
        bold={!currentStyle.templateScripture}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="templates" style="margin-left: 0.5em;" right />
            <p>
                {#if currentStyle.templateScripture}
                    {$templates[currentStyle.templateScripture || ""]?.name || "—"}
                {:else}
                    <T id="popup.select_template" />
                {/if}
            </p>
        </div>
    </Button>
    {#if currentStyle.templateScripture}
        <Button
            title={$dictionary.actions?.remove}
            on:click={() => {
                updateStyle("", "templateScripture")
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
    <Dropdown options={meta} value={meta.find((a) => a.id === (currentStyle.displayMetadata || "never"))?.name || "—"} on:click={(e) => updateStyle(e.detail.id, "displayMetadata")} up />
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
                popupData.set({ action: "select_template", active: currentStyle.metadataTemplate || "metadata", trigger: (id) => updateStyle(id, "metadataTemplate") })
                activePopup.set("select_template")
            }}
            bold={false}
        >
            <div style="display: flex;align-items: center;padding: 0;">
                <Icon id="templates" style="margin-left: 0.5em;" right />
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
            popupData.set({ action: "select_template", active: currentStyle.messageTemplate || "message", trigger: (id) => updateStyle(id, "messageTemplate") })
            activePopup.set("select_template")
        }}
        bold={false}
    >
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="templates" style="margin-left: 0.5em;" right />
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

    .inputs {
        display: flex;
    }

    /* .text {
        display: flex;
        align-items: center;
        padding: 0 10px;
        border: none;
    } */

    .filler {
        height: 48px;
    }
    .bottom {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;
    }
</style>
