import jwt from 'jsonwebtoken';
let authorize_key = process.env.api_authorizekey
export default class gateway{
    constructor(){
        if(!authorize_key){
            throw new Error("Authorization key is not set")
        }
    }

    sign(payload:any){
        return  jwt.sign({
            exp: Math.floor(Date.now() / 1000) + (60 * 60),
            data: payload
        }, authorize_key);
    
    }
    authorize(token:string){
        return jwt.verify(token, authorize_key, (err, decoded)=>{
            if(err){
                return {status:false, message:"Invalid token"}
            }
            return {
                status:true,
                message:"Token is valid",
                decoded:decoded
            }
        })

    }
}