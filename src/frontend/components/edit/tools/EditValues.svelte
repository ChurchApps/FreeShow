<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import { dictionary, imageExtensions, videoExtensions } from "../../../stores"
  import T from "../../helpers/T.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import Color from "../../inputs/Color.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import FontDropdown from "../../inputs/FontDropdown.svelte"
  import IconButton from "../../inputs/IconButton.svelte"
  import MediaPicker from "../../inputs/MediaPicker.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import { removeExtension } from "../scripts/edit"
  import EditTimer from "./EditTimer.svelte"

  export let edits: any
  export let item: any = null
  export let styles: any = {}
  export let lineAlignStyle: any
  export let alignStyle: any

  const inputs: any = {
    fontDropdown: FontDropdown,
    color: Color,
    number: NumberInput,
    dropdown: Dropdown,
    checkbox: Checkbox,
  }

  let dispatch = createEventDispatcher()
  function valueChange(e: any, input: any) {
    let value = e.detail || e.target.value
    if (input.input === "checkbox") value = e.target.checked
    else if (input.input === "number") value = Number(value)
    dispatch("change", { ...input, value })
  }

  const lineInputs: any = {
    "font-style": [
      { id: "bold", toggle: true, key: "font-weight", value: "bold" },
      { id: "italic", toggle: true, key: "font-style", value: "italic" },
      { id: "underline", toggle: true, key: "text-decoration", value: "underline" },
      { id: "strikethrough", toggle: true, key: "text-decoration", value: "line-through" },
    ],
    "align-x": [
      { id: "alignLeft", title: "left", key: "text-align", value: "left" },
      { default: true, id: "alignCenter", title: "center", key: "text-align", value: "center" },
      { id: "alignRight", title: "right", key: "text-align", value: "right" },
      { id: "alignJustify", title: "justify", key: "text-align", value: "justify" },
    ],
    "align-y": [
      { id: "alignTop", title: "top", key: "align-items", value: "flex-start" },
      { default: true, id: "alignMiddle", title: "center", key: "align-items", value: "center" },
      { id: "alignBottom", title: "bottom", key: "align-items", value: "flex-end" },
    ],
  }

  function toggle(key: string, toggleValue: string) {
    let value: string = styles[key] || ""

    let exists: number = value.indexOf(toggleValue)
    if (exists > -1) value = value.slice(0, exists) + value.substring(exists + toggleValue.length)
    else value = value + " " + toggleValue
    value = value.trim()

    dispatch("change", { key, value })
  }

  function getValue(input: any, _updater: any) {
    // if (input.id === "auto" && isAuto) return true
    if (input.valueIndex !== undefined && styles[input.key]) return removeExtension(styles[input.key].split(" ")[input.valueIndex], input.extension)
    if (input.input === "dropdown") return input.values.options.find((a: any) => a.id === (item?.[input.id] || input.value)).name
    return styles[input.key] || input.value
  }
</script>

{#each Object.keys(edits) as section, i}
  <div class="section" style={i === 0 && section !== "default" ? "margin-top: 0;" : ""}>
    {#if i > 0}<hr />{/if}
    {#if section !== "default"}
      <h6><T id="edit.{section}" /></h6>
    {/if}
    {#each edits[section] as input}
      {#if input.input === "editTimer"}
        <EditTimer {item} />
      {:else if input.input === "media"}
        <MediaPicker filter={{ name: "Media files", extensions: [...$videoExtensions, ...$imageExtensions] }} on:picked={(e) => valueChange(e, input)}>
          <p>Choose media</p>
        </MediaPicker>
      {:else if lineInputs[input.input]}
        <div class="line" style="margin-bottom: 5px;">
          {#each lineInputs[input.input] as input}
            {@const currentStyle = input.key === "align-items" ? alignStyle : input.key === "text-align" ? lineAlignStyle : styles}
            <IconButton
              on:click={() => (input.toggle ? toggle(input.key, input.value) : dispatch("change", input))}
              title={$dictionary.edit?.["_title_" + input.title || input.id]}
              icon={input.id}
              active={currentStyle[input.key] ? currentStyle[input.key]?.includes(input.value) : input.default}
            />
          {/each}
        </div>
      {:else}
        {@const value = getValue(input, { styles, item })}
        <div class="input">
          <p><T id="edit.{input.name}" /></p>
          <svelte:component
            this={inputs[input.input]}
            {...input.values || {}}
            {value}
            checked={item?.auto || false}
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
