import Headers from "../../../../Headers";
import Health from "../../../../HealthStatus";
import TokenManager from "../../../../TokenManager"; 
export async function POST(req: Request, h: Health, t:  TokenManager){  
  const token = req.headers.get("Authorization")
  const form =  await req.formData()
  const fileName = form.get("fileName")
  const path  = form.get("filePath")
  const data = form.get("fileData")
  if(t.verify(req.ipAddress, token) == false){
    return new Response(JSON.stringify({
        response:{
            message:"Invalid token passed",
            error: true
        }
    }), {
        status:400,
        headers:{
            ...Headers.Cors,
            ...Headers.ContentType['json']
        }
    })
  }
 
}

export function PUT(){

}
export function DELETE(){

}

export function GET(){
  return new Response("ye", {
    headers:{
        ...Headers.ContentType['text'],
        ...Headers.Cors
    }
  })
}
 