<script lang="ts">
    import type { List } from "../../../../types/Show"
    import { transitionData } from "../../../stores"
    import { custom } from "../../../utils/transitions"

    export let list: List = { items: [] }
    export let disableTransition = false

    let currentItem = 0
    $: if (list.interval) startInterval()
    let timeout: NodeJS.Timeout | null = null
    function startInterval() {
        if (timeout) return

        timeout = setTimeout(
            () => {
                currentItem++
                if (currentItem >= list.items.length) currentItem = 0

                timeout = null
                if (list.interval) startInterval()
            },
            (list.interval || 1) * 1000
        )
    }

    $: transition = disableTransition ? { type: "none" } : $transitionData.text
</script>

<ul style="list-style{list.style?.includes('disclosure') ? '-type:' : ': inside'} {list.style || 'disc'};">
    {#each list.items as item, i}
        {#if list.interval}
            {#if currentItem === i}
                <!-- svelte transition bug, can't change menus without -->
                {#if transition.type === "none"}
                    <div class="center">
                        <span>{@html item.text}</span>
                    </div>
                {:else}
                    <div class="center" transition:custom={transition}>
                        <span>{@html item.text}</span>
                    </div>
                {/if}
            {/if}
        {:else}
            <li>
                <div style="display: inline-flex;">
                    <span>{@html item.text}</span>
                </div>
            </li>
        {/if}
    {/each}
</ul>

<style>
    ul {
        list-style-position: inside;
        padding: 10px 0;

        overflow-y: hidden;
        height: 100%;
    }

    li {
        padding: 2px 10px;
    }

    .center {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
