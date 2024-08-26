<script lang="ts">
    import { get } from "svelte/store"
    import { OUTPUT } from "../../../../types/Channels"
    import type { TransitionType } from "../../../../types/Show"
    import { activeEdit, activeShow, overlays, popupData, selected, showsCache, templates, transitionData } from "../../../stores"
    import { easings } from "../../../utils/transitions"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import { clone } from "../../helpers/array"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import { onMount } from "svelte"

    const types: { id: TransitionType; name: string }[] = [
        { id: "none", name: "$:transition.none:$" },
        { id: "fade", name: "$:transition.fade:$" },
        // { id: "crossfade", name: "$:transition.crossfade:$" },
        { id: "blur", name: "$:transition.blur:$" },
        { id: "scale", name: "$:transition.scale:$" },
        { id: "spin", name: "$:transition.spin:$" },
        { id: "slide", name: "$:transition.slide:$" },
    ]

    const iconSize: number = 60
    const icons = {
        none: '<g><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:#FFFFFF;stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:#FFFFFF;stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
        fade: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_0" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.1)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_0);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_1" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.43)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_1);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
        blur: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_4" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.1)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_4);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_5" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.43)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_5);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><filter id="F74DSDpwrY4BXvi3MtrloAnkmdQBbAU7" x="-200%" y="-200%" width="400%" height="400%" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB"><feGaussianBlur xmlns="http://www.w3.org/2000/svg" stdDeviation="5.968116597346249"/></filter></defs><g filter="url(#F74DSDpwrY4BXvi3MtrloAnkmdQBbAU7)"><path d="M 39 25 L 71 25 C 73.208 25 75 26.792 75 29 L 75 61 C 75 63.208 73.208 65 71 65 L 39 65 C 36.792 65 35 63.208 35 61 L 35 29 C 35 26.792 36.792 25 39 25 Z" style="stroke:none;fill:#EBEBEB;stroke-miterlimit:10;opacity:0.5;"/></g></g>',
        scale: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_6" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.69)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_6);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_7" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.83)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_7);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><path d=" M 24.5 75.5 L 55.5 44.5 L 24.5 75.5 L 24.5 75.5 Z  M 55.5 44.5 L 55.5 56.5 L 55.5 44.5 L 55.5 44.5 Z  M 24.5 63.5 L 24.5 75.5 L 24.5 63.5 Z " fill-rule="evenodd" fill="none" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="55.5" y1="44.5" x2="45" y2="44.5" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="35" y1="75.5" x2="24.5" y2="75.5" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g></g>',
        spin: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_10" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.69)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_10);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_11" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.83)"/></linearGradient></defs><path d="M 35.472 18.152 L 81.2 44.554 C 82.921 45.547 83.511 47.751 82.518 49.472 L 56.116 95.2 C 55.123 96.921 52.919 97.511 51.198 96.518 L 5.47 70.116 C 3.749 69.123 3.159 66.919 4.152 65.198 L 30.554 19.47 C 31.547 17.749 33.751 17.159 35.472 18.152 Z" style="stroke:none;fill:url(#_lgradient_11);stroke-miterlimit:10;"/><path d="M 35.472 18.152 L 81.2 44.554 C 82.921 45.547 83.511 47.751 82.518 49.472 L 56.116 95.2 C 55.123 96.921 52.919 97.511 51.198 96.518 L 5.47 70.116 C 3.749 69.123 3.159 66.919 4.152 65.198 L 30.554 19.47 C 31.547 17.749 33.751 17.159 35.472 18.152 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/></g>',
        slide: '<g><rect width="100" height="100" style="fill:rgb(0,0,0)" fill-opacity="0"/><defs><linearGradient id="_lgradient_8" x1="-3.885780586188048e-16" y1="1.0000000000000002" x2="0.9999999999999998" y2="-4.440892098500626e-16"><stop offset="2.5%" style="stop-color:rgba(255,255,255,0.69)"/><stop offset="100%" style="stop-color:#FFFFFF"/></linearGradient></defs><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="stroke:none;fill:url(#_lgradient_8);stroke-miterlimit:10;"/><path d="M 43 10 L 87 10 C 88.656 10 90 11.344 90 13 L 90 57 C 90 58.656 88.656 60 87 60 L 43 60 C 41.344 60 40 58.656 40 57 L 40 13 C 40 11.344 41.344 10 43 10 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><defs><linearGradient id="_lgradient_9" x1="0" y1="1" x2="1" y2="-4.440892098500626e-16"><stop offset="0%" style="stop-color:#FFFFFF"/><stop offset="100%" style="stop-color:rgba(255,255,255,0.83)"/></linearGradient></defs><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="stroke:none;fill:url(#_lgradient_9);stroke-miterlimit:10;"/><path d="M 13.6 30 L 66.4 30 C 68.387 30 70 31.613 70 33.6 L 70 86.4 C 70 88.387 68.387 90 66.4 90 L 13.6 90 C 11.613 90 10 88.387 10 86.4 L 10 33.6 C 10 31.613 11.613 30 13.6 30 Z" style="fill:none;stroke:#000000;stroke-width:2;stroke-linecap:square;stroke-miterlimit:2;"/><g><path d=" M 24.5 75.5 L 55.5 44.5 L 24.5 75.5 Z  M 55.5 44.5 L 55.5 56.5 L 55.5 44.5 Z " fill-rule="evenodd" fill="none" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/><line x1="55.5" y1="44.5" x2="45" y2="44.5" vector-effect="non-scaling-stroke" stroke-width="3" stroke="rgb(0,0,0)" stroke-linejoin="miter" stroke-linecap="square" stroke-miterlimit="3"/></g></g>',
    }

    function changeTransition(id: "text" | "media", key: "type" | "duration" | "easing", value: any) {
        if (key === "duration") value = Number(value)

        if (isItem) {
            // WIP duplicate of SetTime.svelte ++
            let indexes = $activeEdit.items

            slideItemTransition[key] = value
            value = { ...(slideItemTransition || {}), [key]: value }

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
            if (id === "text") {
                slideTextTransition[key] = value
                value = { ...(slideTextTransition || {}), [key]: value }
            } else {
                slideMediaTransition[key] = value
                value = { ...(slideMediaTransition || {}), [key]: value }
            }

            let globalValues = $transitionData[id]
            if (value.type === globalValues.type && value.duration === globalValues.duration && value.easing === globalValues.easing) value = null

            let type = id === "text" ? "transition" : "mediaTransition"
            let indexes = $selected.data.map((a) => a.index)
            let override = "show#" + $activeShow?.id + "layout#" + _show().get("settings.activeLayout") + "indexes#" + indexes.join(",") + type
            history({ id: "SHOW_LAYOUT", newData: { key: type, data: value, indexes }, location: { page: "show", override } })

            setTimeout(() => {
                window.api.send(OUTPUT, { channel: "SHOWS", data: get(showsCache) })
            }, 500)
        } else {
            transitionData.update((a: any) => {
                a[id][key] = value
                return a
            })
        }
    }

    let isItem: boolean = $popupData.action === "transition"
    let isSlide: boolean = $selected.id === "slide"
    let ref = isSlide || isItem ? _show().layouts("active").ref()[0] : []

    onMount(() => {
        popupData.set({})
    })

    let slideIndex = isItem ? $activeEdit.slide : $selected.data?.[0]?.index
    let slideRef = ref?.[slideIndex] || {}

    let slideItems: any[] = []
    if (isItem) {
        if ($activeEdit.type === "overlay") slideItems = $overlays[$activeEdit.id || ""]?.items || []
        else if ($activeEdit.type === "template") slideItems = $templates[$activeEdit.id || ""]?.items || []
        else slideItems = _show().get("slides")[slideRef.id]?.items || []
    }
    let firstItem = slideItems[$activeEdit.items[0]] || {}
    $: slideItemTransition = isItem ? clone(firstItem.actions?.transition || $transitionData.text || { type: "fade", duration: 500, easing: "sine" }) : {}

    let firstSlide = slideRef.data || {}
    $: slideTextTransition = isSlide ? clone(firstSlide.transition || $transitionData.text || { type: "fade", duration: 500, easing: "sine" }) : {}
    $: slideMediaTransition = isSlide ? clone(firstSlide.mediaTransition || $transitionData.media || { type: "fade", duration: 800, easing: "sine" }) : {}

    $: currentTextTransition = clone(isItem ? slideItemTransition : isSlide ? slideTextTransition : $transitionData.text)
    $: currentMediaTransition = clone(isSlide ? slideMediaTransition : $transitionData.media)

    let selectedType: "text" | "media" = "text"
    $: textIsDisabled = currentTextTransition.type === "none"
    $: mediaIsDisabled = currentMediaTransition.type === "none"
    $: textDurationValue = currentTextTransition.duration
    $: mediaDurationValue = currentMediaTransition.duration
    $: textEasingValue = easings.find((a) => a.id === currentTextTransition.easing)?.name || "$:easings.sine:$"
    $: mediaEasingValue = easings.find((a) => a.id === currentMediaTransition.easing)?.name || "$:easings.sine:$"
    // $: textTypeValue = types.find((a) => a.id === currentTextTransition.type)?.name || "$:transition.fade:$"
    // $: mediaTypeValue = types.find((a) => a.id === currentMediaTransition.type)?.name || "$:transition.fade:$"

    function reset() {
        let defaultDuration = selectedType === "text" ? 500 : 800
        changeTransition(selectedType, "duration", isSlide || isItem ? $transitionData[selectedType].duration || defaultDuration : defaultDuration)
        changeTransition(selectedType, "type", isSlide || isItem ? $transitionData[selectedType].type || "fade" : "fade")
        changeTransition(selectedType, "easing", isSlide || isItem ? $transitionData[selectedType].easing || "sine" : "sine")
    }
</script>

{#if !isItem}
    <div style="display: flex;">
        <Button
            on:click={() => (selectedType = "text")}
            style={selectedType === "text" ? "flex: 1;border-bottom: 2px solid var(--secondary) !important;white-space: nowrap;" : "flex: 1;border-bottom: 2px solid var(--primary-lighter);white-space: nowrap;"}
            bold={false}
            center
            dark
        >
            <Icon id="text" right />
            <T id="transition.text" />{#if isSlide}&nbsp;<T id="transition.current_slide" />{/if}
        </Button>
        <Button
            on:click={() => (selectedType = "media")}
            style={selectedType === "media" ? "flex: 1;border-bottom: 2px solid var(--secondary) !important;white-space: nowrap;" : "flex: 1;border-bottom: 2px solid var(--primary-lighter);white-space: nowrap;"}
            bold={false}
            center
            dark
        >
            <Icon id="image" right />
            <T id="transition.media" />{#if isSlide}&nbsp;<T id="transition.current_slide" />{/if}
        </Button>
    </div>
{/if}

<!-- TYPE -->

<div class="types">
    {#each types as type}
        <Button outline={selectedType === "text" ? type.id === currentTextTransition.type : type.id === currentMediaTransition.type} on:click={() => changeTransition(selectedType, "type", type.id)} bold={false}>
            <svg viewBox="0 0 100 100" width="{iconSize}pt" height="{iconSize}pt">
                {@html icons[type.id]}
            </svg>
            <!-- <Icon id="noIcon" size={4} /> -->
            <T id={type.name} />
        </Button>
    {/each}
</div>
<!-- <CombinedInput>
    <p><T id="transition.type" /></p>
    <Dropdown options={types} value={selectedType === "text" ? textTypeValue : mediaTypeValue} on:click={(e) => changeTransition(selectedType, "type", e.detail.id)} />
</CombinedInput> -->

<CombinedInput style="margin-top: 10px;">
    <p><T id="transition.duration" /></p>
    <NumberInput
        disabled={selectedType === "text" ? textIsDisabled : mediaIsDisabled}
        value={selectedType === "text" ? textDurationValue : mediaDurationValue}
        max={20000}
        fixed={1}
        decimals={3}
        step={100}
        inputMultiplier={0.001}
        on:change={(e) => changeTransition(selectedType, "duration", e.detail)}
    />
</CombinedInput>

<CombinedInput>
    <p><T id="transition.easing" /></p>
    <Dropdown disabled={selectedType === "text" ? textIsDisabled : mediaIsDisabled} options={easings} value={selectedType === "text" ? textEasingValue : mediaEasingValue} on:click={(e) => changeTransition(selectedType, "easing", e.detail.id)} />
</CombinedInput>

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
