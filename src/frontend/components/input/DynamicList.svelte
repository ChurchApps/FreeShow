<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { dictionary } from "../../stores"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Center from "../system/Center.svelte"
    import InputRow from "./InputRow.svelte"

    type Item = {
        id: string
        [key: string]: any
    }

    export let items: Item[]
    export let allowOpen = true
    export let addDisabled = false
    export let nothingText = true

    let dispatch = createEventDispatcher()
    function openItem(id: string) {
        if (!allowOpen) return
        dispatch("open", id)
    }
    function deleteItem(id: string) {
        dispatch("delete", id)
    }
    function addItem() {
        dispatch("add")
    }
</script>

{#if items.length}
    {#each items as item}
        <InputRow>
            {#if allowOpen}
                <MaterialButton style="width: 100%;font-weight: normal;" title={$dictionary.titlebar?.edit} on:click={() => openItem(item.id)}>
                    <slot {item} />
                </MaterialButton>
            {:else}
                <slot {item} />
            {/if}

            <MaterialButton icon="delete" style="width: 40px;" title={$dictionary.actions?.delete} on:click={() => deleteItem(item.id)} white />
        </InputRow>
    {/each}
{:else if nothingText}
    <Center faded>
        <T id="empty.general" />
    </Center>

    <br />
{/if}

<MaterialButton variant="outlined" icon="add" disabled={addDisabled} on:click={addItem}>
    <T id="settings.add" />
</MaterialButton>
