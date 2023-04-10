import { Network } from "./network.js"
import throttledMap from "./throttledMap.js"

/**
 *Wrapper class for the TorrServer API
 *See more: https://github.com/YouROK/TorrServer
 *
 * @class TorrServer
 */
class TorrServer {
    TIMEOUT = 6000 //Connection timeout. Local ips will return very fast (if they exist).
    MAX_CONNECTIONS = 3 //Number of concurrent WebSocket requests over the local network - we shouldn't overburden the browser
    PORT = 8090 //See torrServer's documentation https://github.com/YouROK/TorrServer

    constructor(url = null) {
        this.url = url
        this.version = null
    }
    /**
     *Assert that server is ready to recieve requests
     *
     * @param {boolean} [retryUponError=true] If *NO* server response is recieved from the users pecified IP, server.detectUrl() will be called.
     * @memberof TorrServer
     */
    init = async (retryUponError = true) => {
        const response = await fetch(`http://${this.url}:${this.PORT}/echo`)
        this.version = await response.text()

        if (!this.version.match(/MatriX\.\d{1,3}/)) {
            if (retryUponError) {
                await this.detectUrl()
                if (!this.version.match(/MatriX\.\d{1,3}/))
                    throw "No server in network" //Still no server found in the network
            } else throw "No server at IP"
        }

        console.log(`Server ready at '${this.url}'`)
    }

    /**
     *"Automatically" detect the location (ie. IP) of the torrServer within the user's WLAN.
     *
     * @memberof TorrServer
     */
    detectUrl = async () => {
        const network = new Network(this.TIMEOUT, this.TIMEOUT / 4)
        await network.detectGetaway()

        //This will only reutrn if server exists at IP, and its /echo encpoint responds with TorrServer version
        const checkIfTorrServer = async (ip) => {
            await network.checkAddress(ip) //this will throw if endpoint doesn't exist
            const server = await network.checkServer(`${ip}:8090/echo`)
            if (server?.text.match(/MatriX\.\d{1,3}/)) {
                //ex. MatriX.121
                return { ip, version: server.text }
            }
            throw `No TorrServer here (${ip})`
        }

        const server = await Promise.any(
            throttledMap(
                network.possibleLocalIps,
                checkIfTorrServer,
                this.MAX_CONNECTIONS,
                this.TIMEOUT,
                true
            )
        )
        this.url = server.ip
        this.version = server.version
    }

    streamTorrent = async (torrentId, fileIdx, element) => {
        const data = { link: torrentId, index: fileIdx, m3u: true }
        const response = await fetch(
            `http://${this.url}:${this.PORT}/stream?${new URLSearchParams(
                data
            )}`
        )
        console.log(await response.text())
    }
}

export { TorrServer }
