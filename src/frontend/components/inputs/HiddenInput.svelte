<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { activeEdit, activePage, activeProject, activeRename, projectView } from "../../stores"
    import { translateText } from "../../utils/language"

    export let value = ""
    export let style = ""
    export let id: string
    export let allowEmpty = true
    export let allowEdit = true

    $: value = edit ? value.replaceAll("  ", " ") : value.trim()

    let nameElem: HTMLParagraphElement, inputElem: HTMLInputElement
    export let edit: boolean | string = false
    let prevVal = ""
    $: if (!edit && !value.length && prevVal.length) value = prevVal
    const click = (e: any) => {
        if (e.target === nameElem) {
            //  || e.target.closest(".contextMenu")
            activeRename.set(id)
            prevVal = value
            setTimeout(() => inputElem?.focus(), 10)
        } else if (e.target !== inputElem) {
            cancelEdit()
        }
    }

    $: if ($activeRename === id) {
        edit = id
        setTimeout(() => inputElem?.focus(), 10)
        // prevVal = value
    } else if ($activeRename === null) edit = false

    const HOLD_TIME = 700

    let timeout: NodeJS.Timeout | null = null
    function mousedown(e: any) {
        if (e.target === nameElem && allowEdit) {
            timeout = setTimeout(() => {
                click(e)
            }, HOLD_TIME)

            return
        }

        if (e.target.closest("input") || e.target.closest(".edit") || e.target.closest(".contextMenu")) return

        cancelEdit()
    }

    function stopTimeout() {
        if (timeout) clearTimeout(timeout)
    }

    function keydown(e) {
        if (e.key === "Enter" || e.key === "Tab") {
            if ($activeRename?.includes("project_") && $activeProject === $activeRename.slice($activeRename.indexOf("_") + 1)) {
                setTimeout(() => projectView.set(false), 20)
            }

            cancelEdit()
            return
        }
    }

    let initiallyEmpty = false
    $: if (id) updateState()
    function updateState() {
        initiallyEmpty = !value
    }

    const dispatch = createEventDispatcher()
    function change(e: any) {
        let value = (e.target?.value || "").trim()
        if (allowEmpty || value.length) dispatch("edit", { value, id })

        if (!initiallyEmpty || id.includes("category")) return

        let objectId = id.slice(id.indexOf("_") + 1)
        // open editor if no name (probably just created)
        if (id.includes("template") || id.includes("overlay") || id.includes("effect")) {
            let type: any = id.slice(0, id.indexOf("_"))
            activeEdit.set({ type, id: objectId, items: [] })
            activePage.set("edit")
        }
    }

    $: editingActive = edit === id && allowEdit
    function cancelEdit() {
        if (!editingActive) return

        edit = false
        activeRename.set(null)
    }

    $: if (editingActive) setTimeout(selectText, 10)
    function selectText() {
        inputElem?.select()
    }
</script>

<svelte:window on:mousedown={mousedown} on:mouseup={stopTimeout} on:dragstart={stopTimeout} on:keydown={keydown} />
<!-- on:contextmenu={click} -->

{#if editingActive}
    <input bind:this={inputElem} {value} on:change={change} class="edit nocontext _rename name" />
{:else}
    <p {id} {style} bind:this={nameElem} class="_rename">
        {#if value.length}
            {value}
        {:else}
            <span style="opacity: 0.5;font-style: italic;pointer-events: none;">{translateText("main.unnamed")}</span>
        {/if}
    </p>
{/if}

<style>
    p {
        margin: 5px;
        width: 100%;
        text-align: start;
        /* cursor: text; */
    }
    input {
        padding: 5px;
        font-weight: inherit;
        font-size: inherit;
        background-color: var(--hover);
        color: inherit;
        border: none;
        width: 100%;
        min-width: 80px;
    }
</style>
