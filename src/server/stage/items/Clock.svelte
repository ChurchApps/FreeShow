<script lang="ts">
  import { timeFormat } from "../store"

  export let autoSize: number = 0
  // export let type: "digital" | "analog" = "digital"
  export let seconds: boolean = true

  $: twelwe = $timeFormat === "12"

  let d: Date = new Date()
  setInterval(() => (d = new Date()), 250)
  let h: number = 0
  let m: number = 0
  let s: number = 0
  let pm: boolean = false

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

<div style={autoSize ? `font-size: ${autoSize}px;height: 100%;align-items: center;` : ""}>
  {("0" + h).slice(-2)}:{("0" + m).slice(-2)}{#if seconds}:{("0" + s).slice(-2)}{/if}
  {#if twelwe}{pm ? "PM" : "AM"}{/if}
</div>

<style>
  div {
    display: flex;
    justify-content: center;
    align-items: baseline;
    font-size: 4em;
  }
</style>
