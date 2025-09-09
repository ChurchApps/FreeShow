<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { uid } from "uid"
    import type { Item } from "../../../../types/Show"
    import type { StageItem } from "../../../../types/Stage"
    import { activePopup, dictionary, actions, popupData, storedEditMenuState, variables } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
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
    import Slider from "../../inputs/Slider.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import TimeInput from "../../inputs/TimeInput.svelte"
    import Notes from "../../show/tools/Notes.svelte"
    import { getOriginalValue, openDrawer, removeExtension } from "../scripts/edit"
    import type { EditInput } from "../values/boxes"
    import EditTimer from "./EditTimer.svelte"
    import { mediaExtensions } from "../../../values/extensions"

    export let edits: { [key: string]: EditInput[] }
    export let defaultEdits: { [key: string]: EditInput[] } = {}
    export let item: Item | StageItem | null = null
    export let styles: { [key: string]: string } = {}
    export let lineAlignStyle: { [key: string]: string } = {}
    export let alignStyle: { [key: string]: string } = {}
    export let customLabels: string[] = []
    export let noClosing = false
    export let sessionId = ""
    export let isStage = false

    const inputs = {
        fontDropdown: FontDropdown,
        color: Color,
        number: NumberInput,
        text: TextInput,
        dropdown: Dropdown,
        checkbox: Checkbox,
        date: DateInput,
        time: TimeInput
    }

    let dispatch = createEventDispatcher()
    function valueChange(e: any, input: EditInput, inputUpdate = false) {
        if (inputUpdate && input.input === "text") return

        let value = e.detail ?? e.target?.value ?? null

        if (input.input === "checkbox") value = e.target?.checked
        else if (input.input === "dropdown" || input.input === "selectVariable" || input.input === "action") value = value?.id || ""
        else if (input.input === "number") value = Number(value)
        // else if (input.input === "multiselect" && Array.isArray(input.value)) {
        //     if (input.value.includes(value)) value = input.value.filter((a) => a !== value)
        //     else value = [...input.value, value]
        // }

        // closed update
        if (!value && value !== "" && e.detail !== undefined) value = e.detail

        if (input.extension) value += input.extension

        // the changed value is part af a larger string
        if (input.valueIndex !== undefined) {
            let inset = input.key?.includes("inset_")
            if (inset) input.key = input.key?.substring(6)

            let actualValue = styles[input.key || ""] || getOriginalValue(clone(edits), (inset ? "inset_" : "") + input.key)

            // replace rgb() because it has spaces
            if (input.input === "color") {
                let rgbIndex: number = actualValue.indexOf("rgb")
                if (rgbIndex > 5) actualValue = actualValue.slice(0, rgbIndex) + "#000000"
            }
            let splittedValue = actualValue.split(" ")

            if (inset && !splittedValue.includes("inset")) splittedValue.unshift("inset")
            splittedValue[input.valueIndex] = value

            value = splittedValue.join(" ")

            // update current styles value (to properly set/reset)
            styles[input.key || ""] = value
        }

        dispatch("change", { ...input, value })
    }

    const lineInputs = {
        "font-style": [
            { id: "style", icon: "bold", toggle: true, key: "font-weight", value: "bold" },
            { id: "style", icon: "italic", toggle: true, key: "font-style", value: "italic" },
            { id: "style", icon: "underline", toggle: true, key: "text-decoration", value: "underline" },
            { id: "style", icon: "strikethrough", toggle: true, key: "text-decoration", value: "line-through" }
        ],
        "align-x": [
            { id: "style", icon: "alignLeft", title: "left", key: "text-align", value: "left" },
            { default: true, id: "style", icon: "alignCenter", title: "center", key: "text-align", value: "center" },
            { id: "style", icon: "alignRight", title: "right", key: "text-align", value: "right" },
            { id: "style", icon: "alignJustify", title: "justify", key: "text-align", value: "justify" }
        ],
        "align-y": [
            { id: "style", icon: "alignTop", title: "top", key: "align-items", value: "flex-start" },
            { default: true, id: "style", icon: "alignMiddle", title: "center", key: "align-items", value: "center" },
            { id: "style", icon: "alignBottom", title: "bottom", key: "align-items", value: "flex-end" }
        ]
    }

    function toggle(input: EditInput) {
        if (typeof input.value !== "string") return

        let value: string = styles[input.key || ""] || ""

        let exists: number = value.indexOf(input.value)
        if (exists > -1) value = value.slice(0, exists) + value.substring(exists + input.value.length)
        else value = value + " " + input.value
        value = value.trim()

        dispatch("change", { ...input, value })
    }

    function getValue(input: EditInput, _updater: any) {
        // if (input.id === "auto" && isAuto) return true
        if (input.id?.includes(".")) input.value = getItemValue(input)

        if (input.valueIndex !== undefined && styles[input.key || ""]) return removeExtension(styles[input.key!].split(" ")[input.valueIndex], input.extension)
        if (input.input === "dropdown") return input.values.options.find((a) => a.id === getKeyValue(input))?.name || "—"
        if (input.input === "checkbox") return !!input.value // closed
        if (input.id === "filter" || input.id === "backdrop-filter") return item?.filter ? getFilters(item.filter || "")?.[input.key || ""] || input.value : input.value

        return styles[input.key || ""] || input.value
    }

    function getItemValue(input: EditInput) {
        // get nested value
        let splitted = input.id?.split(".") || []
        let value = item?.[splitted[0]]?.[splitted[1]]
        return value !== undefined ? value : input.value
    }

    function getKeyValue(input: EditInput) {
        if (!item || !input.id || !item[input.id]) return input.value
        if (input.key) {
            if (item[input.id][input.key]) return item[input.id][input.key]
            if (!styles[input.key]) return input.value
            return styles[input.key]
        }
        return item[input.id]
    }

    // $: if (input.input === "CSS" && item) getStyleString()
    function getStyleString(input: EditInput) {
        let style = ""
        if (input.id === "item") style = item?.style || ""
        else if (typeof input.value === "string") style = input.value // "text" / custom

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

    function openPopup(input: EditInput, section: string) {
        activePopup.set(input.popup || (input.id as any) || null)
        let data = { id: input.id, section, value: input.value, type: "" }
        if (input.id === "list.items") data.type = (edits[section].find((a) => a.id === "list.style")?.value || "") as string
        popupData.set(data)
    }

    // CLOSED STYLES

    const closed = {
        // content
        text: {
            "style_letter-spacing": 1
        },
        lines: {
            // "style_line-height": 1.2,
            "specialStyle.lineGap": 1
        },
        align: {
            "style_text-align": "left"
        },
        outline: {
            // "style_-webkit-text-stroke-color": "#000000",
            "style_-webkit-text-stroke-width": 2
        },
        shadow: {
            // "style_text-shadow_3": "#000000",
            "style_text-shadow_0": 0,
            "style_text-shadow_1": 0,
            "style_text-shadow_2": 0,

            // item
            "style_box-shadow_4": "rgb(0 0 0 / 0.5)",
            "style_box-shadow_0": 2,
            "style_box-shadow_1": 2,
            "style_box-shadow_2": 8
            // "style_box-shadow_3": 0,
        },
        list: {
            "list.enabled": true
        },
        chords: {
            "chords.enabled": true
        },
        // media
        filters: {
            "filter_hue-rotate": 100
        },
        special: {
            "scrolling.type": "left_right"
        },

        // item
        transform: {
            // transform_scaleX: -1,
            transform_perspective: 1
        },
        // style: {
        //     // WIP opacity does not get applied here
        //     // "style_background-color": "rgb(0 0 0 / 0.3)",
        //     // "(style_)background-opacity": "0.3", (this is linked to the color)
        //     style_padding: 10,
        // },
        border: {
            "style_border-width": 5
        },
        backdrop_filters: {
            "backdrop-filter_grayscale": 1
        }
    }

    const ALWAYS_CLOSED = ["CSS", "position"]

    function checkIsClosed(id: string, _updater: any = null) {
        if (noClosing) return false
        if (ALWAYS_CLOSED.includes(id)) return true

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
        let differentValue = currentEdit.find((currentInput, i) => {
            let defaultInput = defaultEdit[i]
            let currentValue = getValue(currentInput, {})
            let defaultValue = defaultInput.value

            if (currentInput.name === "background_opacity") return false

            // convert "0" to 0, but no false or ""
            if (Number(currentValue) == currentValue && typeof currentValue !== "boolean" && currentValue.toString().length) currentValue = Number(currentValue)

            if (defaultInput.input === "dropdown") {
                // if checkbox is not value and it's not unset!
                if (!currentValue.includes(defaultValue) && currentValue !== "—") return true
            } else if (defaultValue !== currentValue) return true

            return false
        })

        let state = !differentValue

        return state
    }

    const setDefaults: string[] = ["list", "outline", "shadow", "chords", "border"]
    function openEdit(id: string) {
        storedEditMenuState.update((a) => {
            if (!a[sessionId]) a[sessionId] = []
            if (!a[sessionId].includes(id)) a[sessionId].push(id)

            return a
        })

        if (setDefaults.includes(id)) setCustomValues(id)
    }

    function setCustomValues(id: string) {
        let closedVal = clone(closed[id])
        let currentEdit = clone(edits[id])

        if (!closedVal || !currentEdit) return
        currentEdit = currentEdit.map((a) => lineInputs[a.input] || a).flat()

        setStyle()
        function setStyle(i = 0) {
            let input = currentEdit[i]
            if (!input) return

            const currentKey = Object.keys(closedVal).find((styleId) => {
                let dataId: string = styleId.split("_")[0]
                let key: string | undefined = styleId.split("_")[1]
                let valueIndex: string | undefined = styleId.split("_")[2]

                if (valueIndex) return input.valueIndex === Number(valueIndex) && input.key === key
                else if (key) return input.key === key
                else return input.id === dataId
            })
            let newValue: any = closedVal[currentKey]

            if (newValue === undefined) return setStyle(i + 1)

            valueChange({ detail: newValue }, input)
            input.value = newValue

            setTimeout(() => setStyle(i + 1), 20)
        }
    }

    function resetAndClose(id: string) {
        if (id === "CSS") {
            closeEdit("CSS")
            return
        }

        // don't "reset" if just closing (if different styles on multiple textboxes!)
        if (checkIsClosed(id)) {
            closeEdit(id)
            return
        }

        let closedVal = closed[id]
        let defaultEdit = clone(defaultEdits?.[id])
        let currentEdit = clone(edits[id])

        if (!closedVal || !defaultEdit || !currentEdit) return

        resetInput()
        function resetInput(i = 0) {
            let input = currentEdit[i]
            if (!input) return
            if (input.name === "background_opacity") return resetInput(i + 1)

            if (lineInputs[input.input]) {
                input = lineInputs[input.input]?.[0] || {}
                defaultEdit[i] = { ...defaultEdit[i], value: "center" }
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
        setTimeout(() => closeEdit(id), timeout)
    }

    function closeEdit(id: string) {
        storedEditMenuState.update((a) => {
            let currentTabIndex = a[sessionId].indexOf(id)
            if (currentTabIndex > -1) a[sessionId].splice(currentTabIndex, 1)

            return a
        })
    }

    // WIP resetting will close these menus
    $: if (!sessionId) sessionId = uid()
    $: if (sessionId) updateSectionsState()
    function updateSectionsState() {
        storedEditMenuState.update((a) => {
            if (!a[sessionId]) a[sessionId] = ["default"]

            Object.keys(edits || {}).forEach((section) => {
                if (a[sessionId].includes(section)) return
                if (!checkIsClosed(section)) a[sessionId].push(section)
            })

            return a
        })
    }

    $: actionOptions = [
        { id: "", name: "—" },
        ...Object.entries($actions)
            .map(([id, a]) => ({ id, name: a.name }))
            .sort((a, b) => a.name?.localeCompare(b.name))
    ]
</script>

{#each Object.keys(edits || {}) as section, i}
    <div class="section" class:top={section === "default"} style={i === 0 && section !== "default" ? "margin-top: 0;" : ""}>
        {#if !noClosing && section !== "default" && !$storedEditMenuState[sessionId]?.includes(section)}
            <!-- closed -->
            <Button on:click={() => openEdit(section)} style="margin-top: 5px;" dark bold={false}>
                {#if section === "CSS"}
                    <Icon id="code" right />
                    <p style="font-size: 1.2em;opacity: 1;width: initial;">CSS</p>
                {:else}
                    <Icon id={section} right />
                    <p style="font-size: 1.2em;opacity: 1;width: initial;"><T id="edit.{section}" /></p>
                {/if}
            </Button>
        {:else}
            {#if section !== "default"}
                <!-- opened -->
                <h6 style="display: flex;justify-content: center;align-items: center;position: relative;">
                    {#if customLabels[i]}
                        <T id={customLabels[i]} />
                    {:else if section[0] === section[0].toUpperCase()}
                        {section}
                    {:else}
                        <T id="edit.{section}" />
                    {/if}

                    {#if !noClosing && (closed[section] || ALWAYS_CLOSED.includes(section))}
                        <Button style="position: absolute;inset-inline-end: 0;" on:click={() => resetAndClose(section)} title={$dictionary.actions?.[checkIsClosed(section) ? "close" : "reset"]}>
                            {#if checkIsClosed(section, item)}
                                <Icon id="remove" white />
                            {:else}
                                <Icon id="reset" white />
                            {/if}
                        </Button>
                    {/if}
                </h6>
            {/if}

            {#each edits[section] as input}
                {#if input.input === "editTimer"}
                    {#if item}
                        <EditTimer {item} on:change={(e) => valueChange(e, input)} {isStage} />
                    {/if}
                {:else if input.input === "selectVariable"}
                    {@const variablesList = sortByName(keysToID($variables)).map((a) => ({ ...a, name: a.name || a.id }))}
                    <CombinedInput>
                        {#if variablesList.length}
                            <!-- <p data-title={$dictionary.items?.variable}><T id="items.variable" /></p> -->
                            <Dropdown style="width: 100%;" value={variablesList.find((a) => a.id === input.value)?.name || "—"} options={variablesList} on:click={(e) => valueChange(e, input)} />
                        {:else}
                            <Button on:click={() => openDrawer("variables", true)} style="width: 100%;" center>
                                <Icon id="add" right />
                                <T id="new.variable" />
                            </Button>
                        {/if}
                    </CombinedInput>
                {:else if input.input === "tip"}
                    {#if !input.hidden || (input.disabled === "clock" && item?.clock?.type === "custom")}
                        <p class="tip">
                            {#if input.name}<T id={input.name} />{/if}
                            {@html input.values?.subtext || ""}
                            {#if input.values?.subtext.includes("<a href=")}<Icon id="launch" white />{/if}
                        </p>
                    {/if}
                {:else if input.input === "popup"}
                    <CombinedInput>
                        <Button style="width: 100%;" on:click={() => openPopup(input, section)} dark center>
                            <Icon id={input.icon || input.id || ""} right />
                            {#key input.name}
                                <p style="padding: 0;flex: initial;width: fit-content;min-width: unset;{input.name?.includes('.') || !input.name?.includes(' ') ? '' : 'opacity: 1;'}">
                                    {#if input.name?.includes(" ")}
                                        {input.name}
                                    {:else}
                                        <T id={input.name?.includes(".") ? input.name : "popup." + input.name} />
                                    {/if}
                                </p>
                            {/key}
                        </Button>
                    </CombinedInput>
                {:else if input.input === "action"}
                    <CombinedInput>
                        <p><T id="edit.{input.name}" /></p>
                        <Dropdown options={actionOptions} value={actionOptions.find((a) => a.id === input.value)?.name || "—"} on:click={(e) => valueChange(e, input)} />
                    </CombinedInput>
                {:else if input.input === "media"}
                    <CombinedInput>
                        <MediaPicker
                            id={"item_" + sessionId}
                            title={typeof input.value === "string" ? input.value : ""}
                            style="width: 100%;min-width: 85%;"
                            filter={{ name: "Media files", extensions: mediaExtensions }}
                            on:picked={(e) => valueChange(e, input)}
                        >
                            <span style="display: flex;align-items: center;max-width: 100%;">
                                <Icon id="image" right />
                                {#if input.value && typeof input.value === "string"}
                                    <p style="padding: 0;opacity: 1;">{getFileName(input.value)}</p>
                                {:else}
                                    <p style="padding: 0;"><T id="edit.choose_media" /></p>
                                {/if}
                            </span>
                        </MediaPicker>
                        {#if input.value}
                            <Button title={$dictionary.actions?.remove} on:click={() => valueChange({ detail: "" }, input)} redHover>
                                <Icon id="close" size={1.2} white />
                            </Button>
                        {/if}
                    </CombinedInput>
                    <!-- {:else if input.input === "multiselect"}
                    <div class="line">
                        {#each input.values as option}
                            <Button
                                on:click={() => valueChange({ detail: option.id }, input)}
                                style={Array.isArray(input.value) && input.value.includes(option.id) ? "flex: 1;border-bottom: 2px solid var(--secondary) !important;" : "flex: 1;border-bottom: 2px solid var(--primary-lighter);"}
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
                    </div> -->
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
                        <Notes lines={8} value={getStyleString(input)} on:change={(e) => dispatch("change", { id: input.id === "text" ? "CSS" : input.id, value: e.detail })} />
                    </div>
                {:else if input.input === "checkbox"}
                    {@const value = getValue(input, { styles, item })}
                    {#if !input.hidden}
                        <CombinedInput>
                            <p data-title={$dictionary[input.name?.includes(".") ? input.name.split(".")[0] : "edit"]?.[input.name?.includes(".") ? input.name.split(".")[1] : input.name || ""]}>
                                {#key input.name}
                                    <T id={input.name?.includes(".") ? input.name : "edit." + input.name} />
                                {/key}
                            </p>
                            <div class="alignRight">
                                <Checkbox {...input.values || {}} checked={item?.[input.id || ""] || value || false} disabled={input.disabled && edits[section].find((a) => a.id === input.disabled)?.value} on:change={(e) => valueChange(e, input)} />
                            </div>
                        </CombinedInput>
                    {/if}
                {:else if !input.name}
                    Missing input name: {input.input}
                {:else}
                    {@const value = getValue(input, { styles, item })}
                    {#if !input.hidden}
                        <CombinedInput style={input.slider ? "border-bottom: 1px solid var(--primary-lighter);" : ""}>
                            <p data-title={input.title || $dictionary[input.name.includes(".") ? input.name.split(".")[0] : "edit"]?.[input.name.includes(".") ? input.name.split(".")[1] : input.name]}>
                                {#key input.name}
                                    <T id={input.name.includes(".") ? input.name : "edit." + input.name} />
                                {/key}
                            </p>
                            <svelte:component
                                this={inputs[input.input]}
                                class="customInput"
                                {...input.values || {}}
                                {value}
                                fontStyleValue={input.styleValue || ""}
                                disabled={typeof input.disabled === "string" ? item?.[input.disabled] || edits[section].find((a) => a.id === input.disabled)?.value : input.disabled}
                                disableHold
                                on:click={(e) => valueChange(e, input)}
                                on:fontStyle={(e) => valueChange(e, { ...input, key: "font" })}
                                on:input={(e) => valueChange(e, input, true)}
                                on:change={(e) => valueChange(e, input)}
                            />
                        </CombinedInput>
                        {#if input.slider}
                            <Slider
                                {...{ ...(input.values || {}), ...(input.sliderValues || {}) }}
                                {value}
                                style="border-bottom: 2px solid var(--primary-lighter);"
                                on:input={(e) => valueChange(e, input, true)}
                                on:change={(e) => valueChange(e, input)}
                            />
                        {/if}
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

    /* .line {
        display: flex;
        align-items: center;
        background-color: var(--primary-darker);
        flex-flow: wrap;
    } */

    div :global(input[type="color"]),
    div :global(.dropdownElem),
    div :global(.color) {
        min-width: 50% !important;
    }

    div :global(.customInput .dropdown) {
        width: 160%;
        inset-inline-end: 0;
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
        padding: 8px;

        text-align: center;
        text-overflow: revert;
        white-space: normal;

        display: flex;
        justify-content: center;
        align-items: center;
        gap: 5px;
    }

    /* Link */
    .tip :global(a) {
        color: var(--text);
        opacity: 0.7;
    }
    .tip :global(a):hover {
        opacity: 0.75;
    }
    .tip :global(a):active {
        opacity: 0.9;
    }
</style>
