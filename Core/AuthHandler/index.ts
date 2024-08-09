import Pocketbase from 'pocketbase';
import { sign } from 'hono/jwt'
import { ErrorCodes } from '../../Enums/Errors';
import { setCookie } from 'hono/cookie';
import { HttpCodes } from '../../Enums/HttpCodes';
const config = require(process.cwd() + '/config.toml')
export default class AuthHandler{
     pb: Pocketbase;
     SuccessFulLogins: Map<string, string>
     tokenStore: Map<string, string>
     ipStore: Map<string, string>
     constructor(
        pb: Pocketbase
     ) {
        this.pb = pb;
        this.SuccessFulLogins = new Map()
        this.tokenStore = new Map()
        this.ipStore = new Map()
     }

     public async login(emailOrUsername: string, password: string, deviceInfo: string, ipAddress: string, hono: any){
         try { 
            let user = await this.pb.collection('users').authWithPassword(emailOrUsername, password) as any;
            let ActiveDevices =  await this.pb.collection('Devices').getFullList( {
                filter: `account="${user.record.id}"`,
                batch: Number.MAX_SAFE_INTEGER
            })  as any
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

            this.SuccessFulLogins.set(user.record.id, ipAddress)

            const payload = {
                id: user.record.id,
                exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
            }

            let token = await sign(payload, config.security.Secret + password , "HS256") as string;
            this.tokenStore.set(token, config.security.Secret + password)
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
            hono.status(ErrorCodes.AUTHORIZATION_FAILED)
            return hono.json({
                status: ErrorCodes.AUTHORIZATION_FAILED,
                message: 'Invalid Email or Password'
            })
         }
     }
}