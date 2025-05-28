<script lang="ts">
    import { onMount } from "svelte"
    import { actionHistory, actions, activePopup, activeTimers, drawerTabsData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
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

    {#if Object.keys($actions).length}
        <Button style="width: 100%;" on:click={() => activePopup.set("action_history")} center dark>
            <Icon id="history" right />
            <T id="popup.action_history" />
        </Button>
    {/if}
    <Button style="width: 100%;" on:click={() => activePopup.set("manage_emitters")} center dark>
        <Icon id="emitter" right />
        <T id="popup.manage_emitters" />
    </Button>
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
{:else if type === "effects"}
    <!-- EFFECTS -->
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
