<script lang="ts">
  import type { Resolution } from "../../../types/Settings"
  import { activeShow, dictionary, mediaOptions, outSlide, screen, showsCache, templates } from "../../stores"
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

  let resolution: Resolution = $outSlide && $outSlide.id !== "temp" ? $showsCache[$outSlide.id].settings.resolution || $screen.resolution : $screen.resolution
  let filteredTemplates: any

  $: activeTemplate = ($activeShow && $activeShow.type === undefined) || $activeShow?.type === "show" ? $showsCache[$activeShow.id]?.settings.template : null

  // TODO: update templates
  $: if ($templates || active) updateTemplates()
  templates.subscribe(updateTemplates)

  function updateTemplates() {
    filteredTemplates = Object.keys($templates)
      .map((id) => ({ id, ...$templates[id] }))
      .filter((s: any) => active === "all" || active === s.category || (active === "unlabeled" && s.category === null))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  function wheel(e: any) {
    if (e.ctrlKey || e.metaKey) mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + e.deltaY / 100)) })
  }
</script>

<div style="position: relative;height: 100%;overflow-y: auto;" on:wheel={wheel}>
  <DropArea id="templates">
    <div class="grid">
      {#each filteredTemplates as template}
        <Card
          class="context #template_card"
          active={template.id === activeTemplate}
          label={template.name || "—"}
          color={template.color}
          {resolution}
          on:click={() => {
            if (($activeShow && $activeShow.type === undefined) || $activeShow?.type === "show")
              history({ id: "template", newData: { template: template.id, createItems: true }, location: { page: "show", show: $activeShow } })
          }}
        >
          <SelectElem id="template" data={template.id} fill draggable>
            <Zoomed {resolution} background={template.items.length ? "black" : "transparent"}>
              {#each template.items as item}
                <Textbox {item} ref={{ type: "template", id: template.id }} />
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
      history({ id: "newTemplate" })
    }}
    center
    title={$dictionary.new?.template}
  >
    <Icon id="templates" right />
    <span style="color: var(--secondary);">
      <T id="new.template" />
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
