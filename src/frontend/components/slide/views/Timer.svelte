<script lang="ts">
  import type { Item } from "../../../../types/Show"
  import { activeTimers } from "../../../stores"
  // import { blur } from "svelte/transition"
  import { format, secondsToTimes } from "../../helpers/time"

  export let item: Item
  export let ref: { type?: "show" | "stage" | "overlay" | "template"; showId?: string; id: string }

  // TODO: timer stops when leaving window...

  let times: string[] = []
  $: currentTime = $activeTimers.filter((a) => a.showId === ref.showId && a.slideId === ref.id && a.id === item.timer?.id)[0]?.currentTime
  $: numberToText(currentTime || item.timer?.start)

  function numberToText(time: number) {
    let allTimes: any = secondsToTimes(time)

    let t: string[] = []
    item.timer?.format.split(":").forEach((a: string) => t.push(format(a, allTimes)))
    times = t
  }
</script>

<div class="align" style={item.align || ""}>
  <div style="display: flex;">
    {#each times as ti, i}
      <div style="position: relative;display: flex;">
        {#each ti as t}
          <div>
            {#key t}
              <span style="position: absolute;">{t}</span>
              <!-- <span transition:blur={{ duration: 500 }} style="position: absolute;">{t}</span> -->
            {/key}
            <span style:opacity={0}>{t}</span>
          </div>
        {/each}
        <!-- style="margin: 0 10px;" -->
        {#if i % 2 === 0 && i < times.length}<span>:</span>{/if}
      </div>
    {/each}
  </div>
</div>
