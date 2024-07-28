<script lang="ts">
    import { progressData } from "../store"

    export let tracker: any
    export let autoSize: number = 0

    let type: "number" | "bar" | "group" = "number"
    $: type = tracker.type || "number"
    $: accent = tracker.accent

    $: progress = $progressData.progress || {}

    $: currentShowSlide = progress?.currentShowSlide ?? -1
    $: slidesLength = progress.slidesLength || 0
</script>

<div class="progress" class:barBG={type === "bar"} style={accent ? "--accent: " + accent : ""}>
    {#if type === "number"}
        <p style={autoSize ? "font-size: " + autoSize + "px" : ""}><span style="color: var(--accent);">{currentShowSlide + 1}</span>/{slidesLength}</p>
    {:else if type === "bar"}
        <!-- progress bar -->
        <div class="bar" style="width: {slidesLength ? ((currentShowSlide + 1) / slidesLength) * 100 : 0}%;"></div>
    {:else if type === "group"}
        <!-- group sequence -->
        <!-- WIP new auto size here -->
        <div class="groups" style={autoSize ? "font-size: " + autoSize / 2.8 + "px" : ""}>
            {#each progress.layoutGroups as group, i}
                <div class="group" class:active={i === currentShowSlide}>
                    {group}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .progress {
        width: 100%;
        height: 100%;

        display: flex;
        align-items: center;
        justify-content: center;

        --accent: var(--secondary);
    }

    .progress.barBG {
        justify-content: flex-start;
    }
    .bar {
        height: 100%;
        background-color: var(--accent);
        transition: width 0.5s;
    }

    .groups {
        display: flex;
        gap: 15px;
        flex-wrap: wrap;
    }
    .group {
        transition: color 0.2s;
    }
    .group.active {
        color: var(--accent);
    }
</style>
