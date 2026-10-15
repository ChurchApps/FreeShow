<script lang="ts">
    import { onMount } from "svelte"
    import { actionHistory, activeTimers, drawerTabsData } from "../../../stores"
    import { actionTimeouts, stopAllActionTimeouts } from "../../actions/actions"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import InteractionsInfo from "../pages/InteractionsInfo.svelte"
    import TimerInfo from "../timers/TimerInfo.svelte"
    import OBSInfo from "./OBSInfo.svelte"
    import ScenesInfo from "./ScenesInfo.svelte"

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

    {#if $actionTimeouts > 0}
        <Button on:click={stopAllActionTimeouts} center dark>
            <Icon id="stop" size={1.2} right />
            <T id="media.stop" />
            {#if $actionTimeouts > 1}
                <span style="opacity: 0.5;margin-left: 5px;">({$actionTimeouts})</span>
            {/if}
        </Button>
    {/if}
{:else if type === "timer"}
    {#if $activeTimers.length}
        <TimerInfo />
    {/if}
{:else if type === "variables"}
    <!-- VARIABLE -->
{:else if type === "scenes"}
    <ScenesInfo />
{:else if type === "interactions"}
    <InteractionsInfo />
{:else if type === "obs"}
    <OBSInfo />
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
