<script lang="ts">
    import { onMount } from "svelte"
    import { language } from "../../stores"
    import { setLanguage } from "../../utils/language"
    import { languageFlags, languages } from "../../utils/languageData"
    import Dropdown from "../inputs/Dropdown.svelte"
    import { sortByName } from "../helpers/array"

    let options: any[] = []

    onMount(() => {
        Object.keys(languages).forEach((id) => {
            options.push({ name: languages[id], id })
        })
        options = sortByName(options)

        // add flags
        options = options.map((a) => ({ ...a, name: getNameWithFlag(a.id) }))
    })

    function getNameWithFlag(id: string) {
        return (languageFlags[id] ? languageFlags[id] + " " : "") + languages[id]
    }
</script>

<Dropdown flags value={getNameWithFlag($language)} {options} on:click={(e) => setLanguage(e.detail.id)} />
