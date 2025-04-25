<script lang="ts">
    import { fade } from "svelte/transition"
    import { dictionary, guideActive, os } from "../../stores"
    import { wait } from "../../utils/common"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import { guideSteps } from "./guideSteps"

    let steps = guideSteps
    $: active = $guideActive

    let stepIndex = 0
    $: if (active) init()
    function init() {
        stepIndex = 0
        currentStyle = ""
    }

    $: currentStep = steps[stepIndex]
    $: if (active && currentStep) findElementPos(currentStep)

    let currentStyle = ""
    let currentTextStyle = ""
    let flip = false
    async function findElementPos({ pre, query, timeout = 10 }: { pre?: () => void; query: string; timeout?: number }) {
        if (pre) pre()
        let timeIndex = stepIndex
        await wait(timeout)
        if (timeIndex !== stepIndex) return

        let elem = document.querySelector(query)
        if (!elem) {
            console.log("Could not find element for step", stepIndex)
            stepIndex++
            return
        }

        const bounds = elem.getBoundingClientRect()
        const width = window.innerWidth
        flip = bounds.x > width * 0.7

        let top = ""
        if (bounds.y + bounds.height <= 25 + 40) top = `top: ${bounds.y + bounds.height}px;` + ($os.platform === "win32" ? "transform: translateY(-25px);" : "")

        currentStyle = `inset-inline-start: ${bounds.x}px;top: ${Math.max(top ? 0 : 70, bounds.y)}px;width: ${bounds.width}px;height: ${bounds.height}px;`
        if (flip) currentTextStyle = `max-width: ${bounds.right}px;${top}`
        else currentTextStyle = `max-width: ${width - bounds.left}px;${top}`
    }

    function mousedown(e: any) {
        if (!active || e.target.closest("#guideButtons")) return

        stepIndex++
    }

    function keydown(e: KeyboardEvent) {
        if (!active) return

        if (e.key === "Escape") {
            guideActive.set(false)
        } else if (e.key === "ArrowRight") {
            if (steps[stepIndex + 1]) stepIndex++
            else guideActive.set(false)
        } else if (e.key === "ArrowLeft") {
            if (stepIndex === 0) guideActive.set(false)
            else if (steps[stepIndex + 1]) stepIndex--
        }
    }
</script>

<svelte:window on:mousedown={mousedown} on:keydown={keydown} />

{#if active}
    {#if currentStep && currentStyle}
        <div class="guide" transition:fade>
            <div class="focus" style={currentStyle}>
                <div class="text" style={currentTextStyle} class:flip>
                    <p style="font-size: 1.5em;font-weight: 600;">
                        {#key currentStep.title}
                            <T id={currentStep.title} />
                        {/key}
                    </p>
                    <!-- style="white-space: normal;" -->
                    {#if currentStep.description}
                        <p><T id={currentStep.description} /></p>
                    {/if}
                </div>
            </div>

            <div id="guideButtons">
                {#if stepIndex === 0}
                    <Button on:click={() => guideActive.set(false)}>
                        <T id="guide.skip" />
                    </Button>
                {:else if steps[stepIndex + 1]}
                    <Button on:click={() => stepIndex--} title={$dictionary.media?.previous}>
                        <Icon id="back" size={1.5} white />
                    </Button>
                {/if}
                <Button on:click={() => (steps[stepIndex + 1] ? stepIndex++ : guideActive.set(false))} title={steps[stepIndex + 1] ? $dictionary.media?.next : $dictionary.actions?.done}>
                    <Icon id={steps[stepIndex + 1] ? "arrow_forward" : "check"} size={1.5} white={!!steps[stepIndex + 1]} />
                </Button>
            </div>
        </div>
    {/if}
{/if}

<style>
    .guide {
        position: absolute;
        width: 100%;
        height: 100%;
        inset-inline-start: 0;
        top: 0;

        overflow: hidden;
        z-index: 5999;

        /* pointer-events: none; */

        /* color: #eee; */
        color: var(--text);
    }

    .focus {
        position: absolute;
        top: 0;
        inset-inline-start: 0;

        /* min-height: 100px;
        min-width: 100px;
        aspect-ratio: 1; */

        /* border-radius: 50%; */
        box-shadow: 0 0 0 8000px rgb(0 0 0 / 40%);

        transition: 0.8s all;
    }

    .text {
        position: absolute;
        inset-inline-start: 0;
        top: 0;
        transform: translateY(-70px);

        /* max-width: 900px; */
        max-width: 100vw;
        width: max-content;

        background-color: rgb(0 0 0 / 70%);
        padding: 8px 12px;
    }
    .text.flip {
        inset-inline-start: initial;
        inset-inline-end: 0;
    }
    .text p {
        white-space: normal;
    }

    #guideButtons {
        position: absolute;
        bottom: 20px;
        inset-inline-end: 20px;

        display: flex;
        gap: 10px;

        background-color: rgb(0 0 0 / 70%);
        padding: 10px;

        pointer-events: initial;
    }
</style>
