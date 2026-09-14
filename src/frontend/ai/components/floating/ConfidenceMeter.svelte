<script lang="ts">
    export let confidence: number = 0

    const colors = ["#f44336", "#ff9800", "#ffeb3b", "#8bc34a", "#4caf50"]

    $: safeConfidence = Math.max(0, Math.min(100, confidence))
    $: colorIndex = Math.min(Math.floor(safeConfidence / 20), colors.length - 1)
    $: currentColor = colors[colorIndex]
</script>

<div class="confidence-meter-pie" data-title="{confidence}%" style={`background: conic-gradient(${currentColor} ${safeConfidence * 3.6}deg, transparent 0deg);`}></div>

<style>
    .confidence-meter-pie {
        --diameter: 14px;

        width: var(--diameter);
        height: var(--diameter);
        min-width: var(--diameter);
        min-height: var(--diameter);

        border-radius: 50%;
        transition: background 0.3s ease;

        border: 1px solid var(--primary-lighter);
    }
</style>
