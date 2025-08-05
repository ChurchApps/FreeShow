<script lang="ts">
    import type { StageLayout } from "../../../types/Stage"
    import Center from "../../common/components/Center.svelte"
    import Icon from "../../common/components/Icon.svelte"
    import autosize from "../../common/util/autosize"
    import { keysToID, sortByName } from "../../common/util/helpers"
    import { getStyles } from "../../common/util/style"
    import Clock from "../items/Clock.svelte"
    import SlideNotes from "../items/SlideNotes.svelte"
    import SlideProgress from "../items/SlideProgress.svelte"
    import SlideText from "../items/SlideText.svelte"
    import VideoTime from "../items/VideoTime.svelte"
    import { activeTimers, background, output, outputSlideCache, progressData, showsCache, stream, timers, variables } from "../util/stores"
    import MediaOutput from "./MediaOutput.svelte"
    import PreviewCanvas from "./PreviewCanvas.svelte"
    import Textbox from "./Textbox.svelte"
    import Timer from "./Timer.svelte"
    import Variable from "./Variable.svelte"

    export let stageLayout: StageLayout
    export let id: string
    export let item: any // Item | StageItem
    
    // Add condition checking
    function checkConditions(item: any): boolean {
        // Try to get conditions from stageShows store like frontend does
        let conditions = null
        if (stageLayout?.showId && $showsCache[stageLayout.showId]) {
            const currentShow = $showsCache[stageLayout.showId]
            
            // Find the stage layout that matches our current layout
            if (currentShow.layouts && stageLayout.id) {
                const stageLayoutData = currentShow.layouts[stageLayout.id]
                
                if (stageLayoutData && stageLayoutData.items) {
                    const itemData = stageLayoutData.items.find((layoutItem: any) => {
                        return layoutItem.id === item.id || 
                               (layoutItem.type === item.type && layoutItem.name === item.name)
                    })
                    
                    if (itemData && itemData.conditions) {
                        conditions = itemData.conditions
                    }
                }
            }
        }
        
        // Get conditionValue from the same source
        let conditionValue = "all" // default
        if (stageLayout?.showId && $showsCache[stageLayout.showId]) {
            const currentShow = $showsCache[stageLayout.showId]
            if (currentShow.layouts && stageLayout.id) {
                const stageLayoutData = currentShow.layouts[stageLayout.id]
                if (stageLayoutData && stageLayoutData.items) {
                    const itemData = stageLayoutData.items.find((layoutItem: any) => {
                        return layoutItem.id === item.id || 
                               (layoutItem.type === item.type && layoutItem.name === item.name)
                    })
                    if (itemData && itemData.conditionValue) {
                        conditionValue = itemData.conditionValue
                    }
                }
            }
        }
        
        if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
            return true
        }

        const isAllScenario = conditionValue === "all"
        
        for (const condition of conditions) {
            const isMatch = isConditionMet(condition)
            
            if (isAllScenario) {
                // ALL scenario: if any condition fails, item is not visible
                if (!isMatch) {
                    return false
                }
            } else {
                // ANY scenario: if any condition passes, item is visible
                if (isMatch) {
                    return true
                }
            }
        }
        
        // ALL scenario: all conditions passed
        // ANY scenario: no conditions passed
        return isAllScenario
    }

    function isConditionMet(condition: any): boolean {
        if (!condition) return true

        const conditionValues: boolean[] = condition.values.map((cVal: any) => {
            const element = cVal.element || "text"
            let elementId = cVal.elementId || ""
            if (element === "timer" && !elementId) elementId = getFirstActiveTimer()

            let operator = cVal.operator || "is"
            if (element === "timer") operator = cVal.operator || "isRunning"

            const data = cVal.data || "value"
            let dataValue: string | number = cVal.value ?? ""
            if (data === "seconds") dataValue = (cVal.seconds || 0).toString()

            let value = ""
            if (element === "text") {
                // For text elements, we could check the actual text content of the item
                // For now, return empty string (text conditions may need specific implementation)
                value = item?.text || item?.content || ""
            }
            else if (element === "timer") value = getTimerValue(elementId)
            else if (element === "variable") value = getVariableValue(elementId)
            else if (element === "dynamicValue") value = getDynamicValue(elementId)

            if (operator === "is") {
                const valueLower = value.toLowerCase()
                const dataValueLower = dataValue.toString().toLowerCase()
                return valueLower === dataValueLower
            } else if (operator === "isNot") {
                const valueLower = value.toLowerCase()
                const dataValueLower = dataValue.toString().toLowerCase()
                return valueLower !== dataValueLower
            } else if (operator === "has") {
                const valueLower = value.toLowerCase()
                const dataValueLower = dataValue.toString().toLowerCase()
                return valueLower.includes(dataValueLower)
            } else if (operator === "hasNot") {
                const valueLower = value.toLowerCase()
                const dataValueLower = dataValue.toString().toLowerCase()
                return !valueLower.includes(dataValueLower)
            } else if (operator === "isRunning") {
                if (element === "timer") return isTimerRunning(elementId)
            } else if (operator === "isAbove") {
                return Number(value) > Number(dataValue)
            } else if (operator === "isBelow") {
                return Number(value) < Number(dataValue)
            }

            return true
        })

        const scenario = condition.scenario || "all"
        const filteredValues = [...new Set(conditionValues)]

        if (scenario === "all") {
            return filteredValues.length === 1 && filteredValues[0] === true
        } else if (scenario === "some") {
            return filteredValues.includes(true)
        } else if (scenario === "none") {
            return filteredValues.length === 1 && filteredValues[0] === false
        }

        return true
    }

    function getFirstActiveTimer(): string {
        let firstTimerId = $activeTimers[0]?.id
        if (!firstTimerId) firstTimerId = sortByName(keysToID($timers)).find((timer) => timer.type !== "counter")?.id || ""
        return firstTimerId
    }

    function getTimerValue(timerId: string): string {
        const timer = $timers[timerId]
        if (!timer) return "0"
        // TODO: implement proper timer value calculation
        return "0"
    }

    function getVariableValue(variableId: string): string {
        const variable = $variables[variableId]
        if (!variable) return ""
        return variable.value?.toString() || ""
    }

    function isTimerRunning(timerId: string): boolean {
        const timer = $timers[timerId]
        if (!timer) return false
        // Check if timer is in activeTimers
        return $activeTimers.some(activeTimer => activeTimer.id === timerId)
    }

    function getDynamicValue(elementId: string): string {
        // Handle different dynamic value types
        if (elementId.startsWith("meta_")) {
            const metaKey = elementId.substring(5) // Remove "meta_" prefix
            // For server-side, we need to access the show data through the stageLayout parameter
            if (stageLayout && stageLayout.showId) {
                const currentShow = $showsCache[stageLayout.showId]
                if (currentShow && currentShow.meta) {
                    // Case-insensitive search for meta key
                    const actualKey = Object.keys(currentShow.meta).find(key => key.toLowerCase() === metaKey.toLowerCase())
                    if (actualKey) {
                        return currentShow.meta[actualKey].toString()
                    }
                }
            }
        }
        // Add other dynamic value types as needed
        return ""
    }
    
    let isItemVisible: boolean = true
    let isHidden: boolean = false
    
    $: isItemVisible = checkConditions(item)
    $: isHidden = !isItemVisible || isDisabledVariable

    $: currentOutput = $output
    $: currentSlide = currentOutput?.out?.slide || (slideOffset !== 0 ? $outputSlideCache[currentOutput?.id || ""] || null : null)

    $: currentBackground = $background

    // timer
    let today = new Date()
    setInterval(() => (today = new Date()), 1000)

    let itemStyles: any = getStyles(item.style, true)
    $: fontSize = Number(itemStyles?.["font-size"] || 0) || 100 // item.autoFontSize ||

    // dynamic resolution
    let resolution = { width: window.innerWidth, height: window.innerHeight }

    $: style = item.auto ? removeFontSize(item.style) : item.style
    function removeFontSize(style: string) {
        let fontSizeIndex = style.indexOf("font-size")
        if (fontSizeIndex < 0) return style

        return style.slice(0, fontSizeIndex) + style.slice(style.indexOf(";", fontSizeIndex) + 1)
    }

    // custom dynamic size
    // WIP this does not update when window size changes...
    let newSizes = `;
        top: ${Math.min(itemStyles.top, (itemStyles.top / 1080) * resolution.height)}px;
        inset-inline-start: ${Math.min(itemStyles.left, (itemStyles.left / 1920) * resolution.width)}px;
        width: ${Math.min(itemStyles.width, (itemStyles.width / 1920) * resolution.width)}px;
        height: ${Math.min(itemStyles.height, (itemStyles.height / 1080) * resolution.height)}px;
    `

    let alignElem: HTMLElement | undefined
    let size = 100
    $: if (alignElem && (item || $progressData)) size = autosize(alignElem, { type: "growToFit", textQuery: ".autoFontSize" })
    $: autoSize = fontSize !== 100 ? Math.max(fontSize, size) : size

    $: slideOffset = item.type ? Number(item.slideOffset || 0) : id.includes("next") ? 1 : 0

    $: isDisabledVariable = id.includes("variables") && $variables[id.split("#")[1]]?.enabled === false

    // request video time
    let videoTime: number = 0
    // $: if (id.includes("video")) requestVideoData()
    // let interval: any = null
    // function requestVideoData() {
    //     if (interval) return
    //     // USE API ?!?
    //     interval = setInterval(() => send("REQUEST_VIDEO_DATA"), 1000)
    //     // interval = setInterval(() => socket.emit("STAGE", { id: socketId, channel: "REQUEST_VIDEO_DATA" }), 1000)
    // }
    // onDestroy(() => {
    //     if (interval) clearInterval(interval)
    // })

    let firstTimerId: string = ""
    $: if (item.type === "timer" || id.includes("first_active_timer")) {
        firstTimerId = $activeTimers[0]?.id
        if (!firstTimerId) firstTimerId = sortByName(keysToID($timers)).find((timer) => timer.type !== "counter")?.id || ""
    }

    let itemStyle: string = ""
    let textStyle: string = ""
    $: if (style) updateStyles()
    function updateStyles() {
        const styles = getStyles(style)
        const textStyleKeys = ["line-height", "text-decoration"]

        itemStyle = ""
        textStyle = ""

        Object.entries(styles).forEach(([key, value]) => {
            if (textStyleKeys.includes(key)) textStyle += `${key}: ${value};`
            else itemStyle += `${key}: ${value};`
        })
    }
</script>

<!-- style + (id.includes("current_output") ? "" : newSizes) -->
<!-- {show.settings.autoStretch === false ? '' : newSizes} -->
<div class="item" class:border={stageLayout?.settings.labels} class:isDisabledVariable class:isHidden style="{itemStyle}{id.includes('slide') && !id.includes('tracker') ? '' : textStyle}{newSizes}--labelColor: {stageLayout?.settings?.labelColor || '#d0a853'};">
    {#if stageLayout?.settings.labels}
        <div class="label">{item.label || ""}</div>
    {/if}

    <div bind:this={alignElem} class="align" style="--align: {item.align};--text-align: {item.alignX};{item.type !== 'slide_text' || item.keepStyle ? 'height: 100%;' : ''}">
        <span style="pointer-events: none;width: 100%;height: 100%;">
            {#if item.type === "current_output" || id.includes("current_output")}
                <!-- width gets squished when resized -->
                <PreviewCanvas alpha={id.includes("_alpha")} id={stageLayout?.settings?.output} capture={$stream[id.includes("_alpha") ? "alpha" : "default"]} />
            {:else if item.type === "slide_text" || id.includes("slide")}
                {@const slideBackground = slideOffset === 0 ? currentBackground : slideOffset === 1 ? currentBackground.next : null}

                {#if (item.type ? item.includeMedia : !id.includes("_text")) && slideBackground?.path}
                    <MediaOutput path={slideBackground.path} mediaStyle={slideBackground.mediaStyle} />
                {/if}

                {#if currentSlide}
                    {#key item || currentSlide}
                        <!-- autoStage={show.settings.autoStretch !== false} -->
                        <SlideText
                            {currentSlide}
                            {slideOffset}
                            stageItem={item}
                            show={stageLayout}
                            {resolution}
                            chords={typeof item.chords === "boolean" ? item.chords : item.chords?.enabled}
                            autoSize={item.auto !== false}
                            {fontSize}
                            autoStage
                            {textStyle}
                            style={item.type ? item.keepStyle : false}
                        />
                    {/key}
                {/if}
            {:else if item.type === "slide_notes" || id.includes("notes")}
                <SlideNotes {currentSlide} {slideOffset} autoSize={item.auto !== false ? autoSize : fontSize} />
            {:else if item.type === "text"}
                <Textbox {item} showId={id} autoSize={item.auto === true} {fontSize} />
                <!-- STAGE VV -->
            {:else if item.type === "slide_tracker" || id.includes("slide_tracker")}
                <SlideProgress tracker={item.tracker || {}} autoSize={item.auto !== false ? autoSize : fontSize} />
            {:else if item.type === "clock" || id.includes("clock")}
                <Clock autoSize={item.auto !== false ? autoSize : fontSize} style={false} {...item.clock} />
            {:else if item.type === "timer"}
                <Timer {item} id={item.timer?.id || item.timerId || firstTimerId || ""} {today} style={item.auto === false ? "" : `font-size: ${item.auto !== false ? autoSize : fontSize}px;`} />
            {:else if item.type === "media" || item.type === "camera"}
                <Center faded>
                    <Icon id="noImage" size={8} white />
                </Center>
            {:else if item.type}
                <!-- probably unused -->
                <Textbox {item} showId={id} fontSize={item.auto !== false ? autoSize : fontSize} />
                <!-- <SlideItems item={stageItemToItem(item)} ref={{ type: "stage", id }} fontSize={item.auto !== false ? autoSize : fontSize} /> -->
            {:else}
                <!-- OLD CODE -->
                <div>
                    {#if id.includes("video")}
                        <VideoTime {videoTime} autoSize={item.auto !== false ? autoSize : fontSize} />
                    {:else if id.includes("first_active_timer")}
                        <Timer {item} id={firstTimerId} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                    {:else if id.includes("timers")}
                        {#if $timers[id.split("#")[1]]}
                            <Timer {item} id={id.split("#")[1]} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                        {/if}
                    {:else if id.includes("variables")}
                        {#if $variables[id.split("#")[1]]}
                            <Variable id={id.split("#")[1]} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                        {/if}
                    {:else}
                        {id}
                    {/if}
                </div>
            {/if}
        </span>
    </div>
</div>

<style>
    .item {
        font-family: Arial, Helvetica, sans-serif;

        border-width: 0;
        border-style: solid;

        /* make label visible */
        overflow: visible !important;
    }

    .item.border {
        outline: 3px solid var(--labelColor);
        outline-offset: 0;
    }

    .align {
        height: 100%;
        display: flex;
        text-align: center;
        align-items: center;
    }

    .align div,
    .align :global(.item) {
        width: 100%;
        height: 100%;
        color: unset;
        /* overflow-wrap: break-word; */
    }

    .isDisabledVariable {
        display: none;
    }
    
    .isHidden {
        display: none;
    }

    .label {
        position: absolute;
        top: 0;
        transform: translateY(calc(-100% - 3px));
        width: 100%;

        background: rgb(0 0 0 / 0.4);
        color: var(--labelColor);

        /* RESET LABEL STYLE */
        font-family: sans-serif;
        font-size: 42px;
        -webkit-text-stroke-width: 0;
        text-shadow: none;

        font-weight: normal;
        font-style: normal;
        text-align: center;
        text-transform: none;

        line-height: normal;
        letter-spacing: normal;
        word-spacing: normal;
    }

    .align :global(.item .align) {
        align-items: var(--align);
    }
    .align :global(.item .align .lines) {
        text-align: var(--text-align);
    }
</style>
