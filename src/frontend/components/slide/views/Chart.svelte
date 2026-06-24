<script lang="ts">
    import type { Item } from "../../../../types/Show"

    export let item: Item

    $: type = item.chart?.type || "bar"

    let grid: string[][] = []
    $: if (item.chart?.data) {
        try {
            grid = JSON.parse(item.chart.data)
        } catch (e) {
            const lines = item.chart.data.split("\n").filter((l) => l.trim())
            grid = lines.map((line) => {
                const parts = line.split(":")
                return [parts[0].trim(), parts[1] ? parts[1].trim() : ""]
            })
        }
    }

    // SVG Chart Data
    $: data = (() => {
        const fallbackColors = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#f43f5e", "#06b6d4", "#14b8a6"]
        if (grid && grid.length > 0) {
            const hasHeader = grid[0] && isNaN(parseFloat(grid[0][1]))
            const dataRows = hasHeader ? grid.slice(1) : grid
            const parsed = dataRows.map((row, idx) => {
                const label = row[0] || ""
                const val = parseFloat(row[1] || "0")
                const colorHex = row[2] || fallbackColors[idx % fallbackColors.length]
                return {
                    label,
                    value: isNaN(val) ? 0 : val,
                    color: colorHex,
                    colorHex
                }
            })
            if (parsed.length > 0) return parsed
        }
        return []
    })()

    let width = 400
    let height = 240

    $: paddingLeft = 60
    $: paddingRight = 30
    $: paddingTop = 45
    $: fontSize = Math.max(10, Math.min(width * 0.025, height * 0.04))
    $: maxLabelLength = Math.max(...data.map((d) => (d.label || "").length), 0)
    $: paddingBottom = Math.max(50, 20 + Math.min(maxLabelLength, 15) * fontSize * 0.35)

    $: usableWidth = width - paddingLeft - paddingRight
    $: usableHeight = height - paddingTop - paddingBottom
    $: yAxis = height - paddingBottom

    $: maxValue = Math.max(...data.map((d) => d.value), 1)

    $: spacing = data.length > 0 ? usableWidth / (data.length + 1) : 80
    $: barWidth = Math.min(60, spacing * 0.6)

    $: points = data.map((item, i) => ({
        x: paddingLeft + (i + 1) * spacing,
        y: yAxis - (item.value / maxValue) * usableHeight
    }))
    $: pathD = points.length ? `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}` : ""
    $: areaD = points.length ? `${pathD} L ${points[points.length - 1].x},${yAxis} L ${points[0].x},${yAxis} Z` : ""

    // Pie / Doughnut slice calculations
    $: itemsPerRow = data.length > 4 ? 4 : data.length
    $: numRows = Math.ceil(data.length / itemsPerRow)
    $: rowGap = Math.max(16, fontSize * 0.75)
    $: legendHeight = (numRows - 1) * rowGap + Math.max(20, fontSize * 0.5) + 10
    $: usablePieHeight = height - legendHeight

    $: total = data.reduce((sum, d) => sum + d.value, 0) || 1
    $: pieRadius = Math.min(width * 0.4, usablePieHeight * 0.45)
    $: centerX = width / 2
    $: centerY = usablePieHeight / 2
    $: pieSegments = (() => {
        let currentAngle = -90 // Start at top (12 o'clock)
        const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#f43f5e", "#06b6d4", "#14b8a6"]
        return data.map((item, idx) => {
            const val = item.value
            const angleDegrees = (val / total) * 360
            const nextAngle = currentAngle + angleDegrees

            // Convert angles to radians for calculation
            const rad1 = (currentAngle * Math.PI) / 180
            const rad2 = (nextAngle * Math.PI) / 180

            const r = pieRadius
            const x1 = r * Math.cos(rad1)
            const y1 = r * Math.sin(rad1)
            const x2 = r * Math.cos(rad2)
            const y2 = r * Math.sin(rad2)

            // Large arc flag: 1 if slice is > 180 degrees, else 0
            const largeArcFlag = angleDegrees > 180 ? 1 : 0

            // SVG path: Move to center (0,0), Line to start point (x1, y1), Arc to end point (x2, y2), Close (Z)
            const d = `M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`

            const colorHex = item.colorHex || colors[idx % colors.length]

            // Calculate coordinates for inside labels (centered radially at 60% of the radius)
            const midAngle = currentAngle + angleDegrees / 2
            const midRad = (midAngle * Math.PI) / 180
            const textR = r * 0.6
            const textX = textR * Math.cos(midRad)
            const textY = textR * Math.sin(midRad)

            const rawPercent = (val / total) * 100
            // Keep up to 1 decimal place, but drop trailing .0 if integer
            const percentage = parseFloat(rawPercent.toFixed(1))
            const showInside = angleDegrees >= 25

            currentAngle = nextAngle

            return {
                label: item.label,
                value: val,
                d,
                colorHex,
                isFull: angleDegrees >= 360,
                textX,
                textY,
                percentage,
                showInside
            }
        })
    })()
</script>

<div class="chart-container">
    <div class="chart-wrapper" bind:clientWidth={width} bind:clientHeight={height} style="--chart-font-size: {fontSize}px;">
        {#if type === "bar"}
            <svg viewBox="0 0 {width} {height}" class="chart-svg">
                <defs>
                    <linearGradient id="grad1" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3" />
                        <stop offset="100%" stop-color="#60a5fa" />
                    </linearGradient>
                    <linearGradient id="grad2" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#10b981" stop-opacity="0.3" />
                        <stop offset="100%" stop-color="#34d399" />
                    </linearGradient>
                    <linearGradient id="grad3" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3" />
                        <stop offset="100%" stop-color="#fbbf24" />
                    </linearGradient>
                    <linearGradient id="grad4" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#ec4899" stop-opacity="0.3" />
                        <stop offset="100%" stop-color="#f472b6" />
                    </linearGradient>
                </defs>

                <!-- Grid lines -->
                {#each Array(5) as _, i}
                    {@const y = paddingTop + i * (usableHeight / 4)}
                    <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#334155" stroke-dasharray="3,3" />
                {/each}

                <!-- Bars -->
                {#each data as item, i}
                    {@const x = paddingLeft + (i + 1) * spacing - barWidth / 2}
                    {@const barHeight = (item.value / maxValue) * usableHeight}
                    {@const y = yAxis - barHeight}

                    <rect {x} {y} width={barWidth} height={barHeight} fill={item.color} rx="4" class="bar-rect" />
                    <!-- Value Label -->
                    <text x={paddingLeft + (i + 1) * spacing} y={y - 8} class="chart-text val-text" text-anchor="middle">{item.value}%</text>
                    <!-- X Axis Label -->
                    <text x={paddingLeft + (i + 1) * spacing} y={yAxis + 12} class="chart-text axis-text" text-anchor="end" transform="rotate(-45, {paddingLeft + (i + 1) * spacing}, {yAxis + 12})">{item.label.length > 12 ? item.label.slice(0, 10) + "..." : item.label}</text>
                {/each}

                <!-- Axis -->
                <line x1={paddingLeft} y1={yAxis} x2={width - paddingRight} y2={yAxis} stroke="#475569" stroke-width="2" />
            </svg>
        {:else if type === "line"}
            <svg viewBox="0 0 {width} {height}" class="chart-svg">
                <defs>
                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4" />
                        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
                    </linearGradient>
                </defs>
                <!-- Grid lines -->
                {#each Array(5) as _, i}
                    {@const y = paddingTop + i * (usableHeight / 4)}
                    <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#334155" stroke-dasharray="3,3" />
                {/each}

                <!-- Line & Area Paths -->
                <path d={areaD} fill="url(#lineGrad)" />
                <path d={pathD} fill="none" stroke="#3b82f6" stroke-width="3" />

                <!-- Dots -->
                {#each points as p, i}
                    <circle cx={p.x} cy={p.y} r={Math.max(5, fontSize * 0.25)} fill={data[i].colorHex} stroke="#1e293b" stroke-width={Math.max(2, fontSize * 0.05)} />
                    <text x={p.x} y={p.y - Math.max(8, fontSize * 0.25) - 4} class="chart-text val-text" text-anchor="middle">{data[i].value}%</text>
                    <text x={p.x} y={yAxis + 12} class="chart-text axis-text" text-anchor="end" transform="rotate(-45, {p.x}, {yAxis + 12})">{data[i].label.length > 15 ? data[i].label.slice(0, 12) + "..." : data[i].label}</text>
                {/each}

                <!-- Axis -->
                <line x1={paddingLeft} y1={yAxis} x2={width - paddingRight} y2={yAxis} stroke="#475569" stroke-width="2" />
            </svg>
        {:else if type === "pie"}
            <svg viewBox="0 0 {width} {height}" class="chart-svg">
                <defs>
                    <mask id="doughnut-mask">
                        <!-- Everything under white stays visible -->
                        <circle cx="0" cy="0" r={pieRadius + 1} fill="white" />
                        <!-- Everything under black becomes transparent -->
                        <circle cx="0" cy="0" r={pieRadius * ((item.chart?.holeSize ?? 0) / 100)} fill="black" />
                    </mask>
                </defs>
                <g transform="translate({centerX}, {centerY})" mask={(item.chart?.holeSize ?? 0) > 0 ? "url(#doughnut-mask)" : ""}>
                    {#if pieSegments.length === 1 || (pieSegments.length > 0 && pieSegments[0].isFull)}
                        <!-- Single full slice -->
                        <circle cx="0" cy="0" r={pieRadius} fill={pieSegments[0].colorHex} />
                        {#if pieSegments[0].percentage > 1}
                            {#if pieSegments[0].label && !((item.chart?.holeSize ?? 0) > 0)}
                                <text x="0" y={-fontSize * 0.4} class="chart-text val-text" text-anchor="middle" dominant-baseline="middle" style="font-size: calc(var(--chart-font-size) * 1.1); fill: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.5); font-weight: bold;">{pieSegments[0].label}</text>
                                <text x="0" y={fontSize * 0.6} class="chart-text val-text" text-anchor="middle" dominant-baseline="middle" style="font-size: calc(var(--chart-font-size) * 1.25); fill: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.5); font-weight: 500;">100%</text>
                            {:else}
                                <text x="0" y="4" class="chart-text val-text" text-anchor="middle" dominant-baseline="middle" style="font-size: calc(var(--chart-font-size) * 1.25); fill: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">100%</text>
                            {/if}
                        {/if}
                    {:else}
                        {#each pieSegments as segment}
                            <path d={segment.d} fill={segment.colorHex} />
                            {#if segment.percentage > 1}
                                {#if segment.showInside && segment.label && !((item.chart?.holeSize ?? 0) > 0)}
                                    <text x={segment.textX} y={segment.textY - fontSize * 0.4} class="chart-text val-text" text-anchor="middle" dominant-baseline="middle" style="font-size: calc(var(--chart-font-size) * 0.75); fill: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.5); font-weight: bold;">
                                        {segment.label.length > 8 ? segment.label.slice(0, 7) + ".." : segment.label}
                                    </text>
                                    <text x={segment.textX} y={segment.textY + fontSize * 0.5} class="chart-text val-text" text-anchor="middle" dominant-baseline="middle" style="font-size: calc(var(--chart-font-size) * 0.85); fill: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.5); font-weight: 500;">
                                        {segment.percentage}%
                                    </text>
                                {:else}
                                    <!-- Always show percentage in the pie slice, centered if no label fits/exists -->
                                    <text x={segment.textX} y={segment.textY + 2} class="chart-text val-text" text-anchor="middle" dominant-baseline="middle" style="font-size: calc(var(--chart-font-size) * 0.85); fill: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.5); font-weight: 500;">
                                        {segment.percentage}%
                                    </text>
                                {/if}
                            {/if}
                        {/each}
                    {/if}
                </g>
                <!-- Legend underneath (multi-row wrapped grid) -->
                {#if (item.chart?.holeSize ?? 0) > 0 || pieSegments.filter((segment) => segment.label && (segment.percentage <= 1 || (!(segment.showInside && segment.percentage > 1) && !(pieSegments.length === 1 || (pieSegments.length > 0 && pieSegments[0].isFull))))).length > 0}
                    {@const visibleSegments = ((item.chart?.holeSize ?? 0) > 0 ? pieSegments : pieSegments.filter((segment) => segment.percentage <= 1 || (!(segment.showInside && segment.label && segment.percentage > 1) && !(pieSegments.length === 1 || (pieSegments.length > 0 && pieSegments[0].isFull && pieSegments[0].label))))).filter(s => s.label)}
                    {@const visibleItemsPerRow = visibleSegments.length > 4 ? 4 : visibleSegments.length}
                    {@const visibleNumRows = Math.ceil(visibleSegments.length / visibleItemsPerRow)}
                    <g transform="translate(0, {height - (visibleNumRows - 1) * rowGap - Math.max(20, fontSize * 0.5)})" class="chart-legend">
                        {#each visibleSegments as segment, i}
                            {@const rowIdx = Math.floor(i / visibleItemsPerRow)}
                            {@const colIdx = i % visibleItemsPerRow}
                            {@const itemsInThisRow = rowIdx === visibleNumRows - 1 ? visibleSegments.length - rowIdx * visibleItemsPerRow : visibleItemsPerRow}
                            {@const itemWidth = width / itemsInThisRow}
                            {@const itemX = colIdx * itemWidth + itemWidth / 2}
                            {@const boxSize = Math.max(10, fontSize * 0.5)}
                            {@const isSmallPercent = (item.chart?.holeSize ?? 0) > 0 ? segment.percentage <= 1 : segment.percentage <= 1}
                            {@const labelText = isSmallPercent ? `${segment.label} (${segment.percentage}%)` : segment.label}
                            {@const labelLen = labelText.length + 4}
                            {@const textWidth = labelLen * (fontSize * 0.4)}
                            {@const totalWidth = boxSize + 6 + textWidth}
                            {@const offset = totalWidth / 2}
                            <g transform="translate({itemX - offset}, {rowIdx * rowGap})">
                                {#if segment.label}
                                    <rect x="0" y={-boxSize / 2} width={boxSize} height={boxSize} fill={segment.colorHex} rx="2" />
                                    <text x={boxSize + 6} y={boxSize / 2 - 1} class="chart-text legend-text" text-anchor="start">{labelText}</text>
                                {/if}
                            </g>
                        {/each}
                    </g>
                {/if}
            </svg>
        {/if}
    </div>
</div>

<style>
    .chart-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: var(--text, #ffffff);
        font-family: inherit;
        overflow: hidden;
    }

    .chart-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
    }

    .chart-svg {
        width: 100%;
        height: 100%;
        max-height: 100%;
        max-width: 100%;
    }

    .chart-text {
        fill: #94a3b8;
        font-size: var(--chart-font-size, 10px);
        font-weight: 500;
    }

    .val-text {
        fill: #f1f5f9;
        font-weight: 600;
    }

    .axis-text {
        fill: #64748b;
    }

    .legend-text {
        font-size: calc(var(--chart-font-size, 10px) * 0.9);
        fill: #94a3b8;
    }
</style>
