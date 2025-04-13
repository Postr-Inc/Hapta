import TokenManager from "../../../../../TokenManager";
import { User } from "../../../../..";
import Headers from "../../../../../Headers";
import bcrypt from 'bcrypt'
import Health from "../../../../../HealthStatus";
export default async function POST(req: Request, health: Health, TokenManager: TokenManager){

  const {emailOrUsername, password} = await req.json(); 

  if(!emailOrUsername || !password){
    return new Response(JSON.stringify({
        response:{
            message: 'Missing email or password',
            success:false
        }
    }), {
        status:400,
        headers:{
            ...Headers.Cors,
            ...Headers.ContentType['json']
        }
    })
  }
  const isEmail = emailOrUsername.includes('@') 
  const existingUser = await User.findOne({ where: { ...(isEmail ? {email: emailOrUsername} : {username: emailOrUsername})}})

  if(!existingUser){
    return new Response(JSON.stringify({
        response:{
            message: 'Invalid username or password',
            success:false
        }
    }), {
        status: 400,
        headers:{
            ...Headers.Cors,
            ...Headers.ContentType['json']
        }
    })
  }



  const match = await bcrypt.compare(password, existingUser.password);


  if(!match){
    return new Response(JSON.stringify({
        response:{
            message:'User not found',
            success:false
        }
    }), {
        status:400,
        headers:{
            ...Headers.Cors,
            ...Headers.ContentType['json']
        }
    })
  } 

  //@ts-ignore
  var ip =  req?.ipAddress as any
 
  const token = TokenManager.create({payload:{emailOrUsername, tier: existingUser.dataValues.tier}, password, ip})

  delete existingUser.dataValues.password
  delete existingUser.dataValues.tier
  return new Response(JSON.stringify({
     response:{
        message:'Successfully Logged In',
        record:{
            ...existingUser.dataValues,
            token
        },
        success: true
     }
  }), {
    status: 200,
    headers:{
        ...Headers.Cors,
        ...Headers.ContentType['json']
    }
  })
}