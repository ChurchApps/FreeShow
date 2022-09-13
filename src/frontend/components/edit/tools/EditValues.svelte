<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import { dictionary, imageExtensions, videoExtensions } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import { getFilters } from "../../helpers/style"
  import T from "../../helpers/T.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import Color from "../../inputs/Color.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import FontDropdown from "../../inputs/FontDropdown.svelte"
  import IconButton from "../../inputs/IconButton.svelte"
  import MediaPicker from "../../inputs/MediaPicker.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import Notes from "../../show/tools/Notes.svelte"
  import { getOriginalValue, removeExtension } from "../scripts/edit"
  import EditTimer from "./EditTimer.svelte"

  export let edits: any
  export let item: any = null
  export let styles: any = {}
  export let lineAlignStyle: any = {}
  export let alignStyle: any = {}

  const inputs: any = {
    fontDropdown: FontDropdown,
    color: Color,
    number: NumberInput,
    dropdown: Dropdown,
    checkbox: Checkbox,
  }

  let dispatch = createEventDispatcher()
  function valueChange(e: any, input: any) {
    let value = e.detail || e.target?.value || null

    if (input.input === "checkbox") value = e.target.checked
    else if (input.input === "dropdown") value = value.id
    else if (input.input === "number") value = Number(value)

    if (input.extension) value += input.extension

    // the changed value is part af a larger string
    if (input.valueIndex !== undefined) {
      let inset = input.key.includes("inset_")
      if (inset) input.key = input.key.substring(6)
      let actualValue = (styles[input.key] || getOriginalValue(edits, (inset ? "inset_" : "") + input.key)).split(" ")
      if (inset && !actualValue.includes("inset")) actualValue.unshift("inset")
      actualValue[input.valueIndex] = value
      value = actualValue.join(" ")
    }

    dispatch("change", { ...input, value })
  }

  const lineInputs: any = {
    "font-style": [
      { id: "style", icon: "bold", toggle: true, key: "font-weight", value: "bold" },
      { id: "style", icon: "italic", toggle: true, key: "font-style", value: "italic" },
      { id: "style", icon: "underline", toggle: true, key: "text-decoration", value: "underline" },
      { id: "style", icon: "strikethrough", toggle: true, key: "text-decoration", value: "line-through" },
    ],
    "align-x": [
      { id: "style", icon: "alignLeft", title: "left", key: "text-align", value: "left" },
      { default: true, id: "style", icon: "alignCenter", title: "center", key: "text-align", value: "center" },
      { id: "style", icon: "alignRight", title: "right", key: "text-align", value: "right" },
      { id: "style", icon: "alignJustify", title: "justify", key: "text-align", value: "justify" },
    ],
    "align-y": [
      { id: "style", icon: "alignTop", title: "top", key: "align-items", value: "flex-start" },
      { default: true, id: "style", icon: "alignMiddle", title: "center", key: "align-items", value: "center" },
      { id: "style", icon: "alignBottom", title: "bottom", key: "align-items", value: "flex-end" },
    ],
  }

  function toggle(input: any) {
    let value: string = styles[input.key] || ""

    let exists: number = value.indexOf(input.value)
    if (exists > -1) value = value.slice(0, exists) + value.substring(exists + input.value.length)
    else value = value + " " + input.value
    value = value.trim()

    dispatch("change", { ...input, value })
  }

  function getValue(input: any, _updater: any) {
    // if (input.id === "auto" && isAuto) return true
    if (input.id.includes(".")) input.value = getItemValue(input)

    if (input.valueIndex !== undefined && styles[input.key]) return removeExtension(styles[input.key].split(" ")[input.valueIndex], input.extension)
    if (input.input === "dropdown") return input.values.options.find((a: any) => a.id === getKeyValue(input))?.name || "—"
    if (input.id === "filter") return item?.filter ? getFilters(item.filter || "")[input.key] || input.value : input.value
    return styles[input.key] || input.value
  }

  function getItemValue(input: any) {
    // get nested value
    let splitted = input.id.split(".")
    let value = item[splitted[0]]?.[splitted[1]]
    return value !== undefined ? value : input.value
  }

  function getKeyValue(input: any): string {
    if (!item || !item[input.id]) return input.value
    if (input.key) {
      if (item[input.id][input.key]) return item[input.id][input.key]
      if (!styles[input.key]) return input.value
      return styles[input.key]
    }
    return item[input.id]
  }

  $: console.log(edits)
</script>

{#each Object.keys(edits || {}) as section, i}
  <div class="section" style={i === 0 && section !== "default" ? "margin-top: 0;" : ""}>
    {#if i > 0}<hr />{/if}
    {#if section !== "default"}
      {#if section[0] === section[0].toUpperCase()}
        <h6>{section}</h6>
      {:else}
        <h6><T id="edit.{section}" /></h6>
      {/if}
    {/if}
    {#each edits[section] as input}
      {#if input.input === "editTimer"}
        <EditTimer {item} />
      {:else if input.input === "media"}
        <MediaPicker style="margin-bottom: 10px;" filter={{ name: "Media files", extensions: [...$videoExtensions, ...$imageExtensions] }} on:picked={(e) => valueChange(e, input)}>
          <Icon id="image" right />
          <T id="edit.choose_media" />
        </MediaPicker>
      {:else if lineInputs[input.input]}
        <div class="line" style="margin-bottom: 5px;">
          {#each lineInputs[input.input] as input}
            {@const currentStyle = input.key === "align-items" ? alignStyle : input.key === "text-align" ? lineAlignStyle : styles}
            <IconButton
              on:click={() => (input.toggle ? toggle(input) : dispatch("change", input))}
              title={$dictionary.edit?.["_title_" + input.title || input.icon]}
              icon={input.icon}
              active={currentStyle[input.key] ? currentStyle[input.key]?.includes(input.value) : input.default}
            />
          {/each}
        </div>
      {:else if input.input === "CSS"}
        <div class="items" style="display: flex;flex-direction: column;background: var(--primary-darker);">
          <Notes value={item?.style.replaceAll(";", ";\n") || ""} on:change={(e) => dispatch("change", { id: "CSS", value: e.detail })} />
        </div>
      {:else if !input.name}
        Missing input: {input.input}
      {:else}
        {@const value = getValue(input, { styles, item })}
        <div class="input">
          <p><T id={input.name.includes(".") ? input.name : "edit." + input.name} /></p>
          <svelte:component
            this={inputs[input.input]}
            {...input.values || {}}
            {value}
            checked={item?.[input.id] || value || false}
            on:click={(e) => valueChange(e, input)}
            on:input={(e) => valueChange(e, input)}
            on:checked={(e) => valueChange(e, input)}
            on:change={(e) => valueChange(e, input)}
          />
        </div>
      {/if}
    {/each}
  </div>
{/each}

<style>
  .section {
    display: flex;
    flex-direction: column;
    margin: 20px 10px;
    /* gap: 5px; */
  }

  h6 {
    color: var(--text);
    text-transform: uppercase;
    text-align: center;
    font-size: 0.9em;
    margin: 20px 0;
  }

  hr {
    width: 100%;
    height: 2px;
    background-color: var(--primary-lighter);
    border: none;
  }

  .line {
    display: flex;
    align-items: center;
    background-color: var(--primary-darker);
    flex-flow: wrap;
  }

  .input {
    display: flex;
    gap: 10px;
    min-height: 35px;
    align-items: center;
  }

  .input :global(input[type="color"]),
  .input :global(.dropdownElem),
  .input :global(.color) {
    min-width: 50%;
  }

  p {
    width: 100%;
    /* width: 75%; */
    opacity: 0.8;
    align-self: center;
    font-size: 0.9em;
  }
</style>
