//@ts-nocheck

import { pb } from "../../server"
import { TokenManager } from "../utils/jwt/JWT"

export default async function oauth2( tokenManager: TokenManager,  msg:any, d: any){
   
 
    let data = d.data 
    let session = d.session
  

    try {
        let res  = await pb.admins.client.collection('users').authWithOAuth2({
            provider: data.provider,
            createData: {
             bio: "I am new to Postr!",
             followers: [],
             following: [],
            },
            redirectUrl: data.redirect_uri,
            urlCallback: (url) => {
               
               msg({
                    type: 'oauth',
                    key:'oauth',
                    data: {
                        url: url
                    },
                    session: session
                 
                })
            },
           }) 

        let signingKey = await tokenManager.generateSigningKey(res.record.id, true) as string;
  
        let newtoken = await tokenManager.sign(res.record.id,  signingKey) as string;
        res['token'] = newtoken as string;

        global.shouldLog && console.log(`User ${res.record.id} logged in`);

        msg({type:'oauth', key:'oauth', clientData:res, session: session})

    

             
      } catch (error) {
        console.log(error)
     
        msg({type:'oauth', key:'oauth', error: true, message: error.message, session:  d.session})
        
        
      }
}