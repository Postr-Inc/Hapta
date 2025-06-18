//@ts-nocheck
import { test, expect } from "bun:test"
// Create update and delete

async function test_logging_in() {
    return new Promise(async (resolve, reject) => {
        const email = Bun.env.TestUserEmail
        const password = Bun.env.TestUserPassword
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


test("Create Post Test", async()=>{
    const auth = await test_logging_in().then((d) => d)
    expect(auth.test_succesfully).toEqual(true)
})




