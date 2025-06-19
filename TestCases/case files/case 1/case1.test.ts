import { expect, test } from "bun:test";

async function test_logging_in() {
  const email = Bun.env.TestUserEmail;
  const password = Bun.env.TestUserPassword;

  const res = await fetch("http://localhost:8080/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ emailOrUsername: email, password }),
  });

  const json = await res.json();

  if (json.status !== 200) {
    throw new Error("Auth failed: " + json.message);
  }

  return {
    test_succesfully: true,
    data: json.data,
  };
}

async function test_fetching_post_flow(token: string) {
  const res = await fetch("http://localhost:8080/collection/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "get",
      payload: { id: "33d131g62hf60ik" },
      security: { token },
      callback: "",
    }),
  });

  return await res.json();
}

async function test_list_post_flow(recommend: boolean, token: string, userId: string) {
  const res = await fetch("http://localhost:8080/collection/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "list",
      payload: {
        collection: "posts",
        limit: 10,
        page: 1,
        id: userId,
        options: { recommend },
      },
      security: { token },
      callback: "",
    }),
  });

  return await res.json();
}

test("Authentication Test", async () => {
  const auth = await test_logging_in();
  expect(auth.test_succesfully).toBe(true);
  expect(auth.data).toHaveProperty("token");
});

test("Fetch & List Posts Flow", async () => {
  const auth = await test_logging_in();

  const post = await test_fetching_post_flow(auth.data.token);
  expect(post.payload.content).toBeDefined();
  expect(post.payload.author).toBeDefined();

  const list = await test_list_post_flow(true, auth.data.token, auth.data.id);
  expect(list.payload.length).toBeGreaterThan(0);

  for (const item of list.payload) {
    expect(item.content).toBeDefined();
    expect(item.author).toBeDefined();
  }
});
