 

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
          
 
    try {
        let res = await pb.admins.client.collection('users').authWithPassword(data.email || data.username, data.password)
     
       
          
      return {type:'auth&password', key:'auth&password', clientData:res}
    } catch (error) {
        console.log(error)
        return { error: true, message: error.message, key:  "auth&password"}
    }

   }
}

export async function authUpdate(pb, data, tokenManager){
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
 
        if(tokenManager.decode(data.token).id !== data.record.id || !tokenManager.isValid(data.token)){
            return {
                error: true,
                message: 'You are not authorized to perform this action'
            }
        }

        try {
             
        
        let res = await pb.admins.client.collection('users').getOne(data.record.id)
        return {error: false, message: 'success', key: data.key, clientData: res}

        } catch (error) {
            return {error: true, message: error.message, key: data.key}
        }
  }
}