import { tokenManager } from "../utils/jwt.js"

export default async function oauth2(pb, sendMessage, data){
     let res  = await pb.admins.client.collection('users').authWithOAuth2({
        provider: data.provider,
        createData: {
         bio: "I am new to Postr!",
         followers: [],
        },
        redirectUrl: data.redirect_uri,
        urlCallback: (url) => {
            sendMessage({
                type: 'oauth',
                key:'oauth',
                data: {
                    url: url
                }
             
            })
        },
       }) 


       
       res['token'] = tokenManager.sign(res.record.id)
          
       sendMessage({type:'oauth', key:'oauth', clientData:res})

         
}