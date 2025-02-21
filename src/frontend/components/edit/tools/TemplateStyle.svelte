<script lang="ts">
    import type { TemplateSettings } from "../../../../types/Show"
    import { activeEdit, activePopup, dictionary, overlays, popupData, templates } from "../../../stores"
    import { getList } from "../../../utils/common"
    import { mediaExtensions } from "../../../values/extensions"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import MediaPicker from "../../inputs/MediaPicker.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    $: templateId = $activeEdit?.id || ""
    $: template = $templates[templateId] || {}

    let settings: TemplateSettings = {}

    $: if (template) setValues()
    function setValues() {
        settings = {
            backgroundColor: template?.settings?.backgroundColor || "",
            ...(template.settings || {}),
        }
    }

    function update() {
        if (!template) return

        let newData: any = { key: "settings", data: clone(settings) }

        history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "edit", id: "template_settings", override: templateId } })
    }

    function setValue(e: any, key: string) {
        let value = e?.detail ?? e
        settings[key] = value

        update()
    }

    $: overlayList = getList($overlays, true).filter((a) => a.name)
</script>

<div class="section">
    <CombinedInput>
        <p><T id="edit.background_color" /></p>
        <Color bind:value={settings.backgroundColor} on:input={(e) => setValue(e, "backgroundColor")} enableNoColor />
    </CombinedInput>
    <CombinedInput>
        <p><T id="edit.background_media" /></p>
        <MediaPicker id={"bg_" + templateId} title={settings.backgroundPath} style="overflow: hidden;" filter={{ name: "Media files", extensions: mediaExtensions }} on:picked={(e) => setValue(e, "backgroundPath")}>
            <Icon id="image" right />
            {#if settings.backgroundPath}
                <p style="padding: 0;opacity: 1;">{getFileName(settings.backgroundPath)}</p>
            {:else}
                <p style="padding: 0;"><T id="edit.choose_media" /></p>
            {/if}
        </MediaPicker>
        {#if settings.backgroundPath}
            <Button title={$dictionary.actions?.remove} on:click={() => setValue("", "backgroundPath")} redHover>
                <Icon id="close" size={1.2} white />
            </Button>
        {/if}
    </CombinedInput>

    <CombinedInput>
        <p title={$dictionary.edit?.overlay_content}><T id="edit.overlay_content" /></p>
        <Dropdown options={overlayList} value={$overlays[settings.overlayId || ""]?.name || "—"} on:click={(e) => setValue(e?.detail?.id, "overlayId")} />
    </CombinedInput>

    <CombinedInput>
        <p title={$dictionary.edit?.different_first_template}><T id="edit.different_first_template" /></p>
        <Button
            on:click={() => {
                popupData.set({
                    action: "select_template",
                    active: settings.firstSlideTemplate || "",
                    hideIds: [templateId],
                    trigger: (id) => setValue(id, "firstSlideTemplate"),
                })
                activePopup.set("select_template")
            }}
            style="overflow: hidden;"
            bold={!settings.firstSlideTemplate}
        >
            <div style="display: flex;align-items: center;padding: 0;">
                <Icon id="templates" />
                <p style="opacity: 1;font-size: 1em;">
                    {#if settings.firstSlideTemplate}
                        {$templates[settings.firstSlideTemplate || ""]?.name || "—"}
                    {:else}
                        <T id="popup.select_template" />
                    {/if}
                </p>
            </div>
        </Button>
        {#if settings.firstSlideTemplate}
            <Button title={$dictionary.actions?.remove} on:click={() => setValue("", "firstSlideTemplate")} redHover>
                <Icon id="close" size={1.2} white />
            </Button>
        {/if}
    </CombinedInput>

    <CombinedInput>
        <p title={$dictionary.edit?.max_lines_per_slide}><T id="edit.max_lines_per_slide" /></p>
        <NumberInput value={settings?.maxLinesPerSlide || 0} max={100} on:change={(e) => setValue(e, "maxLinesPerSlide")} />
    </CombinedInput>
</div>

<style>
    .section {
        display: flex;
        flex-direction: column;
        margin: 10px;
    }

    /* h6 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    } */

    p {
        overflow: hidden !important;
        opacity: 0.8;
        font-size: 0.9em;
    }
</style>
