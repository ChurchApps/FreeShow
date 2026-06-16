<script lang="ts">
    import { interactions, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone } from "../../helpers/array"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let chosenType = ""
    const types = [
        { id: "multi_choice", name: translateText("interaction.multi_choice"), icon: "multi_choice" },
        { id: "text", name: translateText("variables.text"), icon: "text" },
        { id: "number", name: translateText("variables.number"), icon: "number" },
        { id: "heading", name: translateText("interaction.heading"), icon: "info" }
    ]

    let chosenInputType = ""
    const inputTypes = {
        multi_choice: [
            { id: "buttons", name: translateText("interaction.buttons"), icon: "grid" },
            { id: "checkbox", name: translateText("interaction.checkboxes"), icon: "checkbox" },
            { id: "radio", name: translateText("interaction.radio_buttons"), icon: "radio_button" },
            { id: "dropdown", name: translateText("interaction.dropdown"), icon: "dropdown" }
        ],
        text: [
            // just text input (for now)
            { id: "input", name: translateText("interaction.input"), icon: "keyboard" }
        ],
        number: [
            { id: "input", name: translateText("interaction.input"), icon: "keyboard" },
            { id: "slider", name: translateText("interaction.slider"), icon: "slider" },
            { id: "number_range", name: translateText("interaction.range"), icon: "ruler" }
            // { id: "time_range", name: "Time range", icon: "ruler" }
        ],
        heading: [
            // { id: "none" }
        ]
    }

    let openedInteractionId: string = $popupData.id
    let openedInteraction = $interactions[openedInteractionId] || null
    let inputIndex: number = $popupData.inputIndex ?? -1
    let currentInput = openedInteraction?.inputs?.[inputIndex] || {}

    let existing = !!currentInput?.type

    function updateValue(e: any, key: string) {
        let value = e?.target?.value ?? e
        if (value === undefined) return

        currentInput[key] = value

        // just "input" for "text" type (for now)
        if (key === "type" && inputTypes[chosenType]?.length < 2) {
            chosenInputType = inputTypes[chosenType]?.[0]?.id || "none"
            updateValue(chosenInputType, "inputType")
        }

        if (key === "type" || key === "inputType") return

        existing = true
        updateInput()
    }

    function updateInput() {
        interactions.update((a) => {
            if (!a[openedInteractionId]) return a
            if (!a[openedInteractionId].inputs) a[openedInteractionId].inputs = []

            let current = clone(currentInput)

            if (inputIndex === -1) {
                a[openedInteractionId].inputs.push(current)
                inputIndex = a[openedInteractionId].inputs.length - 1
            } else {
                a[openedInteractionId].inputs[inputIndex] = current
            }

            return a
        })
    }
</script>

{#if !existing && !chosenType}
    <MaterialMultiChoice
        options={types}
        on:click={(e) => {
            chosenType = e.detail
            updateValue(chosenType, "type")
        }}
        gradient
    />
{:else if !existing && !chosenInputType}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (chosenType = "")} />

    <MaterialMultiChoice
        options={inputTypes[currentInput.type]}
        on:click={(e) => {
            chosenInputType = e.detail
            updateValue(chosenInputType, "inputType")
        }}
    />
{:else}
    {#if !existing}
        <MaterialButton
            class="popup-back"
            icon="back"
            iconSize={1.3}
            title="actions.back"
            on:click={() => {
                if (inputTypes[chosenType]?.length < 2) chosenType = ""
                chosenInputType = ""
            }}
        />
    {/if}

    <MaterialTextInput label={currentInput.type === "heading" ? "interaction.heading" : "interaction.question"} style={currentInput.type === "heading" ? "" : "margin-bottom: 10px;"} value={currentInput.question} on:change={(e) => updateValue(e.detail, "question")} autofocus={!currentInput.question} />

    {#if currentInput.type === "multi_choice"}
        <div class="options">
            {#each currentInput.options || [] as option, i}
                <InputRow>
                    <MaterialButton
                        title={option?.isAnswer ? "interaction.mark_as_incorrect" : "interaction.mark_as_correct"}
                        icon={option?.isAnswer ? "check" : "close"}
                        iconSize={1.2}
                        style={option?.isAnswer ? "background-color: var(--connected) !important;" : "background-color: var(--red) !important;"}
                        on:click={() => {
                            if (!currentInput.options) currentInput.options = []

                            // mark as answer
                            currentInput.options[i].isAnswer = !currentInput.options[i].isAnswer

                            updateInput()
                        }}
                    />

                    <MaterialTextInput
                        label="interaction.option"
                        value={option?.value}
                        on:change={(e) => {
                            if (!currentInput.options) currentInput.options = []
                            if (!currentInput.options[i]) currentInput.options[i] = { value: "" }

                            currentInput.options[i].value = e.detail

                            updateInput()
                        }}
                        autofocus={!!currentInput.question && !option?.value}
                    />
                    <MaterialButton
                        icon="delete"
                        title="actions.remove"
                        on:click={() => {
                            if (!currentInput.options) currentInput.options = []
                            currentInput.options.splice(i, 1)

                            currentInput.options = currentInput.options
                            updateInput()
                        }}
                    />
                </InputRow>
            {/each}

            <MaterialButton
                variant="outlined"
                icon="add"
                disabled={currentInput.options && currentInput.options.length > 0 && currentInput.options.some((a) => !a.value)}
                on:click={() => {
                    if (!currentInput.options) currentInput.options = []
                    currentInput.options.push({ value: "" })

                    currentInput.options = currentInput.options
                    updateInput()
                }}
            >
                <T id="interaction.add_option" />
            </MaterialButton>

            <!-- Display tip?: order will be random -->
        </div>
    {:else if currentInput.type === "text"}
        <!-- optional - for polls we don't need answers -->
        <MaterialTextInput label="interaction.answer (interaction.optional)" value={currentInput.answer || ""} on:change={(e) => updateValue(e.detail, "answer")} />

        <MaterialToggleSwitch label="interaction.allow_multiple" checked={currentInput.allowMultiple} defaultValue={false} on:change={(e) => updateValue(e.detail, "allowMultiple")} />
    {:else if currentInput.type === "number"}
        <MaterialNumberInput label="interaction.answer (interaction.optional)" type="number" value={currentInput.answer ?? -1} min={currentInput.min ?? 0} max={currentInput.max ?? 1000} on:change={(e) => updateValue(e.detail, "answer")} />

        <InputRow>
            <MaterialNumberInput label="interaction.min" type="number" value={currentInput.min ?? 0} min={-10000000} on:change={(e) => updateValue(e.detail, "min")} />
            <MaterialNumberInput label="interaction.max" type="number" value={currentInput.max ?? 1000} max={10000000} on:change={(e) => updateValue(e.detail, "max")} />
        </InputRow>
    {/if}
{/if}

<style>
    .options {
        display: flex;
        flex-direction: column;
    }
</style>
