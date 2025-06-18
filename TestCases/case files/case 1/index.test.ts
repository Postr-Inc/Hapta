//@ts-nocheck
import { expect, test } from "bun:test"
import { describe } from "bun:test"

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
            resolve({ test_succesfully: true, data: json.data })
        }
    })
}


async function test_fetching_post_flow(token: string) {
    return new Promise(async (resolve, reject) => {
        const res = await fetch('http://localhost:8080/collection/posts', {
            method: "POST",
            body: JSON.stringify({
                type: "get",
                payload: {
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


async function test_list_post_flow(recommend: boolean = false, token: string, authenticated_user_id: string) {
    return new Promise(async (resolve, reject) => {
        const res = await fetch('http://localhost:8080/collection/posts', {
            method: "POST",
            body: JSON.stringify({
                type: "list",
                payload: {
                    collection: "posts",
                    limit: 10,
                    page:1,
                    id: authenticated_user_id,
                    options: {
                        ...({ recommend })
                    },
                },
                security: {
                    token: token
                },

                callback: ""
            })
        })

        const j = await res.json()

        if(j.opCode !== 200){
            reject(j)
        }else{
            resolve(j)
        } 
    })
}

test("Authentication Test 1", async () => {
    const res = await test_logging_in().then((d) => d)
    expect(res.test_succesfully).toEqual(true)
    expect(res.data).toHaveProperty('token')
})



test("Fetch Post Flow", async () => {
    console.log("\n")
    console.log("[Test Flow]: Fetching Singular post from endpoint: /collection/posts")
    const auth = await test_logging_in().then((d) => d)
    expect(auth.test_succesfully).toEqual(true)
    const res = await test_fetching_post_flow(auth.data.token).then((p) => p.payload)
    expect(res).toBeDefined();
    expect(res).toContainKey("content")
    expect(res).toContainKey("author")
    expect(res.author).not.toHaveLength(0)
    console.log("Flow Finished")
    console.log("[Test Flow]: Testing Recommended Algorithm, and Ensuring post filtering is working properly")
    const posts = await test_list_post_flow(true, auth.data.token, auth.data.id).then((d) => d.payload)
    describe.each(posts)("Ensure correct data is returned",(data)=>{ 
        expect(data).toContainKey("content")
        expect(data).toContainKey("author")
        expect(data.author).not.toHaveLength(0)
    })
    console.log("Flow Finished")
    console.log("\n")
})


test("Test Cases Successful", () => {
    console.log("Success, ensure you screen shot and send PR to manager")
})

