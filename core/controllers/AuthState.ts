//@ts-nocheck

import { pb } from "../../server";
import { TokenManager } from "../utils/jwt/JWT";

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
                return {
                    error: true,
                    message: 'You are not authorized to perform this action'
                }
            case !data.data.record:
                return {
                    error: true,
                    message: 'auth record is required'
                }
            default:
         
              
        
                try {
                     
                let d = await pb.admins.client.collection('users').getOne(data.data.record.id)
              
              
                return {error: false, message: 'success', key: data.data.key, clientData:d  }
        
                } catch (error) {
       
                    return {error: true, message: error.message, key: data.key}
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

    async checkUsername(username: string){
        try {
            let res = await pb.admins.client.collection('users').getFirstListItem(`username = "${username}"`)
            return res ? true : false
        } catch (error) {
            return false
        }
    }
    
}
 
 