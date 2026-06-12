<script lang="ts">
    import { uid } from "uid"
    import { activePopup, activeRename, interactions, labelsDisabled, openedInteractionId, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import { getInteraction, getActiveInteractions, startInteraction, stopInteraction } from "./interactions"
    import InputRow from "../../input/InputRow.svelte"

    export let searchValue: string
    console.log(searchValue)

    function createNew() {
        const id = uid()
        interactions.update((a) => {
            a[id] = {
                name: "",
                inputs: []
            }
            return a
        })

        activeRename.set(`interaction_${id}`)
    }

    $: openedId = $openedInteractionId
    $: openedInteraction = $interactions[openedId] || null

    let activeInteractions = getActiveInteractions()

    function updateInteractionName(id: string, value: string) {
        if (!value) return

        interactions.update((a) => {
            if (!a[id]) return a

            if (!a[id].name) openedInteractionId.set(id)

            a[id].name = value

            return a
        })
    }

    // OPENED

    function addInput() {
        popupData.set({ id: openedId })
        activePopup.set("interaction_input")
    }

    function rearrangeInputs(direction: "forward" | "backward", index: number) {
        interactions.update((a) => {
            const items = clone(a[openedId]?.inputs)
            if (!items) return a

            const currentItem = items.splice(index, 1)[0]

            if (direction === "forward") index = Math.min(index + 1, items.length)
            else if (direction === "backward") index = Math.max(index - 1, 0)

            console.log(index, items, currentItem)
            a[openedId].inputs = [...items.slice(0, index), currentItem, ...items.slice(index)]

            return a
        })
    }

    const inputTypeIcons = {
        buttons: "grid",
        checkbox: "checkbox",
        radio: "radio_button",
        dropdown: "dropdown",
        input: "keyboard",
        slider: "slider",
        number_range: "ruler"
    }

    let answers: { [key: string]: any }[] = []
    let clients: { [key: string]: any } = {}
    async function start() {
        const interaction = await startInteraction(openedId)
        interaction?.onUpdate((data) => {
            answers = data.answers
            clients = data.clients
        })

        activeInteractions = getActiveInteractions()
    }
    $: if (openedId && activeInteractions.includes(openedId)) {
        const interaction = getInteraction(openedId)
        interaction?.onUpdate((data) => {
            answers = data.answers
            clients = data.clients
        })
    }

    $: console.log("Answers updated:", answers)
</script>

<!-- WIP what is it? Polls / Quizzes / Q&A / Word Clouds / Game Shows / etc. -->

<!-- WIP Game options -->
<!-- show all inputs at once? = forms & no timer  -->
<!-- otherwise have X seconds timer? or manually go to next -->

<!-- WIP run custom actions in between each input -->

{#if openedId}
    <div class="banner">EXPERIMENTAL!</div>

    <div class="header">
        <MaterialButton style="padding: 6px;" icon="back" title="actions.back" on:click={() => openedInteractionId.set("")} />

        <p style="flex: 1;{openedInteraction.name ? '' : 'font-style: italic;opacity: 0.7;'}">
            {openedInteraction.name || translateText("main.unnamed")}
        </p>

        {#if activeInteractions.includes(openedId)}
            <div style="display: flex;align-items: center;gap: 4px;opacity: 0.7;margin-right: 8px;">
                <Icon id="people" white />
                {Object.keys(clients).length}
            </div>
        {/if}
    </div>

    <div class="inputs">
        {#each openedInteraction.inputs as input, i}
            <InputRow arrow={activeInteractions.includes(openedId) && Object.keys(answers[i] || {}).length > 0}>
                <div
                    class="input context #interaction_input"
                    style="width: 100%;"
                    id="#{i}"
                    on:click={(e) => {
                        if (e.target?.closest(".rearrange")) return

                        popupData.set({ id: openedId, inputIndex: i })
                        activePopup.set("interaction_input")
                    }}
                    role="none"
                >
                    <Icon id={input.type} size={1.5} gradient />
                    <Icon id={inputTypeIcons[input.inputType]} white />

                    <p style="flex: 1;{input.question ? '' : 'font-style: italic;opacity: 0.7;'}">
                        {input.question || translateText("main.unnamed")}
                    </p>

                    {#if activeInteractions.includes(openedId)}
                        ({Object.keys(answers[i] || {}).length || 0})
                    {:else}
                        <span>
                            <MaterialButton class="rearrange" disabled={i === openedInteraction.inputs.length - 1} icon="down" title="actions.backward" style="padding: 8px;" on:click={() => rearrangeInputs("forward", i)} />
                            <MaterialButton class="rearrange" disabled={i === 0} icon="up" title="actions.forward" style="padding: 8px;" on:click={() => rearrangeInputs("backward", i)} />
                        </span>
                    {/if}
                </div>

                <div slot="menu">
                    {#each Object.entries(answers[i] || {}) as [clientId, answer]}
                        <p>
                            {#if clients[clientId]?.name}<span>{clients[clientId].name}:</span>{/if}
                            <span>{answer}</span>
                        </p>
                    {/each}
                </div>
            </InputRow>
        {/each}

        {#if !activeInteractions.includes(openedId)}
            <MaterialButton variant="outlined" icon="add" on:click={addInput}>
                <T id="New input" />
            </MaterialButton>
        {/if}
    </div>

    {#if activeInteractions.includes(openedId)}
        <!-- current index... -->

        <!-- go to next/previous index -->
        <InputRow>
            <MaterialButton variant="outlined" style="flex: 1;" on:click={() => getInteraction(openedId)?.previous()}>
                <T id="Previous" />
            </MaterialButton>
            <MaterialButton variant="outlined" style="flex: 1;" on:click={() => getInteraction(openedId)?.next()}>
                <T id="Next" />
            </MaterialButton>
        </InputRow>

        <MaterialButton
            variant="contained"
            style="background-color: red;"
            on:click={async () => {
                await stopInteraction(openedId)
                activeInteractions = getActiveInteractions()
            }}
        >
            <T id="Stop/Close" />
        </MaterialButton>
    {:else}
        <MaterialButton variant="contained" disabled={!openedInteraction.inputs.length} style="background-color: green;" on:click={start}>
            <T id="Start/Open" />
        </MaterialButton>
    {/if}
{:else}
    <div class="interactions">
        {#each sortByName(keysToID($interactions)) as interaction}
            <SelectElem id="interaction" data={{ id: interaction.id }}>
                <div
                    class="interaction context #interaction"
                    on:click={(e) => {
                        if (e.target?.closest(".edit")) return
                        openedInteractionId.set(interaction.id)
                    }}
                    role="none"
                >
                    <p style={interaction.name ? "" : "font-style: italic;opacity: 0.7;"}>
                        <HiddenInput value={interaction.name} id="interaction_{interaction.id}" on:edit={(e) => updateInteractionName(interaction.id, e.detail.value)} />
                    </p>
                </div>
            </SelectElem>
        {/each}
    </div>

    <FloatingInputs onlyOne>
        <MaterialButton
            icon="add"
            title="new.create"
            on:click={() => {
                // selected.set({ id: null, data: [] })
                // activePopup.set("interaction")
                createNew()
            }}
        >
            {#if !$labelsDisabled}<T id="new.create" />{/if}
        </MaterialButton>
    </FloatingInputs>
{/if}

<style>
    .banner {
        width: 100%;
        background-color: #8b0000;
        color: white;

        text-align: center;
        font-weight: bold;
        font-size: 0.8em;

        padding: 4px 8px;
    }

    .interactions {
        flex: 1;
        overflow: auto;

        padding-bottom: 60px;
    }

    .interaction {
        display: flex;
        flex-direction: column;
        gap: 6px;

        padding: 4px 8px;

        cursor: pointer;
    }

    .header {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 12px;

        background-color: var(--primary-darkest);
        padding: 4px;

        border-bottom: 1px solid var(--primary);
    }

    .inputs {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px;
        overflow: auto;
    }

    .input {
        display: flex;
        align-items: center;
        gap: 8px;

        padding: 4px 8px;

        background-color: var(--primary-darkest);

        cursor: pointer;
    }
    .input:hover {
        background-color: var(--primary-darker);
    }
</style>
