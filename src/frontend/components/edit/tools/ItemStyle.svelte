<script lang="ts">
  import type { Item } from "../../../../types/Show"
  import { activeEdit, activeShow, shows } from "../../../stores"
  import { history, History } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"

  import Color from "../../inputs/Color.svelte"
  import TextInput from "../../inputs/TextInput.svelte"
  import { addStyleString } from "./TextStyle"

  let active = $activeShow?.id!
  let editSlideItems = $activeEdit.slide !== null ? $shows[active].slides[$shows[active].layouts[$shows[active].settings.activeLayout].slides[$activeEdit.slide].id].items : []
  $: console.log(editSlideItems)
  // TODO: not updating in child(layout) slides

  let item = $activeEdit.item !== null ? $activeEdit.item : null

  const defaults: { [key: string]: string } = {
    "background-color": "rgb(0 0 0 / 0)",
  }

  function getStyle(id: string) {
    // select active item or first item
    // TODO: check if item 0 exists...
    let styles: any = editSlideItems[item || 0].style.split(";")

    let style = null
    styles.forEach((s: string) => {
      if (s.includes(id)) style = s.split(":")[1]
    })

    return style || defaults[id]
  }

  function setStyle(style: any[]) {
    let layout: string = $shows[active].settings.activeLayout
    let slide: string = $shows[active].layouts[layout].slides[$activeEdit.slide!].id

    let oldData = JSON.parse(JSON.stringify($shows[active].slides[slide].items))
    let items: Item[] = [...$shows[active].slides[slide].items]
    if (item !== null) items = [items[item]]

    let newItems = [...items]
    console.log(oldData[0].style)
    newItems.forEach((i) => {
      i.style = addStyleString(i.style, style)
    })
    console.log(oldData[0].style)
    if (item !== null) {
      let changed = newItems[0]
      newItems = [...$shows[active].slides[slide].items]
      newItems[item] = changed
    }

    console.log(newItems)

    // let newItem = items[item!].style

    // items[item!].style += style

    let obj: History = {
      id: "itemStyle",
      oldData: oldData, // TODO: minimize this
      newData: newItems,
      location: {
        page: "edit",
        show: { id: active },
        layout: layout,
        slide: slide,
      },
    }
    // push to history
    history(obj)
  }

  const colorChange = () => {
    setStyle(["background-color", bgColor])
  }

  $: bgColor = getStyle("background-color")

  let colorVal = "#FF00FF"
</script>

<section>
  {#key item}
    <h6>[[[Position]]]</h6>
    <div style="display: flex;gap: 10px;">
      <span class="titles">
        <p>Family</p>
        <p>Style</p>
      </span>
      <!-- overflow-x: hidden; -->
      <span style="flex: 1;">
        <span> XY </span>
        <span> WH </span>
        <span> rotation </span>
      </span>
    </div>
    <hr />
    <h6>[[[Box]]]</h6>
    <div style="display: flex;">
      <span class="titles">
        <p>Background</p>
        <p>Opacity</p>
        <p>Corner Radius</p>
      </span>
      <span>
        <Color bind:value={bgColor} on:input={colorChange} />
        <input type="range" />
        <input type="range" />
      </span>
    </div>
    <hr />
    <span>
      <input type="checkbox" />
      <h6>[[[Outline]]]</h6>
    </span>
    <!-- color, distance -->
    <div style="display: flex;gap: 10px;">
      <span class="titles">
        <p>Color</p>
        <p>Length</p>
      </span>
      <span>
        <Color bind:value={colorVal} on:input={() => console.log("color")} />
        <span class="line">
          <Button center>
            <Icon id="remove" size={1.2} white />
          </Button>
          <span class="input">
            <TextInput value={1} center />
          </span>
          <Button center>
            <Icon id="add" size={1.2} white />
          </Button>
        </span>
      </span>
    </div>
    <hr />
    <span>
      <input type="checkbox" />
      <!-- duplicate... ???? -->
      <h6>[[[Box Shadow...]]]</h6>
    </span>
    <!-- color, blur, distance, density -->
    <div style="display: flex;gap: 10px;">
      <span class="titles">
        <p>Color</p>
        <p>Angle</p>
        <p>Length</p>
        <p>Radius</p>
        <!-- <p>Density</p> -->
      </span>
      <span>
        <Color bind:value={colorVal} on:input={() => console.log("shadowColor")} />
        <span class="line">
          <Button center>
            <Icon id="remove" size={1.2} white />
          </Button>
          <span class="input">
            <TextInput value={1} center />
          </span>
          <Button center>
            <Icon id="add" size={1.2} white />
          </Button>
        </span>
        <span class="line">
          <Button center>
            <Icon id="remove" size={1.2} white />
          </Button>
          <span class="input">
            <TextInput value={1} center />
          </span>
          <Button center>
            <Icon id="add" size={1.2} white />
          </Button>
        </span>
        <span class="line">
          <Button center>
            <Icon id="remove" size={1.2} white />
          </Button>
          <span class="input">
            <TextInput value={1} center />
          </span>
          <Button center>
            <Icon id="add" size={1.2} white />
          </Button>
        </span>
      </span>
    </div>
  {/key}
</section>

<style>
  h6 {
    color: var(--text);
    text-transform: uppercase;
    text-align: center;
    font-size: 0.9em;
    margin: 20px 0;
  }

  .titles {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }

  p {
    width: 100%;
    opacity: 0.8;
    align-self: center;
    /* font-weight: bold; */
    /* text-transform: uppercase; */
    font-size: 0.9em;
  }

  /* span {
    margin: 10px 0;
  } */

  .line {
    display: flex;
    align-items: center;
    background-color: var(--primary-darker);
    flex-flow: wrap;
  }
  .line :global(button) {
    flex: 1;
  }

  .input {
    flex: 2;
    color: var(--secondary);
    font-weight: bold;
    height: 100%;
    font-size: 1.5em;
  }
  .input :global(input) {
    color: var(--secondary);
    font-weight: bold;
  }

  hr {
    width: 100%;
    height: 2px;
    background-color: var(--primary-lighter);
    border: none;
    margin: 20px 0;
  }
</style>
