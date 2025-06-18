//@ts-nocheck
import { expect, test } from "bun:test"

// Authentication Mehtod

async function test_logging_in() {
    return new Promise(async (resolve, reject) => {
        const email = Bun.env.EmployeeEmail
        const password = Bun.env.EmployeePassword  
        const res = await fetch("http://localhost:8080/auth/login", {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
          },
            body: JSON.stringify({ emailOrUsername: email, password })
        })

        const json = await res.json()
        if (json.status !== 200) {
            reject({
                error: json.message,
                test_succesfully: false,
            })
        } else {
            resolve({ test_succesfully: true, data: json.data})
        }
    })
}


async function test_fetching_post_flow(token: string){
   return new Promise(async (resolve, reject)=>{
      const res = await fetch('http://localhost:8080/collection/posts', {
          method: "POST",
          body: JSON.stringify({
            type: "get",
            payload: {
              collection: "posts",
              id: "33d131g62hf60ik", 
            },
            security: {
              token: token
            },
            callback: ""
          })
      })

      const j = await res.json()
      resolve(j)
   })
}


async function test_list_post_flow(){

}
 
test("Authentication Test 1", async () => {
    const res = await test_logging_in().then((d)=> d) 
    expect(res.test_succesfully).toEqual(true) 
    expect(res.data).toHaveProperty('token')
})


test("Fetch Post Flow", async ()=>{
   const auth = await test_logging_in().then((d)=> d)
   expect(auth.test_succesfully).toEqual(true) 
   const res = await test_fetching_post_flow(auth.data.token).then((p) => p.payload)
   expect(res).toBeDefined();
   expect(res).toContainKey("content")
   expect(res).toContainKey("author")
   expect(res.author).not.toHaveLength(0)
})



test("Test Cases Successful", ()=>{
console.log("Test Flow Ran Successfully, ensure you screen shot and send PR to manager")
})

 