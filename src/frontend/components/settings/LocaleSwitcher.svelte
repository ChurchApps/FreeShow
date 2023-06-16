<script lang="ts">
    import { language } from "../../stores"
    import { setLanguage } from "../../utils/language"
    import { languages } from "../../utils/languageData"
    import Dropdown from "../inputs/Dropdown.svelte"

    let options: any[] = []
    Object.keys(languages).forEach((id) => {
        options.push({ name: languages[id], id: id })
    })
</script>

<Dropdown value={languages[$language]} {options} on:click={(e) => setLanguage(e.detail.id)} />
