<script lang="ts">
  import { uid } from "uid"

  import type { Item } from "../../../../types/Show"
  import { activeEdit, activePopup, activeShow, overlays } from "../../../stores"
  import { GetLayout } from "../../helpers/get"
  import { history } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import IconButton from "../../inputs/IconButton.svelte"
  import Panel from "../../system/Panel.svelte"

  export let allSlideItems: Item[]

  function add(type: "text" | "shape" | "image" | "video" | "audio" | "timer") {
    let newData: Item = {
      style: "",
      type,
    }
    if (type === "text") newData.lines = [{ align: "", text: [{ value: "", style: "" }] }]
    else if (type === "timer") newData.timer = { id: uid(), name: "", type: "countdown", start: 300, end: 0, format: "MM:SS" }
    console.log(newData)

    if ($activeEdit.type === "overlay") {
      // TODO: history
      overlays.update((a) => {
        a[$activeEdit.id!].items.push(newData)
        return a
      })
    } else if (!$activeEdit.id) {
      history({
        id: "newItem",
        oldData: null,
        newData,
        location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id },
      })
    }
  }
</script>

<Panel>
  <h6><T id="edit.add_items" /></h6>
  <div class="grid">
    <IconButton icon="text" on:click={() => add("text")} />
    <IconButton icon="image" />
    <IconButton icon="video" />
    <IconButton icon="live" />
    <IconButton icon="audio" />
    <IconButton icon="timer" on:click={() => add("timer")} />
  </div>
  <div>
    <!-- square, circle, triangle, star, heart, ... -->
    <Button style="width: 100%;" on:click={() => activePopup.set("icon")} dark center>
      <T id="edit.add_icons" />
    </Button>
  </div>
  <hr />
  <h6><T id="edit.arrange_items" /></h6>
  <div class="items" style="display: flex;flex-direction: column;">
    {#each allSlideItems as currentItem, i}
      <Button
        active={$activeEdit.items.includes(i)}
        on:click={() =>
          activeEdit.update((ae) => {
            if (ae.items.includes(i)) ae.items.splice(ae.items.indexOf(i), 1)
            else ae.items.push(i)
            return ae
          })}
      >
        <Icon id={currentItem.type || "item"} />
        <p>{i}</p>
      </Button>
    {/each}
  </div>
</Panel>

<!-- <section>Items order layers / add new items (text/shapes/image?/video/music...)</section> -->

<!-- new from template.. ? -->
<!-- grid view add new items... -->

<!-- TODO: select item / bring to center / delete ...  -->
<style>
  .items :global(button) {
    width: 100%;
  }

  .grid {
    display: flex;
    /* gap: 10px; */
    flex-wrap: wrap;
  }
  .grid :global(button) {
    flex: 1;
    background-color: var(--primary-darker);
    padding: 20px;
  }
</style>
