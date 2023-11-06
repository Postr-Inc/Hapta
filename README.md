# Codename Hapta

What is hapta? - hapta is a backend websocket server/load balancer aimed to fix the common issue with latency / high bandwidth sizes

## Features

1. High availibility 
  - All requests are set in a qeue and all connections are qeue'd this is to ensure that one request at a time gets processed  - to ensure lower load/high latency per user
  - Streamed requests from pocketbase backend - hapta allows you to run requests from pocketbase to frontend faster and efficiently/also sending only chunks of request at a time for higher efficiency
 
2. Embeddibility - hapta aims to make it easy to embed pocketbase throughout your app and making ui seamless 