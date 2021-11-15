import type { Time } from "./../../../types/Main"

export function secondsToTime(seconds: number): Time {
  let h: any = Math.floor(seconds / 3600)
  let m: any = Math.floor((seconds - h * 3600) / 60)
  let s: any = Math.round(seconds - h * 3600 - m * 60)
  // TODO: ms
  // let ms: any = Math.round(seconds - h * 3600 - m * 60 - s * 60)
  let ms: any = 0

  if (h < 10) h = "0" + h
  if (m < 10) m = "0" + m
  if (s < 10) s = "0" + s
  if (ms < 10) ms = "0" + ms

  return { ms, s, m, h }
}

export function joinTime(time: Time, ms: boolean = false): string {
  let arr: string[] = [time.m, time.s]
  if (Number(time.h)) arr.unshift(time.h)
  if (ms) arr.push(time.ms)
  return arr.join(":")
}
