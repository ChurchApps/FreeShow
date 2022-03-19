import type { ValidChannels } from "../../types/Channels"

export function requestData(ID: ValidChannels, channels: string[], data: any = null) {
  channels.forEach((channel: string) => window.api.send(ID, { channel, data }))
}

export function receiveData(ID: ValidChannels, channels: any) {
  window.api.receive(ID, (msg: any) => {
    if (channels[msg.channel]) channels[msg.channel](msg.data)
  })
}
