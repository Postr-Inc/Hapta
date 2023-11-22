import {  TokenManager } from "../utils/jwt.js"
 

export default async function authWithPassword(pb,  data){
 
   switch(true){
    case  !data['email']  && !data['username'] :
        return {
            key: 'auth&password',
            error: true,
            message: 'email or username is required'
        }
    case !data.password:
        return {
            error: true,
            message: 'password is required'
        }
    default:
          
   console.log(data)
    try {
        let res = await pb.admins.client.collection('users').authWithPassword(data.email || data.username, data.password)
        console.log(res)
       
          
      return {type:'auth&password', key:'auth&password', clientData:res}
    } catch (error) {
        console.log(error)
        return { error: true, message: error.message, key:  "auth&password"}
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
  
        if(idFromToken !== data.record.id){
            return {
                error: true,
                message: 'You are not authorized to perform this action'
            }
        }

        try {
             
           

        } catch (error) {
            return {error: true, message: error.message, key: data.key}
        }
  }
}