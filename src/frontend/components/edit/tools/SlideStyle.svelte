<script lang="ts">
    import { activeEdit, activeShow, outputs, showsCache, styles } from "../../../stores"
    import { history } from "../../helpers/history"
    import { getActiveOutputs, getResolution } from "../../helpers/output"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Color from "../../inputs/Color.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import Notes from "../../show/tools/Notes.svelte"
    import Panel from "../../system/Panel.svelte"

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
            color: editSlide?.settings?.color || backgroundColor || "#000000",
            resolution: {
                width: res.width,
                height: res.height,
            },
        }
    }

    const inputChange = (e: any, key: string) => {
        settings[key] = e.target.value
        update()
    }

    function update() {
        if (!editSlide) return

        let newData: any = { style: JSON.parse(JSON.stringify(settings)) }
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
</script>

<Panel>
    <h6><T id="edit.style" /></h6>
    <div class="gap">
        <span class="titles">
            <p><T id="edit.background_color" /></p>
        </span>
        <span style="flex: 1;">
            <Color bind:value={settings.color} on:input={(e) => inputChange(e, "color")} />
        </span>
    </div>
    <hr />
    <h6><T id="settings.resolution" /></h6>
    <div class="gap">
        <span class="titles">
            <p><T id="edit.width" /></p>
            <p><T id="edit.height" /></p>
            <!-- <p><T id="edit.transition" /></p> -->
        </span>
        <span style="flex: 1;">
            <NumberInput
                value={settings.resolution.width}
                max={100000}
                on:change={(e) => {
                    settings.resolution.width = Number(e.detail)
                    update()
                }}
            />
            <NumberInput
                value={settings.resolution.height}
                max={100000}
                on:change={(e) => {
                    settings.resolution.height = Number(e.detail)
                    update()
                }}
            />
        </span>
    </div>
    <hr />
    <h6><T id="tools.notes" /></h6>
    <div class="notes">
        <Notes value={note} on:edit={edit} />
    </div>
</Panel>

<style>
    .notes :global(div) {
        display: block !important;
    }

    .notes :global(div.paper) {
        position: relative;
        display: block;
        background: var(--primary-darker);
    }
</style>
