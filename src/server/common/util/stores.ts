import type { Writable } from "svelte/store"

export type Inferred<T> = T extends Writable<infer U> ? U : never
export type Nested<T, K> = K extends keyof T ? T[K] : never
export type DeepNested<T, K> = K extends [infer Head, infer Rest] ? (Head extends keyof T ? (Rest extends keyof NonNullable<T[Head]> ? NonNullable<T[Head]>[Rest] : never) : never) : never
export type DeepKey<T> = {
    [K in keyof T]: T[K] extends object ? [K, keyof T[K]] : never
}[keyof T]

export function __update(a: any, key: string | [string, string], value: any) {
    if (Array.isArray(key)) {
        if (!a[key[0]]) a[key[0]] = {}
        a[key[0]]![key[1]] = value
    } else {
        a[key] = value
    }

    return a
}
