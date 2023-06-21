<script lang="ts">
    import type { ListItem } from "../../../../types/Show"
    import { activePopup, dictionary, popupData } from "../../../stores"
    import { newToast } from "../../../utils/messages"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { addToPos } from "../../helpers/mover"
    import Button from "../../inputs/Button.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    let items: ListItem[] = $popupData.value || []
    $: if (items) popupData.set({ ...$popupData, value: items })

    let currentValue = ""
    function updateValue(e: any) {
        currentValue = e.target.value
    }

    function addItem() {
        if (!currentValue) {
            newToast("$toast.no_name")
            return
        }

        if (currentlyEditing !== null) items[currentlyEditing].text = currentValue
        else items = [...items, { text: currentValue }]

        currentValue = ""
        currentlyEditing = null
    }

    let currentlyEditing: any = null
    function editItem(index: number) {
        currentValue = items[index].text
        currentlyEditing = index
    }

    function removeItem(index: number) {
        items.splice(index, 1)
        items = items
    }

    function moveItem(index: number) {
        let newItems = clone(items)
        let currentItem = newItems.splice(index, 1)

        let newIndex = index - 1
        if (newIndex < 0) newIndex = items.length - 1

        items = addToPos(newItems, currentItem, newIndex)
    }

    let listStyle = $popupData.type || ""

    function keydown(e: any) {
        if (e.key === "Enter") {
            updateValue(e)
            setTimeout(() => {
                if (e.shiftKey) currentValue += "<br>"
                else addItem()
            }, 10)
        }
    }
</script>

<div style="display: flex;gap: 10px;">
    <TextInput value={currentValue} on:change={updateValue} on:keydown={keydown} />
    <Button style="white-space: nowrap;" on:click={addItem} dark>
        {#if currentlyEditing !== null}
            <Icon id="edit" right />
            <T id="timer.edit" />
        {:else}
            <Icon id="add" right />
            <T id="settings.add" />
        {/if}
    </Button>
</div>

<ul style="list-style{listStyle.includes('disclosure') ? '-type:' : ': inside'} {listStyle || 'disc'};">
    {#each items as item, i}
        <li class:active={currentlyEditing === i}>
            <div style="display: inline-flex;">
                <span style="padding-right: 120px;">
                    <!-- TODO: list icons ? -->
                    <!-- <Icon id={item.icon || ""} /> -->
                    <span>{@html item.text}</span>
                </span>
                <span style="right: 0;position: absolute;display: flex;">
                    <Button title={$dictionary.timer?.edit} on:click={() => editItem(i)}>
                        <Icon id="edit" />
                    </Button>
                    <Button title={$dictionary.settings?.remove} on:click={() => removeItem(i)} disabled={currentlyEditing !== null}>
                        <Icon id="delete" />
                    </Button>
                    <Button on:click={() => moveItem(i)} disabled={i === 0 || currentlyEditing !== null}>
                        <Icon id="up" />
                    </Button>
                </span>
            </div>
        </li>
    {/each}
</ul>

<Button on:click={() => activePopup.set(null)} center dark>
    <Icon id="check" size={1.2} right />
    <T id="actions.done" />
</Button>

<style>
    ul {
        list-style-position: inside;
        padding: 10px 0;

        overflow-y: auto;
        max-height: 50vh;
    }

    li {
        position: relative;
        padding: 2px 10px;
    }

    li.active {
        opacity: 0.6;
    }

    li:nth-child(odd) {
        background-color: var(--primary-darker);
    }
</style>
