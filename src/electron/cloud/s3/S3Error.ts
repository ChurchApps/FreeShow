export class S3Error extends Error {
    statusCode: number
    code: string

    constructor(statusCode: number, code: string, message: string) {
        super(message)
        this.statusCode = statusCode
        this.code = code
    }
}
