<script lang="ts">
  import { activeStage, dictionary, stageShows } from "../../../stores"
  import { addStyleString } from "../../edit/tools/textStyle"
  import { history } from "../../helpers/history"
  import { getStyles } from "../../helpers/style"
  import T from "../../helpers/T.svelte"
  import Color from "../../inputs/Color.svelte"
  import IconButton from "../../inputs/IconButton.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import Center from "../../system/Center.svelte"
  import Panel from "../../system/Panel.svelte"

  let style: any = {}
  let align: any = {}

  $: items = $activeStage.items
  $: allItems = $stageShows[$activeStage.id!].items

  $: {
    if (items) setStyle()
  }

  setStyle()
  function setStyle() {
    Object.entries($stageShows[$activeStage.id!].items).forEach(([id, item]: any) => {
      let styles = getStyles(item.style, true)
      let aligns = getStyles(item.align)
      if (!style[id]) style[id] = {}
      if (!align[id]) align[id] = {}
      Object.entries(styles).forEach(([key, value]: any) => (style[id][key] = value))
      Object.entries(aligns).forEach(([key, value]: any) => (align[id][key] = value))
    })
    console.log(style)
  }

  const defaults: { [key: string]: any } = {
    color: "#FFFFFF",
    "font-size": 100,
    "text-align": "center",
    "align-items": "center",
    zeros: 0,
    overrun: "#FF0000",
  }

  const getTitles = (id: string) => {
    let category = id.split("#")[0]
    let titles = ["color", "font-size"]
    if (category === "timers" || category === "countdowns") titles.push("zeros")
    if (category === "countdowns") titles.push("overrun")
    return titles
  }

  const inputChange = (e: any, key: string) => update(key, e.target.value)
  function update(key: string, newStyle: any, aligns: boolean = false) {
    console.log(key, newStyle)

    let textStyle = newStyle
    if (key === "font-size") textStyle += "px"

    let newData: any = []
    let oldData: any = []
    // loop through all items
    items.forEach((id) => {
      if (aligns) {
        if (!align[id]) align[id] = {}
        if (newStyle === undefined || newStyle === null || !newStyle.toString().length) newStyle = defaults[key]
        align[id][key] = newStyle
      } else {
        if (!style[id]) style[id] = {}
        if (newStyle === undefined || newStyle === null || !newStyle.toString().length) newStyle = defaults[key]
        style[id][key] = newStyle
      }

      oldData.push(allItems[id][align ? "align" : "style"])
      newData.push(aligns ? addStyleString(allItems[id].align, [key, textStyle]) : addStyleString(allItems[id].style, [key, textStyle]))
    })

    history({
      id: aligns ? "stageItemAlign" : "stageItemStyle",
      oldData,
      newData,
      location: { page: "stage", slide: $activeStage.id!, items },
    })
  }
</script>

<Panel>
  {#if items.length}
    {#each items as id, i}
      {#if i > 0}<hr />{/if}
      <h6><T id="stage.{id.split('#')[1]}" /></h6>
      <div class="gap">
        <div class="titles">
          {#each getTitles(id) as title}
            <p><T id="stage.{title}" /></p>
          {/each}
        </div>
        <div style="flex: 1;">
          {#each getTitles(id) as title}
            {#if title === "color" || title === "overrun"}
              <Color value={style[id][title] || defaults[title]} on:input={(e) => inputChange(e, title)} />
            {:else}
              <NumberInput value={style[id][title] || defaults[title]} on:change={(e) => update(title, e.detail)} />
            {/if}
          {/each}
        </div>
      </div>

      <div class="line" style="margin-top: 10px;">
        <IconButton on:click={() => update("text-align", "left", true)} title={$dictionary.edit._title_left} icon="alignLeft" active={align[id]?.["text-align"] === "left"} />
        <IconButton
          on:click={() => update("text-align", "center", true)}
          title={$dictionary.edit._title_center}
          icon="alignCenter"
          active={align[id]?.["text-align"] === "center" || !align[id]?.["text-align"]}
        />
        <IconButton on:click={() => update("text-align", "right", true)} title={$dictionary.edit._title_right} icon="alignRight" active={align[id]?.["text-align"] === "right"} />
        <IconButton
          on:click={() => update("text-align", "justify", true)}
          title={$dictionary.edit._title_justify}
          icon="alignJustify"
          active={align[id]?.["text-align"] === "justify"}
        />
      </div>
      <div class="line">
        <IconButton
          on:click={() => update("align-items", "flex-start", true)}
          title={$dictionary.edit._title_top}
          icon="alignTop"
          active={align[id]?.["align-items"] === "flex-start"}
        />
        <IconButton
          on:click={() => update("align-items", "center", true)}
          title={$dictionary.edit._title_center}
          icon="alignMiddle"
          active={align[id]?.["align-items"] === "center" || !align[id]?.["align-items"]}
        />
        <IconButton
          on:click={() => update("align-items", "flex-end", true)}
          title={$dictionary.edit._title_bottom}
          icon="alignBottom"
          active={align[id]?.["align-items"] === "flex-end"}
        />
      </div>
    {/each}
  {:else}
    <Center faded>
      <T id="empty.items" />
    </Center>
  {/if}
</Panel>
