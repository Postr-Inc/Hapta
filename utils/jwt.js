import jwt from 'jsonwebtoken';
import crypto from 'crypto';

 
 
export class TokenManager{
    constructor(Pocketbase){
        this.serverKeys = new Map()
        this.pb = Pocketbase
        this.startUp()
    }

    startUp(){
        this.pb.admins.client.collection('authState').getFullList().then((res)=>{
            res.forEach((d)=>{
                this.serverKeys.set(d.User, {key: d.signing_key, id: d.id})
            })
        })
    }

    sign(Uid, signingKey){
        
        return new Promise((resolve, reject) => {
            jwt.sign({id: Uid }, signingKey, {expiresIn: '30d'}, (err, token) => {
                if(err) reject(err)
                resolve(token)
            })
        })
    }

    async generateSigningKey(Uid){
        await this.pb.admins.authWithPassword(process.env.EMAIL, process.env.PASSWORD)
        let randomKey =  crypto.randomUUID()
        
        if(this.serverKeys.has(Uid)) {
            try {
                await this.pb.admins.client.collection('authState').update(this.serverKeys.get(Uid).id, {signing_key: randomKey})
                this.serverKeys.set(Uid, {key: randomKey, id: this.serverKeys.get(Uid).id})
                return randomKey
            } catch (error) {
                console.log(error)
                return null
            }
        }
        let res =  await this.pb.admins.client.collection('authState').create({signing_key: randomKey, User: Uid})
        this.serverKeys.set(Uid, {key: randomKey, id: res.id})
        console.log(randomKey   )
        return randomKey
    }

    decode(token){
        
        return jwt.decode(token)
    }

    removeSigningKey(id){
        this.serverKeys.delete(id)
    }

    async getSigningKey(id){
         
        switch(true){
            case !id:
                return null
            case this.serverKeys.has(id):
                return this.serverKeys.get(id)
            default:
             return await this.generateSigningKey(id)
        }
    }

    

    async isValid(token){
         
        try {
            console.log(this.decode(token).id)
            let signingKey = await this.getSigningKey(this.decode(token).id)            
            jwt.verify(token, signingKey.key)

            return true
        } catch (error) {
            return false
        }
    }
    
}
 