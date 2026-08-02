<script lang="ts">
    import { activePopup, labelsDisabled, messages, overlays, selected } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import { clearMessage, replaceMessageTokens, triggerMessage } from "../../actions/messages"
    import { deleteStore } from "../../helpers/historyStores"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Center from "../../system/Center.svelte"

    export let searchValue

    // live trigger panel for templated audience alerts ("Messages") - defined in the "message" popup, rendered via actions/messages.ts
    const profile = getAccess("messages")
    const readOnly = profile.global === "read"

    $: sortedMessages = sortByName(keysToID($messages))
    $: filteredMessages = searchValue.length > 1 ? sortedMessages.filter((a) => (a.name || "").toLowerCase().includes(searchValue.toLowerCase())) : sortedMessages

    // per-message {{token}} fill-in values typed before triggering (not persisted - defaults live on the message)
    let tokenValues: { [messageId: string]: { [token: string]: string } } = {}

    const getTokens = (text: string) => [...new Set([...(text || "").matchAll(/{{\s*([^{}]+?)\s*}}/g)].map((a) => a[1].trim()))]

    function updateTokenValue(messageId: string, token: string, e: any) {
        const value = e?.target?.value ?? ""
        if (!tokenValues[messageId]) tokenValues[messageId] = {}
        tokenValues[messageId][token] = value
    }

    // active = its materialized overlay is currently in the overlays store (see actions/messages.ts)
    $: activeIds = Object.values($overlays)
        .map((a) => a.fromMessageId)
        .filter(Boolean)

    function edit(messageId: string) {
        selected.set({ id: "message", data: [{ id: messageId }] })
        activePopup.set("message")
    }

    function deleteMessage(messageId: string) {
        clearMessage(messageId)
        deleteStore("messages", messageId)
    }
</script>

<div class="messages">
    {#if filteredMessages.length}
        <div class="list">
            {#each filteredMessages as message}
                {@const tokens = getTokens(message.text)}
                {@const isActive = activeIds.includes(message.id)}

                <div class="message" class:active={isActive}>
                    <span class="title">
                        <Icon id="message" right />
                        <p data-title={message.name}>
                            {#if message.name?.length}
                                {message.name}
                            {:else}
                                <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
                            {/if}
                        </p>
                    </span>

                    <p class="preview" title={replaceMessageTokens(message.text, message, tokenValues[message.id] || {})}>
                        {replaceMessageTokens(message.text, message, tokenValues[message.id] || {})}
                    </p>

                    {#if tokens.length}
                        <div class="tokens">
                            {#each tokens as token}
                                <TextInput placeholder={token + (message.tokens?.[token] ? ` (${message.tokens[token]})` : "")} value={tokenValues[message.id]?.[token] || ""} on:input={(e) => updateTokenValue(message.id, token, e)} />
                            {/each}
                        </div>
                    {/if}

                    <div class="buttons">
                        <Button id="trigger" title={translateText(isActive ? "messages.update" : "messages.show")} on:click={() => triggerMessage(message.id, tokenValues[message.id] || {})} center style="flex: 1;" dark>
                            <Icon id="play" size={1.2} white={!isActive} right />
                            <T id={isActive ? "messages.update" : "messages.show"} />
                        </Button>
                        <Button id="clear" title={translateText("clear.general")} on:click={() => clearMessage(message.id)} center style="flex: 1;" disabled={!isActive} dark red={isActive}>
                            <Icon id="clear" size={1.2} right />
                            <T id="clear.general" />
                        </Button>
                        {#if !readOnly}
                            <Button title={translateText("menu.edit")} on:click={() => edit(message.id)} dark>
                                <Icon id="edit" size={1.2} white />
                            </Button>
                            <Button title={translateText("actions.delete")} on:click={() => deleteMessage(message.id)} dark>
                                <Icon id="delete" size={1.2} white />
                            </Button>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
</div>

<FloatingInputs onlyOne>
    <MaterialButton
        disabled={readOnly}
        icon="add"
        title="new.message"
        on:click={() => {
            selected.set({ id: null, data: [] })
            activePopup.set("message")
        }}
    >
        {#if !$labelsDisabled}<T id="new.message" />{/if}
    </MaterialButton>
</FloatingInputs>

<style>
    .messages {
        flex: 1;
        overflow: auto;

        padding-bottom: 60px;
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin: 5px;
    }

    .message {
        display: flex;
        flex-direction: column;

        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        overflow: hidden;
    }
    .message.active {
        border: 2px solid var(--secondary);
    }

    .title {
        display: flex;
        align-items: center;
        padding: 5px 10px;
        font-weight: bold;
    }

    .preview {
        padding: 0 10px 5px;
        opacity: 0.7;
        font-size: 0.9em;

        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .tokens {
        display: flex;
        gap: 5px;
        padding: 0 10px 5px;
    }
    .tokens :global(input) {
        background-color: var(--primary-darkest);
    }

    .buttons {
        display: flex;
        width: 100%;
    }
</style>
