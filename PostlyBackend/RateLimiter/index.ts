import { config } from ".."
export default class RateLimiter{
    pool: Map<string, string>
    constructor(){
        console.log(config)
        this.pool = new Map()
        this.config
    }
}