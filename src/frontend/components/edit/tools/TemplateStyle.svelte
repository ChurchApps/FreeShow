<script lang="ts">
    import type { TemplateSettings } from "../../../../types/Show"
    import { activeEdit, dictionary, imageExtensions, outputs, overlays, styles, templates, videoExtensions } from "../../../stores"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName } from "../../helpers/media"
    import { getActiveOutputs, getResolution } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import MediaPicker from "../../inputs/MediaPicker.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    $: templateId = $activeEdit?.id || ""
    $: template = $templates[templateId] || {}

    $: currentStyle = $styles[$outputs[getActiveOutputs()[0]].style || ""] || {}

    let settings: TemplateSettings = {}

    $: if (template) setValues()
    function setValues() {
        let res = getResolution(template?.settings?.resolution)
        settings = {
            resolution: { width: res.width, height: res.height },
            backgroundColor: template?.settings?.backgroundColor || currentStyle.background || "#000000",
            ...(template.settings || {}),
        }
    }

    function update() {
        if (!template) return

        let newData: any = { key: "settings", data: clone(settings) }

        // don't store resolution if it's the default app resolution
        if (JSON.stringify(newData.data.resolution) === JSON.stringify(getResolution())) delete newData.data.resolution

        history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "edit", id: "template_settings", override: templateId } })
    }

    function setValue(e: any, key: string) {
        let value = e?.detail ?? e
        settings[key] = value

        update()
    }
    function setResolution(e: any, key: "width" | "height") {
        let resolution = settings.resolution || {}
        resolution[key] = Number(e.detail)

        setValue(resolution, "resolution")
    }

    $: templateList = getList($templates, true).filter((a) => a.id !== templateId)
    $: overlayList = getList($overlays, true)

    function getList(object: any, addEmptyValue: boolean = false) {
        let list = sortByName(keysToID(object))
        if (addEmptyValue) list = [{ id: null, name: "—" }, ...list]

        return list
    }
</script>

<div class="section">
    <CombinedInput>
        <p><T id="edit.background_color" /></p>
        <Color bind:value={settings.backgroundColor} on:input={(e) => setValue(e, "backgroundColor")} />
    </CombinedInput>
    <CombinedInput>
        <p><T id="edit.background_media" /></p>
        <MediaPicker id={"bg_" + templateId} title={settings.backgroundPath} style="overflow: hidden;" filter={{ name: "Media files", extensions: [...$videoExtensions, ...$imageExtensions] }} on:picked={(e) => setValue(e, "backgroundPath")}>
            <Icon id="image" right />
            {#if settings.backgroundPath}
                <p style="padding: 0;opacity: 1;">{getFileName(settings.backgroundPath)}</p>
            {:else}
                <p style="padding: 0;"><T id="edit.choose_media" /></p>
            {/if}
        </MediaPicker>
    </CombinedInput>

    <CombinedInput>
        <p><T id="edit.overlay" /></p>
        <Dropdown options={overlayList} value={$overlays[settings.overlayId || ""]?.name || "—"} on:click={(e) => setValue(e?.detail?.id, "overlayId")} />
    </CombinedInput>

    <CombinedInput>
        <p title={$dictionary.edit?.different_first_template}><T id="edit.different_first_template" /></p>
        <Dropdown options={templateList} value={$templates[settings.firstSlideTemplate || ""]?.name || "—"} on:click={(e) => setValue(e?.detail?.id, "firstSlideTemplate")} />
    </CombinedInput>

    <h6><T id="settings.resolution" /></h6>
    <CombinedInput>
        <p><T id="edit.width" /></p>
        <NumberInput value={settings.resolution?.width || 1920} max={100000} on:change={(e) => setResolution(e, "width")} buttons={false} />
    </CombinedInput>
    <CombinedInput>
        <p><T id="edit.height" /></p>
        <NumberInput value={settings.resolution?.height || 1080} max={100000} on:change={(e) => setResolution(e, "height")} buttons={false} />
    </CombinedInput>
</div>

<style>
    .section {
        display: flex;
        flex-direction: column;
        margin: 10px;
    }

    h6 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }

    p {
        opacity: 0.8;
        font-size: 0.9em;
    }
</style>
