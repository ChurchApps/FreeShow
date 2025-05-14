<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, activeShow, customMetadata, dictionary, outputs, popupData, shows, showsCache, styles, templates } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { history } from "../../helpers/history"
    import { getActiveOutputs } from "../../helpers/output"
    import { getCustomMetadata, initializeMetadata, metadataDisplayValues } from "../../helpers/show"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Panel from "../../system/Panel.svelte"
    import Notes from "./Notes.svelte"

    $: currentShow = $showsCache[$activeShow!.id]
    $: meta = currentShow.meta
    let values: { [key: string]: string } = {}
    let message: any = {}
    let metadata: any = {}
    let outputShowSettings: any = {}

    let loaded = false
    onMount(getValues)
    $: messageUpdate = $showsCache[$activeShow?.id || ""]?.message
    $: if ($activeShow!.id || messageUpdate || $customMetadata) getValues()

    function getValues() {
        values = getCustomMetadata()

        const defaultKeys = Object.keys(initializeMetadata({}))
        Object.entries(meta).forEach(([key, value]) => {
            if (!value && defaultKeys.includes(key) && $customMetadata.disabled?.includes(key)) return
            values[key] = value
        })

        metadata = currentShow.metadata || {}
        message = currentShow.message || {}

        let outputId = getActiveOutputs($outputs)[0]
        outputShowSettings = $styles[$outputs[outputId]?.style || ""] || {}

        setTimeout(() => (loaded = true), 100)
    }

    const changeValue = (e: any, key: string) => {
        values[key] = e.target?.value || e.value || ""
        updateData(values, "meta")

        const quickAccessKeys = ["number", "CCLI"]
        if (quickAccessKeys.includes(key)) {
            let quickAccess = $showsCache[$activeShow!.id].quickAccess || {}

            if (key === "number") quickAccess.number = values.number
            else {
                if (!quickAccess.metadata) quickAccess.metadata = {}
                quickAccess.metadata[key] = values[key]
            }

            showsCache.update((a) => {
                a[$activeShow!.id].quickAccess = quickAccess
                return a
            })
            shows.update((a) => {
                a[$activeShow!.id].quickAccess = quickAccess
                return a
            })
        }
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

    // AUTOFILL

    const autofillValues = {
        // get only numbers at the start or end
        number: () => values.number || currentShow.name.match(/^\d+/)?.[0] || currentShow.name.match(/\d+$/)?.[0],
        // remove numbers
        title: () => currentShow.name.replace(/[0-9\-.,!:;]/g, "").trim()
    }
    function autofill(key: string) {
        if (!autofillValues[key]) return

        const value = autofillValues[key]()
        if (!value) return

        changeValue({ value }, key)
    }

    $: slideBackgrounds = Object.values(currentShow?.layouts)
        .map((a) => a.slides.map((a) => a.background).filter(Boolean))
        .flat()

    $: metadataDisplay = metadata.display || "never"
    // $: metadataDisplay = (metadata.display ? metadata.display : outputShowSettings.displayMetadata) || "never"
</script>

<Panel flex column={!tempHide}>
    {#if metadata.autoMedia !== true}
        <div class="gap context #metadata_tools" style={slideBackgrounds.length ? "" : "margin-bottom: 10px;"}>
            {#each Object.entries(values) as [key, value]}
                <CombinedInput textWidth={40}>
                    {#if $dictionary.meta?.[key]}
                        <p style="overflow: hidden;display: block;align-content: center;" title={$dictionary.meta?.[key]}><T id="meta.{key}" /></p>
                    {:else}
                        <p style="overflow: hidden;display: block;align-content: center;text-transform: capitalize;">{key}</p>
                    {/if}
                    <TextInput {value} style={key === "number" && currentShow?.quickAccess?.number ? "border-bottom: 1px solid var(--secondary);" : ""} on:change={(e) => changeValue(e, key)} />

                    {#if (!value || (key === "number" && !currentShow?.quickAccess?.number)) && (autofillValues[key]?.() || (key === "number" && value))}
                        <Button title={$dictionary.meta?.autofill} on:click={() => autofill(key)}>
                            <Icon id="autofill" white />
                        </Button>
                    {/if}
                </CombinedInput>
            {/each}
        </div>
    {/if}

    {#if slideBackgrounds.length}
        <div class="styling">
            <div>
                <p title="{$dictionary.meta?.auto_media} (EXIF from .JPEG)"><T id="meta.auto_media" /></p>
                <Checkbox checked={metadata.autoMedia || false} on:change={toggleAutoMedia} />
            </div>
        </div>
    {/if}

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
                <Button
                    on:click={() => {
                        popupData.set({
                            action: "show_metadata",
                            active: metadataDisplay,
                            trigger: (id) => {
                                metadata.display = id
                                updateData(metadata, "metadata")
                            }
                        })
                        activePopup.set("metadata_display")
                    }}
                    style="overflow: hidden;"
                    bold={false}
                >
                    <div style="display: flex;align-items: center;padding: 0;">
                        <Icon id="info" />
                        <p style="opacity: 1;font-size: 1em;">
                            {#key metadataDisplay}
                                <T id={metadataDisplayValues.find((a) => a.id === metadataDisplay)?.name || ""} />
                            {/key}
                        </p>
                    </div>
                </Button>
                <!-- WIP This does not work with the "Override output style" option -->
                <!-- {#if metadata.display}
                    <Button
                        title={$dictionary.actions?.remove}
                        on:click={() => {
                            metadata.display = ""
                            updateData(metadata, "metadata")
                        }}
                        redHover
                    >
                        <Icon id="close" size={1.2} white />
                    </Button>
                {/if} -->
            </CombinedInput>
            {#if (metadata.display || "never") !== "never"}
                <!-- meta template -->
                <CombinedInput>
                    <p title={$dictionary.meta?.meta_template}><T id="meta.meta_template" /></p>
                    <Button
                        on:click={() => {
                            popupData.set({
                                action: "select_template",
                                active: (metadata.template ? metadata.template : outputShowSettings.metadataTemplate) || "metadata",
                                trigger: (id) => {
                                    metadata.template = id
                                    updateData(metadata, "metadata")
                                }
                            })
                            activePopup.set("select_template")
                        }}
                        style="overflow: hidden;"
                        bold={false}
                    >
                        <div style="display: flex;align-items: center;padding: 0;">
                            <Icon id="templates" />
                            <p style="opacity: 1;font-size: 1em;">{$templates[(metadata.template ? metadata.template : outputShowSettings.metadataTemplate) || "metadata"]?.name || "—"}</p>
                        </div>
                    </Button>
                    {#if metadata.template}
                        <Button
                            title={$dictionary.actions?.remove}
                            on:click={() => {
                                metadata.template = ""
                                updateData(metadata, "metadata")
                            }}
                            redHover
                        >
                            <Icon id="close" size={1.2} white />
                        </Button>
                    {/if}
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
                <Button
                    on:click={() => {
                        popupData.set({
                            action: "select_template",
                            active: (message.template ? message.template : outputShowSettings.messageTemplate) || "message",
                            trigger: (id) => {
                                if (currentShow.message) message = currentShow.message
                                message.template = id
                                updateData(message, "message")
                            }
                        })
                        activePopup.set("select_template")
                    }}
                    style="overflow: hidden;"
                    bold={false}
                >
                    <div style="display: flex;align-items: center;padding: 0;">
                        <Icon id="templates" />
                        <p style="opacity: 1;font-size: 1em;">{$templates[(message.template ? message.template : outputShowSettings.messageTemplate) || "message"]?.name || "—"}</p>
                    </div>
                </Button>
                {#if message.template}
                    <Button
                        title={$dictionary.actions?.remove}
                        on:click={() => {
                            if (currentShow.message) message = currentShow.message
                            message.template = ""
                            updateData(message, "message")
                        }}
                        redHover
                    >
                        <Icon id="close" size={1.2} white />
                    </Button>
                {/if}
            </CombinedInput>
        {/if}
    </div>

    <!-- <h5><T id="meta.tags" /></h5>
    <div class="tags" style="display: flex;flex-direction: column;">
        <Tags />
    </div> -->
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

    /* .tags */
    .message,
    .styling {
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
