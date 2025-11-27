<script lang="ts">
    import { uid } from "uid"
    import type { OutData } from "../../../../types/Output"
    import type { Styles } from "../../../../types/Settings"
    import { activePage, activePopup, activeStyle, currentOutputSettings, outputs, popupData, settingsTab, styles } from "../../../stores"
    import Card from "../../drawer/Card.svelte"
    import { DEFAULT_ITEM_STYLE } from "../../edit/scripts/itemHelpers"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { getResolution } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Output from "../../output/Output.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Center from "../../system/Center.svelte"

    let outputStyles = sortByName(keysToID($styles))

    let active: string = $popupData.active || ""
    let outputId: string = $currentOutputSettings || ""
    let skip = !!$popupData.skip

    function select(selectedId: string) {
        active = selectedId

        if ($popupData.trigger) {
            $popupData.trigger(selectedId)
        }

        popupData.set({ id: "select_style", value: selectedId })

        setTimeout(() => {
            setTimeout(() => popupData.set({}), 500) // reset after closing
            activePopup.set(null)
        })
    }

    const outOverride: OutData = {
        slide: {
            id: "tempText",
            tempItems: [{ style: DEFAULT_ITEM_STYLE, lines: [] }]
        }
    }
    const text = "Lorem ipsum dolor sit amet,\nconsectetur adipiscing elit.\nDonec eget condimentum diam,\na sollicitudin lorem."
    function getOverride(style: Styles) {
        let override = clone(outOverride)
        const lines = text.split("\n").map(a => ({ align: "", text: [{ value: a, style: "" }] }))
        override.slide!.tempItems![0].lines = lines.slice(0, style.lines || 10)
        return override
    }

    $: outputData = $outputs[outputId]?.out

    function createNew() {
        const styleId = uid()
        history({ id: "UPDATE", newData: { data: { name: "" } }, oldData: { id: styleId }, location: { page: "settings", id: "settings_style" } })
        select(styleId)
        activeStyle.set(styleId)
        settingsTab.set("styles")
        activePage.set("settings")
    }
</script>

<MaterialButton class="popup-options" icon="add" iconSize={1.3} title="new.style" on:click={createNew} white />

<div style="position: relative;height: 100%;width: calc(100vw - (var(--navigation-width) + 20px) * 2);overflow-y: auto;">
    {#if outputStyles.length}
        <div class="grid">
            {#each outputStyles as style}
                {@const resolution = getResolution(null, null, false, outputId, style.id)}
                <Card width={25} active={active === style.id} label={style.name} {resolution} on:click={() => select(style.id)}>
                    <Output {outputId} style={getStyleResolution(resolution, resolution.width, resolution.height, "fit")} styleIdOverride={style.id} outOverride={outputData?.slide ? outputData : getOverride(style)} mirror />
                </Card>
            {/each}

            <!-- <Card label="Create new" icon="add" resolution={getResolution(null, null, false, outputId)} on:click={() => select("")} /> -->
        </div>
    {:else}
        <Center size={1.2} faded style="height: 100px;padding-top: 20px;">
            <T id="empty.general" />
        </Center>
    {/if}
</div>

{#if skip}
    <CombinedInput style="margin: 6px;margin-top: 10px;width: initial;">
        <Button style="width: 100%;" on:click={() => activePopup.set(null)} center dark>
            <Icon id="arrow_forward" right />
            <T id="guide.skip" />
        </Button>
    </CombinedInput>
{/if}

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
    }

    .grid :global(.main) {
        align-self: center;
    }
</style>
