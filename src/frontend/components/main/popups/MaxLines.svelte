<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

    const lines = [0, 1, 2, 3, 4]

    let active = $popupData.active || 0

    function setValue(value: any) {
        if (!$popupData.trigger) return

        $popupData.trigger(value)

        let previousActive = JSON.stringify(active)
        active = value
        if (previousActive !== JSON.stringify(value)) return

        popupData.set({})
        activePopup.set(null)
    }
</script>

<div class="grid">
    {#each lines as line}
        {@const isActive = line === Number(active)}
        <Button outline={isActive} active={isActive} on:click={() => setValue(line)} bold={false}>
            <div class="lines">
                {#each { length: line ? line : 5 } as _}
                    <span class="line" style={line ? "" : "opacity: 0.6;"}></span>
                {/each}
            </div>

            <p>
                {#if line === 0}
                    <T id="settings.all_lines" />
                {:else}
                    {line}
                {/if}
            </p>
        </Button>
    {/each}
</div>

<CombinedInput>
    <p><T id="actions.custom_key" /></p>
    <NumberInput value={active} min={0} max={99} on:change={(e) => setValue(e.detail)} />
</CombinedInput>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
        padding: 15px 0;
    }

    .grid :global(button) {
        padding: 0.4em;
        flex-direction: column;
        gap: 5px;
        justify-content: center;
    }

    .lines {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 3px;

        width: 100px;
        aspect-ratio: 16/9;

        /* border: 3px solid black; */
        background: black;
        border-radius: 3px;

        /* padding-left: 0; */
        padding: 8px 4px;
    }

    .lines .line {
        height: 5px;
        width: 100%;

        background-color: white;
        /* border-radius: 1px; */
    }
</style>
