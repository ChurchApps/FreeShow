<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { activeTimers } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    let allPaused = false
    $: if ($activeTimers?.length > 0) checkPaused()
    function checkPaused() {
        let playing = $activeTimers.filter((timer) => !timer.paused)
        if (playing.length === 0) allPaused = true
        else allPaused = false
    }

    function actionOnAllTimers(key, value) {
        activeTimers.update((a) => {
            return a.map((timer) => {
                timer[key] = value
                return timer
            })
        })
    }
</script>

<main>
    <Button on:click={() => actionOnAllTimers("paused", !allPaused)} center dark>
        <Icon id={allPaused ? "play" : "pause"} white={allPaused} size={1.2} right />
        {#key allPaused}
            <T id={allPaused ? "media.play" : "actions.pause_timers"} />
            <!-- <T id="media.{allPaused ? 'play' : 'pause'}" /> -->
        {/key}
    </Button>

    <Button
        on:click={() => {
            activeTimers.set([])
            send(OUTPUT, ["ACTIVE_TIMERS"], $activeTimers)
        }}
        center
        dark
    >
        <Icon id="stop" right />
        <T id="actions.stop_timers" />
    </Button>
</main>

<style>
    main {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
</style>
