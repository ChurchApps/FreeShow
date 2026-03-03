<script lang="ts">
    import { activeDrawerTab, activeEdit, activePage, activeShow, showsCache, templates } from "../../../stores"
    import { mediaExtensions } from "../../../values/extensions"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"

    $: slideId = getLayoutRef()[$activeEdit.slide || 0]?.id
    $: editSlide = $showsCache && $activeEdit.slide !== null && slideId ? _show().slides([slideId]).get()[0] : null

    // $: globalGroup = _show().get("slides")[slideId]?.globalGroup || ""
    // $: groupData = $groups[globalGroup] || {}
    // $: groupTemplate = groupData.template

    let settings: { template?: string; color?: string; backgroundImage?: string } = {}

    $: if ($showsCache || editSlide) setValues()
    function setValues() {
        settings = {
            template: editSlide?.settings?.template,
            color: editSlide?.settings?.color || "",
            backgroundImage: editSlide?.settings?.backgroundImage || ""
        }
    }

    function update() {
        if (!editSlide) return

        let newData = { style: clone(settings) }

        history({
            id: "slideStyle",
            oldData: { style: editSlide?.settings },
            newData,
            location: { page: "edit", show: $activeShow!, slide: slideId }
        })
    }

    function editTemplate(id: string) {
        activeDrawerTab.set("templates")
        activeEdit.set({ type: "template", id, items: [] })
        activePage.set("edit")
    }

    $: bgImage = settings.backgroundImage
    function editBackgroundImage() {
        activeEdit.set({ type: "media", id: bgImage, items: [] })
        activePage.set("edit")
    }
</script>

<div class="tools">
    <div>
        <MaterialColorInput
            label="edit.background_color"
            value={settings.color}
            on:input={(e) => {
                settings.color = e.detail
                update()
            }}
            allowGradients
            allowEmpty
            noLabel
        />

        <!-- WIP TIP about layout background image -->
        <InputRow>
            <MaterialFilePicker
                label="edit.background_media"
                value={bgImage}
                filter={{ name: "Media files", extensions: mediaExtensions }}
                on:change={(e) => {
                    settings.backgroundImage = e.detail
                    update()
                }}
                allowEmpty
            />
            {#if bgImage}
                <MaterialButton title="titlebar.edit" icon="edit" on:click={editBackgroundImage} />
            {/if}
        </InputRow>

        <InputRow>
            <!-- {#if groupTemplate && !settings.template}
                <span style="display: flex;align-items: center;padding: 0 10px;font-size: 0.8em;opacity: 0.7;"><T id="settings.overrided_value" /></span>
            {/if} -->
            <MaterialPopupButton
                label="show.slide_template"
                value={settings.template}
                name={$templates[settings.template || ""]?.name}
                popupId="select_template"
                icon="templates"
                on:change={(e) => {
                    settings.template = e.detail
                    update()
                }}
                allowEmpty
            />
            {#if settings.template && $templates[settings.template]}
                <MaterialButton title="titlebar.edit" icon="edit" on:click={() => editTemplate(settings.template || "")} />
            {/if}
        </InputRow>
    </div>
</div>

<style>
    .tools {
        padding: 8px 5px;

        display: flex;
        flex-direction: column;
        gap: 5px;
    }
</style>
