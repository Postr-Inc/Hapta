import { sequelize, User } from "../../../../..";
import Headers from "../../../../../Headers";  
import TokenManager from "../../../../../TokenManager";
import bcrypt from 'bcrypt';

const saltRounds = 10;
const tokenManager = new TokenManager();

export default async function POST(req: Request) { 
   try {
      const { email, username, password } =  await req.json()
 

      if (!username || !email || !password) {
         return new Response(JSON.stringify({
            response: { message: "Missing username, email, or password" }
         }), {
            status: 400,
            headers: { ...Headers.Cors, ...Headers.ContentType.json }
         });
      }
 
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
         return new Response(JSON.stringify({
            response: { message: "User exists already", success: false }
         }), {
            status: 400,
            headers: { ...Headers.Cors, ...Headers.ContentType.json }
         });
      }
 
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(password, salt);
 
      const user = await User.create({
         username,
         email,
         password: hashedPassword,
         tier: 1, // unverified,
         verified: false,
      });

      delete user.password;
      return new Response(JSON.stringify({
         response: { message: "Successful", success: true, data: {
            user
         } }
      }), {
         status: 200,
         headers: { ...Headers.Cors, ...Headers.ContentType.json }
      });

   } catch (error) {
      console.log
      return new Response(JSON.stringify({
         response: { message: error.message }
      }), {
         status: 500,
         headers: { ...Headers.Cors, ...Headers.ContentType.json }
      });
   }
}
