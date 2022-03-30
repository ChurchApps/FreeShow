<script lang="ts">
  import type { Item } from "../../../../types/Show"
  import { activeEdit, activePopup, selected } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import IconButton from "../../inputs/IconButton.svelte"
  import Panel from "../../system/Panel.svelte"
  import { addItem } from "../scripts/addItem"

  export let allSlideItems: Item[]
</script>

<Panel>
  <h6><T id="edit.add_items" /></h6>
  <div class="grid">
    <IconButton icon="text" on:click={() => addItem("text")} />
    <IconButton disabled icon="image" />
    <IconButton disabled icon="video" />
    <IconButton disabled icon="live" />
    <IconButton disabled icon="audio" />
    <IconButton icon="timer" on:click={() => addItem("timer")} />
  </div>
  <div>
    <!-- square, circle, triangle, star, heart, ... -->
    <Button
      style="width: 100%;"
      on:click={() => {
        selected.set({ id: "slide", data: [{ ...$activeEdit }] })
        activePopup.set("icon")
      }}
      dark
      center
    >
      <Icon id={"noIcon"} right />
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
