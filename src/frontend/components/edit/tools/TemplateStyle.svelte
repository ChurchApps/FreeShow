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
        .filter((a) => a.name)
        .map((a) => ({ value: a.id, label: a.name }))
</script>

<div class="tools">
    <div>
        <MaterialColorInput
            label="edit.background_color"
            value={settings.backgroundColor}
            on:input={(e) => {
                settings.backgroundColor = e.detail
                update()
            }}
            allowEmpty
            noLabel
        />

        <InputRow>
            <MaterialFilePicker label="edit.background_media" value={settings.backgroundPath} filter={{ name: "Media files", extensions: mediaExtensions }} on:change={(e) => setValue(e, "backgroundPath")} allowEmpty />
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

        <MaterialNumberInput label="edit.max_lines_per_slide" value={settings?.maxLinesPerSlide || 0} max={100} on:change={(e) => setValue(e, "maxLinesPerSlide")} />
        <MaterialNumberInput label="edit.break_long_lines_tip" value={settings?.breakLongLines || 0} max={100} on:change={(e) => setValue(e, "breakLongLines")} />
    </div>

    <div>
        <div class="title">
            <span style="display: flex;gap: 8px;align-items: center;padding: 8px 12px;">
                <Icon id="special" white />
                <p>{translateText("edit.special")}</p>
            </span>
        </div>

        <MaterialDropdown label="edit.overlay_content" options={overlayList} value={settings.overlayId || ""} on:change={(e) => setValue(e.detail, "overlayId")} allowEmpty />

        <InputRow>
            <MaterialPopupButton
                label="edit.different_first_template"
                value={settings.firstSlideTemplate}
                name={$templates[settings.firstSlideTemplate || ""]?.name}
                popupId="select_template"
                icon="templates"
                on:change={(e) => {
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
            {translateText("edit.style_overrides")}
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
</style>
