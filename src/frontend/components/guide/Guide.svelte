<script lang="ts">
    import { fade } from "svelte/transition"
    import { guideActive, os } from "../../stores"
    import { wait } from "../../utils/common"
    import { translateText } from "../../utils/language"
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

        // Check if element is at the top of the screen (needs extra offset to avoid top bars)
        const isAtTop = bounds.y < 100
        const extraOffset = isAtTop ? 50 : 0

        // Account for platform-specific top bars
        // Mac: system menu bar (~30px outside window)
        // Windows: menu bar (25px inside window)
        const platformOffset = $os.platform === "darwin" ? 30 : $os.platform === "win32" ? 25 : 0
        const minTopPosition = 70 + platformOffset
        // Use less aggressive translateY to avoid top bars
        const baseTranslateY = $os.platform === "darwin" ? -50 : $os.platform === "win32" ? -60 : -70
        const translateY = baseTranslateY + extraOffset

        let top = ""
        if (bounds.y + bounds.height <= 25 + 40) {
            top = `top: ${bounds.y + bounds.height}px;`
            if ($os.platform === "win32") {
                const winTranslateY = isAtTop ? 25 : -25
                top += `transform: translateY(${winTranslateY}px);`
            } else if ($os.platform === "darwin") {
                top += `transform: translateY(${translateY}px);`
            }
        } else {
            // Override CSS translateY to prevent text box from going behind top bars
            if ($os.platform === "darwin" || $os.platform === "win32") {
                top = `transform: translateY(${translateY}px);`
            } else if (isAtTop) {
                // Apply extra offset for elements at top on Linux/other platforms
                top = `transform: translateY(${translateY}px);`
            }
        }

        currentStyle = `left: ${bounds.x}px;top: ${Math.max(top && top.includes("top:") ? 0 : minTopPosition, bounds.y)}px;width: ${bounds.width}px;height: ${bounds.height}px;`
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
                    <Button on:click={() => stepIndex--} title={translateText("media.previous")}>
                        <Icon id="back" size={1.5} white />
                    </Button>
                {/if}
                <Button on:click={() => (steps[stepIndex + 1] ? stepIndex++ : guideActive.set(false))} title={translateText(steps[stepIndex + 1] ? "media.next" : "actions.done")}>
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
        left: 0;
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
        left: 0;

        /* min-height: 100px;
        min-width: 100px;
        aspect-ratio: 1; */

        /* border-radius: 50%; */
        box-shadow: 0 0 0 8000px rgb(0 0 0 / 40%);

        transition: 0.8s all;

        border-radius: 2px;
    }

    .text {
        position: absolute;
        left: 0;
        top: 0;
        transform: translateY(-70px);

        /* max-width: 900px; */
        max-width: 100vw;
        width: max-content;

        background-color: rgb(0 0 0 / 70%);
        padding: 8px 12px;

        border-radius: 4px;
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

        border-radius: 4px;
    }
</style>
