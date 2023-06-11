<script lang="ts">
    import type { ListItem } from "../../../../types/Show"
    import { activePopup, dictionary, popupData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    let items: ListItem[] = $popupData.value || []
    $: if (items) popupData.set({ ...$popupData, value: items })
    $: console.log(items)
    $: console.log($popupData)

    let currentValue = ""
    function updateValue(e: any) {
        currentValue = e.target.value
    }

    function addItem() {
        if (!currentValue) return

        items = [...items, { text: currentValue }]
        currentValue = ""
    }

    function removeItem(index: number) {
        items.splice(index, 1)
        items = items
    }

    let listStyle = $popupData.type || ""
</script>

<div style="display: flex;gap: 10px;">
    <TextInput value={currentValue} on:change={updateValue} />
    <Button style="white-space: nowrap;" on:click={addItem} dark>
        <Icon id="add" right />
        <T id="settings.add" />
    </Button>
</div>

<ul style="list-style{listStyle.includes('disclosure') ? '-type:' : ': inside'} {listStyle || 'disc'};">
    {#each items as item, i}
        <li>
            <div style="display: inline-flex;">
                <span>
                    <!-- TODO: list icons ? -->
                    <!-- <Icon id={item.icon || ""} /> -->
                    <span>{item.text}</span>
                </span>
                <Button style="right: 0;position: absolute;" title={$dictionary.settings?.remove} on:click={() => removeItem(i)}>
                    <Icon id="delete" />
                </Button>
            </div>
        </li>
    {/each}
</ul>

<Button on:click={() => activePopup.set(null)} center>
    <Icon id="check" right />
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

    li:nth-child(odd) {
        background-color: var(--primary-darker);
    }
</style>
