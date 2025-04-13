import Health from "../HealthStatus"
import Headers from "../Headers"
import { RequestFunction } from "../types"
export default function GET<RequestFunction>(req: Request, Health: Health){ 
     return new Response(JSON.stringify({
        code: 200,
        message: "All systems go", 
        health: Health.forge()
     }), {
        headers:{
            status:'200',
            ...Headers.Cors, 
            ...Headers.ContentType.json,
        }
     })
}