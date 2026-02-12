<script lang="ts">
    import { onMount } from "svelte"
    import { activeShow, customMetadata, dictionary, shows, showsCache } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { history } from "../../helpers/history"
    import { getCustomMetadata, initializeMetadata } from "../../helpers/show"
    import HRule from "../../input/HRule.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialTextarea from "../../inputs/MaterialTextarea.svelte"

    $: currentShow = $showsCache[$activeShow!.id]
    $: meta = currentShow.meta
    let values: { [key: string]: string } = {}
    let message: any = {}

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

        message = currentShow.message || {}
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

    <!-- WIP how to enable tip -->

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
