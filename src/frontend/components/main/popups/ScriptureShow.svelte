<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, popupData, scriptureSettings } from "../../../stores"
    import { createScriptureShow } from "../../drawer/bible/scripture"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let showVersion = !!$popupData.showVersion
    let create = !!$popupData.create

    onMount(() => popupData.set({}))

    function update(id: string, value: any) {
        scriptureSettings.update(a => {
            a[id] = value
            return a
        })
    }

    function createShow() {
        createScriptureShow()
        activePopup.set(null)
    }
</script>

<MaterialNumberInput label="scripture.max_verses" value={$scriptureSettings.versesPerSlide} defaultValue={3} min={1} max={100} on:change={e => update("versesPerSlide", e.detail)} hideWhenZero />

{#if $scriptureSettings.showVerse}
    <MaterialToggleSwitch label="scripture.split_reference" disabled={$scriptureSettings.firstSlideReference} checked={$scriptureSettings.firstSlideReference ? false : $scriptureSettings.splitReference !== false} defaultValue={true} on:change={e => update("splitReference", e.detail)} />
{/if}
{#if showVersion || $scriptureSettings.showVerse}
    <!-- {#if $scriptureSettings.firstSlideReference || !$scriptureSettings.combineWithText} -->
    <MaterialToggleSwitch label="scripture.first_slide_reference" checked={$scriptureSettings.firstSlideReference} defaultValue={false} on:change={e => update("firstSlideReference", e.detail)} />
    <!-- {/if} -->
{/if}

{#if create}
    <MaterialButton variant="contained" style="margin-top: 20px;" icon="add" on:click={createShow}>
        <T id="new.show_convert" />
    </MaterialButton>
{/if}
