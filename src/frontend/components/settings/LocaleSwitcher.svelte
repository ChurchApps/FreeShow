<script lang="ts">
  import { setLanguage } from "../../utils/language"
  import { language } from "../../stores"
  import Dropdown from "../inputs/Dropdown.svelte"

  const languages: any = {
    en: "English",
    no: "Norsk",
  }

  let options: any[] = []
  Object.keys(languages).forEach((id) => {
    options.push({ name: `$:languages.${id}:$ (${languages[id]})`, id: id })
  })

  // export let value = 'en';
</script>

<!-- <div class="choose-locale"> -->
<!-- <div class="select"> <select value={value} on:change|preventDefault={e => setLanguage(e.target.value)}>
      <option value="en">English</option>
      <option value="no">Norsk</option>
      <option value="ar">عربي</option>
    </select>
  </div> -->
<Dropdown value={`$:languages.${$language}:$ (${languages[$language]})`} style="width: 200px;" {options} on:click={(e) => setLanguage(e.detail.id)} />
<!-- </div> -->
