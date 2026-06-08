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

    // WIP translate all text

    let chosenType = ""
    const types = [
        { id: "multi_choice", name: "Multiple choice", icon: "multi_choice" },
        { id: "text", name: translateText("variables.text"), icon: "text" },
        { id: "number", name: translateText("variables.number"), icon: "number" }
    ]

    let chosenInputType = ""
    const inputTypes = {
        multi_choice: [
            { id: "buttons", name: "Buttons", icon: "grid" },
            { id: "checkbox", name: "Checkboxes", icon: "checkbox" },
            { id: "radio", name: "Radio buttons", icon: "radio_button" },
            { id: "dropdown", name: "Dropdown", icon: "dropdown" }
        ],
        text: [
            // just text input (for now)
            { id: "input", name: "Input", icon: "keyboard" }
        ],
        number: [
            { id: "input", name: "Input", icon: "keyboard" },
            { id: "slider", name: "Slider", icon: "slider" },
            { id: "number_range", name: "Range", icon: "ruler" }
            // { id: "time_range", name: "Time range", icon: "ruler" }
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
        if (key === "type" && chosenType === "text") {
            chosenInputType = "input"
            updateValue("input", "inputType")
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
                if (chosenType === "text") chosenType = ""
                chosenInputType = ""
            }}
        />
    {/if}

    <MaterialTextInput label="Question" style="margin-bottom: 10px;" value={currentInput.question} on:change={(e) => updateValue(e.detail, "question")} autofocus={!currentInput.question} />

    {#if currentInput.type === "multi_choice"}
        <div class="options">
            {#each currentInput.options || [] as option, i}
                <InputRow>
                    <MaterialTextInput
                        label="Option"
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
                        title={option?.isAnswer ? "Mark as incorrect answer" : "Mark as correct answer"}
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
                    <MaterialButton
                        icon="delete"
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
                on:click={() => {
                    if (!currentInput.options) currentInput.options = []
                    currentInput.options.push({ value: "" })

                    currentInput.options = currentInput.options
                    updateInput()
                }}
            >
                <T id="New option" />
            </MaterialButton>

            <!-- TIP order will be random -->
        </div>
    {:else if currentInput.type === "text"}
        <!-- optional - for polls we don't need answers -->
        <MaterialTextInput label="Answer" value={currentInput.answer || ""} on:change={(e) => updateValue(e.detail, "answer")} />
    {:else if currentInput.type === "number"}
        <MaterialNumberInput label="Answer" type="number" value={currentInput.answer} on:change={(e) => updateValue(e.detail, "answer")} />

        <InputRow>
            <MaterialNumberInput label="Min" type="number" value={currentInput.min ?? 0} min={-10000000} on:change={(e) => updateValue(e.detail, "min")} />
            <MaterialNumberInput label="Max" type="number" value={currentInput.max ?? 1000} max={10000000} on:change={(e) => updateValue(e.detail, "max")} />
        </InputRow>
    {/if}
{/if}

<style>
    .options {
        display: flex;
        flex-direction: column;
    }
</style>
