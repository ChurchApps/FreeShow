<script lang="ts">
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"
    import { dictionary, spellcheck } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import { closeContextMenu } from "../../utils/shortcuts"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"

    $: misspelled = $spellcheck?.misspelled || ""
    $: suggestions = $spellcheck?.suggestions || []

    function addToDictionary() {
        sendMain(Main.SPELLCHECK, { addToDictionary: misspelled })
        closeContextMenu()
    }

    function fixSpelling(word: string) {
        sendMain(Main.SPELLCHECK, { fixSpelling: word })
        closeContextMenu()
    }
</script>

{#if misspelled && suggestions.length}
    {#each suggestions as suggestion}
        <div on:click={() => fixSpelling(suggestion)} on:keydown={triggerClickOnEnterSpace} tabindex={0} role="button" data-title={$dictionary.context?.correct}>
            <span style="display: flex;align-items: center;gap: 10px;">
                <Icon id="fix_misspelling" />
                <p style="display: flex;align-items: center;gap: 5px;font-weight: bold;">
                    {suggestion}
                </p>
            </span>
        </div>
    {/each}

    <hr />

    <div on:click={addToDictionary} on:keydown={triggerClickOnEnterSpace} tabindex={0} role="button">
        <span style="display: flex;align-items: center;gap: 10px;">
            <Icon id="dictionary" />
            <p style="display: flex;align-items: center;gap: 5px;">
                <T id="context.to_dictionary" />: <span style="font-weight: bold;">{misspelled}</span>
            </p>
        </span>
    </div>

    <hr />

    <!-- <ContextItem id="misspelled" />
    <ContextItem id="suggestions" /> -->
{/if}

<style>
    div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 6px 20px;
        cursor: pointer;
    }
    div:hover {
        background-color: rgb(0 0 0 / 0.2);
    }

    p {
        max-width: 300px;
    }

    hr {
        margin: 5px 0;
        height: 1px;
        border: none;
        background-color: var(--primary-lighter);
    }
</style>
