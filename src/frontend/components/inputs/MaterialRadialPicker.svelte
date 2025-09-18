<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { translateText } from "../../utils/language"

    export let value = 0
    export let label: string
    export let id = ""
    export let placeholder = ""
    export let disabled = false
    export let autofocus = false
    export let step = 1

    $: numberValue = clamp360(Number(value))
    const dispatch = createEventDispatcher()

    function clamp360(v: number) {
        if (isNaN(v)) return 0
        v = v % 360
        if (v < 0) v += 360
        return v
    }

    function updateValue(newVal: number) {
        if (disabled) return
        numberValue = clamp360(newVal)
        dispatch("input", numberValue)
        dispatch("change", numberValue)
    }

    function handleInput(e: Event) {
        const newValue = parseFloat((e.target as HTMLInputElement).value)
        if (!isNaN(newValue)) updateValue(newValue)
    }

    function increment(customStep: number = step) {
        updateValue(numberValue + customStep)
    }

    function decrement(customStep: number = step) {
        updateValue(numberValue - customStep)
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "ArrowUp") {
            e.preventDefault()
            increment()
        } else if (e.key === "ArrowDown") {
            e.preventDefault()
            decrement()
        }
    }

    // --- Radial popup ---
    let showPopup = false
    const radius = 40
    let dragging = false

    // Close popup when the wrapper loses focus entirely
    function handleFocusOut(e: FocusEvent) {
        const related = e.relatedTarget as HTMLElement
        if (!related || !(e.currentTarget as HTMLElement)?.contains(related)) {
            showPopup = false
        }
    }

    const SNAP_POINTS = [0, 90, 180, 270, 360]
    function angleFromEvent(e: MouseEvent | TouchEvent, rect: DOMRect) {
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        let clientX, clientY
        if (e instanceof MouseEvent) {
            clientX = e.clientX
            clientY = e.clientY
        } else {
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        }
        const dx = clientX - cx
        const dy = clientY - cy
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90

        angle = Math.round(angle < 0 ? angle + 360 : angle)

        // snapping
        const shouldSnap = SNAP_POINTS.find((a) => Math.abs(angle - a) < 5)
        if (shouldSnap !== undefined) return shouldSnap

        return angle
    }

    function startDrag(e) {
        if (!(e.target as SVGElement).closest("svg")) return

        dragging = true
        const rect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect()
        updateValue(angleFromEvent(e, rect))
        window.addEventListener("mousemove", onDrag)
        window.addEventListener("mouseup", stopDrag)
        window.addEventListener("touchmove", onDrag)
        window.addEventListener("touchend", stopDrag)
    }

    function onDrag(e) {
        if (!dragging) return
        const rect = document.getElementById("degree-picker")!.getBoundingClientRect()
        updateValue(angleFromEvent(e, rect))
    }

    function stopDrag() {
        dragging = false
        window.removeEventListener("mousemove", onDrag)
        window.removeEventListener("mouseup", stopDrag)
        window.removeEventListener("touchmove", onDrag)
        window.removeEventListener("touchend", stopDrag)
    }

    $: handleX = Math.cos((numberValue - 90) * (Math.PI / 180)) * radius
    $: handleY = Math.sin((numberValue - 90) * (Math.PI / 180)) * radius

    function togglePopup(e) {
        if (e.target?.tagName === "BUTTON") return
        if (!disabled) showPopup = !showPopup
    }

    // wheel

    let nextScrollTimeout: NodeJS.Timeout | null = null
    function handleWheel(e: WheelEvent) {
        if (disabled || nextScrollTimeout) return
        if (!e.ctrlKey && !e.metaKey) return
        e.preventDefault()

        let stepAmount = step * (e.shiftKey ? 10 : 1)

        e.deltaY < 0 ? increment(stepAmount) : decrement(stepAmount)

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    // small indicator
    const miniRadius = 6
    $: miniX = Math.cos((numberValue - 90) * (Math.PI / 180)) * miniRadius
    $: miniY = Math.sin((numberValue - 90) * (Math.PI / 180)) * miniRadius
    // const circumference = 2 * Math.PI * miniRadius
    // $: offset = circumference - (numberValue / 360) * circumference
</script>

<!-- Number input styled like your original -->
<div class="textfield numberfield {disabled ? 'disabled' : ''}" tabindex="-1" on:focusout={handleFocusOut}>
    <div class="background" />

    <div class="input-wrapper">
        <input
            bind:value={numberValue}
            type="number"
            {id}
            {placeholder}
            {disabled}
            {autofocus}
            {step}
            min="0"
            max="360"
            class="input edit"
            class:noValue={!numberValue}
            on:keydown={handleKeyDown}
            on:input={handleInput}
            on:focus={togglePopup}
            on:wheel={handleWheel}
        />

        <svg class="mini-indicator" viewBox="-8 -8 16 16">
            <circle r={miniRadius} stroke="var(--primary-lighter)" stroke-width="1" fill="none" />
            <circle cx={miniX} cy={miniY} r="2" fill={disabled ? "var(--primary)" : "var(--secondary)"} />
            <!-- <circle r={miniRadius} stroke="var(--primary-lighter)" stroke-width="1.5" fill="none" />
            <circle r={miniRadius} stroke="var(--secondary)" stroke-width="2" fill="none" stroke-dasharray={circumference} stroke-dashoffset={offset} transform="rotate(-90)" /> -->
        </svg>

        <div class="buttons">
            <button type="button" class="inc" on:click={(e) => increment(e.shiftKey ? step * 10 : step)} tabindex="-1" {disabled}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 14l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
            <button type="button" class="dec" on:click={(e) => decrement(e.shiftKey ? step * 10 : step)} tabindex="-1" {disabled}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
        </div>
    </div>

    <label for={id} class:value-filled={numberValue !== 0}>{translateText(label)}</label>

    <span class="underline" />

    <!-- Radial Popup -->
    {#if showPopup}
        <div class="picker" on:click|stopPropagation on:mousedown={startDrag} on:touchstart={startDrag}>
            <svg id="degree-picker" viewBox="-{radius + 10} -{radius + 10} {(radius + 10) * 2} {(radius + 10) * 2}" width="100" height="100">
                <circle r={radius} stroke="var(--primary-lighter)" stroke-width="1" fill="none" />
                <line x1="0" y1="0" x2={handleX} y2={handleY} stroke="var(--secondary)" stroke-width="2" />
                <circle class="handle" cx={handleX} cy={handleY} r="4" fill="var(--secondary)" />
            </svg>
            <!-- <div class="popup-value">{numberValue.toFixed(0)}°</div> -->
        </div>
    {/if}
</div>

<style>
    /* Keep your original textfield style */
    .textfield {
        position: relative;
        width: 100%;
        color: var(--text);
        border-bottom: 1.2px solid var(--primary-lighter);
        height: 50px;
    }
    .background {
        position: absolute;
        inset: 0;
        background-color: var(--primary-darkest);
        border-radius: 4px 4px 0 0;
        z-index: 0;
    }
    .input-wrapper {
        height: 100%;
        display: flex;
        align-items: center;
        position: relative;
    }

    /* Hide default browser arrows */
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    input[type="number"].noValue:not(:focus) {
        color: transparent;
    }

    .input {
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        font-size: 1rem;
        padding: 1.25rem 2.2rem 0.5rem 0.75rem;
        color: var(--text);
    }

    .input:disabled {
        color: var(--text);
        opacity: 0.3;
        cursor: not-allowed;
    }

    .mini-indicator {
        position: absolute;
        right: 35px;

        width: 26px;
        height: 26px;
        flex-shrink: 0;

        pointer-events: none;
    }

    /* buttons */

    .buttons {
        position: absolute;
        right: 0.1rem;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        z-index: 2;

        opacity: 0;
        transition: 0.15s opacity ease;
    }

    .textfield:not(.disabled):hover .buttons {
        opacity: 1;
    }

    .buttons button {
        background: var(--primary-darkest);
        color: var(--text);
        border: none;
        cursor: pointer;
        padding: 0.15rem;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
            background 0.15s ease,
            color 0.15s ease,
            opacity 0.15s ease;
    }

    .buttons button svg {
        display: block;
    }

    .buttons button:hover:not(:disabled) {
        background: var(--hover);
        color: var(--secondary);
    }

    .buttons button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    label {
        position: absolute;
        left: 0.75rem;
        top: 0.75rem;
        font-size: 1.1rem;
        color: var(--text);
        opacity: 0.8;
        transition: all 0.2s ease;
        pointer-events: none;
        z-index: 1;
    }
    .textfield:has(input:focus) label,
    label.value-filled {
        top: 0.25rem;
        font-size: 0.75rem;
        color: var(--secondary);
        font-weight: 500;
        opacity: 1;
    }
    .textfield.disabled label {
        color: var(--text);
        opacity: 0.35;
    }

    .underline {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 1.2px;
        width: 100%;
        background-color: var(--secondary);
        transform: scaleX(0);
        transition: transform 0.2s ease;
        transform-origin: left;
        z-index: 2;
    }
    .textfield:has(input:focus) .underline {
        transform: scaleX(1);
    }

    /* Popup */
    .picker {
        position: absolute;
        z-index: 10;
        left: 50%;
        transform: translateX(-50%);

        background: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        /* padding: 8px 5px; */
        padding: 5px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
    }
    .handle {
        cursor: grab;
        touch-action: none;
    }
    /* .popup-value {
        font-weight: bold;
    } */
</style>
