import { get } from "svelte/store"
import { MAIN } from "../../types/Channels"
import { _show } from "../components/helpers/shows"
import { midiIn } from "../stores"
import { send } from "./request"
// import JZZ from "jzz"
// import electronMidi from "jazz-midi-electron"

export function midiInListen() {
    console.log("MIDI IN LISTEN")

    Object.entries(get(midiIn)).forEach(([id, midi]: any) => {
        midi.shows.forEach((show) => {
            // find all slides in current show with this MIDI
            let layouts: any[] = _show(show.id).layouts().get()
            console.log(layouts)
            let found: boolean = false
            layouts.forEach((layout) => {
                console.log(layout)
                layout.slides.forEach((slide) => {
                    console.log(slide)
                    if (slide.actions?.receiveMidi === id) {
                        console.log(1)
                        found = true
                    }
                })
            })

            if (!found) {
                // remove from midi
                console.log("REMOVE")
                midiIn.update((a) => {
                    delete a[id]
                    return a
                })
            } else {
                console.log(midi.input)
                if (!midi.input) return
                send(MAIN, ["RECEIVE_MIDI"], { id, ...midi })

                // electronMidi().then(function () {
                //     let midiIn = JZZ().openMidiIn(midi.input).or("Could not connect")
                //     midiIn.connect((msg: any) => {
                //         console.log(msg)
                //     })
                //     // var midiin = JZZ.gui.SelectMidiIn({ at: 'selectmidiin', none: 'HTML Piano' });
                //     // var midiout = JZZ.gui.SelectMidiOut({ at: 'selectmidiout', none: 'No MIDI Out' });
                //     // midiin.connect(piano);
                //     // piano.connect(midiout);
                //     // // Open the default MIDI Out port:
                //     // midiout.select();
                // })
            }
        })
    })
}
