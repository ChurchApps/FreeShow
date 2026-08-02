<script lang="ts">
    import { uid } from "uid"
    import { activePopup, messages, selected } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { createStore, updateStore } from "../../helpers/historyStores"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextarea from "../../inputs/MaterialTextarea.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    // create/edit popup for a templated audience alert ("Message") - see actions/messages.ts for how it triggers/renders
    const DEFAULT_MESSAGE = {
        name: "",
        text: ""
    }

    let existing: boolean = $selected.id === "message" && $selected.data[0]?.id
    let messageId = existing ? $selected.data[0].id : uid()
    let currentMessage = clone($messages[messageId] || DEFAULT_MESSAGE)

    function updateValue(e: any, key: string) {
        let value = e?.detail ?? e?.target?.value ?? e
        if (value === undefined) return

        // can't have the same name as an existing message (names are usable as API trigger keys)
        if (key === "name") {
            let existingName
            do {
                existingName = Object.entries($messages).find(([id, a]) => id !== messageId && value.toLowerCase() === a.name.toLowerCase())
                if (existingName) value += " 2"
            } while (existingName)
        }

        currentMessage[key] = value

        if (existing) {
            updateStore("messages", messageId, currentMessage)
        } else {
            createStore("messages", currentMessage, messageId)
            existing = true
        }
    }

    // {{tokens}} found in the text - each gets a default value input
    $: tokens = [...new Set([...(currentMessage.text || "").matchAll(/{{\s*([^{}]+?)\s*}}/g)].map((a) => a[1].trim()))]

    function updateToken(token: string, e: any) {
        const value = e?.detail ?? e?.target?.value ?? ""
        if (!currentMessage.tokens) currentMessage.tokens = {}
        currentMessage.tokens[token] = value
        updateValue(currentMessage.tokens, "tokens")
    }

    function nameKeydown(e: any) {
        // close on Enter only when the message is already usable (has text)
        if (e.key === "Enter" && e.target?.value && currentMessage.text) activePopup.set(null)
    }
</script>

<MaterialTextInput label="inputs.name" style="margin-bottom: 10px;" value={currentMessage.name} on:change={(e) => updateValue(e.detail, "name")} autofocus={!currentMessage.name} on:keydown={nameKeydown} />

<MaterialTextarea label="messages.text" value={currentMessage.text || ""} rows={3} on:change={(e) => updateValue(e.detail, "text")} />
<p class="tip"><T id="messages.tokens_tip" /></p>

{#if tokens.length}
    {#each tokens as token}
        <InputRow>
            <p style="width: 40%;display: flex;align-items: center;padding: 0 10px;"><span style="color: var(--secondary);">&#123;&#123;</span>{token}<span style="color: var(--secondary);">&#125;&#125;</span></p>
            <MaterialTextInput label="messages.default_value" value={currentMessage.tokens?.[token] || ""} on:change={(e) => updateToken(token, e)} />
        </InputRow>
    {/each}
{/if}

<MaterialNumberInput label="messages.display_duration (s)" value={currentMessage.displayDuration || 0} step={1} min={0} max={3600} defaultValue={0} on:change={(e) => updateValue(e.detail, "displayDuration")} />

<style>
    .tip {
        opacity: 0.7;
        font-size: 0.8em;
        margin-bottom: 10px;
    }
</style>
