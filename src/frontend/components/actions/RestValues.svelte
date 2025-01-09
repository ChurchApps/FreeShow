<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import T from "../helpers/T.svelte"

    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import TextInput from "../inputs/TextInput.svelte"

    import type { API_rest_command } from "./api"

    export let value: API_rest_command
    export let emitter: boolean = false
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
        // update url
        rest.url = e.target.value
        change()
    }

    /**
     * onChange Handler for Method component
     * This is a Dropdown, so `e.detail.name`
     * @param e onChange Event
     */
    function updateMethod(e) {
        // update method
        rest.method = e.detail.name
        change()
    }

    /**
     * onChange Handler for Payload component
     * This is a TextInput, so `e.target.value`
     * @param e onChange Event
     */
    function updatePayload(e) {
        // update payload
        rest.payload = e.target.value
        change()
    }

    /**
     * onChange Handler for ContentType component
     * This is a TextInput, so `e.target.value`
     * @param e onChange Event
     */
    function updateContentType(e) {
        // update ContentType
        rest.contentType = e.target.value
        change()
    }

    let dispatch = createEventDispatcher()
    function change() {
        dispatch("change", rest)
    }

    let dropdownInputs = [{ name: "GET" }, { name: "POST" }, { name: "PUT" }, { name: "DELETE" }]
</script>

<!-- URL -->
<CombinedInput>
    <p><T id="inputs.url" /></p>
    <TextInput value={rest.url || ""} placeholder={"127.0.0.1"} on:change={(e) => updateUrl(e)} />
</CombinedInput>

<!-- Method -->
<CombinedInput>
    <p><T id="inputs.method" /></p>
    <Dropdown value={rest.method || "GET"} options={dropdownInputs} on:click={(e) => updateMethod(e)} />
</CombinedInput>

<!-- ContentType -->
<CombinedInput>
    <p><T id="inputs.contentType" /></p>
    <TextInput disabled={emitter} value={rest.contentType || ""} placeholder={"application/json"} on:change={(e) => updateContentType(e)} />
</CombinedInput>

<!-- Body -->
{#if !emitter}
    <CombinedInput>
        <p><T id="inputs.payload" /></p>
        <TextInput value={rest.payload || ""} placeholder={"{}"} on:change={(e) => updatePayload(e)} />
    </CombinedInput>
{/if}

<!--
TODO: Better Namings
? Send WebRequest 

- URL
- Method
- Content Type <-- einstellbar machen
- Payload
-->
