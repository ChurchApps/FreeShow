<script lang="ts">
    import { activeStage, stageShows, theme, themes } from "../../../stores"
    import { addStyleString } from "../../edit/scripts/textStyle"
    import EditValues from "../../edit/tools/EditValues.svelte"
    import { trackerEdits } from "../../edit/values/boxes"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getStyles } from "../../helpers/style"
    import Center from "../../system/Center.svelte"
    import { updateStageShow } from "../stage"
    import { textEdits } from "../values/text"

    $: items = $activeStage.items
    $: stageItems = $stageShows[$activeStage.id!].items
    $: item = items ? stageItems[items[0]] : null

    let edits: any = {}
    $: if (item) {
        edits = clone(textEdits)

        // custom input values
        if (items[0].includes("slide") && !items[0].includes("text") && !items[0].includes("notes") && !items[0].includes("tracker")) edits = { chords: edits.chords }
        else if (items[0].includes("tracker")) {
            let newEdits = clone(textEdits)
            delete newEdits.default
            delete newEdits.align
            delete newEdits.chords
            edits = { default: trackerEdits, font: edits.default, ...newEdits }
        } else if (items[0].includes("output")) edits = {}
    }

    let data: { [key: string]: any } = {}
    $: if (item?.style || item === null) data = getStyles(item?.style, true)

    // $: if (edits) updateAuto(item?.auto || true)
    $: if (item) updateAuto(item?.auto ?? true)
    $: if (edits.chords) {
        edits.chords[0].value = item?.chords
        edits.chords[1].hidden = !item?.chords
        edits.chords[2].hidden = !item?.chords

        if (item?.chordsData?.color) edits.chords[1].value = item.chordsData.color
        if (item?.chordsData?.size) edits.chords[2].value = item.chordsData.size
    }
    $: if (items[0]?.includes("tracker") && item?.tracker && edits.default?.[0]?.id === "tracker.type") {
        if (item.tracker.type) edits.default[0].value = item.tracker.type
        edits.default[1].value = item.tracker.accent || $themes[$theme]?.colors?.secondary || "#F0008C"
    }

    // CSS
    // WIP get only text related item styles (& combine again)?
    $: if (edits?.CSS && item?.style) edits.CSS[0].value = item.style

    // align
    let alignStyle: any = {}
    let lineAlignStyle: any = {}
    $: if (item?.align) alignStyle = { "align-items": item.align }
    $: if (item?.alignX) lineAlignStyle = { "text-align": item.alignX }

    function updateAuto(value) {
        if (!edits.default) return

        let autoIndex = edits.default.findIndex((a) => a.id === "auto")
        if (autoIndex < 0) return

        edits.default[autoIndex].value = value
    }

    function setValue(input: any) {
        let value: any = input.value
        // if (input.id === "filter") value = addFilterString(item?.filter || "", [input.key, value])
        // else if (input.key) value = { ...((item as any)?.[input.key] || {}), [input.key]: value }

        if (input.id === "auto") updateAuto(value)

        if (input.id.includes(".")) {
            let splitted = input.id.split(".")
            input.id = splitted[0]
            let newValue = item?.[input.id] || {}
            newValue[splitted[1]] = value
            value = newValue
        }

        history({ id: "UPDATE", newData: { data: value, key: "items", subkey: input.id, keys: items }, oldData: { id: $activeStage.id }, location: { page: "stage", id: "stage_item_content", override: $activeStage.id + items.join("") } })
    }

    function updateAlign(input) {
        let id = "align"
        if (input.key === "text-align") id = "alignX"

        let value = input.value

        history({ id: "UPDATE", newData: { data: value, key: "items", subkey: id, keys: items }, oldData: { id: $activeStage.id }, location: { page: "stage", id: "stage_item_content", override: $activeStage.id + items.join("") } })
    }

    function updateStyle(e: any) {
        let input = e.detail

        if (input.key === "text-align" || input.key === "align-items") updateAlign(input)

        if (input.id !== "style" && input.id !== "CSS") {
            setValue(input)
            return
        }

        let value: string = addStyleString(item!.style, [input.key, input.value]) || ""

        if (input.id === "CSS") value = input.value.replaceAll("\n", "")

        if (!value) return

        history({ id: "UPDATE", newData: { data: value, key: "items", subkey: "style", keys: items }, oldData: { id: $activeStage.id }, location: { page: "stage", id: "stage_item_content", override: $activeStage.id + items.join("") } })

        if (!timeout) {
            updateStageShow()
            timeout = setTimeout(() => {
                updateStageShow()
                timeout = null
            }, 500)
        }
    }

    let timeout: any = null
</script>

{#if item}
    <EditValues {edits} defaultEdits={clone(textEdits)} {alignStyle} {lineAlignStyle} styles={data} {item} on:change={updateStyle} />
{:else}
    <Center faded>
        <T id="empty.items" />
    </Center>
{/if}

<!-- <Panel>
  {#if items.length}
    {#each items as id, i}
      {#if i > 0}<hr />{/if}
      <h6>
        {#if id.includes("timers")}
          {#if $timers[id.split("#")[1]]?.name}
            {$timers[id.split("#")[1]].name}
          {:else}
            <T id="items.timer" />
          {/if}
        {:else}
          <T id="stage.{id.split('#')[1]}" />
        {/if}
      </h6>
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
</Panel> -->
