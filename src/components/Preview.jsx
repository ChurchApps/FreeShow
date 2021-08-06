import { createElement, useContext } from "react";
import { Context } from "../App";
import Slide from "./Slide";

export default function Preview({live, setLive}) {
  const [freeShow, setFreeShow] = useContext(Context);
  let song = freeShow.songs[freeShow.activeSong];

  const style = {position: 'absolute', overflow: 'hidden', outline: 'none', height: 'inherit', whiteSpace: 'pre-wrap', overflowWrap: 'break-word'}

  return (
    <div>
      <div className="output">
        <Slide zoom={.2}>
          {song.slides[live].map((textbox, i) => <div key={i} style={{...style, ...textbox.style}}>
            {textbox.text.map((text, i) => createElement(text.tag ? text.tag : 'span', {key: i, style: (text.style ? text.style : {})}, text.content))}
          </div>)}
        </Slide>
      </div>
      <div className="actions">
        <button onClick={() => setLive(live - 1)} disabled={song.slides[live - 1] ? false : true} style={{fontWeight: 'bold', fontSize: '1.5em', padding: '5px 15px'}}>{'<'}</button>
        <button style={{fontWeight: 'bold', fontSize: '1.5em', padding: '5px 15px'}}>||</button>
        <button onClick={() => setLive(live + 1)} disabled={song.slides[live + 1] ? false : true} style={{fontWeight: 'bold', fontSize: '1.5em', padding: '5px 15px'}}>{'>'}</button>
      </div>
    </div>
  );
}