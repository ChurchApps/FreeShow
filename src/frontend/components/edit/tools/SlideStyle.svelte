<script lang="ts">
    import { activeEdit, activeShow, outputs, showsCache, styles, templates } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getActiveOutputs, getResolution } from "../../helpers/output"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import Notes from "../../show/tools/Notes.svelte"

    // TODO: templates / overlays

    $: slideId = _show("active").layouts("active").ref()[0]?.[$activeEdit.slide || 0]?.id
    $: editSlide = $activeEdit.slide !== null && slideId ? _show("active").slides([slideId]).get()[0] : null
    $: backgroundColor = $styles[$outputs[getActiveOutputs()[0]].style || ""]?.background

    let settings: any = {}
    showsCache.subscribe(setValues)

    $: if (editSlide) setValues()
    function setValues() {
        let res = getResolution(editSlide?.settings?.resolution)
        settings = {
            template: editSlide?.settings?.template,
            color: editSlide?.settings?.color || backgroundColor || "#000000",
            resolution: {
                width: res.width,
                height: res.height,
            },
        }
    }

    function update() {
        if (!editSlide) return

        let newData: any = { style: clone(settings) }
        if (JSON.stringify(newData.style.resolution) === JSON.stringify(getResolution())) delete newData.style.resolution
        if (newData.style.color === backgroundColor) delete newData.style.color

        history({
            id: "slideStyle",
            oldData: { style: editSlide?.settings },
            newData,
            location: { page: "edit", show: $activeShow!, slide: slideId },
        })
    }

    let note: string = ""
    $: if ($activeEdit.slide !== null && $activeEdit.slide !== undefined) note = editSlide?.notes || ""

    function edit(e: any) {
        if (editSlide.notes === e.detail || !slideId) return

        _show($activeShow!.id).slides([slideId]).set({ key: "notes", value: e.detail })
    }

    let templateList: any[] = []
    $: templateList = [
        { id: null, name: "—" },
        ...Object.entries($templates)
            .map(([id, template]: any) => ({ id, name: template.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
    ]
</script>

<div class="section">
    <h6 style="margin-top: 10px;"><T id="edit.style" /></h6>
    <CombinedInput>
        <p><T id="edit.background_color" /></p>
        <Color
            bind:value={settings.color}
            on:input={(e) => {
                settings.color = e.detail
                update()
            }}
        />
    </CombinedInput>
    <CombinedInput>
        <p><T id="show.slide_template" /></p>
        <Dropdown
            options={templateList}
            value={$templates[settings.template || ""]?.name || "—"}
            on:click={(e) => {
                settings.template = e.detail.id
                update()
            }}
        />
    </CombinedInput>

    <h6><T id="settings.resolution" /></h6>
    <CombinedInput>
        <p><T id="edit.width" /></p>
        <NumberInput
            value={settings.resolution.width}
            max={100000}
            on:change={(e) => {
                settings.resolution.width = Number(e.detail)
                update()
            }}
            buttons={false}
        />
    </CombinedInput>
    <CombinedInput>
        <p><T id="edit.height" /></p>
        <NumberInput
            value={settings.resolution.height}
            max={100000}
            on:change={(e) => {
                settings.resolution.height = Number(e.detail)
                update()
            }}
            buttons={false}
        />
    </CombinedInput>

    <h6><T id="tools.notes" /></h6>
    <div class="notes">
        <Notes value={note} on:edit={edit} />
    </div>
</div>

<style>
    .section {
        display: flex;
        flex-direction: column;
        margin: 0 10px;
    }
    .section:last-child {
        margin-bottom: 10px;
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

    .notes :global(div) {
        display: block !important;
    }

    .notes :global(div.paper) {
        position: relative;
        display: block;
        background: var(--primary-darker);
    }
</style>
