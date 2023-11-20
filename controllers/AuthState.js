import { tokenManager } from "../utils/jwt.js"

export default async function authWithPassword(pb,  data){
   switch(true){
    case !data.email:
        return {
            error: true,
            message: 'email is required'
        }
    case !data.password:
        return {
            error: true,
            message: 'password is required'
        }
    default:
          
    try {
        let res = await pb.admins.client.collection('users').authWithPassword(data.email, data.password)
      
        res['token'] = tokenManager.sign(res.record.id)
          
      return {type:'auth&password', key:'auth&password', clientData:res}
    } catch (error) {
        console.log(error)
        return { error: true, message: error.message, key: data.key}
    }

   }
}

export async function authUpdate(pb, data){
  switch(true){
    case !data.token:
        return {
            error: true,
            message: 'token is required'
        }
    case !data.record:
        return {
            error: true,
            message: 'auth record is required'
        }
    default:
        let idFromToken = tokenManager.decode(data.token).id
        if(idFromToken !== data.record.id){
            return {
                error: true,
                message: 'You are not authorized to perform this action'
            }
        }

        try {
            let newToken = tokenManager.sign(data.record.id)
            let res = await pb.admins.client.collection('users').getOne(data.record.id)
            res['token'] = newToken
            return {error:false, key:data.key, clientData:res}

        } catch (error) {
            return {error: true, message: error.message, key: data.key}
        }
  }
}