<script lang="ts">
    import { onMount } from "svelte"
    import { activeShow, customMetadata, dictionary, shows, showsCache } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { history } from "../../helpers/history"
    import { getCustomMetadata, initializeMetadata } from "../../helpers/show"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Tip from "../../main/Tip.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"

    $: currentShow = $showsCache[$activeShow!.id]
    $: meta = currentShow.meta
    let values: { [key: string]: string } = {}

    onMount(getValues)
    $: if ($activeShow!.id || $customMetadata) getValues()

    function getValues() {
        values = getCustomMetadata()

        const defaultKeys = Object.keys(initializeMetadata({}))
        Object.entries(meta).forEach(([key, value]) => {
            if (!value && defaultKeys.includes(key) && $customMetadata.disabled?.includes(key)) return
            values[key] = value
        })
    }

    // duration = quickaccess only
    // number = quickaccess & metadata
    // CCLI = quickaccess (metadata) & metadata
    // others = metadata only
    const changeValue = (value: string, key: string) => {
        if (key === "duration") {
            setQuickAccess(key, value)
            return
        }

        values[key] = value
        updateData(values, "meta")

        if (key === "number") setQuickAccess(key, value)
        else if (key === "CCLI") setQuickAccess(key, value, true)
    }

    function setQuickAccess(key: string, value: string | number, asMetadata = false) {
        let quickAccess = $showsCache[$activeShow!.id].quickAccess || {}

        if (asMetadata) {
            if (!quickAccess.metadata) quickAccess.metadata = {}
            quickAccess.metadata[key] = value
        } else {
            quickAccess[key] = value
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

        <!-- not visible as metadata (only in project) -->
        <MaterialNumberInput label="transition.duration (s)" value={currentShow?.quickAccess?.duration} on:change={(e) => changeValue(e.detail, "duration")} hideWhenZero />
    </div>

    <Tip value="tips.display_metadata" style="margin: 0 10px;" bottom={10} />

    <!-- <h5><T id="meta.tags" /></h5>
    <div class="tags" style="display: flex;flex-direction: column;">
        <Tags />
    </div> -->
</section>

<style>
    section {
        display: flex;
        flex-direction: column;
    }

    section :global(.title) {
        margin: 5px 0;
    }
</style>
