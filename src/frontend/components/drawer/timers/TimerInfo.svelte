<script lang="ts">
    import { activeTimers } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    let allPaused = false
    $: if ($activeTimers?.length > 1) checkPaused()
    function checkPaused() {
        let playing = $activeTimers.filter(timer => !timer.paused)
        if (playing.length === 0) allPaused = true
        else allPaused = false
    }

    function actionOnAllTimers(key, value) {
        activeTimers.update(a => {
            return a.map(timer => {
                timer[key] = value
                return timer
            })
        })
    }
</script>

<main>
    {#if $activeTimers?.length > 1}
        <Button on:click={() => actionOnAllTimers("paused", !allPaused)} center dark>
            <Icon id={allPaused ? "play" : "pause"} white={allPaused} size={1.2} right />
            {#key allPaused}
                <T id={allPaused ? "media.play" : "actions.pause_timers"} />
                <!-- <T id="media.{allPaused ? 'play' : 'pause'}" /> -->
            {/key}
        </Button>
    {/if}
</main>

<style>
    main {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
</style>
