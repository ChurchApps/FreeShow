<script lang="ts">
  import type { Item } from "../../../../types/Show"
  import { activeShow, activeEdit, shows } from "../../../stores"
  import { History, history } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"
  import Color from "../../inputs/Color.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import TextInput from "../../inputs/TextInput.svelte"
  import { getParentPos, setItemSelection } from "./TextStyle"

  let active = $activeShow?.id!

  console.log($activeEdit)
  let editSlideItems = $activeEdit.slide !== null ? $shows[active].slides[$shows[active].layouts[$shows[active].settings.activeLayout].slides[$activeEdit.slide].id].items : []

  // console.log(editSlideItems)
  // console.log($activeEdit)
  $: editSlideItems

  $: item = $activeEdit.item !== null ? $activeEdit.item : null
  // $: console.log(item)

  const defaults: { [key: string]: string } = {
    "font-size": "40",
  }

  function getStyle(id: string, _c: any = null) {
    // select active item or first item
    // TODO: check if item 0 exists...
    let styles: any = editSlideItems[item || 0]
    if (styles.text) {
      console.log(selectedTextItem)
      // TODO: fix bug...
      styles = styles.text![selectedTextItem].style.split(";")
    } else styles = styles.style.split(";")
    console.log(styles)

    let style = null
    styles.forEach((s: string) => {
      console.log(s, id)

      if (s.includes(id)) style = s.split(":")[1]
      if (s.includes(id)) console.log(s.split(":")[1])
    })
    console.log(style)

    return style || defaults[id]
  }

  function setStyle(style: any[], _e: any = null) {
    let sel: null | Selection = window.getSelection()

    let layout: string = $shows[active].settings.activeLayout
    let slide: string = $shows[active].layouts[layout].slides[$activeEdit.slide!].id
    // let itemObj: Item = $shows[active].slides[slide].items[item]

    let oldData = JSON.parse(JSON.stringify($shows[active].slides[slide].items))
    let items: Item[] = $shows[active].slides[slide].items
    // if (item) items = [items[item]]
    if (item !== null) items = [items[item]]

    // TODO: get selection
    // let sel = window.getSelection()
    // let newItem = setItemSelection({ ...itemObj }, style)
    let newItems: Item[] = setItemSelection([...items], style)
    // TODO: get all selected items!!!!
    if (item !== null) {
      let changed = newItems[0]
      newItems = $shows[active].slides[slide].items
      newItems[item] = changed
    }

    // if (!e || e.target.tagName !== "INPUT") window.getSelection()?.removeAllRanges()

    let obj: History = {
      id: "textStyle",
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

    // set new selection
    console.log(sel)
    // const selection = window.getSelection()
    // const range = document.createRange()
    // let parent: Element = sel!.anchorNode!.parentElement!.closest(".edit")!
    // setTimeout(() => {
    //   console.log(parent.children)
    // }, 1000)

    // range.setStart(parent.children[newItems[1].from.index], newItems[1].from.pos)
    // range.setEnd(parent.children[newItems[1].to.index], newItems[1].to.pos)
    // // range.selectNodeContents(parent)
    // selection?.removeAllRanges()
    // selection?.addRange(range)

    // shows.update((s) => {
    //   let items = s[active].slides[slide].items[item!]
    //   // TODO: apply remove old
    //   if (items.text) items.text[0].style += style
    //   return s
    // })
  }

  // TODO: get default value / template value

  // const editValues = [
  //   {id: "font-size", name: "text_size", icon: "size", default: 10, }
  // ]

  let selectedTextItem = 0
  function keydown(e: any) {
    let parent = window.getSelection()?.focusNode?.parentElement?.closest(".edit")
    if (parent !== null && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      let elem = window.getSelection()?.focusNode
      let pos = window.getSelection()?.focusOffset || 0
      // TODO: get end instead of start (0)
      // TODO: not updating on first leave...

      selectedTextItem = getParentPos(elem, pos, e.key === "ArrowLeft" ? "left" : "right")[1]

      // TODO: change values on caret/cursor move
    }
  }
  $: console.log(selectedTextItem)

  const colorChange = (e: any) => {
    console.log(e.value)
    setStyle(["color", colorVal], e)
  }

  // TODO: update
  $: colorVal = getStyle("color", selectedTextItem)
</script>

<svelte:window on:keydown={keydown} />

<section>
  <!-- TODO: update values based of cursor position.... -->
  {#key item}
    {#key selectedTextItem}
      <!-- {#key $activeShow?.id} -->
      <h6>[[[Font]]]</h6>
      <div style="display: flex;gap: 10px;">
        <span class="titles">
          <p>Family</p>
          <p>Style</p>
        </span>
        <!-- overflow-x: hidden; -->
        <span style="flex: 1;">
          <span>
            <!-- dropdown: system fonts, web fonts, custom (CMGSans) -->
            <Dropdown options={[{ name: "CMGSans" }, { name: "Tahoma" }, { name: "Calibri" }, { name: "Arial" }]} value="CMGSans" />
          </span>
          <span>
            <!-- font style... (bold, italic, ++) -->
            <Dropdown options={[{ name: "Normal" }, { name: "Bold" }, { name: "Italic" }, { name: "BoldItalic" }]} value="Normal" />
          </span>
        </span>
      </div>
      <hr />
      <h6>[[[Style]]]</h6>
      <div class="line">
        <Button center>
          <Icon id="bold" size={1.2} white={true} />
        </Button>
        <Button center>
          <Icon id="italic" size={1.2} white={true} />
        </Button>
        <Button center>
          <Icon id="underline" size={1.2} white={true} />
        </Button>
        <Button center>
          <Icon id="strikethrough" size={1.2} white={true} />
        </Button>
      </div>
      <div style="display: flex;gap: 10px;">
        <span class="titles">
          <p>Color</p>
          <p>Size</p>
          <p>Auto Size</p>
          <p>Line Spacing</p>
          <p>Word Spacing</p>
        </span>
        <span>
          <Color bind:value={colorVal} on:input={colorChange} />
          <span class="line">
            <Button on:click={() => setStyle(["font-size", Number(getStyle("font-size")) - 10 + "px"])} center>
              <Icon id="remove" size={1.2} white />
            </Button>
            <span class="input">
              <!-- {editSlideItems[item]} -->
              <!-- {Number(getStyle("font-size").replace(/\D+/g, "")) / 10} -->
              <TextInput value={Number(getStyle("font-size").replace(/\D+/g, "")) / 10} center />
            </span>
            <Button on:click={() => setStyle(["font-size", Number(getStyle("font-size")) + 10 + "px"])} center>
              <Icon id="add" size={1.2} white />
            </Button>
          </span>
          <span>
            <input type="checkbox" />
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
      <hr />
      <h6>[[[Align]]]</h6>
      <div class="line">
        <Button center>
          <Icon id="alignLeft" size={1.2} white={true} />
        </Button>
        <Button center>
          <Icon id="alignCenter" size={1.2} white={true} />
        </Button>
        <Button center>
          <Icon id="alignRight" size={1.2} white={true} />
        </Button>
        <Button center>
          <Icon id="alignJustify" size={1.2} white={true} />
        </Button>
      </div>
      <div class="line">
        <Button center>
          <Icon id="alignTop" size={1.2} white={true} />
        </Button>
        <Button center>
          <Icon id="alignMiddle" size={1.2} white={true} />
        </Button>
        <Button center>
          <Icon id="alignBottom" size={1.2} white={true} />
        </Button>
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
          <Color bind:value={colorVal} on:input={() => console.log("outlineColor")} />
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
        <h6>[[[Shadow]]]</h6>
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
      <!-- {/key} -->
    {/key}
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
