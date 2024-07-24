<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { activePopup, dictionary, imageExtensions, popupData, storedEditMenuState, variables, videoExtensions } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID } from "../../helpers/array"
    import { getFileName } from "../../helpers/media"
    import { getFilters } from "../../helpers/style"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import DateInput from "../../inputs/DateInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import FontDropdown from "../../inputs/FontDropdown.svelte"
    import IconButton from "../../inputs/IconButton.svelte"
    import MediaPicker from "../../inputs/MediaPicker.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import TimeInput from "../../inputs/TimeInput.svelte"
    import Notes from "../../show/tools/Notes.svelte"
    import { getOriginalValue, removeExtension } from "../scripts/edit"
    import EditTimer from "./EditTimer.svelte"

    export let edits: any
    export let defaultEdits: any = {}
    export let item: any = null
    export let styles: any = {}
    export let lineAlignStyle: any = {}
    export let alignStyle: any = {}
    export let noClosing: boolean = false
    export let sessionId: string = ""

    const inputs: any = {
        fontDropdown: FontDropdown,
        color: Color,
        number: NumberInput,
        text: TextInput,
        dropdown: Dropdown,
        checkbox: Checkbox,
        date: DateInput,
        time: TimeInput,
    }

    let dispatch = createEventDispatcher()
    function valueChange(e: any, input: any, inputUpdate: boolean = false) {
        if (inputUpdate && input.input === "text") return

        let value = e.detail ?? e.target?.value ?? null

        if (input.input === "checkbox") value = e.target?.checked
        else if (input.input === "dropdown" || input.input === "selectVariable") value = value?.id || ""
        else if (input.input === "number") value = Number(value)
        else if (input.input === "multiselect") {
            if (input.value.includes(value)) value = input.value.filter((a) => a !== value)
            else value = [...input.value, value]
        }

        // closed update
        if (!value && e.detail !== undefined) value = e.detail

        if (input.extension) value += input.extension

        // the changed value is part af a larger string
        if (input.valueIndex !== undefined) {
            let inset = input.key.includes("inset_")
            if (inset) input.key = input.key.substring(6)
            let actualValue = (styles[input.key] || getOriginalValue(edits, (inset ? "inset_" : "") + input.key)).split(" ")
            if (inset && !actualValue.includes("inset")) actualValue.unshift("inset")
            actualValue[input.valueIndex] = value

            // update current styles value (to properly reset)
            if (styles[input.key]) {
                let splitted = styles[input.key].split(" ") || []
                if (splitted[input.valueIndex]) splitted[input.valueIndex] = value
                styles[input.key] = splitted.join(" ")
            }

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
        if (input.id?.includes(".")) input.value = getItemValue(input)

        if (input.valueIndex !== undefined && styles[input.key]) return removeExtension(styles[input.key].split(" ")[input.valueIndex], input.extension)
        if (input.input === "dropdown") return input.values.options.find((a: any) => a.id === getKeyValue(input))?.name || "—"
        if (input.input === "checkbox") return !!input.value // closed
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
        else style = input.value // "text" / custom

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

    // CLOSED STYLES

    const closed = {
        // content
        text: {
            "style_letter-spacing": 1,
        },
        lines: {
            // "style_line-height": 1.2,
            "specialStyle.lineGap": 1,
        },
        align: {
            "style_text-align": "left",
        },
        outline: {
            // "style_-webkit-text-stroke-color": "#000000",
            "style_-webkit-text-stroke-width": 2,
        },
        shadow: {
            // "style_text-shadow_3": "#000000",
            "style_text-shadow_0": 2,
            "style_text-shadow_1": 2,

            // item
            // WIP only last value updates here (both set/reset)
            "style_box-shadow_4": "rgb(0 0 0 / 0.3)",
            "style_box-shadow_0": 2,
            "style_box-shadow_1": 2,
            "style_box-shadow_2": 8,
            // "style_box-shadow_3": 0,
        },
        chords: {
            "chords.enabled": true,
            chords: true,
        },
        // media
        filters: {
            "filter_hue-rotate": 100,
        },
        special: {
            "scrolling.type": "left_right",
        },

        // item
        transform: {
            // transform_scaleX: -1,
            transform_perspective: 1,
        },
        style: {
            // WIP opacity does not get applied here
            // "style_background-color": "rgb(0 0 0 / 0.3)",
            // "(style_)background-opacity": "0.3", (this is linked to the color)
            style_padding: 10,
        },
        border: {
            "style_border-width": 5,
        },
        backdrop_filters: {
            "backdrop-filter_grayscale": 1,
        },
    }

    function checkIsClosed(id: string) {
        if (noClosing) return false

        // if ($storedEditMenuState[sessionId]?.[id] !== undefined) {
        //     return $storedEditMenuState[sessionId]?.[id]
        // }

        let closedVal = closed[id]
        let defaultEdit = defaultEdits?.[id]
        let currentEdit = clone(edits[id])

        if (!closedVal || !defaultEdit || !currentEdit) return false
        currentEdit.forEach((a, i) => {
            let lineInputValues = clone(lineInputs[a.input])
            if (!lineInputValues) return

            // set default
            let defaultValue = lineInputValues.find((a) => a.default)
            if (!defaultValue) return
            defaultEdit[i] = defaultValue

            // get value
            let lineInput = lineInputValues[0]
            let currentStyle = lineInput.key === "align-items" ? alignStyle : lineInput.key === "text-align" ? lineAlignStyle : styles
            let keyStyle = currentStyle[lineInput.key] || defaultValue.value

            let newInput = lineInputValues.find((a) => keyStyle.includes(a.value)) || { ...lineInput, value: defaultValue.value }
            currentEdit[i] = newInput
        })

        // check if value has changed
        let differentValue = currentEdit.find((currentInput: any, i: number) => {
            let defaultInput = defaultEdit[i]
            let currentValue = getValue(currentInput, {})
            let defaultValue = defaultInput.value

            if (currentInput.name === "background_opacity") return false

            // convert "0" to 0, but no false or ""
            if (Number(currentValue) == currentValue && typeof currentValue !== "boolean" && currentValue.toString().length) currentValue = Number(currentValue)

            if (defaultInput.input === "dropdown") {
                if (!currentValue.includes(defaultValue)) return true
            } else if (defaultValue !== currentValue) return true

            return false
        })

        let state = !differentValue

        // if (sessionId) {
        //     storedEditMenuState.update((a) => {
        //         if (!a[sessionId]) a[sessionId] = {}
        //         a[sessionId][id] = state

        //         return a
        //     })
        // }

        return state
    }

    // function updateMenu() {
    //     if ($storedEditMenuState[sessionId]) storedEditMenuState.set({})
    //     updateClosed = true
    //     // WIP some menus won't close on first update
    // }

    function openEdit(id: string) {
        storedEditMenuState.update((a) => {
            if (!a[sessionId]) a[sessionId] = []
            if (!a[sessionId].includes(id)) a[sessionId].push(id)

            return a
        })
    }

    // WIP this will apply a default value (could be useful in some cases (like shadows), but was more confusing)
    // let updateClosed: boolean = false
    // function openEdit(id: string) {
    //     let closedVal = clone(closed[id])
    //     let currentEdit = clone(edits[id])

    //     if (!closedVal || !currentEdit) return
    //     currentEdit = currentEdit.map((a) => lineInputs[a.input] || a).flat()

    //     currentEdit.forEach((input: any) => {
    //         let newValue = Object.entries(closedVal).find(([styleId, _value]: any) => {
    //             let dataId: string = styleId.split("_")[0]
    //             let key: string | undefined = styleId.split("_")[1]
    //             let valueIndex: string | undefined = styleId.split("_")[2]

    //             if (valueIndex) return input.valueIndex === Number(valueIndex)
    //             else if (key) return input.key === key
    //             else return input.id === dataId
    //         })?.[1]

    //         if (newValue === undefined) return

    //         valueChange({ detail: newValue }, input)
    //     })

    //     updateMenu()
    // }

    function resetAndClose(id: string) {
        let closedVal = closed[id]
        let defaultEdit = clone(defaultEdits?.[id])
        let currentEdit = clone(edits[id])
        console.log(defaultEdit, currentEdit)

        if (!closedVal || !defaultEdit || !currentEdit) return

        resetInput()
        function resetInput(i: number = 0) {
            let input = currentEdit[i]
            if (!input) return
            if (input.name === "background_opacity") return resetInput(i + 1)

            if (lineInputs[input.input]) {
                input = lineInputs[input.input]?.[0] || {}
                defaultEdit[i] = { value: "center" }
            }

            // TODO: remove value instead of setting to default...
            let newValue = defaultEdit[i]?.value
            let currentValue = getValue(input, { styles, item })
            if (newValue == currentValue) return resetInput(i + 1)

            valueChange({ detail: newValue }, input)

            setTimeout(() => resetInput(i + 1), 10)
        }

        // update menu state after values have changed!
        let timeout = currentEdit.length * 10 + 30
        setTimeout(() => {
            storedEditMenuState.update((a) => {
                let currentTabIndex = a[sessionId].indexOf(id)
                if (currentTabIndex > -1) a[sessionId].splice(currentTabIndex, 1)

                return a
            })
        }, timeout)
    }

    let cssClosed: boolean = true

    $: if (sessionId) updateSectionsState()
    function updateSectionsState() {
        storedEditMenuState.update((a) => {
            if (!a[sessionId]) a[sessionId] = []

            Object.keys(edits || {}).forEach((section) => {
                if (a[sessionId].includes(section)) return
                if (!checkIsClosed(section)) a[sessionId].push(section)
            })

            return a
        })
    }
</script>

{#each Object.keys(edits || {}) as section, i}
    <div class="section" class:top={section === "default"} style={i === 0 && section !== "default" ? "margin-top: 0;" : ""}>
        {#if !$storedEditMenuState[sessionId]?.includes(section)}
            <Button on:click={() => openEdit(section)} style="margin-top: 5px;" dark bold={false}>
                <Icon id={section} right />
                <p style="font-size: 1.2em;opacity: 1;width: initial;"><T id="edit.{section}" /></p>
            </Button>
        {:else}
            {#if section !== "default" && (section !== "CSS" || !cssClosed)}
                <h6 style="display: flex;justify-content: center;align-items: center;position: relative;">
                    {#if section[0] === section[0].toUpperCase()}
                        {section}
                    {:else}
                        <T id="edit.{section}" />
                    {/if}

                    {#if !noClosing && closed[section]}
                        <Button style="position: absolute;right: 0;" on:click={() => resetAndClose(section)} title={$dictionary.actions?.reset}><Icon id="reset" white /></Button>
                    {/if}
                </h6>
            {/if}
            {#each edits[section] as input}
                {#if input.input === "editTimer"}
                    <EditTimer {item} on:change={(e) => valueChange(e, input)} />
                {:else if input.input === "selectVariable"}
                    <CombinedInput>
                        <p title={$dictionary.items?.variable}><T id="items.variable" /></p>
                        <Dropdown value={Object.entries($variables).find(([id]) => id === input.value)?.[1]?.name || "—"} options={keysToID($variables)} on:click={(e) => valueChange(e, input)} />
                    </CombinedInput>
                {:else if input.input === "tip"}
                    <p class="tip">
                        <T id={input.name} />
                        {input.values?.subtext || ""}
                    </p>
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
                    <MediaPicker
                        id={"item_" + sessionId}
                        title={input.value}
                        style="overflow: hidden;margin-bottom: 10px;"
                        filter={{ name: "Media files", extensions: [...$videoExtensions, ...$imageExtensions] }}
                        on:picked={(e) => valueChange(e, input)}
                    >
                        <Icon id="image" right />
                        {#if input.value}
                            <p style="padding: 0;opacity: 1;">{getFileName(input.value)}</p>
                        {:else}
                            <p style="padding: 0;"><T id="edit.choose_media" /></p>
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
                    {#if cssClosed}
                        <Button on:click={() => (cssClosed = false)} style="margin-top: 5px;" dark bold={false}>
                            <Icon id="code" right />
                            <p style="font-size: 1.2em;opacity: 1;width: initial;">CSS</p>
                        </Button>
                    {:else}
                        <div class="items CSS" style="display: flex;flex-direction: column;background: var(--primary-darker);">
                            <Notes lines={8} value={getStyleString(input)} on:change={(e) => dispatch("change", { id: input.id === "text" ? "CSS" : input.id, value: e.detail })} />
                        </div>
                    {/if}
                {:else if input.input === "checkbox"}
                    {@const value = getValue(input, { styles, item })}
                    {#if !input.hidden}
                        <CombinedInput>
                            <p title={$dictionary[input.name.includes(".") ? input.name.split(".")[0] : "edit"]?.[input.name.includes(".") ? input.name.split(".")[1] : input.name]}>
                                <T id={input.name.includes(".") ? input.name : "edit." + input.name} />
                            </p>
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
                            <p title={$dictionary[input.name.includes(".") ? input.name.split(".")[0] : "edit"]?.[input.name.includes(".") ? input.name.split(".")[1] : input.name]}>
                                <T id={input.name.includes(".") ? input.name : "edit." + input.name} />
                            </p>
                            <svelte:component
                                this={inputs[input.input]}
                                {...input.values || {}}
                                {value}
                                disabled={input.disabled && (item?.[input.disabled] || edits[section].find((a) => a.id === input.disabled)?.value)}
                                enableNoColor={input.enableNoColor}
                                disableHold
                                on:click={(e) => valueChange(e, input)}
                                on:input={(e) => valueChange(e, input, true)}
                                on:change={(e) => valueChange(e, input)}
                            />
                        </CombinedInput>
                    {/if}
                {/if}
            {/each}
        {/if}
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

    .tip {
        font-size: 0.8em;
        opacity: 0.8;
        text-align: center;
        padding: 8px;
    }
</style>
