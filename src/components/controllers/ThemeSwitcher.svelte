<!-- https://dev.to/josef/theming-in-svelte-with-css-variables-53kd -->
<script>
  import { theme, theme_css, language } from "../../stores";
  import { themes } from "../../values/settings";
  import Dropdown from "../inputs/Dropdown.svelte";

  theme.subscribe(theme => theme_css.set(themes[theme].values));
  theme_css.subscribe(object => {
    Object.keys(object).forEach(key => document.documentElement.style.setProperty('--' + key, object[key]));
  });

  function getThemesArray() {
    let names = [];
    if (Object.keys(themes).length) {
      themes.forEach((obj, id) => {
        names.push({name: `$:${obj.name}:$`, id, updater: $language});
      })
    }
    return names;
  }
</script>

<Dropdown value={`$:${themes[$theme].name}:$`} options={getThemesArray()} on:click={e => theme.set(e.detail.id)} />