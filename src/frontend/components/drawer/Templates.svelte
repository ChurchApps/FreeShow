<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { activeShow, outSlide, screen, shows, templates } from "../../stores"
  import { history } from "../helpers/history"
  import Textbox from "../slide/Textbox.svelte"
  import Zoomed from "../slide/Zoomed.svelte"
  import DropArea from "../system/DropArea.svelte"
  import SelectElem from "../system/SelectElem.svelte"
  import Card from "./Card.svelte"

  let resolution: Resolution = $outSlide ? $shows[$outSlide.id].settings.resolution || $screen.resolution : $screen.resolution

  $: activeTemplate = ($activeShow && $activeShow.type === undefined) || $activeShow?.type === "show" ? $shows[$activeShow.id].settings.template : null
</script>

<div style="position: relative;height: 100%;">
  <DropArea id="templates">
    <div class="grid">
      {#each Object.entries($templates) as [id, overlay]}
        <Card
          active={id === activeTemplate}
          label={overlay.name || "—"}
          color={overlay.color}
          {resolution}
          on:click={() => {
            if (($activeShow && $activeShow.type === undefined) || $activeShow?.type === "show")
              history({ id: "template", newData: { template: id }, location: { page: "show", show: $activeShow } })
          }}
        >
          <SelectElem id="template" data={id} fill draggable>
            <Zoomed {resolution} background={overlay.items.length ? "black" : "transparent"}>
              {#each overlay.items as item}
                <Textbox {item} />
              {/each}
            </Zoomed>
          </SelectElem>
        </Card>
      {/each}
    </div>
  </DropArea>
</div>

<style>
  .grid {
    display: flex;
    flex-wrap: wrap;
    flex: 1;
    padding: 5px;
    place-content: flex-start;
  }
</style>
