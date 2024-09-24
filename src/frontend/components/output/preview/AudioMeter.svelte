<script lang="ts">
    import { activeDrawerTab, activePage, audioChannels, drawer } from "../../../stores"
    import { DEFAULT_DRAWER_HEIGHT } from "../../../utils/common"

    export let advanced: boolean = false
    // const numbers: number = 8
    const numbers: number[] = [-10, -15, -20, -25, -30, -50, -70, -85, -100]

    function getDBValue(dB: any, side: "left" | "right") {
        if (!dB) return 0

        let value: number = dB.value[side]
        const max: number = dB.max
        const min: number = dB.min

        if (value > max) value = max
        if (value < min) value = min

        let percentage = (value - min) / (max - min)
        percentage = 1 - transformRange(1 - percentage)

        return percentage * 100
    }

    const newRange = 1 - 0.4 // %
    const threshold = 1 - 0.78 // bottom X% will be compressed into new range
    const compressionFactor = threshold / newRange
    const expansionFactor = (1 - newRange) / (1 - threshold)

    function transformRange(value) {
        if (value <= threshold) {
            return value / compressionFactor
        } else {
            return newRange + (value - threshold) * expansionFactor
        }
    }

    // function getDBFromPercentage(percentage: number) {
    //     const dB = $audioChannels.dB

    //     const max: number = dB?.max ?? -10
    //     const min: number = dB?.min ?? -100

    //     percentage = 1 - transformRange(percentage)
    //     return (max - min) * percentage + min
    // }

    function getPercentageFromDB(dB: number) {
        const max: number = $audioChannels.dB?.max ?? -10
        const min: number = $audioChannels.dB?.min ?? -100

        // invert
        // dB = max + min - dB
        let percentage = (dB - min) / (max - min)
        percentage = 1 - percentage
        console.log(dB, percentage, transformRange(percentage))
        return transformRange(percentage) * 100

        // const percentage = 1 - transformRange(percentage)
        // return (max - min) * percentage + min

        // (transformRange(1 - 1 / (i * -1))) * 100
    }

    function openAudioMix() {
        activePage.set("show")
        activeDrawerTab.set("audio")

        const minHeight = 40
        if ($drawer.height <= minHeight) drawer.set({ height: $drawer.stored || DEFAULT_DRAWER_HEIGHT, stored: null })
    }
</script>

{#if advanced}
    <div class="main advanced">
        <!-- WIP volume dots!!! instead of transition.. -->
        <span class="left">
            <div style="height: {100 - getDBValue($audioChannels.dB, 'left')}%" />
        </span>
        <span class="right">
            <div style="height: {100 - getDBValue($audioChannels.dB, 'right')}%" />
        </span>

        <!-- <div class="lines">
            {#each { length: numbers } as _, i}
                {@const hide = i === 0 || i + 1 === numbers}
                <p class="line" class:hide>-</p>
            {/each}
        </div> -->
        <!-- <div class="lines" style="padding: 0 5px;">
            {#each { length: numbers } as _, i}
                {@const hide = i === 0 || i + 1 === numbers}
                <p class:hide class:start={i === 0} class:end={i + 1 === numbers}>{i + 1 === numbers ? "-∞" : Math.round(getDBFromPercentage(i / (numbers - 1)))}</p>
            {/each}
        </div> -->
        <div class="lines" style="padding: 0 5px;">
            {#each numbers as i}
                <p class="absolute" style="top: {getPercentageFromDB(i)}%;" class:start={i === numbers[0]} class:end={i === numbers[numbers.length - 1]}>{i <= -100 ? "-∞" : i}</p>
            {/each}
        </div>
    </div>
{:else}
    <div class="main" on:click={openAudioMix}>
        <!-- <span class="left">
            <div style="height: {100 - ($audioChannels.volume?.left || 0)}%" />
        </span>
        <span class="right">
            <div style="height: {100 - ($audioChannels.volume?.right || 0)}%" />
        </span> -->
        <span class="left">
            <div style="height: {100 - getDBValue($audioChannels.dB, 'left')}%" />
        </span>
        <span class="right">
            <div style="height: {100 - getDBValue($audioChannels.dB, 'right')}%" />
        </span>
    </div>
{/if}

<style>
    .main {
        width: 6px;
        display: flex;
    }

    .main.advanced {
        width: 48px;
    }
    .lines {
        position: relative;

        display: flex;
        flex-direction: column;
        /* justify-content: space-between; */

        text-align: center;
        opacity: 0.8;

        background: var(--primary-lighter);
    }
    /* .lines .line {
        opacity: 0.4;
        margin: 0 3px;
    } */

    /* .lines .hide {
        opacity: 0;
        / * line-height: 0; * /
    } */

    .lines p {
        display: flex;
        align-items: center;
        flex: 2;

        font-size: 0.8em;
    }
    /* .lines p.hide {
        flex: 1;
    } */

    .absolute {
        position: absolute;
        top: 0;
        left: 5px;
        transform: translateY(-50%);
    }

    .lines p.start,
    .lines p.end {
        position: initial;
        transform: none;
    }

    .lines p.start {
        align-items: start;
        padding-top: 2px;
    }
    .lines p.end {
        align-items: end;
        padding-bottom: 2px;
    }

    span {
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 220, 0) 16%, rgb(0, 220, 0) 45%, rgb(0, 120, 0) 100%); */
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(200, 100, 0) 16%, rgb(0, 255, 120) 45%, rgb(0, 120, 200) 100%); */
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 200, 0) 16%, rgb(0, 255, 50) 45%, rgb(0, 200, 150) 100%); */
        background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 200, 0) 16%, rgb(0, 255, 50) 45%, rgb(0, 200, 200) 100%);
        width: 50%;
    }

    span div {
        transition: height 0.05s ease 0s;
        /* background-color: transparent; */
        background-color: var(--primary-darker);
        width: 100%;
    }
</style>
