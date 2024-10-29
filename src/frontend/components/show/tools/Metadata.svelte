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
    import { sortByName } from "../../helpers/array"
    import { initializeMetadata } from "../../helpers/show"
    import CombinedInput from "../../inputs/CombinedInput.svelte"

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

    let loaded: boolean = false
    onMount(getValues)
    $: messageUpdate = $showsCache[$activeShow?.id || ""]?.message
    $: if ($activeShow!.id || messageUpdate) getValues()

    function getValues() {
        values = initializeMetadata({})
        Object.entries(meta).forEach(([key, value]) => {
            values[key] = value
        })

        metadata = currentShow.metadata || {}
        message = currentShow.message || {}

        templateList = [{ id: null, name: "—" }, ...sortByName(Object.entries($templates).map(([id, template]: any) => ({ id, name: template.name })))]

        let outputId = getActiveOutputs($outputs)[0]
        outputShowSettings = $styles[$outputs[outputId]?.style || ""] || {}

        setTimeout(() => (loaded = true), 100)
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
        hide()
    }

    function updateData(data, key) {
        let override = "show#" + $activeShow!.id + "_" + key
        history({ id: "UPDATE", newData: { data, key }, oldData: { id: $activeShow!.id }, location: { page: "show", id: "show_key", override } })
    }

    // I have no idea why, but the ui jump around without resetting this new checkbox
    let tempHide = false
    $: setHide = metadata.display || metadata.template || message.template
    $: if (setHide) hide()
    function hide() {
        if (!loaded) return
        tempHide = true
        setTimeout(() => (tempHide = false), 10)

        // scroll to bottom
        setTimeout(() => document.querySelector(".content")?.scrollTo(0, 999), 20)
    }
</script>

<Panel flex column={!tempHide}>
    {#if metadata.autoMedia !== true}
        <div class="gap">
            {#each Object.entries(values) as [key, value]}
                <CombinedInput textWidth={40}>
                    {#if $dictionary.meta?.[key]}
                        <p title={$dictionary.meta?.[key]}><T id="meta.{key}" /></p>
                    {:else}
                        <p style="text-transform: capitalize;">{key}</p>
                    {/if}
                    <TextInput {value} on:change={(e) => changeValue(e, key)} />
                </CombinedInput>
            {/each}
        </div>
    {/if}

    <div class="styling">
        <div>
            <p title="{$dictionary.meta?.auto_media} (EXIF from .JPEG)"><T id="meta.auto_media" /></p>
            <Checkbox checked={metadata.autoMedia || false} on:change={toggleAutoMedia} />
        </div>
    </div>

    <!-- message -->
    <h5><T id="meta.message" /></h5>
    <div class="message">
        <p style="padding-bottom: 10px;"><T id="meta.message_tip" /></p>
        <Notes value={message.text || ""} class="context #meta_message" on:change={(e) => updateData({ ...message, text: e.detail }, "message")} lines={2} />
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
            <CombinedInput style="margin-top: 10px;">
                <p title={$dictionary.meta?.display_metadata}><T id="meta.display_metadata" /></p>
                <Dropdown
                    options={metaDisplay}
                    value={metaDisplay.find((a) => a.id === (metadata.display || "never"))?.name || "—"}
                    on:click={(e) => {
                        metadata.display = e.detail.id
                        updateData(metadata, "metadata")
                    }}
                />
            </CombinedInput>
            {#if (metadata.display || "never") !== "never"}
                <!-- meta template -->
                <CombinedInput>
                    <p title={$dictionary.meta?.meta_template}><T id="meta.meta_template" /></p>
                    <Dropdown
                        options={templateList}
                        value={$templates[metadata.template === undefined ? outputShowSettings.metadataTemplate || "metadata" : metadata.template]?.name || "—"}
                        on:click={(e) => {
                            metadata.template = e.detail.id
                            updateData(metadata, "metadata")
                        }}
                    />
                </CombinedInput>
            {/if}
            <!-- message display -->
            <!-- <CombinedInput>
                <p title={$dictionary.meta?.display_message}><T id="meta.display_message" /></p>
                <Dropdown options={metaDisplay} value={metaDisplay.find((a) => a.id === (message.display || outputShowSettings.displayMessage || "never"))?.name || "—"} on:click={(e) => updateData()} />
            </CombinedInput> -->
            <!-- message template -->
            <CombinedInput>
                <p title={$dictionary.meta?.message_template}><T id="meta.message_template" /></p>
                <Dropdown
                    options={templateList}
                    value={$templates[message.template === undefined ? outputShowSettings.messageTemplate || "message" : message.template]?.name || "—"}
                    on:click={(e) => {
                        if (currentShow.message) message = currentShow.message
                        message.template = e.detail.id
                        updateData(message, "message")
                    }}
                />
            </CombinedInput>
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

    .gap {
        padding: 10px;
        padding-bottom: 0;
        flex-direction: column;
        gap: 0;
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
</style>
