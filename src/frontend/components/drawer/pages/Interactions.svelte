<script lang="ts">
    import { uid } from "uid"
    import { activePopup, activeRename, interactions, labelsDisabled, openedInteractionId, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"

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

    function startGame() {
        alert("OPEN FOR INTERACTIONS!")
    }
</script>

<!-- WIP what is it? Polls / Quizzes / Word Clouds / Game Shows / etc. -->

<!-- WIP Game options -->
<!-- show all inputs at once? = forms & no timer  -->
<!-- otherwise have X seconds timer? or manually go to next -->

<!-- WIP run custom actions in between each input -->

{#if openedId}
    <div class="banner">EXPERIMENTAL!</div>

    <div class="header">
        <MaterialButton style="padding: 6px;" icon="back" title="actions.back" on:click={() => openedInteractionId.set("")} />

        <p style={openedInteraction.name ? "" : "font-style: italic;opacity: 0.7;"}>
            {openedInteraction.name || translateText("main.unnamed")}
        </p>
    </div>

    <div class="inputs">
        {#each openedInteraction.inputs as input, i}
            <div
                class="input context #interaction_input"
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

                <span>
                    <MaterialButton class="rearrange" disabled={i === openedInteraction.inputs.length - 1} icon="down" title="actions.backward" style="padding: 8px;" on:click={() => rearrangeInputs("forward", i)} />
                    <MaterialButton class="rearrange" disabled={i === 0} icon="up" title="actions.forward" style="padding: 8px;" on:click={() => rearrangeInputs("backward", i)} />
                </span>
            </div>
        {/each}

        <MaterialButton variant="outlined" icon="add" on:click={addInput}>
            <T id="New input" />
        </MaterialButton>
    </div>

    <MaterialButton variant="contained" disabled={!openedInteraction.inputs.length} style="background-color: green;" on:click={startGame}>
        <T id="Start/Open" />
    </MaterialButton>
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
