<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, activeTriggerFunction, popupData, scriptureSettings } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    let showVersion = !!$popupData.showVersion

    onMount(() => popupData.set({}))

    const isChecked = (e: any) => e.target.checked

    function update(id: string, value: any) {
        scriptureSettings.update((a) => {
            a[id] = value
            return a
        })
    }

    function createShow() {
        activeTriggerFunction.set("scripture_newShow_popup")
        activePopup.set(null)
    }
</script>

<CombinedInput>
    <p><T id="scripture.max_verses" /></p>
    <NumberInput value={$scriptureSettings.versesPerSlide} min={1} max={100} on:change={(e) => update("versesPerSlide", e.detail)} />
</CombinedInput>
{#if $scriptureSettings.showVerse}
    <CombinedInput>
        <p style="flex: 1;"><T id="scripture.split_reference" /></p>
        <div class="alignRight">
            <Checkbox disabled={$scriptureSettings.firstSlideReference} checked={$scriptureSettings.firstSlideReference ? false : $scriptureSettings.splitReference !== false} on:change={(e) => update("splitReference", isChecked(e))} />
        </div>
    </CombinedInput>
{/if}
{#if showVersion || $scriptureSettings.showVerse}
    <!-- {#if $scriptureSettings.firstSlideReference || !$scriptureSettings.combineWithText} -->
    <CombinedInput>
        <p style="flex: 1;"><T id="scripture.first_slide_reference" /></p>
        <div class="alignRight">
            <Checkbox checked={$scriptureSettings.firstSlideReference} on:change={(e) => update("firstSlideReference", isChecked(e))} />
        </div>
    </CombinedInput>
    <!-- {/if} -->
{/if}

<CombinedInput>
    <Button on:click={createShow} style="width: 100%;" dark center>
        <Icon id="slide" right />
        <T id="new.show_convert" />
    </Button>
</CombinedInput>

<style>
    .alignRight {
        flex: 0 !important;
        padding: 0 10px;
    }
</style>
