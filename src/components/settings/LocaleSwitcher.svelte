<script lang="ts">
  // import { createEventDispatcher } from 'svelte';
  import { setLanguage } from "../../services/language"
  import { language } from "../../stores"
  import { languages } from "../../values/settings"
  import Dropdown from "../inputs/Dropdown.svelte"
  // const dispatch = createEventDispatcher();

  let options = []
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
<Dropdown value={`$:languages.${$language}:$ (${languages[$language]})`} {options} on:click={(e) => setLanguage(e.detail.id)} />
<!-- </div> -->
