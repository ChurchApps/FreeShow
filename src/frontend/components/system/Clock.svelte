<script lang="ts">
  import AnalogClock from "./AnalogClock.svelte"
  import dayjs from "dayjs"
  import localizedFormat from "dayjs/plugin/localizedFormat"

  // Initialize plugins
  dayjs.extend(localizedFormat)

  export let style: boolean = true
  export let autoSize: number = 0
  export let type: "digital" | "analog" | "custom" = "digital"
  export let dateFormat: string = "none"
  export let timeFormat: string = "hh:mm a"
  export let customFormat: string = "hh:mm a"

  let d: Date = new Date()
  setInterval(() => (d = new Date()), 250)

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
  $: formattedTime = timeFormat !== "none" ? formatDateTime(d, timeFormat) : ""
  $: formattedCustom = type === "custom" ? formatDateTime(d, customFormat) : ""
</script>

{#if type === "analog"}
  <AnalogClock date={d} />
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
      {#if formattedDate && formattedTime}&nbsp;{/if}
      {#if formattedTime}<span class="colored">{formattedTime}</span>{/if}
    {:else}
      {#if formattedDate}{formattedDate}{/if}
      {#if formattedDate && formattedTime}&nbsp;{/if}
      {#if formattedTime}{formattedTime}{/if}
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