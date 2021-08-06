import { createElement, useContext, useEffect, useState } from "react";
import { Context } from "../App";
import Slide from "./Slide";

export default function Slides({live, setLive}) {
  const [freeShow, setFreeShow] = useContext(Context);

  let song = freeShow.songs[freeShow.activeSong];
  // console.log(song, song.slides[0]);
  
  const style = {position: 'absolute', overflow: 'hidden', outline: 'none', height: 'inherit', whiteSpace: 'pre-wrap', overflowWrap: 'break-word'}

  return (
    <div className="slides" style={{width: '100%'}}>
      {[...song.slides].map((slide, i) => (
        <Slide key={i} id={i} active={i === live ? true : false} zoom={.15} setActive={setLive} debug={true}>
          {slide.map((textbox, j) => <div key={j} style={{...style, ...textbox.style}}>
            {textbox.text.map((text, i) => createElement(text.tag ? text.tag : 'span', {key: i, style: (text.style ? text.style : {})}, text.content))}
          </div>)}
        </Slide>
      ))}
      {/* <Slide active={false} zoom={.2}>Example text!</Slide>
      <Slide active={false} styling={{textAlign: 'center'}} zoom={.2}>Second slide.</Slide>
      <Slide active={false} styling={{textAlign: 'center'}} zoom={.2} active={true}>Third slide.</Slide> */}
    </div>
  );
}