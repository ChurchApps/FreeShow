<script lang="ts">
    import { metronome, metronomeTimer } from "../../../stores"

    export let isItem: boolean = false

    $: data = $metronome
    $: values = $metronomeTimer

    $: beat = values.beat || 0
    $: beats = data?.beats || 4

    const beatsPerSecond = 60 / (data?.tempo || 120)

    $: timeUntilNext = values.timeToNext || 0 // seconds
    $: nextTime = timeUntilNext + beatsPerSecond - preScheduleTime
    const preScheduleTime = 0.1
</script>

<section class:isItem>
    <div class="beats">
        {#each Array.from({ length: beats }) as _, currentBeat}
            <div class="bar" class:active={beat === currentBeat + 1}>
                {currentBeat + 1}
            </div>
        {/each}
    </div>

    <div class="overflow">
        <div class="bar" style="margin-top: 5px;">
            <div class="indicator" style="transition-duration: {nextTime}s; transform: translateX({(beat % 2 === 1 ? -1 : 1) * 50}%);">
                <div class="dot" class:big={beat === 1}></div>
            </div>
        </div>
    </div>
</section>

<style>
    section.isItem {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        width: 100%;
        height: 100%;

        text-shadow: none;
    }

    .beats {
        display: flex;
        gap: 5px;
        justify-content: center;
        align-items: center;
        padding: 5px 0;

        width: 100%;
    }

    .beats .bar {
        flex: 1;

        width: 30px;
        height: 30px;

        border-radius: 4px;
        border: 2px solid var(--primary);

        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: bold;
        color: var(--text);
        transition:
            background-color 0.2s,
            color 0.2s;
    }
    .beats .bar.active {
        background-color: var(--primary);

        /* background-color: var(--secondary);
        color: var(--secondary-text); */
    }

    section.isItem .beats .bar {
        height: 80px;
        font-size: 0.7em;
    }

    /* BAR */

    .overflow {
        height: 20px;
        overflow: hidden;
        width: 100%;
    }

    .bar {
        width: 100%;
        height: 12px;
        position: relative;
        background-color: var(--primary-darkest);
        border-radius: 20px;

        padding: 0 10px;
    }

    .indicator {
        width: 100%;
        height: inherit;
        position: relative;
    }
    .indicator .dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: var(--text);
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        transition:
            transform 0.2s ease-in-out,
            width 0.1s,
            height 0.1s,
            background-color 0.3s;
    }
    .indicator .dot.big {
        width: 18px;
        height: 18px;

        background-color: var(--secondary);
    }

    section.isItem .overflow {
        height: 28px;
    }
    section.isItem .bar {
        height: 20px;
    }
    section.isItem .indicator .dot {
        width: 20px;
        height: 20px;
    }
    section.isItem .indicator .dot.big {
        width: 28px;
        height: 28px;
    }
</style>
