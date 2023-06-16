<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { activePopup, dictionary, imageExtensions, popupData, videoExtensions } from "../../../stores"
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
    import Button from "../../inputs/Button.svelte"
    import { getFileName } from "../../helpers/media"
    import CombinedInput from "../../inputs/CombinedInput.svelte"

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
        else if (input.input === "multiselect") {
            if (input.value.includes(value)) value = input.value.filter((a) => a !== value)
            else value = [...input.value, value]
        }

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
        if (input.id === "filter" || input.id === "backdrop-filter") return item?.filter ? getFilters(item.filter || "")[input.key] || input.value : input.value
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

    // $: if (input.input === "CSS" && item) getStyleString()
    function getStyleString(input: any) {
        let style = ""
        if (input.id === "item") style = item?.style
        if (input.id === "text") style = input.value

        if (!style) return ""

        // sort alphabetically
        let split = style.split(";").filter((a) => a)
        let sorted = split.sort((a, b) => a.localeCompare(b))
        style = sorted.join(";") + ";"

        style = style.replaceAll(";", ";\n").replaceAll(": ", ":").replaceAll(":", ": ").trim()
        return style
    }

    $: if ($activePopup === null && $popupData.value) findChangedInput()
    function findChangedInput() {
        let changedInput = edits[$popupData.section]?.find((a) => a.id === $popupData.id)
        if (!changedInput) return

        changedInput.value = $popupData.value
        valueChange({ detail: changedInput.value }, changedInput)
    }
</script>

{#each Object.keys(edits || {}) as section, i}
    <div class="section" class:top={section === "default"} style={i === 0 && section !== "default" ? "margin-top: 0;" : ""}>
        <!-- {#if i > 0}<hr />{/if} -->
        {#if section !== "default"}
            {#if section[0] === section[0].toUpperCase()}
                <h6>{section}</h6>
            {:else}
                <h6><T id="edit.{section}" /></h6>
            {/if}
        {/if}
        {#each edits[section] as input}
            {#if input.input === "editTimer"}
                <EditTimer {item} on:change={(e) => valueChange(e, input)} />
            {:else if input.input === "popup"}
                <CombinedInput>
                    <Button
                        style="width: 100%;"
                        on:click={() => {
                            activePopup.set(input.popup || input.id)
                            let data = { id: input.id, section, value: input.value, type: "" }
                            if (input.id === "list.items") data.type = edits[section].find((a) => a.id === "list.style")?.value
                            popupData.set(data)
                        }}
                        dark
                        center
                    >
                        <Icon id={input.icon || input.id} right />
                        <T id={input.name.includes(".") ? input.name : "popup." + input.name} />
                    </Button>
                </CombinedInput>
            {:else if input.input === "media"}
                <MediaPicker title={input.value} style="margin-bottom: 10px;" filter={{ name: "Media files", extensions: [...$videoExtensions, ...$imageExtensions] }} on:picked={(e) => valueChange(e, input)}>
                    <Icon id="image" right />
                    {#if input.value}
                        {getFileName(input.value)}
                    {:else}
                        <T id="edit.choose_media" />
                    {/if}
                </MediaPicker>
            {:else if input.input === "multiselect"}
                <div class="line">
                    {#each input.values as option}
                        <Button
                            on:click={() => valueChange({ detail: option.id }, input)}
                            style={input.value.includes(option.id) ? "flex: 1;border-bottom: 2px solid var(--secondary) !important;" : "flex: 1;border-bottom: 2px solid var(--primary-lighter);"}
                            bold={false}
                            center
                            dark
                        >
                            {#if option.icon}
                                <Icon id={option.icon} right />
                            {/if}
                            <T id={option.name} />
                        </Button>
                    {/each}
                </div>
            {:else if lineInputs[input.input]}
                <!-- <div class="line" style="border-bottom: 2px solid var(--primary-lighter);"> -->
                <CombinedInput>
                    {#each lineInputs[input.input] as lineInput}
                        {@const currentStyle = lineInput.key === "align-items" ? alignStyle : lineInput.key === "text-align" ? lineAlignStyle : styles}
                        <IconButton
                            on:click={() => (lineInput.toggle ? toggle(lineInput) : dispatch("change", lineInput))}
                            title={$dictionary.edit?.["_title_" + lineInput.title || lineInput.icon]}
                            icon={lineInput.icon}
                            active={currentStyle[lineInput.key] ? currentStyle[lineInput.key]?.includes(lineInput.value) : lineInput.default}
                        />
                    {/each}
                </CombinedInput>
                <!-- </div> -->
            {:else if input.input === "CSS"}
                <div class="items CSS" style="display: flex;flex-direction: column;background: var(--primary-darker);">
                    <Notes value={getStyleString(input)} on:change={(e) => dispatch("change", { id: "CSS", value: e.detail })} />
                </div>
            {:else if input.input === "checkbox"}
                {@const value = getValue(input, { styles, item })}
                {#if !input.hidden}
                    <CombinedInput>
                        <p><T id={input.name.includes(".") ? input.name : "edit." + input.name} /></p>
                        <div class="alignRight">
                            <Checkbox {...input.values || {}} checked={item?.[input.id] || value || false} disabled={input.disabled && edits[section].find((a) => a.id === input.disabled)?.value} on:change={(e) => valueChange(e, input)} />
                        </div>
                    </CombinedInput>
                {/if}
            {:else if !input.name}
                Missing input name: {input.input}
            {:else}
                {@const value = getValue(input, { styles, item })}
                {#if !input.hidden}
                    <CombinedInput>
                        <p title={$dictionary[input.name.includes(".") ? input.name.split(".")[0] : "edit"][input.name.includes(".") ? input.name.split(".")[1] : input.name]}><T id={input.name.includes(".") ? input.name : "edit." + input.name} /></p>
                        <svelte:component
                            this={inputs[input.input]}
                            {...input.values || {}}
                            {value}
                            disabled={input.disabled && edits[section].find((a) => a.id === input.disabled)?.value}
                            on:click={(e) => valueChange(e, input)}
                            on:input={(e) => valueChange(e, input)}
                            on:change={(e) => valueChange(e, input)}
                        />
                    </CombinedInput>
                {/if}
            {/if}
        {/each}
    </div>
{/each}

<style>
    .section {
        display: flex;
        flex-direction: column;
        margin: 0 10px;
        /* margin: 20px 10px; */
        /* gap: 5px; */
    }
    .section:last-child {
        margin-bottom: 10px;
    }
    .section.top {
        margin-top: 10px;
    }

    h6 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }

    /* hr {
        width: 100%;
        height: 2px;
        background-color: var(--primary-lighter);
        border: none;
    } */

    .line {
        display: flex;
        align-items: center;
        background-color: var(--primary-darker);
        flex-flow: wrap;
    }

    div :global(input[type="color"]),
    div :global(.dropdownElem),
    div :global(.color) {
        min-width: 50% !important;
    }

    p {
        width: 100%;
        /* width: 75%; */
        opacity: 0.8;
        align-self: center;
        font-size: 0.9em;

        overflow: hidden !important;
    }
</style>
