export enum ToMain {
    ALERT = "ALERT",
}
export interface ToMainSendPayloads {
    [ToMain.ALERT]: string
}

///////////

// export type ToMainSendValue<ID extends ToMain, V> = ID extends keyof ToMainSendPayloads ? (ToMainSendPayloads[ID] extends V ? V : never) : never
export type ToMainSendValue<ID extends ToMain, V> = Extract<ToMainSendPayloads[ID], V>
