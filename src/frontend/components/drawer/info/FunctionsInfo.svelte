<script lang="ts">
    import { activePopup, activeTimers, drawerTabsData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import TimerInfo from "../timers/TimerInfo.svelte"

    $: type = $drawerTabsData.functions?.activeSubTab || ""
</script>

{#if type === "actions"}
    <div class="scroll" />

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
