<script lang="ts">
    import { activeTimers, drawerTabsData } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import TimerInfo from "../timers/TimerInfo.svelte"

    $: type = $drawerTabsData.functions?.activeSubTab || ""
</script>

{#if type === "actions"}
    <!-- ACTIONS -->
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
