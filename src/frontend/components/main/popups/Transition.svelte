<script lang="ts">
    import { onMount } from "svelte"
    import { get } from "svelte/store"
    import { OUTPUT } from "../../../../types/Channels"
    import type { Transition } from "../../../../types/Show"
    import { activeEdit, activeShow, overlays, popupData, selected, showsCache, styles, templates, transitionData } from "../../../stores"
    import { send } from "../../../utils/request"
    import { easings, transitionTypes } from "../../../utils/transitions"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import { getLayoutRef } from "../../helpers/show"

    // VALUES

    const iconSize = 60
    const icons = {
        none: '<g><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:#FFFFFF;stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:#FFFFFF;stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
        fade: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_0" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.1)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_0);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_1" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.43)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_1);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
        blur: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_4" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.1)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_4);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_5" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.43)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_5);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><filter id="F74DSDpwrY4BXvi3MtrloAnkmdQBbAU7" x="-200%" y="-200%" width="400%" height="400%" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB"><feGaussianBlur xmlns="http://www.w3.org/2000/svg" stdDeviation="5.968116597346249"/></filter></defs><g filter="url(#F74DSDpwrY4BXvi3MtrloAnkmdQBbAU7)"><path d="M 39 25 L 71 25 C 73.208 25 75 26.792 75 29 L 75 61 C 75 63.208 73.208 65 71 65 L 39 65 C 36.792 65 35 63.208 35 61 L 35 29 C 35 26.792 36.792 25 39 25 Z" style="stroke:none;fill:#EBEBEB;stroke-miterlimit:10;opacity:0.5;"/></g></g>',
        spin: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_10" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.69)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_10);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_11" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.83)"/></linearGradient></defs><path d="M 35.472 18.152 L 81.2 44.554 C 82.921 45.547 83.511 47.751 82.518 49.472 L 56.116 95.2 C 55.123 96.921 52.919 97.511 51.198 96.518 L 5.47 70.116 C 3.749 69.123 3.159 66.919 4.152 65.198 L 30.554 19.47 C 31.547 17.749 33.751 17.159 35.472 18.152 Z" style="stroke:none;fill:url(#_lgradient_11);stroke-miterlimit:10;"/><path d="M 35.472 18.152 L 81.2 44.554 C 82.921 45.547 83.511 47.751 82.518 49.472 L 56.116 95.2 C 55.123 96.921 52.919 97.511 51.198 96.518 L 5.47 70.116 C 3.749 69.123 3.159 66.919 4.152 65.198 L 30.554 19.47 C 31.547 17.749 33.751 17.159 35.472 18.152 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
        scale: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_6" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.69)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_6);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_7" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.83)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_7);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><path d=" M 24.5 75.5 L 55.5 44.5 L 24.5 75.5 L 24.5 75.5 Z  M 55.5 44.5 L 55.5 56.5 L 55.5 44.5 L 55.5 44.5 Z  M 24.5 63.5 L 24.5 75.5 L 24.5 63.5 Z " fill-rule="evenodd" fill="none" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="55.5" y1="44.5" x2="45" y2="44.5" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="35" y1="75.5" x2="24.5" y2="75.5" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g></g>',
        slide: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_8" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.69)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_8);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_9" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.83)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_9);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><path d=" M 24.5 75.5 L 55.5 44.5 L 24.5 75.5 Z  M 55.5 44.5 L 55.5 56.5 L 55.5 44.5 Z " fill-rule="evenodd" fill="none" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="55.5" y1="44.5" x2="45" y2="44.5" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g></g>',
    }

    // UPDATE

    function changeTransition(id: TransitionTypes, key: "type" | "duration" | "easing" | "custom", value: any, reset = false) {
        if (key === "duration") value = Number(value)

        if (isItem) {
            // WIP duplicate of SetTime.svelte ++
            let indexes = $activeEdit.items

            value = updateSpecific(slideItemTransition, key, value, reset)
            slideItemTransition = value

            slideItems.forEach((_: any, i: number) => {
                if (!indexes.includes(i)) return

                if (!slideItems[i].actions) slideItems[i].actions = {}
                slideItems[i].actions.transition = value
            })

            let actions = indexes.map((i) => slideItems[i].actions)

            if ($activeEdit.type === "overlay" || $activeEdit.type === "template") {
                history({
                    id: "UPDATE",
                    oldData: { id: $activeEdit.id },
                    newData: { key: "items", subkey: "actions", data: actions, indexes },
                    location: { page: "edit", id: $activeEdit.type + "_items", override: "itemaction_" + indexes.join(",") },
                })

                return
            }

            history({
                id: "setItems",
                newData: { style: { key: "actions", values: actions } },
                location: { page: "edit", show: $activeShow!, slide: slideRef.id, items: indexes, override: "itemaction_" + slideRef.id + "_items_" + indexes.join(",") },
            })
        } else if (isSlide) {
            // set value
            value = updateSpecific(currentTransitionFull, key, value, reset)

            // update active
            if (id === "text") slideTextTransition = value
            else slideMediaTransition = value

            let globalValues = $transitionData[id]
            if (value.type === globalValues.type && value.duration === globalValues.duration && value.easing === globalValues.easing && !specificScenatios.find((a) => value[a])) value = null

            let type = id === "text" ? "transition" : "mediaTransition"
            let indexes = $selected.data.map((a) => a.index)
            let override = "show#" + $activeShow?.id + "layout#" + _show().get("settings.activeLayout") + "indexes#" + indexes.join(",") + type
            history({ id: "SHOW_LAYOUT", newData: { key: type, data: value, indexes }, location: { page: "show", override } })

            setTimeout(() => {
                send(OUTPUT, ["SHOWS"], get(showsCache))
            }, 500)
        } else if (isStyle) {
            value = { ...styleTransition, [selectedType]: updateSpecific(styleTransition[selectedType] || {}, key, value, reset) }
            if (!$styles[popupDataId]) return

            history({ id: "UPDATE", newData: { key: "transition", data: value }, oldData: { id: popupDataId }, location: { page: "settings", id: "settings_style", override: "style_" + key } })
        } else {
            transitionData.update((a: any) => {
                a[id] = updateSpecific(a[id], key, value, reset)
                return a
            })
        }
    }

    let updated: string[] = []
    let updatedTimeout: NodeJS.Timeout | null = null
    function updateSpecific(data: Transition, key: "type" | "duration" | "easing" | "custom", value: any, reset = false) {
        if (!enableSpecific) {
            return { ...data, [key]: value }
        }

        // change all matches if changing "in"
        let changeSpecific = [selectedSpecific]
        if (selectedSpecific === "in") {
            specificScenatios
                .filter((a) => a !== selectedSpecific)
                .forEach((sKey) => {
                    if (!data[sKey] || JSON.stringify(data[sKey]) === JSON.stringify(data[selectedSpecific])) changeSpecific.push(sKey)
                })
        }

        // set data
        changeSpecific.forEach((sKey) => {
            if (reset) {
                delete data[sKey]
            } else {
                if (!data[sKey]) data[sKey] = copyTransition(data)
                data[sKey][key] = value
            }
        })

        if (reset) data = { ...data, [key]: value }

        // visually show updated
        updated = changeSpecific
        if (updatedTimeout) clearTimeout(updatedTimeout)
        updatedTimeout = setTimeout(() => {
            updated = []
        }, 800)

        return data
    }

    function copyTransition(data: Transition) {
        let delay = data.delay
        data = { type: data.type, duration: data.duration, easing: data.easing }
        if (delay) data.delay = delay
        return clone(data)
    }

    let isItem: boolean = $popupData.action === "transition"
    let isStyle: boolean = $popupData.action === "style_transition"
    let popupDataId: string = $popupData.id
    let isSlide: boolean = $selected.id === "slide"
    let ref = isSlide || isItem ? getLayoutRef() : []

    onMount(() => {
        popupData.set({})
    })

    // SLIDE/ITEM TRANSITION

    let slideIndex = isItem ? $activeEdit.slide : $selected.data?.[0]?.index
    let slideRef = ref?.[slideIndex] || {}

    let slideItems: any[] = []
    if (isItem) {
        if ($activeEdit.type === "overlay") slideItems = $overlays[$activeEdit.id || ""]?.items || []
        else if ($activeEdit.type === "template") slideItems = $templates[$activeEdit.id || ""]?.items || []
        else slideItems = _show().get("slides")[slideRef.id]?.items || []
    }
    let firstItem = slideItems[$activeEdit.items[0]] || {}
    $: slideItemTransition = isItem ? clone(firstItem.actions?.transition || $transitionData.text || clone(DEFAULT_TRANSITIONS.text)) : {}

    let firstSlide = slideRef.data || {}
    $: slideTextTransition = isSlide ? clone(firstSlide.transition || $transitionData.text || clone(DEFAULT_TRANSITIONS.text)) : {}
    $: slideMediaTransition = isSlide ? clone(firstSlide.mediaTransition || $transitionData.media || clone(DEFAULT_TRANSITIONS.media)) : {}

    // STYLE TRANSITION

    let styleTransition: any = { text: {}, media: {} }
    $: styleTransition = $styles[popupDataId]?.transition || { text: clone(DEFAULT_TRANSITIONS.text), media: clone(DEFAULT_TRANSITIONS.media) }
    $: styleTextTransition = styleTransition.text
    $: styleMediaTransition = styleTransition.media

    // CURRENT TRANSITION

    $: currentTextTransition = clone(isItem ? slideItemTransition : isSlide ? slideTextTransition : isStyle ? styleTextTransition : $transitionData.text)
    $: currentMediaTransition = clone(isSlide ? slideMediaTransition : isStyle ? styleMediaTransition : $transitionData.media)

    type TransitionTypes = "text" | "media"
    const TRANSITION_TYPES: TransitionTypes[] = ["text", "media"]
    let selectedType = TRANSITION_TYPES[0]
    $: currentTransitionFull = selectedType === "text" ? currentTextTransition : currentMediaTransition
    let currentTransition = currentTransitionFull
    $: if (currentTransitionFull && enableSpecific !== undefined && selectedSpecific) updateTransition()
    function updateTransition() {
        currentTransition = currentTransitionFull
        if (enableSpecific) currentTransition = currentTransitionFull[selectedSpecific] || currentTransitionFull
    }

    $: isDisabled = currentTransition.type === "none"
    $: durationValue = currentTransition.duration
    $: easingValue = easings.find((a) => a.id === currentTransition.easing)?.name || "$:easings.sine:$"

    // SPECIFIC

    const SPECIFIC_SCENARIOS = ["in", "out", "between"]
    let specificScenatios = clone(SPECIFIC_SCENARIOS)
    $: if (isItem || selectedType === "media") specificScenatios = specificScenatios.slice(0, 2)
    else specificScenatios = clone(SPECIFIC_SCENARIOS)

    let enableSpecific = false
    let selectedSpecific: string = specificScenatios[0]
    $: if (specificScenatios.find((a) => currentTransitionFull[a])) {
        enableSpecific = true
    } else {
        selectedSpecific = specificScenatios[0]
        enableSpecific = false
    }

    // RESET

    const DEFAULT_TRANSITIONS = {
        text: { type: "fade", duration: 500, easing: "sine", custom: {} },
        media: { type: "fade", duration: 800, easing: "sine", custom: {} },
    }
    function reset() {
        const defaults = DEFAULT_TRANSITIONS[selectedType]

        Object.keys(defaults).forEach((key) => {
            let defaultValue = defaults[key]
            // @ts-ignore
            changeTransition(selectedType, key, isSlide || isItem ? $transitionData[selectedType][key] || defaultValue : defaultValue, true)
        })
    }

    // CUSTOM VALUES

    const slideTypes = [
        { id: "left_right", name: "$:edit.left_right:$" },
        { id: "right_left", name: "$:edit.right_left:$" },
        { id: "bottom_top", name: "$:edit.bottom_top:$" },
        { id: "top_bottom", name: "$:edit.top_bottom:$" },
    ]
</script>

<!-- ITEM (TEXT) / MEDIA -->
{#if !isItem}
    <div style="display: flex;">
        {#each TRANSITION_TYPES as type}
            <Button on:click={() => (selectedType = type)} style="flex: 1;border-bottom: 2px solid {selectedType === type ? 'var(--secondary)' : 'var(--primary-lighter)'} !important;white-space: nowrap;" bold={false} center dark>
                <Icon id={type === "media" ? "image" : type} right />
                <T id="transition.{type}" />{#if isSlide}&nbsp;<T id="transition.current_slide" />{/if}
            </Button>
        {/each}
    </div>
{/if}

<!-- SPECIFIC -->

{#if enableSpecific}
    <div style="display: flex;">
        {#each specificScenatios as specific}
            <Button
                on:click={() => (selectedSpecific = specific)}
                style={selectedSpecific === specific || updated.includes(specific) ? "flex: 1;border-bottom: 2px solid var(--secondary) !important;white-space: nowrap;" : "flex: 1;border-bottom: 2px solid var(--primary-lighter);white-space: nowrap;"}
                bold={false}
                center
                dark
            >
                <T id="transition.{specific}" />
            </Button>
        {/each}
    </div>
{:else}
    <Button on:click={() => (enableSpecific = true)} bold={false} center dark>
        <!-- <Icon id="noIcon" size={1.2} right /> -->
        <T id="transition.specific" />
    </Button>
{/if}

<!-- TYPE -->

<div class="types">
    {#each transitionTypes as type}
        {@const isActive = type.id === currentTransition.type}
        <Button outline={isActive} active={isActive} on:click={() => changeTransition(selectedType, "type", type.id)} bold={false}>
            <svg viewBox="0 0 100 100" width="{iconSize}pt" height="{iconSize}pt">
                {@html icons[type.id]}
            </svg>
            <T id={type.name} />
        </Button>
    {/each}
</div>

<CombinedInput style="margin-top: 10px;">
    <p><T id="transition.duration" /></p>
    <NumberInput disabled={isDisabled} value={durationValue} max={20000} fixed={1} decimals={3} step={100} inputMultiplier={0.001} on:change={(e) => changeTransition(selectedType, "duration", e.detail)} />
</CombinedInput>

<CombinedInput>
    <p><T id="transition.easing" /></p>
    <Dropdown disabled={isDisabled} options={easings} value={easingValue} on:click={(e) => changeTransition(selectedType, "easing", e.detail.id)} />
</CombinedInput>

{#if currentTransition.type === "slide"}
    <CombinedInput>
        <p><T id="transition.direction" /></p>
        <Dropdown
            options={slideTypes}
            value={slideTypes.find((a) => a.id === (currentTransition.custom?.direction || slideTypes[0].id))?.name || ""}
            on:click={(e) => changeTransition(selectedType, "custom", { ...(currentTransition.custom || {}), direction: e.detail.id })}
        />
    </CombinedInput>
{/if}

<br />

<Button on:click={reset} center dark>
    <Icon id="reset" size={1.2} right />
    <T id="actions.reset" />
</Button>

<style>
    .types {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 5px;
        padding: 15px 0;
    }

    .types :global(button) {
        padding: 0.5em 0.8em;
        flex-direction: column;
    }
</style>
