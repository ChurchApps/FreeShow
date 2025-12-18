<script lang="ts">
    import { onMount } from "svelte"
    import { activePage, activeShow, customMetadata, dictionary, outputs, settingsTab, shows, showsCache, styles, templates } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { history } from "../../helpers/history"
    import { getActiveOutputs } from "../../helpers/output"
    import { getCustomMetadata, initializeMetadata, metadataDisplayValues } from "../../helpers/show"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialTextarea from "../../inputs/MaterialTextarea.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    $: currentShow = $showsCache[$activeShow!.id]
    $: meta = currentShow.meta
    let values: { [key: string]: string } = {}
    let message: any = {}
    let metadata: any = {}
    let outputShowSettings: any = {}

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
    }

    const changeValue = (value: string, key: string) => {
        values[key] = value
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

    function updateMetadata(e: any, key: string) {
        metadata[key] = e.detail
        updateData(metadata, "metadata")
    }

    function updateMessageTemplate(e: any) {
        if (currentShow.message) message = currentShow.message
        message.template = e.detail
        updateData(message, "message")
    }

    function updateData(data, key) {
        let override = "show#" + ($activeShow?.id || "") + "_" + key
        history({ id: "UPDATE", newData: { data, key }, oldData: { id: $activeShow?.id || "" }, location: { page: "show", id: "show_key", override } })
    }

    // AUTOFILL

    const autofillValues = {
        // get only numbers at the start or end
        number: () => values.number || currentShow.name.match(/^\d+/)?.[0] || currentShow.name.match(/\d+$/)?.[0],
        // remove numbers
        title: () => currentShow.name.replace(/[0-9\-.,!:;]/g, "").trim()
    }

    $: metadataDisplay = metadata.display || "never"
    // $: metadataDisplay = (metadata.display ? metadata.display : outputShowSettings.displayMetadata) || "never"

    function editMetadataStyle() {
        activePage.set("settings")
        settingsTab.set("styles")
        // scroll to bottom
        setTimeout(() => {
            document.querySelector(".row")?.querySelector(".center")?.querySelector(".scroll")?.scrollTo(0, 1000)
        }, 50)
    }
</script>

<section>
    <div class="context #metadata_tools" style="padding: 10px;">
        {#each Object.entries(values) as [key, value]}
            {@const isDefault = !!$dictionary.meta?.[key]}
            {@const label = isDefault ? translateText(`meta.${key}`) : `<span style="text-transform: capitalize;">${key}</span>`}
            {@const shouldAutofill = (!value || (key === "number" && !currentShow?.quickAccess?.number)) && (autofillValues[key]?.() || (key === "number" && value))}
            {@const autofillValue = shouldAutofill ? autofillValues[key]?.() || "" : ""}
            {@const numberStored = key === "number" && currentShow?.quickAccess?.number}

            <MaterialTextInput {label} style={numberStored ? "border-bottom: 1px solid var(--secondary);" : ""} {value} autofill={autofillValue} on:change={(e) => changeValue(e.detail, key)} />
        {/each}
    </div>

    <!-- message -->
    <HRule title="meta.message" />
    <div style="padding: 10px;">
        <MaterialTextarea label="meta.message_tip" class="context #meta_message" value={message.text || ""} rows={2} on:change={(e) => updateData({ ...message, text: e.detail }, "message")} />
    </div>

    <!-- styling -->
    <HRule title="edit.style" />
    <div style="padding: 10px;">
        <InputRow>
            <MaterialToggleSwitch label="meta.override_output" checked={metadata.override || false} defaultValue={false} style="width: 100%;" on:change={(e) => updateMetadata(e, "override")} />
            {#if !metadata.override}
                <MaterialButton icon="edit" title="menu.edit" on:click={editMetadataStyle} />
            {/if}
        </InputRow>

        {#if metadata.override}
            <MaterialPopupButton label="meta.display_metadata" value={metadataDisplay} defaultValue="never" name={metadataDisplayValues.find((a) => a.id === metadataDisplay)?.name || ""} popupId="metadata_display" icon="info" on:change={(e) => updateMetadata(e, "display")} />

            {#if metadataDisplay !== "never"}
                <MaterialPopupButton label="meta.meta_template" value={(metadata.template ? metadata.template : outputShowSettings.metadataTemplate) || "metadata"} defaultValue="metadata" name={$templates[(metadata.template ? metadata.template : outputShowSettings.metadataTemplate) || "metadata"]?.name} popupId="select_template" icon="templates" on:change={(e) => updateMetadata(e, "template")} />
            {/if}

            <MaterialPopupButton label="meta.message_template" value={(message.template ? message.template : outputShowSettings.messageTemplate) || "message"} defaultValue="message" name={$templates[(message.template ? message.template : outputShowSettings.messageTemplate) || "message"]?.name} popupId="select_template" icon="templates" on:change={updateMessageTemplate} />
        {/if}
    </div>

    <!-- <h5><T id="meta.tags" /></h5>
    <div class="tags" style="display: flex;flex-direction: column;">
        <Tags />
    </div> -->
</section>

<style>
    section {
        height: 100%;
        width: 100%;

        display: flex;
        flex-direction: column;
    }

    section :global(.title) {
        margin: 5px 0;
    }
</style>
