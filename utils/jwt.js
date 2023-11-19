import jwt from 'jsonwebtoken';

export  const tokenManager = {
    sign: (id) => {
        return jwt.sign({id:id}, process.env.JWT_SECRET, {expiresIn: process.env.JWT_EXPIRES_IN})
    },
    decode: (token) => {
        return  jwt.decode(token)
    },
    isValid: (token) => {
        try {
            jwt.verify(token, process.env.JWT_SECRET)
            return true
        } catch (error) {
            return false
        }
    }
}
