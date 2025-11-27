<script lang="ts">
    import { onMount } from "svelte"
    import { activeEdit, activePopup, effects } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Card from "../../drawer/Card.svelte"
    import Effect from "../../output/effects/Effect.svelte"
    import { effectItems } from "../../output/effects/effectItems"

    const effectId = $activeEdit?.id || ""

    function selectEffect(data: any) {
        effects.update(a => {
            a[effectId].items.push(data)
            return a
        })

        activePopup.set(null)
    }

    let slowLoader = 0
    onMount(() => {
        const loader = setInterval(() => {
            slowLoader++
            if (slowLoader > Object.keys(effectItems).length + 1) clearInterval(loader)
        })
    })
</script>

<div style="position: relative;height: 100%;width: calc(100vw - (var(--navigation-width) + 20px) * 2);overflow-y: auto;">
    <div class="grid">
        {#each Object.keys(effectItems) as type, i}
            {@const data = { type, ...effectItems[type].default }}

            <Card label={translateText(`effect.${effectItems[type].default?.type || type}`)} width={100 / 4} on:click={() => selectEffect(data)} checkered>
                {#if slowLoader > i}
                    <Effect effect={{ name: "", style: "", background: "", color: null, items: [data] }} preview />
                {/if}
            </Card>
        {/each}
    </div>

    <!-- WIP custom ones -->
</div>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
    }
</style>
