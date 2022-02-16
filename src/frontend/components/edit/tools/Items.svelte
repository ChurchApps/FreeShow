<script lang="ts">
  import type { Item } from "../../../../types/Show"
  import { activeEdit, activePopup, activeShow } from "../../../stores"
  import { GetLayout } from "../../helpers/get"
  import { history } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import IconButton from "../../inputs/IconButton.svelte"
  import Panel from "../../system/Panel.svelte"

  export let allSlideItems: Item[]

  function add(type: "text" | "shape" | "image" | "video" | "music") {
    let newData: Item = {
      style: "",
      type,
    }
    if (type === "text") newData.text = [{ value: "", style: "" }]
    console.log(newData)

    history({
      id: "newItem",
      oldData: null,
      newData,
      location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id },
    })
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
  </div>
  <!-- <hr />
  <h6><T id="edit.add_icons" /></h6> -->
  <div>
    <Button style="width: 100%;" on:click={() => activePopup.set("icon")} dark center>Add SVG</Button>
  </div>
  <hr />
  <!-- square, circle, triangle, star, heart, ... -->
  <!-- <h6><T id="edit.add_shapes" /></h6>
  <div class="grid">
    <IconButton icon="text" />
    <IconButton icon="text" />
    <IconButton icon="text" />
    <IconButton icon="text" />
    <IconButton icon="text" />
    <IconButton icon="text" />
    <IconButton icon="text" />
    <IconButton icon="text" />
  </div>
  <hr /> -->
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
