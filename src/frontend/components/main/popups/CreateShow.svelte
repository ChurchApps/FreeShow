<script lang="ts">
  import { uid } from "uid"

  import type { Show } from "../../../../types/Show"
  import { ShowObj } from "../../../classes/Show"
  import { activePopup, activeProject } from "../../../stores"
  import { history } from "../../helpers/history"
  import { checkName } from "../../helpers/show"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import TextArea from "../../inputs/TextArea.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  function textToShow() {
    let sections = values.text.split("\n\n").filter((a: any) => a.length)
    console.log(sections)

    let metaData: string = ""
    if (sections[1] && sections[0]?.split("\n").length < 3) metaData = sections.splice(0, 1)[0]

    if (sections.length) {
      let labeled: any[] = []

      // find chorus phrase
      let indexes = findPatterns(sections)
      labeled = indexes.map((a, i) => ({ type: a, text: sections[i] }))

      let name: string = labeled[0].text.split("\n")[0]
      // get active
      let category = values.category
      let meta: any = {}
      if (metaData.length) {
        let lines: string[] = metaData.split("\n")
        meta.title = lines.splice(0, 1)[0]
        if (meta.title.length) name = meta.title
        if (lines.length) meta.artist = lines.splice(0, 1)[0]
        if (lines.length) meta.other = lines.join("\n")
      }

      let layoutID = uid()
      let show: Show = new ShowObj(false, category, layoutID)
      show.name = checkName(values.name || name)
      show.meta = meta
      let { slides, layouts } = createSlides(labeled)
      show.slides = slides
      show.layouts = { [layoutID]: { name: "", notes: "", slides: layouts } }
      // let newData: any = {name, category, settings: {}, meta}
      history({ id: "newShow", newData: { show }, location: { page: "show", project: $activeProject } })
    } else {
      let show = new ShowObj(false, values.category)
      show.name = checkName(values.name)
      history({ id: "newShow", newData: { show }, location: { page: "show", project: $activeProject } })
    }
    values.text = ""
    activePopup.set(null)
  }

  function createSlides(labeled: any) {
    let slides: any = {}
    let layouts: any[] = []
    let stored: any = {}
    labeled.forEach((a: any) => {
      let id: any
      let text: string = fixText(a.text)
      if (stored[a.type]) {
        id = stored[a.type].find((b: any) => b.text === text)?.id
      }

      if (!id) {
        id = uid()
        if (!stored[a.type]) stored[a.type] = []
        stored[a.type].push({ id, text })

        let group: string = a.type
        let color: any = null

        let allLines: string[] = [text]
        let lines = text.split("\n").filter((a) => a.length)

        let length: number = text.replaceAll("\n", "").length
        if ((length < 20 && lines.length >= 6) || (length >= 20 && lines.length >= 4)) {
          allLines = []
          let divided = Math.floor(lines.length / 2)
          if (lines.length < 7) divided = Math.ceil(lines.length / 2)
          // while (divided > 4) divided = Math.floor(divided / 2)
          while (lines.length) {
            allLines.push(lines.splice(0, divided).join("\n"))
            if (lines.length > 4) divided = Math.ceil(lines.length / 2)
            // allLines.push(lines.splice(0, Math.max(2, Math.floor(lines.length / 2))).join("\n"))
          }
        }

        let children: string[] = []

        allLines.forEach((lines: string, i: number) => {
          // TODO: auto size
          let style = "font-size: 80px;"
          let items: any[] = [{ style: "left:50px;top:120px;width:1820px;height:840px;", lines: lines.split("\n").map((a) => ({ align: "", text: [{ style, value: a }] })) }]

          let childID: any
          if (i > 0) {
            childID = uid(12)
            children.push(childID)
            slides[childID] = { group: null, color: null, settings: {}, notes: "", items }
          } else {
            // a.text.split("\n").forEach((text: string) => {})
            slides[id] = { group, color, globalGroup: group, settings: {}, notes: "", items }
          }
        })
        if (children.length) slides[id].children = children
      }

      layouts.push({ id })
    })
    return { slides, layouts }
  }

  function fixText(text: string): string {
    text = text.replaceAll(".", "").replace(/ *\([^)]*\) */g, "")
    // let splittedCommas = text.replaceAll(",", "\n")
    let newText = ""
    text.split("\n").forEach((t: any) => {
      console.log(t)
      let newLineText = ""
      t.split(",").forEach((a: any, i: number) => {
        console.log(a)
        newLineText += a
        if (i < t.split(",").length - 1 && newLineText.length < 10 && (a.length < 10 || t.split(",")[i]?.length < 10)) newLineText += ","
        else newLineText += "\n"
      })
      newText += newLineText
    })
    text = newText
    text = text
      .split("\n")
      .map((a) => {
        a = a.trim()
        a = (a[0]?.toUpperCase() || "") + a.slice(1, a.length)
        return a
      })
      .join("\n")
    return text
  }

  //

  let similarityNum: number = 0.7

  function findPatterns(sections: string[]) {
    let similarCount: any[] = []
    // total count of totally different slides
    let totalMatches: number = 0
    sections.forEach((a: string, i: number) => {
      similarCount[i] = { matches: [], count: 0 }
      let already = similarCount.find((a) => a.matches.includes(i))
      if (already) {
        similarCount[i] = already
      } else {
        sections.forEach((b: string, j: number) => {
          if (i !== j && similarity(a, b) > similarityNum) {
            similarCount[i].count++
            similarCount[i].matches.push(j)
          }
        })
        if (similarCount[i].count > 0) totalMatches++
      }
    })

    // let totalMatches = similarCount.filter((a) => a > 0).length
    let matches: number = 0
    let stored: any[] = []
    let indexes = similarCount.map((a, i) => {
      // let lines = sections[i].split("\n")
      let length: number = sections[i].replaceAll("\n", "").length
      let group = "verse"
      let find = stored.find((a) => similarity(a.text, sections[i]) > similarityNum)

      // TODO: frihet, the blessing
      // verses repeat..., bridge repeat

      // if (lines.length < 2) group =  "break"
      if (find) group = find.type
      else if (!length) group = "break"
      else if (length < 10 && !sections[i].includes("\n")) group = sections[i].trim()
      else if (length < 30 || linesSimilarity(sections[i])) group = "tag"
      else if (a.count > 0) {
        let groups = ["pre_chorus", "chorus", "bridge", "bridge", "bridge"]
        matches++
        if (totalMatches > 2) group = groups[matches - 1] || "other"
        else group = groups[matches]
        stored.push({ type: group, text: sections[i] })
      }
      return group
    })
    console.log(indexes)

    return indexes
  }

  function linesSimilarity(text: string): boolean {
    let lines = text.split("\n")
    let isSimilar = false
    if (lines.length > 2) {
      lines.reduce((a: string, b: string) => {
        if (similarity(a, b) > 0.95) isSimilar = true
        return ""
      })
    }
    return isSimilar
  }

  // https://stackoverflow.com/questions/10473745/compare-strings-javascript-return-of-likely
  function similarity(s1: string, s2: string) {
    var longer = s1
    var shorter = s2
    if (s1.length < s2.length) {
      longer = s2
      shorter = s1
    }
    var longerLength: any = longer.length
    if (longerLength == 0) {
      return 1.0
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength)
  }
  function editDistance(s1: string, s2: string) {
    s1 = s1.toLowerCase()
    s2 = s2.toLowerCase()

    var costs = new Array()
    for (var i = 0; i <= s1.length; i++) {
      var lastValue = i
      for (var j = 0; j <= s2.length; j++) {
        if (i == 0) costs[j] = j
        else {
          if (j > 0) {
            var newValue = costs[j - 1]
            if (s1.charAt(i - 1) != s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
            costs[j - 1] = lastValue
            lastValue = newValue
          }
        }
      }
      if (i > 0) costs[s2.length] = lastValue
    }
    return costs[s2.length]
  }

  const changeValue = (e: any, key: string = "text") => (values[key] = e.target.value)
  let values: any = {
    text: "",
    name: "",
    category: "song",
  }

  function keydown(e: any) {
    if (e.key === "Enter") {
      ;(document.activeElement as any)?.blur()
      textToShow()
    }
  }
</script>

<svelte:window on:keydown={keydown} />

<div style="display: flex;justify-content: space-between;align-items: center;">
  <p><T id="show.name" /></p>
  <TextInput autofocus value={values.name} on:change={(e) => changeValue(e, "name")} style="width: 50%;height: 30px;" />
</div>
<div style="display: flex;justify-content: space-between;align-items: center;">
  <p><T id="show.category" /></p>
  <TextInput value={values.category} on:change={(e) => changeValue(e, "category")} style="width: 50%;height: 30px;" />
</div>
<br />
<!-- TODO: show example? -->
<span><T id="show.quick_lyrics" /></span>
<TextArea style="height: 250px;" value={values.text} on:input={(e) => changeValue(e)} />
<Button on:click={textToShow} style="width: 100%;margin-top: 10px;color: var(--secondary);" dark center>
  {#if values.text.trim().length > 0}
    <T id="new.show" />
  {:else}
    <T id="new.empty_show" />
  {/if}
</Button>
