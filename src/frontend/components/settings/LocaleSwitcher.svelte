<script lang="ts">
    import { onMount } from "svelte"
    import { language } from "../../stores"
    import { setLanguage } from "../../utils/language"
    import { languages } from "../../utils/languageData"
    import Dropdown from "../inputs/Dropdown.svelte"

    let options: any[] = []

    onMount(() => {
        Object.keys(languages).forEach((id) => {
            options.push({ name: languages[id], id: id })
        })
        options = options.sort((a, b) => a.name.localeCompare(b.name))
    })
</script>

<Dropdown value={languages[$language]} {options} on:click={(e) => setLanguage(e.detail.id)} />
