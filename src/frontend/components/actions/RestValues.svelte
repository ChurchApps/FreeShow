<script lang="ts">
    import { createEventDispatcher } from "svelte"

    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../inputs/MaterialTextInput.svelte"
    import type { API_rest_command } from "./api"
    import InputRow from "../input/InputRow.svelte"

    export let value: API_rest_command
    export let emitter = false
    $: rest = value

    // const REST_MESSAGE_INPUTS: Input[] = [
    //     {name: "inputs.url", id: "url", type: "string", value: ""},
    //     {name: "inputs.method", id: "method", type: "dropdown", value: "GET", options: [{ name: "GET" }, { name: "POST" }, { name: "PUT" }, { name: "DELETE" }]},
    //     {name: "inputs.contentType", id: "contentType", type: "string", value: "application/json"},
    //     {name: "inputs.payload", id: "payload", type: "string", value: "{}"},
    // ]

    /**
     * onChange Handler for URL component
     * This is a TextInput, so `e.target.value`
     * @param e onChange Event
     */
    function updateUrl(e) {
        rest.url = e.detail
        change()
    }

    /**
     * onChange Handler for Method component
     * This is a Dropdown, so `e.detail.name`
     * @param e onChange Event
     */
    function updateMethod(e) {
        rest.method = e.detail
        change()
    }

    /**
     * onChange Handler for Payload component
     * This is a TextInput, so `e.target.value`
     * @param e onChange Event
     */
    function updatePayload(e) {
        rest.payload = e.detail
        change()
    }

    /**
     * onChange Handler for ContentType component
     * This is a TextInput, so `e.target.value`
     * @param e onChange Event
     */
    function updateContentType(e) {
        rest.contentType = e.detail
        change()
    }

    let dispatch = createEventDispatcher()
    function change() {
        dispatch("change", rest)
    }

    let dropdownInputs = [
        { value: "GET", label: "GET" },
        { value: "POST", label: "POST" },
        { value: "PUT", label: "PUT" },
        { value: "DELETE", label: "DELETE" }
    ]
</script>

<MaterialTextInput label="inputs.url" value={rest.url || ""} placeholder="127.0.0.1" on:change={updateUrl} />

<InputRow>
    <MaterialDropdown label="inputs.method" value={rest.method || "GET"} options={dropdownInputs} on:change={updateMethod} />
    <MaterialTextInput label="inputs.contentType" disabled={emitter} value={rest.contentType || "application/json"} placeholder="application/json" on:change={updateContentType} />
</InputRow>

<!-- Body -->
{#if !emitter}
    <MaterialTextInput label="inputs.payload" disabled={emitter} value={rest.payload || ""} placeholder={"{}"} on:change={updatePayload} />
{/if}

<!--
TODO: Better Namings
? Send WebRequest 

- URL
- Method
- Content Type <-- einstellbar machen
- Payload
-->
