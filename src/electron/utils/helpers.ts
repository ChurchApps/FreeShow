export async function waitUntilValueIsDefined(value: Function, intervalTime: number = 50, checkInitially: boolean = true) {
    return new Promise(async (resolve, reject) => {
        let currentValue = await value()
        if (checkInitially && currentValue) resolve(currentValue)

        const timeout = setTimeout(() => {
            exit()
            reject(null)
        }, 5000)

        const interval = setInterval(async () => {
            currentValue = await value()
            if (!currentValue) return

            exit()
            resolve(currentValue)
        }, intervalTime)

        function exit() {
            clearTimeout(timeout)
            clearInterval(interval)
        }
    })
}
