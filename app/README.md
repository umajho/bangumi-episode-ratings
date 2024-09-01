# App

## TODO

- [ ] 如果可以把现有的 token 视为 refresh token，然后用它来得到有较短过期时间的
      access token，应该可以减少不少为了验证用户而向 KV 发起的读取请求。
- [ ] 如果将 methods 与 headers 都移至 body 中，method 只用 GET 和 POST，就可以
      跳过 CORS 的 preflight 请求。
