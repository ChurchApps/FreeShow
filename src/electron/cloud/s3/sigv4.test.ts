import { describe, expect, it } from "vitest"
import { EMPTY_PAYLOAD_HASH, encodePath, sha256Hex, signRequest, uriEncode } from "./sigv4"

// Example values from the AWS documentation:
// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
const credentials = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1" }
const date = new Date("2013-05-24T00:00:00Z")

describe("sigv4", () => {
    it("hashes an empty payload", () => {
        expect(sha256Hex("")).toBe(EMPTY_PAYLOAD_HASH)
    })

    it("signs the AWS GET Object example", () => {
        const url = new URL("https://examplebucket.s3.amazonaws.com/test.txt")
        const headers = signRequest({ method: "GET", url, headers: { Range: "bytes=0-9" }, date }, credentials)

        expect(headers.authorization).toBe("AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41")
        expect(headers["x-amz-date"]).toBe("20130524T000000Z")
        expect(headers.host).toBeUndefined()
    })

    it("signs the AWS GET Bucket (List Objects) example with a sorted query string", () => {
        const url = new URL("https://examplebucket.s3.amazonaws.com/?prefix=J&max-keys=2")
        const headers = signRequest({ method: "GET", url, date }, credentials)

        expect(headers.authorization).toContain("Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7")
    })

    it("encodes object keys per segment", () => {
        expect(encodePath("my folder/current (1).zip")).toBe("my%20folder/current%20%281%29.zip")
        expect(uriEncode("a+b=c&d*")).toBe("a%2Bb%3Dc%26d%2A")
    })
})
