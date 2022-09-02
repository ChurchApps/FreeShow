<script lang="ts">
  import type { Item } from "../../../../types/Show"
  import { activeEdit, activeShow } from "../../../stores"
  import { history } from "../../helpers/history"
  import { _show } from "../../helpers/shows"
  import { getStyles } from "../../helpers/style"
  import { addFilterString, addStyleString } from "../scripts/textStyle"
  import { itemEdits } from "../values/item"
  import EditValues from "./EditValues.svelte"

  export let allSlideItems: Item[]
  export let item: Item | null

  let data: { [key: string]: any } = {}

  $: if (item?.style || item === null) data = getStyles(item?.style, true)

  function updateStyle(e: any) {
    let input = e.detail

    if (input.id === "transform") {
      input.value = addFilterString(data.transform || "", [input.key, input.value])
      input.key = "transform"
    }

    let allItems: number[] = $activeEdit.items

    // update all items if nothing is selected
    if (!allItems.length) allSlideItems.forEach((_item, i) => allItems.push(i))

    let values: any = []

    // loop through all items
    allItems.forEach((itemIndex) => {
      values.push(addStyleString(allSlideItems[itemIndex].style, [input.key, input.value]))
    })

    if (input.id === "CSS") {
      values = [input.value.replaceAll("\n", "")]
      // only change one selected
      allItems = [allItems[0]]
    }

    if (!values.length) return

    if ($activeEdit.id) {
      history({
        id: $activeEdit.type === "template" ? "updateTemplate" : "updateOverlay",
        newData: { key: "items", data: values },
        location: { page: "edit", id: $activeEdit.id, items: allItems },
      })
      return
    }

    let ref: any[] = _show("active").layouts("active").ref()[0]
    history({
      id: "setItems",
      newData: { style: { key: "style", values } },
      location: { page: "edit", show: $activeShow!, slide: ref[$activeEdit.slide!].id, items: allItems },
    })
  }
</script>

<EditValues edits={itemEdits} styles={data} {item} on:change={updateStyle} />
