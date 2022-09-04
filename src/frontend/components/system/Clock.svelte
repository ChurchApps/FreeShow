<script lang="ts">
  import { timeFormat } from "../../stores"

  export let style: boolean = true

  $: twelwe = $timeFormat === "12"
  // TODO: auto detect
  // don't know if this works properly
  // $: twelwe = (new Date(2022, 0, 1, 13, 0)).getHours() === 1
  // $: twelwe = (new Date(2022, 0, 1, 15, 0)).toLocaleString().includes("3")

  let d = new Date()
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

<div>
  {#if style}
    <span class="colored">{("0" + h).slice(-2)}</span>:
    <span class="colored">{("0" + m).slice(-2)}</span>
    <span style="font-size: 0.5em;">:{("0" + s).slice(-2)}</span>
    {#if twelwe}<span style="font-size: 0.3em;font-weight: bold;" class:colored={pm}>&nbsp;{pm ? "PM" : "AM"}</span>{/if}
  {:else}
    {("0" + h).slice(-2)}:{("0" + m).slice(-2)}:{("0" + s).slice(-2)}
    {#if twelwe}{pm ? "PM" : "AM"}{/if}
  {/if}
</div>

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
