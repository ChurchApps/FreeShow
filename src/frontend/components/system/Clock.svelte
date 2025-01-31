<script lang="ts">
    import dayjs from "dayjs"
    import localizedFormat from "dayjs/plugin/localizedFormat"
    import { timeFormat } from "../../stores"

    import AnalogClock from "./AnalogClock.svelte"
    import { onDestroy } from "svelte"
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
    const clockInterval = setInterval(() => (d = new Date()), 250)
    let h: number = 0
    let m: number = 0
    let s: number = 0
    let pm: boolean = false

    onDestroy(() => clearInterval(clockInterval))

    $: if (d) {
        h = d.getHours()
        m = d.getMinutes()
        s = d.getSeconds()
        if (twelwe) {
            if (h === 0) h = 12
            else if (h > 12) h -= 12
            pm = d.getHours() >= 12
        }
    }

    function formatTime(date: Date): string {
        const is12Hour = $timeFormat === "12"
        const format = is12Hour ? (seconds ? "h:mm:ss A" : "h:mm A") : seconds ? "HH:mm:ss" : "HH:mm"
        return dayjs(date).format(format)
    }

    function formatDateTime(date: Date, format: string) {
        if (format === "none") return ""

        // any custom formats?
        // format = format.split(" ").map((a) => (customFormats[a] ? customFormats[a]() : a)).join(" ")

        // custom language
        // https://day.js.org/docs/en/i18n/loading-into-nodejs
        // let lang = $language
        // if (lang === "no") lang = "nb"
        // does not work in this env
        // ;(await import(`dayjs/locale/${lang}`)).default
        // fetch language
        // if (!lang.includes("en")) {
        //     try {
        //         const importLanguageFile = `https://github.com/iamkun/dayjs/blob/dev/src/locale/${lang}.js`
        //         const response = await fetch(importLanguageFile)
        //         const text = await response.text()
        //         console.log(text)
        //     } catch (err) {
        //         console.error(err)
        //     }
        // }

        // .locale($language)
        return dayjs(date).format(format)
    }

    $: formattedDate = dateFormat !== "none" ? formatDateTime(d, dateFormat) : ""
    $: formattedCustom = type === "custom" ? formatDateTime(d, customFormat) : ""
    $: if (type === "digital" && dateFormat === "none" && showTime === false) showTime = true
</script>

{#if type === "analog"}
    <AnalogClock date={d} {...{ h, m, s }} {seconds} />
{:else if type === "custom"}
    <div class="clock autoFontSize" style={autoSize ? `font-size: ${autoSize}px;height: 100%;align-items: center;{$$props.style || ''}` : ""}>
        {#if style}
            <span class="colored">{formattedCustom}</span>
        {:else}
            {formattedCustom}
        {/if}
    </div>
{:else}
    <div class="clock autoFontSize" style={autoSize ? `font-size: ${autoSize}px;height: 100%;align-items: center;{$$props.style || ''}` : ""}>
        {#if style}
            <span class="colored">{("0" + h).slice(-2)}</span>:
            <span class="colored">{("0" + m).slice(-2)}</span>
            {#if seconds}<span style="font-size: 0.5em;">:{("0" + s).slice(-2)}</span>{/if}
            {#if twelwe}<span style="font-size: 0.3em;font-weight: bold;" class:colored={pm}>&nbsp;{pm ? "PM" : "AM"}</span>{/if}
        {:else}
            {#if formattedDate}{formattedDate}{/if}
            <!-- {#if formattedDate && showTime}&nbsp;{/if} -->
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
