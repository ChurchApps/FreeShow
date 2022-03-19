<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { dictionary, outLocked, outOverlays, outSlide, overlays, screen, showsCache } from "../../stores"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Textbox from "../slide/Textbox.svelte"
  import Zoomed from "../slide/Zoomed.svelte"
  import DropArea from "../system/DropArea.svelte"
  import SelectElem from "../system/SelectElem.svelte"
  import Card from "./Card.svelte"

  export let active: string | null

  let resolution: Resolution = $outSlide ? $showsCache[$outSlide.id].settings.resolution || $screen.resolution : $screen.resolution

  let filteredOverlays: any
  $: filteredOverlays = Object.keys($overlays)
    .map((id) => ({ id, ...$overlays[id] }))
    .filter((s: any) => active === "all" || active === s.category || (active === "unlabeled" && s.category === null))
</script>

<div style="position: relative;height: 100%;overflow-y: auto;">
  <DropArea id="overlays">
    <div class="grid">
      {#each filteredOverlays as overlay}
        <Card
          class="context #overlay_card"
          active={$outOverlays.includes(overlay.id)}
          label={overlay.name || "—"}
          color={overlay.color}
          {resolution}
          on:click={() => {
            if (!$outLocked) {
              outOverlays.update((o) => {
                if ($outOverlays.includes(overlay.id)) o.splice($outOverlays.indexOf(overlay.id), 1)
                else o.push(overlay.id)
                return o
              })
            }
          }}
        >
          <SelectElem id="overlay" data={overlay.id} fill draggable>
            <Zoomed {resolution} background={overlay.items.length ? "black" : "transparent"}>
              {#each overlay.items as item}
                <Textbox {item} ref={{ type: "overlay", id: overlay.id }} />
              {/each}
            </Zoomed>
          </SelectElem>
        </Card>
      {/each}
    </div>
  </DropArea>
</div>
<div class="tabs">
  <Button
    style="flex: 1;"
    on:click={() => {
      history({ id: "newOverlay" })
    }}
    center
    title={$dictionary.new?.overlay}
  >
    <Icon id="overlays" right />
    <span style="color: var(--secondary);">
      <T id="new.overlay" />
    </span>
  </Button>
</div>

<style>
  .grid {
    display: flex;
    flex-wrap: wrap;
    flex: 1;
    padding: 5px;
    place-content: flex-start;
  }

  .tabs {
    display: flex;
    background-color: var(--primary-darkest);
  }
</style>
