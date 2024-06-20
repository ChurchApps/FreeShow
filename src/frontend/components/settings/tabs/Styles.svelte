<script lang="ts">
    import { uid } from "uid"
    import { activeStyle, dictionary, imageExtensions, outputs, styles, templates, videoExtensions } from "../../../stores"
    import { mediaFitOptions } from "../../edit/values/boxes"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, removeDuplicates, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getFileName } from "../../helpers/media"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import MediaPicker from "../../inputs/MediaPicker.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import { defaultLayers } from "../../helpers/output"

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

    function updateCropping(newValue: number, key: string) {
        let cropping = currentStyle.cropping || { top: 0, right: 0, bottom: 0, left: 0 }
        cropping[key] = newValue
        updateStyle(cropping, "cropping")
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

    const defaultStyle = {
        name: $dictionary.example?.default || "Default",
    }

    $: stylesList = getList($styles)
    function getList(styles) {
        let list = Object.entries(styles).map(([id, obj]: any) => {
            return { ...obj, id }
        })

        return sortByName(list)
    }

    // set id after deletion
    $: if (Object.keys($styles)?.length && !$styles[styleId]) styleId = $styles.default ? "default" : Object.keys($styles)[0]

    let styleId = $activeStyle || Object.keys($styles)[0] || ""
    $: currentStyle = $styles[styleId] || clone(defaultStyle)

    $: activeStyle.set(styleId || "")

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

    let activeLayers: any[] = []
    $: {
        if (currentStyle.layers) activeLayers = currentStyle.layers
        else activeLayers = clone(defaultLayers)
    }

    // overlays

    const meta: any[] = [
        { id: "never", name: "$:show_at.never:$" },
        { id: "always", name: "$:show_at.always:$" },
        { id: "first", name: "$:show_at.first:$" },
        { id: "last", name: "$:show_at.last:$" },
        { id: "first_last", name: "$:show_at.first_last:$" },
    ]

    let templateList: any[] = []
    $: templateList = [
        { id: null, name: "—" },
        ...Object.entries($templates)
            .map(([id, template]: any) => ({ id, name: template.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
    ]

    // text divider
    function keydown(e: any) {
        if (e.key === "Enter") {
            currentStyle.metadataDivider = (currentStyle.metadataDivider || "; ") + "<br>"
            updateStyle(currentStyle.metadataDivider, "metadataDivider")
        }
    }

    let edit: any
</script>

<div class="info">
    <p><T id="settings.styles_hint" /></p>
</div>

<br />

<!-- TODO: use stage (dropdown) -->
<CombinedInput>
    <p><T id="edit.background_color" /></p>
    <span>
        <Color value={currentStyle.background || "#000000"} on:input={(e) => updateStyle(e, "background")} />
    </span>
</CombinedInput>
<CombinedInput>
    <p><T id="edit.background_media" /></p>
    <MediaPicker
        id="styles"
        title={currentStyle.backgroundImage}
        filter={{ name: "Media files", extensions: [...$imageExtensions, $videoExtensions] }}
        on:picked={(e) => {
            if (e.detail) updateStyle(e, "backgroundImage")
        }}
    >
        <Icon id="image" right />
        {#if currentStyle.backgroundImage}
            {getFileName(currentStyle.backgroundImage)}
        {:else}
            <T id="edit.choose_media" />
        {/if}
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
<CombinedInput>
    <p><T id="edit.media_fit" /></p>
    <Dropdown value={mediaFitOptions.find((a) => a.id === currentStyle.fit)?.name || "—"} options={[{ id: null, name: "—" }, ...mediaFitOptions]} on:click={(e) => updateStyle(e.detail.id, "fit")} />
</CombinedInput>
<!-- TODO: transparency? -->
<!-- WIP background image (clear to image...) -->
<!-- WIP foreground: mask/overlay -->
<CombinedInput>
    <p><T id="settings.resolution" /></p>
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
</CombinedInput>

<CombinedInput>
    <p><T id="settings.cropping" /></p>
    <span class="inputs">
        <NumberInput title={$dictionary.screen?.top} value={currentStyle.cropping?.top || 0} min={0} max={10000} buttons={false} on:change={(e) => updateCropping(Number(e.detail), "top")} />
        <NumberInput title={$dictionary.screen?.right} value={currentStyle.cropping?.right || 0} min={0} max={10000} buttons={false} on:change={(e) => updateCropping(Number(e.detail), "right")} />
        <NumberInput title={$dictionary.screen?.bottom} value={currentStyle.cropping?.bottom || 0} min={0} max={10000} buttons={false} on:change={(e) => updateCropping(Number(e.detail), "bottom")} />
        <NumberInput title={$dictionary.screen?.left} value={currentStyle.cropping?.left || 0} min={0} max={10000} buttons={false} on:change={(e) => updateCropping(Number(e.detail), "left")} />
    </span>
</CombinedInput>

<h3><T id="preview.slide" /></h3>
<CombinedInput>
    <p><T id="settings.lines" /></p>
    <NumberInput
        value={currentStyle.lines || 0}
        min={0}
        max={99}
        buttons={false}
        outline
        on:change={(e) => {
            updateStyle(e, "lines")
        }}
    />
</CombinedInput>
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
    <p><T id="settings.override_with_template" /></p>
    <Dropdown options={templateList} value={$templates[currentStyle.template || ""]?.name || "—"} on:click={(e) => updateStyle(e.detail.id, "template")} />
</CombinedInput>

<!-- meta -->
<h3><T id="tools.metadata" /></h3>
<CombinedInput>
    <p><T id="meta.display_metadata" /></p>
    <Dropdown options={meta} value={meta.find((a) => a.id === (currentStyle.displayMetadata || "never"))?.name || "—"} on:click={(e) => updateStyle(e.detail.id, "displayMetadata")} />
</CombinedInput>
<CombinedInput>
    <p><T id="meta.meta_template" /></p>
    <Dropdown options={templateList} value={$templates[currentStyle.metadataTemplate === undefined ? "metadata" : currentStyle.metadataTemplate]?.name || "—"} on:click={(e) => updateStyle(e.detail.id, "metadataTemplate")} />
</CombinedInput>
<CombinedInput>
    <p><T id="meta.text_divider" /></p>
    <TextInput value={currentStyle.metadataDivider === undefined ? "; " : currentStyle.metadataDivider} on:change={(e) => updateStyle(e, "metadataDivider")} on:keydown={keydown} />
</CombinedInput>
<CombinedInput>
    <p><T id="meta.message_template" /></p>
    <Dropdown options={templateList} value={$templates[currentStyle.messageTemplate === undefined ? "message" : currentStyle.messageTemplate]?.name || "—"} on:click={(e) => updateStyle(e.detail.id, "messageTemplate")} />
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
