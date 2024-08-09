<script lang="ts">
    import { onMount } from "svelte"
    import { activeShow, dictionary, outputs, showsCache, styles, templates } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { history } from "../../helpers/history"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Panel from "../../system/Panel.svelte"
    import Notes from "./Notes.svelte"
    import { getActiveOutputs } from "../../helpers/output"
    import Tags from "../Tags.svelte"

    // WIP duplicate of Outputs.svelte
    const metaDisplay: any[] = [
        { id: "never", name: "$:show_at.never:$" },
        { id: "always", name: "$:show_at.always:$" },
        { id: "first", name: "$:show_at.first:$" },
        { id: "last", name: "$:show_at.last:$" },
        { id: "first_last", name: "$:show_at.first_last:$" },
    ]

    $: currentShow = $showsCache[$activeShow!.id]
    $: meta = currentShow.meta
    let values: { [key: string]: string } = {}
    let message: any = {}
    let metadata: any = {}
    let templateList: any[] = []
    let outputShowSettings: any = {}

    onMount(getValues)
    $: if ($activeShow!.id) getValues()

    function getValues() {
        values = { title: "", artist: "", author: "", composer: "", publisher: "", copyright: "", CCLI: "", year: "" }
        Object.entries(meta).forEach(([key, value]) => {
            values[key] = value
        })

        metadata = currentShow.metadata || {}
        message = currentShow.message || {}

        templateList = [
            { id: null, name: "—" },
            ...Object.entries($templates)
                .map(([id, template]: any) => ({ id, name: template.name }))
                .sort((a, b) => a.name.localeCompare(b.name)),
        ]

        let outputId = getActiveOutputs($outputs)[0]
        outputShowSettings = $styles[$outputs[outputId]?.style || ""] || {}
    }

    const changeValue = (e: any, key: string) => {
        values[key] = e.target.value
        updateData(values, "meta")
    }

    function toggleAutoMedia(e: any) {
        let value = e.target.checked
        metadata.autoMedia = value
        updateData(metadata, "metadata")
    }

    function toggleOverride(e: any) {
        let value = e.target.checked
        metadata.override = value
        updateData(metadata, "metadata")
    }

    function updateData(data, key) {
        let override = "show#" + $activeShow!.id + "_" + key
        history({ id: "UPDATE", newData: { data, key }, oldData: { id: $activeShow!.id }, location: { page: "show", id: "show_key", override } })
    }

    // I have no idea why, but the ui jump around without resetting this new checkbox
    let tempHide = false
    $: setHide = metadata.override || metadata.display || metadata.template || message.template
    $: if (setHide) hide()
    function hide() {
        tempHide = true
        setTimeout(() => (tempHide = false), 10)

        // scroll to bottom
        setTimeout(() => document.querySelector(".content")?.scrollTo(0, 999), 20)
    }
</script>

<Panel flex column={!tempHide}>
    {#if metadata.autoMedia !== true}
        <div class="gap" style="padding: 10px;">
            <span class="titles">
                {#each Object.keys(values) as key}
                    <p><T id="meta.{key}" /></p>
                {/each}
            </span>
            <span style="flex: 1;display: flex;flex-direction: column;gap: 5px;">
                {#each Object.entries(values) as [key, value]}
                    <TextInput {value} on:change={(e) => changeValue(e, key)} />
                {/each}
            </span>
        </div>
    {/if}

    <div class="styling">
        <div>
            <p title="{$dictionary.meta?.auto_media} (.JPEG images)"><T id="meta.auto_media" /></p>
            <Checkbox checked={metadata.autoMedia || false} on:change={toggleAutoMedia} />
        </div>
    </div>

    <!-- message -->
    <h5><T id="meta.message" /></h5>
    <div class="message">
        <p style="padding-bottom: 10px;"><T id="meta.message_tip" /></p>
        <Notes value={message.text || ""} on:change={(e) => updateData({ ...message, text: e.detail }, "message")} lines={2} />
    </div>

    <!-- styling -->
    <h5><T id="edit.style" /></h5>
    <div class="styling">
        <div>
            <p><T id="meta.override_output" /></p>
            <Checkbox checked={metadata.override || false} on:change={toggleOverride} />
        </div>
        {#if metadata.override}
            <!-- meta display -->
            <div class="style_data">
                <p><T id="meta.display_metadata" /></p>
                <Dropdown
                    options={metaDisplay}
                    value={metaDisplay.find((a) => a.id === (metadata.display || "never"))?.name || "—"}
                    on:click={(e) => {
                        metadata.display = e.detail.id
                        updateData(metadata, "metadata")
                    }}
                />
            </div>
            <!-- meta template -->
            <div class="style_data">
                <p><T id="meta.meta_template" /></p>
                <Dropdown
                    options={templateList}
                    value={$templates[metadata.template === undefined ? outputShowSettings.metadataTemplate || "metadata" : metadata.template]?.name || "—"}
                    on:click={(e) => {
                        metadata.template = e.detail.id
                        updateData(metadata, "metadata")
                    }}
                />
            </div>
            <!-- message display -->
            <!-- <div class="style_data">
                <p><T id="meta.display_message" /></p>
                <Dropdown options={metaDisplay} value={metaDisplay.find((a) => a.id === (message.display || outputShowSettings.displayMessage || "never"))?.name || "—"}  on:click={(e) => updateData()} />
            </div> -->
            <!-- message template -->
            <div class="style_data">
                <p><T id="meta.message_template" /></p>
                <Dropdown
                    options={templateList}
                    value={$templates[message.template === undefined ? outputShowSettings.messageTemplate || "message" : message.template]?.name || "—"}
                    on:click={(e) => {
                        if (currentShow.message) message = currentShow.message
                        message.template = e.detail.id
                        updateData(message, "message")
                    }}
                />
            </div>
        {/if}
    </div>

    <h5><T id="meta.tags" /></h5>
    <div class="tags" style="display: flex;flex-direction: column;">
        <Tags />
    </div>
</Panel>

<style>
    h5 {
        overflow: visible;
        text-align: center;
        padding: 5px;
        background-color: var(--primary-darkest);
        color: var(--text);
        font-size: 0.8em;
        text-transform: uppercase;
    }

    .message,
    .styling,
    .tags {
        padding: 10px;
    }

    .message :global(div) {
        display: block !important;
    }

    .message :global(div.paper) {
        position: relative;
        display: block;
        background: var(--primary-darker);
        height: initial;
    }

    .styling div {
        display: flex;
    }
    .styling .style_data {
        padding-top: 5px;
    }

    .style_data :global(.dropdownElem) {
        min-width: 50%;
        max-width: 50%;
    }
</style>
