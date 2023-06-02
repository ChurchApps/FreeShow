<script lang="ts">
    import { uid } from "uid"
    import { dictionary, labelsDisabled, outputs, styles, templates } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    function updateStyle(e: any, key: string) {
        let value = e?.detail || e?.target?.value || e

        currentStyle[key] = value
        if (!styleId) styleId = uid()

        // TODO: history
        styles.update((a) => {
            a[styleId] = currentStyle

            return a
        })
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

        return list.sort((a, b) => a.name.localeCompare(b.name))
    }

    let styleId = Object.keys($styles)[0]
    $: currentStyle = $styles[styleId] || defaultStyle

    function resetStyle() {
        let name = currentStyle.name
        currentStyle = { name }
        updateStyle(name, "name")
    }

    // slide

    let activeLayers: any[] = []
    $: {
        if (currentStyle.layers) activeLayers = currentStyle.layers
        else activeLayers = ["background", "slide", "overlays"]
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
</script>

<Dropdown value={currentStyle.name} options={stylesList} on:click={(e) => (styleId = e.detail?.id)} />

<div class="flex">
    <TextInput disabled={!styleId} value={currentStyle.name} on:change={(e) => updateStyle(e, "name")} light />
    <Button
        disabled={!styleId}
        on:click={() => {
            history({ id: "UPDATE", newData: { id: styleId }, location: { page: "settings", id: "settings_style" } })
        }}
    >
        <Icon id="delete" right />
        {#if !$labelsDisabled}
            <T id="actions.delete" />
        {/if}
    </Button>
    <Button
        on:click={() => {
            styleId = uid()
            history({ id: "UPDATE", newData: { data: clone(currentStyle), replace: { name: currentStyle.name + " 2" } }, oldData: { id: styleId }, location: { page: "settings", id: "settings_style" } })
        }}
    >
        <Icon id="duplicate" right />
        {#if !$labelsDisabled}
            <T id="actions.duplicate" />
        {/if}
    </Button>
</div>

<hr />

<!-- slide -->
<h3><T id="preview.slide" /></h3>
<!-- TODO: use stage (dropdown) -->
<div>
    <p><T id="edit.background_color" /></p>
    <span style="width: 200px;">
        <Color value={currentStyle.background || "#000000"} on:input={(e) => updateStyle(e, "background")} />
    </span>
</div>
<!-- TODO: transparency? -->
<div>
    <p><T id="settings.resolution" /></p>
    <span class="inputs">
        <!-- defaults dropdown -->
        <!-- custom... -->
        <p style="width: 80px; text-align: right; font-weight: bold;"><T id="screen.width" /></p>
        <NumberInput value={currentStyle.resolution?.width || 1920} min={100} max={10000} buttons={false} outline on:change={(e) => updateStyle({ width: Number(e.detail), height: currentStyle.resolution?.height || 1080 }, "resolution")} />
        <p style="width: 80px; text-align: right; font-weight: bold;"><T id="screen.height" /></p>
        <NumberInput value={currentStyle.resolution?.height || 1080} min={100} max={10000} buttons={false} outline on:change={(e) => updateStyle({ height: Number(e.detail), width: currentStyle.resolution?.width || 1920 }, "resolution")} />
    </span>
</div>

<div>
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
</div>
<div>
    <p><T id="settings.active_layers" /></p>
    <span style="display: flex;">
        <!-- active={activeLayers.includes("background")} -->
        <Button
            on:click={() => {
                if (activeLayers.includes("background")) activeLayers.splice(activeLayers.indexOf("background"), 1)
                else activeLayers = [...new Set([...activeLayers, "background"])]
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
                else activeLayers = [...new Set([...activeLayers, "slide"])]
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
                else activeLayers = [...new Set([...activeLayers, "overlays"])]
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
</div>

<div>
    <p><T id="settings.override_with_template" /></p>
    <Dropdown options={templateList} value={$templates[currentStyle.template || ""]?.name || "—"} style="width: 200px;" on:click={(e) => updateStyle(e.detail.id, "template")} />
</div>

<hr />

<!-- meta -->
<h3><T id="tools.metadata" /></h3>
<div>
    <p><T id="meta.display_metadata" /></p>
    <Dropdown options={meta} value={meta.find((a) => a.id === (currentStyle.displayMetadata || "never"))?.name || "—"} style="width: 200px;" on:click={(e) => updateStyle(e.detail.id, "displayMetadata")} />
</div>
<div>
    <p><T id="meta.meta_template" /></p>
    <Dropdown options={templateList} value={$templates[currentStyle.metadataTemplate === undefined ? "metadata" : currentStyle.metadataTemplate]?.name || "—"} style="width: 200px;" on:click={(e) => updateStyle(e.detail.id, "metadataTemplate")} />
</div>
<div>
    <p><T id="meta.message_template" /></p>
    <Dropdown options={templateList} value={$templates[currentStyle.messageTemplate === undefined ? "message" : currentStyle.messageTemplate]?.name || "—"} style="width: 200px;" on:click={(e) => updateStyle(e.detail.id, "messageTemplate")} />
</div>

<!-- TODO: override transition ? -->

<hr />
<Button style="width: 100%;" on:click={resetStyle} center>
    <Icon id="reset" right />
    <T id="settings.reset_style" />
</Button>

<style>
    div:not(.scroll) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 5px 0;
        min-height: 38px;
    }

    h3 {
        text-align: center;
        font-size: 1.8em;
        margin: 20px 0;
    }
    h3 {
        font-size: initial;
    }

    .inputs {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    hr {
        background-color: var(--primary-lighter);
        border: none;
        height: 2px;
        margin: 20px 0;
    }

    .flex {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .flex :global(button) {
        white-space: nowrap;
    }

    div :global(.numberInput) {
        width: 80px;
    }
</style>
