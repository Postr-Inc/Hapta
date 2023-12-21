//@ts-nocheck

import { pb } from "../../server"
import { TokenManager } from "../utils/jwt/JWT"

export default async function oauth2( tokenManager: TokenManager,  msg:any, data: any){
   
   

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
                    }
                 
                })
            },
           }) 

        let newtoken = await tokenManager.sign(res.record.id, await tokenManager.generateSigningKey(res.record.id, true) as string);
        res['token'] = newtoken as string;

        global.shouldLog && console.log(`User ${res.record.id} logged in`);

        msg({type:'oauth', key:'oauth', clientData:res});

    

             
      } catch (error) {
        console.log(error)
     
        msg({type:'oauth', key:'oauth', error: true, message: error.message})
        
        
      }
}