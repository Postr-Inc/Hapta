import Pocketbase from 'pocketbase';
import { sign } from 'hono/jwt'
import { ErrorCodes } from '../../Enums/Errors';
import { setCookie } from 'hono/cookie';
import { HttpCodes } from '../../Enums/HttpCodes';
import config from '../../config';
export default class AuthHandler{
     pb: Pocketbase;
     SuccessFulLogins: Map<string, string>
     tokenStore: Map<string, string>
     ipStore: Map<string, string>
     adminTokenStore: Map<string, string>
     userStore: Map<string, string>
     constructor(
        pb: Pocketbase
     ) {
        this.pb = pb;
        this.SuccessFulLogins = new Map()
        this.tokenStore = new Map()
        this.ipStore = new Map()
        this.adminTokenStore = new Map()
        this.userStore = new Map()
     }

     public async rollNewToken(oldToken: string, data: any, isBasicToken?: boolean){
       let tokenBody = {
            ...data,
            ...(isBasicToken && {isBasic: true, permissions: ["read"]}),
            ...(!isBasicToken && {isBasic: false, permissins: ["read", "write", "delete"]}),
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
       }
       let newSig = config.Security.Secret + oldToken.split('-')[1] + Math.random().toString(36).substring(2, 15);
       let newToken = await sign(tokenBody, newSig, "HS256") as string; 
       this.SuccessFulLogins.set(data.id, oldToken.split('-')[0] + "-" + newToken)
       this.tokenStore.set(newToken, newSig) 
       this.tokenStore.delete(oldToken)
       return newToken;
     }

     public async resetPassword( resetToken: string, password: string, hono: any){
        try {
            await this.pb.collection('users').confirmPasswordReset(resetToken, password, password)
            return hono.json({
                status: HttpCodes.OK,
                message: 'Password Reset Successful'
            })
        } catch (error) {
            hono.status(ErrorCodes.INTERNAL_SERVER_ERROR)
            return hono.json({
                status: ErrorCodes.INTERNAL_SERVER_ERROR,
                message: 'An error occured while resetting password',
                details: error
            })
        }
     }
     public async requestPasswordReset(email: string, hono: any){
        try {
              await this.pb.collection('users').requestPasswordReset(email) 
            return hono.json({
                status: HttpCodes.OK,
                message: 'Password Reset Request Sent'
            })
        } catch (error) {
            hono.status(ErrorCodes.INTERNAL_SERVER_ERROR)
            return hono.json({
                status: ErrorCodes.INTERNAL_SERVER_ERROR,
                message: 'An error occured while sending password reset request'
            })
        }
     }
     public async register(data: any, hono: any){
        try {
            if(data.followers || data.following){
                hono.status(ErrorCodes.UNAUTHORIZED_REQUEST)
                return hono.json({
                    status: ErrorCodes.UNAUTHORIZED_REQUEST,
                    message: "Cannot inject followers or following into user created record!"
                })
            }
            let user = await this.pb.collection('users').create({
                ...data,
                passwordConfirm:data.password,
                ActiveDevices: []
            }) as any;
            return hono.json({
                status: HttpCodes.OK,
                message: 'User Created Successfully',
                data: user.record
            })
        } catch (error) {
            console.log(error)
            hono.status(ErrorCodes.INTERNAL_SERVER_ERROR)
            return hono.json({
                status: ErrorCodes.INTERNAL_SERVER_ERROR,
                message: 'An error occured while creating user'
            })
        }
     }

     public async check(email: string, username: string, hono: any){
        try {
            let emailExists = await this.pb.collection('users').getFullList({batch: 1, filter: `email="${email}"`}) as any;
            let usernameExists = await this.pb.collection('users').getFullList({batch: 1, filter: `username="${username}" || username="${username.toLowerCase()}" || username="${username.toUpperCase()}"`}) as any;
            return hono.json({
                status: HttpCodes.OK,
                message: 'Check Successful',
                data: {
                    emailExists: emailExists.length > 0,
                    usernameExists: usernameExists.length > 0
                }
            })
        } catch (error) {
            console.log(error)
            hono.status(ErrorCodes.INTERNAL_SERVER_ERROR)
            return hono.json({
                status: ErrorCodes.INTERNAL_SERVER_ERROR,
                message: 'An error occured while checking email'
            })
        }
     }

     public async login(emailOrUsername: string, password: string, deviceInfo: string, ipAddress: string, hono: any){
         try { 
            let user = await this.pb.collection('users').authWithPassword(emailOrUsername, password) as any;
            let ActiveDevices =  await this.pb.collection('Devices').getFullList( {
                filter: `account="${user.record.id}"`,
                batch: Number.MAX_SAFE_INTEGER
            })  as any
            if(deviceInfo && deviceInfo.length > 0){
            let deviceExists =  ActiveDevices.some((device: any) => device.ip === ipAddress)
            let deviceName = deviceInfo.split(')')[0].split('(')[1]  || 'Unknown Device'

            if(!deviceExists){
                await this.pb.collection('Devices').create({
                    ip: ipAddress,
                    account: user.record.id,
                    lastLogin: new Date().toISOString(),
                    name_of_device:  deviceName
                }).then(async (res) => {
                    this.pb.collection('users').update(user.record.id, {
                        ActiveDevices: [...ActiveDevices, res.id]
                    })
                })
            }else{
                await this.pb.collection('Devices').update(ActiveDevices.find((device: any) => device.ip === ipAddress).id, {
                    lastLogin: new Date().toISOString()
                })
            } 
            }
            
 

            const payload = {
                id: user.record.id,
                username: user.record.username,
                created: user.record.created, 
                exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
            }
 

            let token = await sign(payload, config.Security.Secret + password , "HS256") as string;
            
            this.SuccessFulLogins.set(user.record.id, ipAddress +"-"+ token)
            // remove last token with same ip
            let lastToken = this.SuccessFulLogins.get(user.record.id) 
            if(lastToken){
                this.tokenStore.delete(lastToken.split('-')[1])
                this.ipStore.delete(lastToken.split('-')[1])
            }
            this.tokenStore.set(token, config.Security.Secret + password)
            this.ipStore.set(token, ipAddress)
            user.record.ActiveDevices = ActiveDevices
            return hono.json({
                status: HttpCodes.OK,
                message: 'Login Successful',
                data: {
                    token, 
                    ...user.record
                }
            })
         } catch (error) {    
            console.log(error)
            hono.status(ErrorCodes.AUTHORIZATION_FAILED)
            return hono.json({
                status: ErrorCodes.AUTHORIZATION_FAILED,
                message: 'Invalid Email or Password'
            })
         }
     }
}
