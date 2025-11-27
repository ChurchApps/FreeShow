<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"

    import { AudioEqualizer, type EQBand, EqualizerCalculations, setEqualizerEnabled, updateEqualizerBands } from "../../../audio/audioEqualizer"
    import { eqPresets, equalizerConfig, special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone, keysToID } from "../../helpers/array"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    export let disabled: boolean = false

    const originalBands = AudioEqualizer.getDefaultBands()

    // 6 band equalizer with frequencies optimized for audio
    let bands: EQBand[] = clone(originalBands)
    let enabled: boolean = false

    // Subscribe to equalizer config changes
    let equalizerConfigUnsubscribe: (() => void) | null = null
    let windowResizeCleanup: (() => void) | null = null
    let resizeObserver: ResizeObserver | null = null

    // Spectrum analyzer instance
    // let spectrumAnalyzer: SpectrumAnalyzer
    // let showSpectrum = true // Toggle for showing live frequency spectrum
    // let spectrumUpdateTrigger = 0 // Reactive trigger for spectrum updates

    // Update canvas width based on container size
    let widthChange = 0
    function updateCanvasWidth() {
        widthChange++
        const rightPanelDrawer = document.querySelector("#rightPanelDrawer")
        if (rightPanelDrawer) {
            const drawerRect = rightPanelDrawer.getBoundingClientRect()
            const padding = 20 // Account for container padding and margins
            const newWidth = Math.max(100, drawerRect.width - padding) // Minimum width of 300px

            if (newWidth !== canvasWidth) {
                canvasWidth = newWidth
                // Force reactivity to update calculations that depend on canvasWidth
                bands = [...bands]
            }
        } else if (containerElement) {
            // Fallback to container element if rightPanelDrawer is not found
            const containerRect = containerElement.getBoundingClientRect()
            const padding = 32 // Account for container padding
            const newWidth = Math.max(100, containerRect.width - padding)

            if (newWidth !== canvasWidth) {
                canvasWidth = newWidth
                bands = [...bands]
            }
        }
    }

    onMount(async () => {
        // Equalizer will auto-initialize when first audio source connects
        // No need to initialize here to avoid audio interruption

        // Subscribe to config changes
        equalizerConfigUnsubscribe = equalizerConfig.subscribe(config => {
            bands = clone(config.bands)
            enabled = config.enabled
        })

        // Set up initial canvas width and resize observer
        updateCanvasWidth()

        if (typeof ResizeObserver !== "undefined") {
            const rightPanelDrawer = document.querySelector("#rightPanelDrawer")
            if (rightPanelDrawer) {
                resizeObserver = new ResizeObserver(() => {
                    updateCanvasWidth()
                })
                resizeObserver.observe(rightPanelDrawer)
            } else if (containerElement) {
                // Fallback to container element if rightPanelDrawer is not found
                resizeObserver = new ResizeObserver(() => {
                    updateCanvasWidth()
                })
                resizeObserver.observe(containerElement)
            }
        }

        // Also listen for window resize as additional fallback
        const handleWindowResize = () => {
            updateCanvasWidth()
        }
        window.addEventListener("resize", handleWindowResize)

        // Store cleanup function
        windowResizeCleanup = () => {
            window.removeEventListener("resize", handleWindowResize)
        }

        // Initialize spectrum analyzer
        // spectrumAnalyzer = new SpectrumAnalyzer()
        // startSpectrumAnalysis()
    })

    onDestroy(() => {
        if (equalizerConfigUnsubscribe) {
            equalizerConfigUnsubscribe()
        }
        if (windowResizeCleanup) {
            windowResizeCleanup()
        }
        if (resizeObserver) {
            resizeObserver.disconnect()
        }

        // remove global event listeners
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)

        // Cleanup spectrum analyzer
        // if (spectrumAnalyzer) spectrumAnalyzer.dispose()
    })

    // Visual settings
    const minGain = -24
    const maxGain = 24
    const canvasHeight = 200
    let canvasWidth = 400 // Default width, will be updated dynamically
    const minFreq = 20
    const maxFreq = 20000

    // Container element for dynamic width calculation
    let containerElement: HTMLElement

    // SPECTRUM ANALYSIS

    // // Spectrum analysis functions using SpectrumAnalyzer class
    // function startSpectrumAnalysis() {
    //     if (spectrumAnalyzer && !spectrumAnalyzer.isRunning()) {
    //         spectrumAnalyzer.start(() => {
    //             spectrumUpdateTrigger++
    //         })
    //     }
    // }

    // // Generate spectrum bars using the analyzer
    // function generateSpectrumBars() {
    //     if (!spectrumAnalyzer) return []
    //     return spectrumAnalyzer.generateSpectrumBars(canvasWidth, canvasHeight)
    // }

    // // Get spectrum color using the analyzer
    // function getSpectrumColor(amplitude: number): string {
    //     return SpectrumAnalyzer.getSpectrumColor(amplitude)
    // }

    // // Reactive statement to trigger UI updates for frequency visualization
    // $: spectrumBars = enabled && showSpectrum && spectrumAnalyzer?.isRunning() && spectrumUpdateTrigger >= 0 ? generateSpectrumBars() : []

    // EQ

    // Reactive statement to ensure UI updates when canvas width changes
    $: if (canvasWidth) {
        // This ensures all calculations dependent on canvasWidth are updated
        // Force update of dragged band position if currently dragging
        if (isDragging && draggedBandIndex !== null) {
            draggedBandX = getFreqX(bands[draggedBandIndex].frequency)
        }
    }

    // Convert frequency to X position (logarithmic scale)
    function getFreqX(frequency: number, _updater: any = null): number {
        const logMin = Math.log10(minFreq)
        const logMax = Math.log10(maxFreq)
        const logFreq = Math.log10(frequency)
        return ((logFreq - logMin) / (logMax - logMin)) * canvasWidth
    }

    // Convert X position to frequency (logarithmic scale)
    function getXFreq(x: number): number {
        const logMin = Math.log10(minFreq)
        const logMax = Math.log10(maxFreq)
        const logFreq = logMin + (x / canvasWidth) * (logMax - logMin)
        return Math.pow(10, logFreq)
    }

    let draggedBandIndex: number | null = null
    let isDragging = false
    let eqVisualElement: HTMLElement
    let isHovering = false
    let hoverX = 0
    let hoverFrequency = 0
    let draggedBandX = 0
    let draggedBandFrequency = 0
    console.log(draggedBandX, draggedBandFrequency)

    // Define unique colors for each band
    const bandColors = [
        "#FF6B6B", // Red - Low frequencies
        "#4ECDC4", // Teal - Low-mid frequencies
        "#45B7D1", // Blue - Mid frequencies
        "#96CEB4", // Green - Mid-high frequencies
        "#FFEAA7", // Yellow - High frequencies
        "#DDA0DD" // Purple - Very high frequencies
    ]

    function handleMouseDown(e: MouseEvent, bandIndex: number) {
        if (disabled) return

        // Check for middle mouse button (wheel button) click to reset
        if (e.button === 1) {
            e.preventDefault()
            handleBandReset(bandIndex)
            return
        }

        // Only handle left mouse button for dragging
        if (e.button !== 0) return

        // Remove existing listeners first to prevent duplicates
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)

        draggedBandIndex = bandIndex
        isDragging = true

        // Initialize dragged band position for display
        draggedBandX = getFreqX(bands[bandIndex].frequency)
        draggedBandFrequency = bands[bandIndex].frequency

        // Prevent text selection while dragging
        e.preventDefault()

        // Add global mouse listeners
        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)
    }

    function handleMouseMove(e: MouseEvent) {
        if (!isDragging || draggedBandIndex === null || !eqVisualElement) return

        const rect = eqVisualElement.getBoundingClientRect()

        // Calculate Y position (gain)
        const y = e.clientY - rect.top
        const gainPercentage = Math.max(0, Math.min(1, (canvasHeight - y) / canvasHeight))
        const newGain = minGain + gainPercentage * (maxGain - minGain)

        // Calculate X position (frequency)
        const x = Math.max(0, Math.min(canvasWidth, e.clientX - rect.left))
        const newFreq = getXFreq(x)

        // Update gain
        bands[draggedBandIndex].gain = Math.round(newGain * 10) / 10

        // Allow frequency adjustment for peaking filters (not high/low pass)
        if (bands[draggedBandIndex].type === "peaking") {
            // Constrain to reasonable ranges for each band to prevent overlap
            // const bandRanges = [
            //     [20, 200], // Band 1 range
            //     [80, 800], // Band 2 range
            //     [200, 2000], // Band 3 range
            //     [500, 5000], // Band 4 range
            //     [1000, 15000], // Band 5 range
            //     [3000, 20000] // Band 6 range
            // ]

            const range = [20, 20000] // bandRanges[draggedBandIndex]
            if (range && newFreq >= range[0] && newFreq <= range[1]) {
                bands[draggedBandIndex].frequency = Math.round(newFreq)
                bands[draggedBandIndex].label = formatFrequency(bands[draggedBandIndex].frequency) + "Hz"
            }
        } else {
            // For high-pass and low-pass filters, allow frequency adjustment
            if (bands[draggedBandIndex].type === "lowpass") {
                const clampedFreq = Math.max(20, Math.min(500, newFreq))
                bands[draggedBandIndex].frequency = Math.round(clampedFreq)
                bands[draggedBandIndex].label = formatFrequency(bands[draggedBandIndex].frequency) + "Hz"
            } else if (bands[draggedBandIndex].type === "highpass") {
                const clampedFreq = Math.max(1000, Math.min(20000, newFreq))
                bands[draggedBandIndex].frequency = Math.round(clampedFreq)
                bands[draggedBandIndex].label = formatFrequency(bands[draggedBandIndex].frequency) + "Hz"
            }
        }

        // Update dragged band position for display
        draggedBandX = getFreqX(bands[draggedBandIndex].frequency)
        draggedBandFrequency = bands[draggedBandIndex].frequency

        bands = [...bands] // Trigger reactivity
        updateBands()

        // update preset
        selectedPreset = "custom"
        eqPresets.update(a => {
            a[selectedPreset] = {
                name: translateText("sort.custom"),
                bands: clone(bands)
            }
            return a
        })
        // Preset 1, Preset 2, ...
        const label = translateText("audio.preset")
        let existingWithDefaultName = Object.values(presets)
            .map(({ name }) => {
                const match = name.match(new RegExp(`^${label} (\\d+)$`))
                return match ? parseInt(match[1], 10) : null
            })
            .filter(num => num !== null)
        customName = label + " " + (existingWithDefaultName.length + 1).toString()
    }

    function handleMouseEnter() {
        if (disabled) return
        isHovering = true
    }

    function handleMouseLeave() {
        isHovering = false
    }

    function handleMouseHover(e: MouseEvent) {
        if (!isHovering || !eqVisualElement || disabled || isDragging) return

        const rect = eqVisualElement.getBoundingClientRect()
        const x = Math.max(0, Math.min(canvasWidth, e.clientX - rect.left))

        hoverX = x
        hoverFrequency = getXFreq(x)
    }

    function handleMouseUp() {
        isDragging = false
        draggedBandIndex = null

        // Remove global mouse listeners
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
    }

    function handleWheel(e: WheelEvent, bandIndex: number) {
        if (disabled) return

        e.preventDefault()

        // 0 = pixels, 1 = lines, 2 = pages. Trackpads often deliver small pixel deltas.
        let raw = e.deltaY
        if ((e as any).deltaMode === 1) raw = raw * 16
        else if ((e as any).deltaMode === 2) raw = raw * canvasHeight

        // Convert the raw delta into a sensible step for Q.
        const baseSensitivity = 0.02
        let step = Math.sign(raw) * Math.max(0.01, Math.min(0.5, Math.abs(raw) * baseSensitivity))

        // Apply and clamp Q between sensible bounds
        bands[bandIndex].q = Math.max(0.1, Math.min(30, +(bands[bandIndex].q + step).toFixed(2)))
        bands = [...bands] // Trigger reactivity

        updateBands()
    }

    function handleBandReset(bandIndex: number) {
        if (disabled) return

        // Reset to original values for this band
        bands[bandIndex] = { ...originalBands[bandIndex] }
        bands = [...bands] // Trigger reactivity

        updateBands()
    }

    function updateBands() {
        // Update the audio equalizer system
        updateEqualizerBands(bands)
    }

    function getGainY(gain: number): number {
        const percentage = (gain - minGain) / (maxGain - minGain)
        return canvasHeight - percentage * canvasHeight
    }

    // Calculate individual band response curve (wave)
    function calculateBandResponse(band: EQBand): string {
        if (band.gain === 0) return "" // No wave if no gain

        const points: string[] = []
        const zeroY = getGainY(0)

        // Extend frequency range so curves naturally approach 0dB at edges
        let minWaveFreq: number, maxWaveFreq: number

        if (band.type === "peaking") {
            // For peaking, extend range based on Q factor for smooth decay
            const octaveRange = Math.max(2, 6 / band.q) // Wider range for lower Q
            minWaveFreq = Math.max(minFreq, band.frequency / Math.pow(2, octaveRange))
            maxWaveFreq = Math.min(maxFreq, band.frequency * Math.pow(2, octaveRange))
        } else {
            // For high-pass and low-pass, show full range to see natural rolloff
            minWaveFreq = minFreq
            maxWaveFreq = maxFreq
        }

        const minWaveX = getFreqX(minWaveFreq)
        const maxWaveX = getFreqX(maxWaveFreq)

        // Calculate curve points using the equalizer calculations
        const numPoints = 100
        const curvePoints: string[] = []

        for (let i = 0; i <= numPoints; i++) {
            const x = minWaveX + (i / numPoints) * (maxWaveX - minWaveX)
            const frequency = getXFreq(x)
            const response = EqualizerCalculations.calculateBandResponse(band, frequency)
            const y = getGainY(response)
            curvePoints.push(`${x},${y}`)
        }

        // Create filled path that smoothly connects to 0dB line
        points.push(`M ${minWaveX},${zeroY}`) // Start at 0dB

        // Add all curve points
        curvePoints.forEach((point, i) => {
            if (i === 0) {
                points.push(`L ${point}`) // First curve point
            } else {
                points.push(`L ${point}`)
            }
        })

        points.push(`L ${maxWaveX},${zeroY}`) // End at 0dB
        points.push(`Z`) // Close path

        return points.join(" ")
    }

    // Calculate frequency response curve taking into account Q factor
    function calculateFrequencyResponse(_updater: any): string {
        const points: string[] = []
        const numPoints = 300 // More points for smoother curve

        for (let i = 0; i <= numPoints; i++) {
            // Proper logarithmic frequency scale
            const x = (i / numPoints) * canvasWidth
            const frequency = getXFreq(x) // Use our frequency conversion function

            // Use the equalizer calculations for combined response
            const totalGain = EqualizerCalculations.calculateCombinedResponse(bands, frequency)
            const y = getGainY(totalGain)

            if (i === 0) {
                points.push(`M ${x},${y}`)
            } else {
                points.push(`L ${x},${y}`)
            }
        }

        return points.join(" ")
    }

    function formatFrequency(freq: number): string {
        if (freq >= 1000) {
            return `${(freq / 1000).toFixed(1)}k`
        }
        return `${freq}`
    }

    // Handle enable/disable toggle
    function handleEnableChange(e: any) {
        enabled = e.detail
        setEqualizerEnabled(enabled)
    }

    let selectedPreset = $special.selectedEQPreset || "default"
    $: presets = {
        ...$eqPresets,
        default: {
            name: translateText("example.default"),
            bands: originalBands
        }
    }
    // value of "default" & "custom" should always be first, then alphabetical order
    $: presetOptions = keysToID(presets)
        .map(a => ({ label: a.name, value: a.id }))
        .sort((a, b) => {
            if (a.value === "default" || a.value === "custom") return -1
            if (b.value === "default" || b.value === "custom") return 1
            return a.label.localeCompare(b.label)
        })

    function selectPreset(value: string) {
        selectedPreset = value
        const preset = presets[value]
        if (!preset) return

        special.update(a => {
            a.selectedEQPreset = selectedPreset
            return a
        })

        bands = clone(preset.bands.map(band => ({ ...band })))
        updateBands()
    }

    let customName = ""
    function saveCustomPreset() {
        const name = customName.trim()
        if (name === "") return

        const id = uid(5)

        // Save current bands as a new preset
        eqPresets.update(a => {
            a[id] = {
                name,
                bands: clone(bands)
            }

            delete a.custom
            return a
        })

        selectPreset(id)
    }

    function deletePreset() {
        eqPresets.update(a => {
            delete a[selectedPreset]
            return a
        })

        selectPreset("default")
    }
</script>

<div class="equalizer-container" style="--accent: #5295ad;" class:disabled bind:this={containerElement}>
    <MaterialToggleSwitch label="settings.enabled" checked={enabled} on:change={handleEnableChange} />
    <InputRow>
        <MaterialDropdown label="audio.preset" value={selectedPreset} options={presetOptions} defaultValue="default" on:change={e => selectPreset(e.detail)} disabled={!enabled} />

        {#if selectedPreset === "custom"}
            <MaterialTextInput label="inputs.name" value={customName} on:change={e => (customName = e.detail)} />
            <MaterialButton icon="save" title="actions.save" on:click={saveCustomPreset} />
        {:else if selectedPreset !== "default"}
            <MaterialButton icon="delete" title="actions.delete" on:click={deletePreset} white />
        {/if}
    </InputRow>

    <div style="height: 5px;width: 100%;"></div>

    <!-- EQ Visual Display -->
    <div class="eq-visual" class:eq-disabled={!enabled} bind:this={eqVisualElement} style="height: {canvasHeight}px;" on:mouseenter={handleMouseEnter} on:mouseleave={handleMouseLeave} on:mousemove={handleMouseHover}>
        <!-- Background grid -->
        <svg class="eq-grid" width={canvasWidth} height={canvasHeight}>
            <!-- Spectrum Analyzer -->

            <!-- SVG Definitions for gradients -->
            <defs>
                <linearGradient id="spectrumGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stop-color="hsl(160, 100%, 50%)" stop-opacity="0.4" />
                    <stop offset="20%" stop-color="hsl(120, 100%, 60%)" stop-opacity="0.5" />
                    <stop offset="40%" stop-color="hsl(60, 100%, 65%)" stop-opacity="0.6" />
                    <stop offset="60%" stop-color="hsl(30, 100%, 60%)" stop-opacity="0.7" />
                    <stop offset="80%" stop-color="hsl(15, 100%, 55%)" stop-opacity="0.8" />
                    <stop offset="100%" stop-color="hsl(0, 100%, 50%)" stop-opacity="0.9" />
                </linearGradient>

                <!-- Glow filter for high amplitude bars -->
                <filter id="barGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            <!-- Live frequency spectrum bars (behind everything else) -->
            <!-- frequencies below 500 Hz are not split up into many individual frequency bands -->
            <!-- {#each spectrumBars as bar}
                    <rect x={bar.x} y={canvasHeight - bar.height} width={bar.width} height={bar.height} fill={getSpectrumColor(bar.amplitude)} opacity={0.02 + bar.amplitude * 0.08} rx="1" filter={bar.amplitude > 0.7 ? "url(#barGlow)" : "none"} />
            {/each} -->

            <!-- EQ -->

            <!-- EQ Band frequency markers -->
            {#each bands as band, index}
                <line x1={getFreqX(band.frequency, widthChange)} y1="0" x2={getFreqX(band.frequency, widthChange)} y2={canvasHeight} stroke={bandColors[index]} stroke-width="1" opacity="0.2" stroke-dasharray="4,4" />
                <!-- <text x={getFreqX(band.frequency, widthChange) + 2} y="15" fill={bandColors[index]} font-size="9" font-weight="bold" opacity="0.8">
                    Band {index + 1}
                </text> -->
            {/each}

            <!-- Horizontal grid lines for dB levels -->
            {#each [24, 18, 12, 6, 0, -6, -12, -18, -24] as db}
                <line x1="0" y1={getGainY(db)} x2={canvasWidth} y2={getGainY(db)} stroke="var(--primary-lighter)" stroke-width={db === 0 ? "2" : "1"} opacity={db === 0 ? "0.8" : "0.3"} />
                <text x="5" y={getGainY(db) - 2} fill="var(--text)" font-size="10" opacity="0.6">
                    {db > 0 ? "+" : ""}{db}dB
                </text>
            {/each}

            <!-- Vertical grid lines for common frequencies -->
            {#each [50, 100, 200, 500, 1000, 2000, 5000, 10000] as freq}
                <line x1={getFreqX(freq, widthChange)} y1="0" x2={getFreqX(freq, widthChange)} y2={canvasHeight} stroke="var(--primary-lighter)" stroke-width="1" opacity="0.2" />
                <text x={getFreqX(freq, widthChange) + 2} y={canvasHeight - 5} fill="var(--text)" font-size="9" opacity="0.5">
                    {formatFrequency(freq)}
                </text>
            {/each}

            <!-- Individual band waves (behind main curve) -->
            {#each bands as band, index}
                {#if band.gain !== 0}
                    <path d={calculateBandResponse(band)} fill={bandColors[index]} fill-opacity="0.15" stroke={bandColors[index]} stroke-width="1" opacity="0.4" />
                {/if}
            {/each}

            <!-- Combined EQ Response Curve (main curve) -->
            <!-- filter="drop-shadow(0 0 2px var(--accent))" -->
            <path d={calculateFrequencyResponse(bands)} fill="none" stroke="var(--accent)" stroke-width="2" opacity="0.9" />

            <!-- Hover line and frequency display -->
            {#if isHovering && !isDragging && enabled && !disabled}
                <line x1={hoverX} y1="0" x2={hoverX} y2={canvasHeight} stroke="#FFFFFF" stroke-width="1" opacity="0.1" stroke-dasharray="8,5" />

                <!-- Frequency label background -->
                <rect x={hoverX - 25} y="5" width="50" height="16" fill="var(--primary-darker)" stroke="#FFFFFF" stroke-width="1" rx="3" opacity="0.6" />

                <!-- Frequency label text -->
                <text x={hoverX} y="17" fill="#FFFFFF" font-size="10" font-weight="bold" text-anchor="middle">
                    {formatFrequency(Math.round(hoverFrequency))}Hz
                </text>
            {/if}

            <!-- Dragged band frequency display -->
            <!-- {#if isDragging && draggedBandIndex !== null}
                <line x1={draggedBandX} y1="0" x2={draggedBandX} y2={canvasHeight} stroke="#FFFFFF" stroke-width="1" opacity="0.1" stroke-dasharray="8,5" />

                <rect x={draggedBandX - 25} y="5" width="50" height="16" fill="var(--secondary)" stroke="var(--secondary)" stroke-width="1" rx="3" opacity="0.8" />

                <text x={draggedBandX} y="17" fill="var(--secondary-text)" font-size="10" font-weight="bold" text-anchor="middle">
                    {formatFrequency(Math.round(draggedBandFrequency))}Hz
                </text>
            {/if} -->
        </svg>

        <!-- Band Controls -->
        {#each bands as band, i}
            <div class="band-control" class:dragging={draggedBandIndex === i} style="left: {getFreqX(band.frequency) - 15}px;">
                <!-- Gain Handle -->
                <div class="gain-handle" class:high-pass={band.type === "highpass"} class:low-pass={band.type === "lowpass"} style="top: {getGainY(band.gain) - 10}px;" on:mousedown={e => handleMouseDown(e, i)} on:wheel={e => handleWheel(e, i)} role="slider" tabindex="0" aria-label="Band {i + 1} gain control" aria-valuenow={band.gain} aria-valuemin={minGain} aria-valuemax={maxGain}>
                    <div class="handle-inner" style="background-color: {bandColors[i]}{draggedBandIndex === i ? 90 : 10}; color: {bandColors[i]}; border: 2px solid {bandColors[i]}90;">
                        {i + 1}
                    </div>
                </div>
            </div>
        {/each}
    </div>

    <!-- Band Info - only show for currently dragged band -->
    {#if draggedBandIndex !== null && bands[draggedBandIndex]}
        <div class="band-info">
            <div class="frequency">{formatFrequency(bands[draggedBandIndex].frequency)}Hz</div>
            <div class="gain-value">{bands[draggedBandIndex].gain > 0 ? "+" : ""}{bands[draggedBandIndex].gain.toFixed(1)}dB</div>
            <div class="q-value">Q: {bands[draggedBandIndex].q.toFixed(1)}</div>
            <!-- <div class="filter-type">
                {bands[draggedBandIndex].type === "highpass" ? "HP" : bands[draggedBandIndex].type === "lowpass" ? "LP" : "PK"}
            </div> -->
        </div>
    {/if}
</div>

<style>
    .equalizer-container {
        border-radius: 8px;
        padding: 10px;
        user-select: none;
    }

    .equalizer-container.disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    .eq-visual {
        position: relative;
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
        margin-bottom: 16px;
        overflow: hidden;
        transition: opacity 0.2s ease;
        width: 100%;

        font-family: monospace;
    }

    .eq-visual.eq-disabled {
        opacity: 0.4;
    }

    .eq-grid {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
    }

    .band-control {
        position: absolute;
        top: 0;
        height: 100%;
        width: 30px;
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
    }

    .gain-handle {
        position: absolute;
        width: 20px;
        height: 20px;
        cursor: grab;
        pointer-events: all;
        /* transition: all 0.1s ease; */
    }

    .gain-handle:active {
        cursor: grabbing;
    }

    .handle-inner {
        width: 100%;
        height: 100%;
        background: var(--secondary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .band-info {
        display: flex;
        justify-content: center;
        gap: 16px;

        font-family: monospace;
        font-size: 12px;
        font-weight: bold;
        color: white;
        opacity: 0.7;

        padding: 2px;
    }
</style>
