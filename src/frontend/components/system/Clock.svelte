<script lang="ts">
    import AnalogClock from "./AnalogClock.svelte"
    import { timeFormat } from "../../stores"
    import dayjs from "dayjs"
    import localizedFormat from "dayjs/plugin/localizedFormat"

    // Initialize plugins
    dayjs.extend(localizedFormat)

    export let style: boolean = true
    export let autoSize: number = 0
    export let type: "digital" | "analog" | "custom" = "digital"
    export let dateFormat: string = "none"
    export let customFormat: string = "hh:mm a"
    export let showTime: boolean = true
    export let seconds: boolean = true
    
    $: twelwe = $timeFormat === "12"

    
    let d: Date = new Date()
    setInterval(() => (d = new Date()), 250)
    let h: number = 0
    let m: number = 0
    let s: number = 0
    
    $: if (d) {
        h = d.getHours()
        m = d.getMinutes()
        s = d.getSeconds()
        if (twelwe) {
            if (h === 0) h = 12
            else if (h > 12) h -= 12
        }
    }
    
    function formatTime(date: Date): string {
        const is12Hour = $timeFormat === "12"
        const format = is12Hour 
            ? (seconds ? "h:mm:ss A" : "h:mm A")
            : (seconds ? "HH:mm:ss" : "HH:mm")
        return dayjs(date).format(format)
    }

    function formatDateTime(date: Date, format: string): string {
        if (format === "none") return ""

        // Handle preset formats
        const presetFormats = ["LT", "LTS", "LL", "ll", "LLL", "lll", "LLLL", "llll"]
        if (presetFormats.includes(format)) {
            return dayjs(date).format(format)
        }

        // Handle custom formats
        return dayjs(date).format(format)
    }

    $: formattedDate = dateFormat !== "none" ? formatDateTime(d, dateFormat) : ""
    $: formattedCustom = type === "custom" ? formatDateTime(d, customFormat) : ""

</script>

{#if type === "analog"}
    <AnalogClock date={d} {...{ h, m, s }} {seconds} />
{:else if type === "custom"}
    <div class="clock" style={autoSize ? `font-size: ${autoSize}px;height: 100%;align-items: center;{$$props.style || ''}` : ""}>
        {#if style}
            <span class="colored">{formattedCustom}</span>
        {:else}
            {formattedCustom}
        {/if}
    </div>
{:else}
    <div class="clock" style={autoSize ? `font-size: ${autoSize}px;height: 100%;align-items: center;{$$props.style || ''}` : ""}>
        {#if style}
            {#if formattedDate}<span class="colored">{formattedDate}</span>{/if}
            {#if formattedDate && showTime}&nbsp;{/if}
            {#if showTime}<span class="colored">{formatTime(d)}</span>{/if}
        {:else}
            {#if formattedDate}{formattedDate}{/if}
            {#if formattedDate && showTime}&nbsp;{/if}
            {#if showTime}{formatTime(d)}{/if}
        {/if}
    </div>
{/if}

<style>
    .clock {
        display: flex;
        justify-content: center;
        align-items: baseline;
        font-size: 4em;
    }
    .colored {
        color: var(--secondary);
    }
</style>
