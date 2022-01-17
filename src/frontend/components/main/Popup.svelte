<script lang="ts">
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"
  import { activePopup } from "../../stores"
  import TextArea from "../inputs/TextArea.svelte"
  import { history } from "../helpers/history"
  import { ShowObj } from "../../classes/Show"
  import type { Show } from "../../../types/Show"
  import { uid } from "uid"

  function textToShow(e: any) {
    // console.log(e.target.value)

    let sections = e.target.value.split("\n\n")
    console.log(sections)

    let metaData: string = ""
    if (sections[0].split("\n").length < 3) metaData = sections.splice(0, 1)[0]

    if (sections.length) {
      let labeled: any[] = []

      // find chorus phrase
      let indexes = findPatterns(sections)

      labeled = indexes.map((a, i) => ({ type: a, text: sections[i] }))

      // if (sections?.[0].length)
      //   sections.forEach((section: string) => {
      //     if (section.length) {
      //       let lines = section.split("\n")
      //       // count for typos
      //       if (indexes.prechorus?.includes()) labeled.push({ type: "chorus", text: section })
      //       if (lines.length < 2) labeled.push({ type: "break", text: section })
      //       // else if (similarity(section, chorus) > similarityNum) labeled.push({ type: "chorus", text: section })
      //       // else if (similarity(section, bridge) > similarityNum) labeled.push({ type: "bridge", text: section })
      //       else labeled.push({ type: "verse", text: section })
      //     }
      //   })

      console.log(metaData)
      console.log(labeled)

      // TODO: remove . and spaces ....
      let name: string = labeled[0].text.split("\n")[0]
      // get active
      let category = "song"
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
      show.name = name
      show.meta = meta
      let { slides, layouts } = createSlides(labeled)
      show.slides = slides
      show.layouts = { [layoutID]: { name: "", notes: "", slides: layouts } }
      // let newData: any = {name, category, settings: {}, meta}
      history({ id: "newShowDrawer", newData: { show } })
    }
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
        let lines = text.split("\n")

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
          let items: any[] = [{ style: "left:50px;top:120px;width:1820px;height:840px;", text: [{ value: lines.replaceAll("\n", "<br>"), style: "font-size:80px;" }] }]

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
    text = text.replaceAll(",", "\n")
    text = text
      .split("\n")
      .map((a) => {
        a = a.trim()
        a = a[0].toUpperCase() + a.slice(1, a.length)
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
      else if (length < 10 && !sections[i].includes("\n")) group = sections[i]
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
</script>

{#if $activePopup !== null}
  <div class="popup">
    <div class="card">
      <Button on:click={() => activePopup.set(null)}>
        <Icon id="close" />
        close
      </Button>
      {#if $activePopup === "import"}
        <span>Paste text:</span>
        <span>(Seperate sections with enter)</span>
        <TextArea value="" on:input={textToShow} />
        <!-- <TextInput value="" on:change={textToShow} /> -->
        <!-- <textarea name="" id="" cols="30" rows="10" /> -->
        <!-- <Button on:click={textToShow}>Paste</Button> -->
      {/if}
    </div>
  </div>
{/if}

<style>
  .popup {
    position: absolute;
    background-color: rgb(0 0 0 / 0.2);
    /* pointer-events: none; */
    width: 100%;
    height: 100%;
    padding: 20px 300px;
    z-index: 40;

    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    background-color: var(--primary);

    min-width: 500px;
    min-height: 500px;
  }

  .popup :global(.edit) {
    height: 500px;
  }
</style>
