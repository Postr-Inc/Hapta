//@ts-nocheck

import { pb } from "../../server";
import { TokenManager } from "../utils/jwt/JWT";
import { ErrorCodes, ErrorHandler } from "./ErrorHandler";

export default class AuthSate{
    pb: any;
    tokenManager: TokenManager;
    constructor(pb: any, tokenManager: TokenManager){
        this.pb = pb;
        this.tokenManager = tokenManager;
    }

   public async authUpdate(data: any){
   
        switch(true){
            case !data.token:
                return {
                    error: true,
                    message: 'token is required'
                }
            case !this.tokenManager.isValid(data.token, true) || this.tokenManager.decode(data.token).id !== data.data.record.id:
                return {...new ErrorHandler(null).handle({code: ErrorCodes.INVALID_TOKEN}), key: data.key, session: data.session}
            case !data.data.record:
                 return {...new ErrorHandler(null).handle({code: ErrorCodes.FIELD_MISSING}), key: data.key, session: data.session, missing: 'record'}
            default:
         
              
        
                try {
                     
                let d = await pb.admins.client.collection('users').getOne(data.data.record.id)
               
                return {error: false, message: 'success', key: data.data.key, clientData:d, session: data.session}
        
                } catch (error) {
       
                    return {...new ErrorHandler(error).handle({code: ErrorCodes.AUTHORIZATION_FAILED}), key: data.key, session: data.session}
                }
          }
    
    }

    public async authWithPassword(data: any){
        switch(true){
            case !data.email || !data.username:
                return {
                    error: true,
                    message: 'email or username are required'
                }

            case !data.password:
                return {
                    error: true,
                    message: 'password is required'
                }
            default:
                try {
                    let res = await pb.admins.client.collection('users').authWithPassword(data.email || data.username, data.password)
                    let token = await this.tokenManager.sign(res.record.id, await this.tokenManager.generateSigningKey(res.record.id, true) as string);
                    res['token'] = token as string;
                    return {error: false, message: 'success', key: data.key, clientData: res}
                } catch (error) {
                    return {error: true, message: error.message, key: data.key}
                }

        }
    }

    async oauth(data: any, msg: any){
        
    let session = data.session
    data = data.data
 
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

        let signingKey = await  this.tokenManager.generateSigningKey(res.record.id, true) as string;
  
        let newtoken = await  this.tokenManager.sign(res.record.id,  signingKey) as string;
        res['token'] = newtoken as string;

        global.shouldLog && console.log(`User ${res.record.id} logged in`);

        msg({type:'oauth', key:'oauth', clientData:res, session: session})

    

             
      } catch (error) { 
     
        console.log(error)
        msg({...new ErrorHandler(error).handle({code:  ErrorCodes.AUTHORIZATION_FAILED}), session: session, key: 'oauth'})
        
        
      }
    }

    async checkUsername(username: string){
        try {
            let res = await pb.admins.client.collection('users').getFirstListItem(`username="${username}"`)
            return res ? true : false
        } catch (error) {
            return false
        }
    }
    
}
 
 