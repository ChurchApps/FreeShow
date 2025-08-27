<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, popupData, scriptureSettings } from "../../../stores"
    import { triggerFunction } from "../../../utils/common"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let showVersion = !!$popupData.showVersion

    onMount(() => popupData.set({}))

    function update(id: string, value: any) {
        scriptureSettings.update((a) => {
            a[id] = value
            return a
        })
    }

    function createShow() {
        triggerFunction("scripture_newShow_popup")
        activePopup.set(null)
    }
</script>

<MaterialNumberInput label="scripture.max_verses" value={$scriptureSettings.versesPerSlide} min={1} max={100} on:change={(e) => update("versesPerSlide", e.detail)} />

{#if $scriptureSettings.showVerse}
    <MaterialToggleSwitch
        label="scripture.split_reference"
        disabled={$scriptureSettings.firstSlideReference}
        checked={$scriptureSettings.firstSlideReference ? false : $scriptureSettings.splitReference !== false}
        defaultValue={true}
        on:change={(e) => update("splitReference", e.detail)}
    />
{/if}
{#if showVersion || $scriptureSettings.showVerse}
    <!-- {#if $scriptureSettings.firstSlideReference || !$scriptureSettings.combineWithText} -->
    <MaterialToggleSwitch label="scripture.first_slide_reference" checked={$scriptureSettings.firstSlideReference} defaultValue={false} on:change={(e) => update("firstSlideReference", e.detail)} />
    <!-- {/if} -->
{/if}

<MaterialButton variant="contained" style="margin-top: 20px;" icon="add" on:click={createShow}>
    <T id="new.show_convert" />
</MaterialButton>
