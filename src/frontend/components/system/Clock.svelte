<script lang="ts">
  import { timeFormat } from "../../stores"
  import AnalogClock from "./AnalogClock.svelte"

  export let style: boolean = true
  export let autoSize: number = 0
  export let type: "digital" | "analog" | "custom" = "digital"
  export let format: string = "HH:mm"
  export let seconds: boolean = false

  $: twelwe = $timeFormat === "12"

  let d: Date = new Date()
  setInterval(() => (d = new Date()), 250)
  let h: number = 0
  let m: number = 0
  let s: number = 0
  let pm: boolean = false

  function formatDate(date: Date, formatStr: string): string {
    const tokens = {
      'HH': ('0' + date.getHours()).slice(-2),
      'H': date.getHours().toString(),
      'h': ((date.getHours() % 12) || 12).toString(),
      'hh': ('0' + ((date.getHours() % 12) || 12)).slice(-2),
      'mm': ('0' + date.getMinutes()).slice(-2),
      'm': date.getMinutes().toString(),
      'ss': ('0' + date.getSeconds()).slice(-2),
      's': date.getSeconds().toString(),
      'A': date.getHours() >= 12 ? 'PM' : 'AM',
      'a': date.getHours() >= 12 ? 'pm' : 'am',
      'dddd': date.toLocaleString('en-US', { weekday: 'long' }),
      'ddd': date.toLocaleString('en-US', { weekday: 'short' }),
      'YYYY': date.getFullYear().toString(),
      'MM': ('0' + (date.getMonth() + 1)).slice(-2),
      'M': (date.getMonth() + 1).toString(),
      'DD': ('0' + date.getDate()).slice(-2),
      'D': date.getDate().toString()
    }
    
    return formatStr.replace(/HH|hh|H|h|mm|m|ss|s|A|a|dddd|ddd|YYYY|MM|M|DD|D/g, match => tokens[match])
  }

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
</script>

{#if type === "analog"}
  <AnalogClock date={d} {...{ h, m, s }} />
{:else if type === "custom"}
  <div style={autoSize ? `font-size: ${autoSize}px;height: 100%;align-items: center;` : ""}>
    {formatDate(d, format)}
  </div>
{:else}
  <div style={autoSize ? `font-size: ${autoSize}px;height: 100%;align-items: center;` : ""}>
    {#if style}
      <span class="colored">{("0" + h).slice(-2)}</span>:
      <span class="colored">{("0" + m).slice(-2)}</span>
      {#if seconds}<span style="font-size: 0.5em;">:{("0" + s).slice(-2)}</span>{/if}
      {#if twelwe}<span style="font-size: 0.3em;font-weight: bold;" class:colored={pm}>&nbsp;{pm ? "PM" : "AM"}</span>{/if}
    {:else}
      {("0" + h).slice(-2)}:{("0" + m).slice(-2)}{#if seconds}:{("0" + s).slice(-2)}{/if}
      {#if twelwe}{pm ? "PM" : "AM"}{/if}
    {/if}
  </div>
{/if}

<style>
  div {
    display: flex;
    justify-content: center;
    align-items: baseline;
    font-size: 4em;
  }

  .colored {
    color: var(--secondary);
  }
</style>