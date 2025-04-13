import Cache from "../../../../../cache";
import Headers from "../../../../../Headers";
import Health from "../../../../../HealthStatus";
import RateLimiter from "../../../../../RateLimiter";
import TokenManager from "../../../../../TokenManager";
import { HandlerProps } from "../../../../../types";

export default async function POST( {req, health, tokenmanager, ratelimiter, cache}: HandlerProps){
    const f  = await req.formData()
    const files = f.get("images")
    const content = f.get("content")
    const author = f.get("author")

    return new Response("500", {
        status:500,
        headers:{
            ...Headers.ContentType['text'],
            ...Headers.Cors
        }
    })
}