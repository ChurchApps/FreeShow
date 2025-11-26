<script lang="ts">
    import { onMount } from "svelte"
    import { actionHistory, activeTimers, drawerTabsData } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import TimerInfo from "../timers/TimerInfo.svelte"

    $: type = $drawerTabsData.functions?.activeSubTab || ""

    let isMounted = false
    onMount(() => (isMounted = true))

    $: if ($actionHistory) historyUpdated()
    let updating: NodeJS.Timeout | null = null
    let updated = false
    function historyUpdated() {
        if (!isMounted) return
        updated = true
        if (updating) clearTimeout(updating)
        updating = setTimeout(() => (updated = false), 1000)
    }
</script>

{#if type === "actions"}
    <div class="scroll">
        {#if updated && $actionHistory.length}
            <p style="text-align: center;padding: 10px;">
                {$actionHistory[0].action[0].toUpperCase() + $actionHistory[0].action.slice(1).replaceAll("_", " ")}
                {#if $actionHistory[0].count > 1}<span style="opacity: 0.5;">({$actionHistory[0].count})</span>{/if}
            </p>
        {/if}
    </div>
{:else if type === "timer"}
    {#if $activeTimers.length}
        <TimerInfo />
    {/if}
{:else if type === "variables"}
    <!-- VARIABLE -->
{:else if type === "triggers"}
    <div class="scroll" style="padding: 10px;">
        <T id="tips.trigger" />
    </div>
{/if}

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
