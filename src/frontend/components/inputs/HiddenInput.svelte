<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { activeRename, dictionary } from "../../stores"

    export let value: string = ""
    export let style: string = ""
    export let id: string
    export let allowEmpty: boolean = true
    export let allowEdit: boolean = true

    $: value = edit ? value.replaceAll("  ", " ") : value.trim()

    let nameElem: HTMLParagraphElement, inputElem: HTMLInputElement
    export let edit: boolean | string = false
    let prevVal: string = ""
    $: if (!edit && !value.length && prevVal.length) value = prevVal
    const click = (e: any) => {
        if (e.target === nameElem) {
            //  || e.target.closest(".contextMenu")
            activeRename.set(id)
            prevVal = value
            setTimeout(() => inputElem?.focus(), 10)
        } else if (e.target !== inputElem) {
            edit = false
            activeRename.set(null)
        }
    }

    $: if ($activeRename === id) {
        edit = id
        setTimeout(() => inputElem?.focus(), 10)
        // prevVal = value
    } else if ($activeRename === null) edit = false

    let timeout: any
    function mousedown(e: any) {
        if (e.target === nameElem && allowEdit) {
            timeout = setTimeout(() => {
                click(e)
            }, 500)

            return
        }

        if (e.target.closest("input") || e.target.closest(".edit")) return

        edit = false
        activeRename.set(null)
    }

    function keydown(e) {
        if (e.key === "Enter" || e.key === "Tab") {
            edit = false
            activeRename.set(null)

            return
        }

        if (edit !== id) return

        // disable space clicking on button
        if (e.key !== " " || !e.target?.classList.contains("_rename")) return
        e.preventDefault()

        let pos = e.target.selectionStart
        if (pos + 1 < value.length) value = value.trim()
        value = value.slice(0, pos) + " " + value.slice(pos)
        setTimeout(() => {
            console.log(pos)
            e.target.selectionStart = pos + 1
            e.target.selectionEnd = pos + 1
        })
    }

    const dispatch = createEventDispatcher()
    function change(e: any) {
        let value = e.target.value
        if (allowEmpty || value.length) dispatch("edit", { value, id })
    }

    $: if (edit === id && allowEdit) setTimeout(selectText, 10)
    function selectText() {
        inputElem?.select()
    }
</script>

<svelte:window on:mousedown={mousedown} on:mouseup={() => clearTimeout(timeout)} on:dragstart={() => clearTimeout(timeout)} on:keydown={keydown} />
<!-- on:contextmenu={click} -->

{#if edit === id && allowEdit}
    <input bind:this={inputElem} on:change={change} class="edit nocontext _rename name" bind:value />
{:else}
    <p {id} {style} bind:this={nameElem} class="_rename">
        {#if value.length}
            {value}
        {:else}
            <span style="opacity: 0.5; pointer-events: none;">{$dictionary.main?.unnamed}</span>
        {/if}
    </p>
{/if}

<style>
    p {
        margin: 5px;
        width: 100%;
        text-align: left;
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
