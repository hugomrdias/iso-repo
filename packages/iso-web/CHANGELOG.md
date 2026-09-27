# Changelog

## [4.0.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v3.1.2...iso-web-v4.0.0) (2026-09-27)


### ⚠ BREAKING CHANGES

* **iso-web:** a 413/429/503 with Retry-After that won't be retried (method not retryable, retries used up, or `shouldRetry` returned false) now returns the `HttpError` immediately instead of waiting first. A Retry-After wait that doesn't fit in the remaining `timeout` or `maxRetryTime` now returns the `HttpError` immediately instead of a `TimeoutError`. Retries after a Retry-After wait no longer add the backoff delay, so they happen sooner.
* **iso-web:** with `retry` enabled, network errors are only retried for methods in `retry.methods` (default GET, PUT, HEAD, DELETE, OPTIONS, TRACE). POST and PATCH requests that fail with a network error now return the `NetworkError` after one attempt. Add the method to `retry.methods`, or return true from `retry.shouldRetry`, to keep retrying them.
* **iso-web:** `new JsonError()` now requires `response` and `request` alongside `cause`, and sets `code` from `response.status`. Errors returned by `request.json()` and DoH `resolve()` gain `code`, `response` and `request`; `cause` and `message` are unchanged.
* **iso-web:** `request()` and `request.json()` no longer reject. Invalid URLs, GET requests with a body, invalid header names or values, an invalid `timeout` and a missing `globalThis.fetch` now resolve to `{ error: RequestError }` (message `Request failed: <original message>`). Malformed JSON, including an empty body with a JSON content type, resolves to `{ error: RequestError('Response body is not valid JSON') }` whether the status is 2xx or an error. A throwing `schema.validate()` resolves to `{ error: RequestError }`. In every case `cause` is the original error. Code that relied on `try/catch` or `.catch()` for these cases must check `error` instead.
* **iso-web:** `request.json.head` is removed. Use `request.head` to check a resource and read `result.headers`/`result.status`. Calling `request.json(url, { method: 'HEAD' })` directly, or any empty-bodied JSON response such as a 204 with `content-type: application/json`, now resolves to `{ error: RequestError('Response body is not valid JSON') }`.
* **iso-web:** errors thrown by `onResponse`, `poll.shouldPoll`, a function `poll.interval` or `retry.shouldRetry` now return a `RequestError` with message `Request failed: <original message>` and the thrown error as `cause`, instead of a `NetworkError` with no cause. `NetworkError.is()` is only true for real fetch failures, and `NetworkError.cause` is now the fetch error itself (for example the Node `TypeError: fetch failed`); in Node the underlying syscall error moves from `error.cause` to `error.cause.cause`. `RequestErrors` now includes `RequestError`.
* **iso-web:** TXT data no longer has every `"` and `'` character removed: multi-string records are concatenated without a space, and apostrophes and escaped quotes are kept. CAA, NAPTR and other non-TXT records are returned unchanged, with their quotes. A TXT value from an unquoted provider that is itself entirely wrapped in `"..."` is unquoted.
* **iso-web:** A name with no records of the requested type now resolves to `{ result: [] }` instead of the zone's SOA record string from `Authority`, and a `Status: 0` response with neither `Answer` nor `Authority` resolves to `[]` instead of a `DohError('No answer or authority')`. SOA and NS queries on a name without those records also return `[]`. SERVFAIL and REFUSED errors are no longer cached, so they are requested again on every call, and NXDOMAIN is cached for the SOA negative TTL instead of always one hour.
* **iso-web:** `resolve()` only returns records of the requested type. A, AAAA, TXT and other results no longer include CNAME/DNAME chain entries such as the CNAME target hostname.

### Features

* **iso-web:** bound the default DoH cache and accept any get/set cache ([#611](https://github.com/hugomrdias/iso-repo/issues/611)) ([97d38bd](https://github.com/hugomrdias/iso-repo/commit/97d38bdf68d8a809e0dd68dd97f238fe71fb0546))
* **iso-web:** export env, simplify crypto, and clean up http and event-target ([#603](https://github.com/hugomrdias/iso-repo/issues/603)) ([fa74c17](https://github.com/hugomrdias/iso-repo/commit/fa74c1790ae078ec246dd695b4cb4d3c2f65d18d)), closes [#601](https://github.com/hugomrdias/iso-repo/issues/601)


### Bug Fixes

* **iso-web:** cancel response bodies discarded while polling and retrying ([#625](https://github.com/hugomrdias/iso-repo/issues/625)) ([13cc2fd](https://github.com/hugomrdias/iso-repo/commit/13cc2fddb64d91acf6d489d89fbe50ca2ccef383)), closes [#596](https://github.com/hugomrdias/iso-repo/issues/596)
* **iso-web:** don't mutate cached TXT records when parsing dnslink ([#612](https://github.com/hugomrdias/iso-repo/issues/612)) ([b72add2](https://github.com/hugomrdias/iso-repo/commit/b72add2a8728bffe252380cfa07f6e0593bdd34d))
* **iso-web:** don't mutate caller options when serializing json body ([#615](https://github.com/hugomrdias/iso-repo/issues/615)) ([dc71ed7](https://github.com/hugomrdias/iso-repo/commit/dc71ed7f647546e79a40575d4b8f1fb726cbef74))
* **iso-web:** don't reset msw browser worker singleton on module load ([#606](https://github.com/hugomrdias/iso-repo/issues/606)) ([f9f6f54](https://github.com/hugomrdias/iso-repo/commit/f9f6f54aa23c2268a85b9a05bfd49cc741e96e1e)), closes [#600](https://github.com/hugomrdias/iso-repo/issues/600)
* **iso-web:** don't retry network errors for non-idempotent methods ([#620](https://github.com/hugomrdias/iso-repo/issues/620)) ([038b65a](https://github.com/hugomrdias/iso-repo/commit/038b65a85cd7da9d27bc78bf952046a6e517961a)), closes [#593](https://github.com/hugomrdias/iso-repo/issues/593)
* **iso-web:** encode DoH query params ([#607](https://github.com/hugomrdias/iso-repo/issues/607)) ([4cf793a](https://github.com/hugomrdias/iso-repo/commit/4cf793a4d119cd6f89087331606e078ea4ed7b7f))
* **iso-web:** filter DoH answers by requested record type ([#608](https://github.com/hugomrdias/iso-repo/issues/608)) ([91b8d9d](https://github.com/hugomrdias/iso-repo/commit/91b8d9df6ec036222f7c0601cead79c137a7ef53))
* **iso-web:** keep status code, response and request on JsonError ([#622](https://github.com/hugomrdias/iso-repo/issues/622)) ([db322a9](https://github.com/hugomrdias/iso-repo/commit/db322a9b5875c796aed19183e630c86d551b6089))
* **iso-web:** only clone responses when a hook will read them ([#616](https://github.com/hugomrdias/iso-repo/issues/616)) ([9a354e9](https://github.com/hugomrdias/iso-repo/commit/9a354e938acc66b08e52edcde3c746fedd3f3dd6))
* **iso-web:** only report real network failures as NetworkError ([#618](https://github.com/hugomrdias/iso-repo/issues/618)) ([d742738](https://github.com/hugomrdias/iso-repo/commit/d742738bf44ec5a43eee8a63466250d88cea3950))
* **iso-web:** only wait for Retry-After when the request will be retried ([#623](https://github.com/hugomrdias/iso-repo/issues/623)) ([046b571](https://github.com/hugomrdias/iso-repo/commit/046b5714c8dc938c42c38240ee558b20a510630e)), closes [#582](https://github.com/hugomrdias/iso-repo/issues/582)
* **iso-web:** parse quoted TXT character-strings and stop stripping quotes from other records ([#610](https://github.com/hugomrdias/iso-repo/issues/610)) ([631053e](https://github.com/hugomrdias/iso-repo/commit/631053e1d2fdc3c087b7a5fe8f8d137b688982d3))
* **iso-web:** pass the built-in decision to shouldRetry and shouldPoll ([#619](https://github.com/hugomrdias/iso-repo/issues/619)) ([1a1c457](https://github.com/hugomrdias/iso-repo/commit/1a1c457f009eadf1fb5c9cd0886e0441b0d4e6fb)), closes [#585](https://github.com/hugomrdias/iso-repo/issues/585)
* **iso-web:** remove request.json.head ([923a0d8](https://github.com/hugomrdias/iso-repo/commit/923a0d88eebccf880098ac28992341594f02856e))
* **iso-web:** return { error } instead of rejecting in request and request.json ([923a0d8](https://github.com/hugomrdias/iso-repo/commit/923a0d88eebccf880098ac28992341594f02856e))
* **iso-web:** return empty result on NODATA and use RFC 2308 negative cache TTLs ([#609](https://github.com/hugomrdias/iso-repo/issues/609)) ([c074bec](https://github.com/hugomrdias/iso-repo/commit/c074bec0d8bfd0b7901babd74f797e5ab331a4e9))
* **iso-web:** treat X-RateLimit-Reset as a Unix timestamp, not seconds to wait ([#617](https://github.com/hugomrdias/iso-repo/issues/617)) ([db5020c](https://github.com/hugomrdias/iso-repo/commit/db5020cd541d1b5ec2c1b282740c08dbe1bf86e2))
* **iso-web:** use AbortSignal.any in anySignal to avoid leaking listeners ([#605](https://github.com/hugomrdias/iso-repo/issues/605)) ([168a3b0](https://github.com/hugomrdias/iso-repo/commit/168a3b072de7966757b13860fdfdcf2a977e490d)), closes [#587](https://github.com/hugomrdias/iso-repo/issues/587)
* **iso-web:** wait for msw worker unregistration before restarting in the browser ([#626](https://github.com/hugomrdias/iso-repo/issues/626)) ([eaef326](https://github.com/hugomrdias/iso-repo/commit/eaef3262af539ac32cc372653f97899cf55bd279))

## [3.1.2](https://github.com/hugomrdias/iso-repo/compare/iso-web-v3.1.1...iso-web-v3.1.2) (2026-06-04)


### Bug Fixes

* **http:** simplify polling and retry logic in request function ([fcc24f5](https://github.com/hugomrdias/iso-repo/commit/fcc24f5e24b21531ed40867c191e57a4f41eda8a))

## [3.1.1](https://github.com/hugomrdias/iso-repo/compare/iso-web-v3.1.0...iso-web-v3.1.1) (2026-06-03)


### Bug Fixes

* **types:** update default retry option to 2 for improved request handling ([6c69c72](https://github.com/hugomrdias/iso-repo/commit/6c69c72b9e0781a1922ddc3a17ba0013bcce5c6d))

## [3.1.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v3.0.1...iso-web-v3.1.0) (2026-06-03)


### Features

* **http:** update error type definitions for request handling ([dc30aa4](https://github.com/hugomrdias/iso-repo/commit/dc30aa49eec2117524bb316d7a8071d42ed42c8e))


### Bug Fixes

* **doh:** update error type definitions and refine resolve function ([3b4f923](https://github.com/hugomrdias/iso-repo/commit/3b4f9235bdc2d68b827ac000d26a23876e1bef4e))

## [3.0.1](https://github.com/hugomrdias/iso-repo/compare/iso-web-v3.0.0...iso-web-v3.0.1) (2026-06-02)


### Bug Fixes

* **http:** refine retry logic to utilize normalized retry methods ([1a26392](https://github.com/hugomrdias/iso-repo/commit/1a26392b368c20cd5fc8441c6d88b5f954672581))

## [3.0.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v2.3.0...iso-web-v3.0.0) (2026-06-02)


### ⚠ BREAKING CHANGES

* **http:** implement polling functionality and enhance retry options

### Features

* **http:** implement polling functionality and enhance retry options ([a35dc7f](https://github.com/hugomrdias/iso-repo/commit/a35dc7f4dd59f1575bded8a5da2996c65ed522ce))

## [2.3.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v2.2.1...iso-web-v2.3.0) (2026-06-01)


### Features

* **http:** add SchemaError class and support for schema validation in JSON requests ([7189d38](https://github.com/hugomrdias/iso-repo/commit/7189d38ab5c9a4edcea879d239750cbe8afc3d52))


### Bug Fixes

* **http:** streamline retry logic and improve retryAfter handling ([6e7901f](https://github.com/hugomrdias/iso-repo/commit/6e7901fcfbf1ca021dee03ad708963ddf5620e2e))

## [2.2.1](https://github.com/hugomrdias/iso-repo/compare/iso-web-v2.2.0...iso-web-v2.2.1) (2026-04-22)


### Bug Fixes

* enhance NetworkError constructor to accept options ([8334aa5](https://github.com/hugomrdias/iso-repo/commit/8334aa5047b24d34842278eda7dde014130c40c7))

## [2.2.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v2.1.1...iso-web-v2.2.0) (2026-04-10)


### Features

* **iso-web:** retry network errors and clone request for retries ([e4d7f8d](https://github.com/hugomrdias/iso-repo/commit/e4d7f8dc8474ac6866e80aee3eefafa1d6263ab2))

## [2.1.1](https://github.com/hugomrdias/iso-repo/compare/iso-web-v2.1.0...iso-web-v2.1.1) (2026-03-15)


### Bug Fixes

* refine TypeScript error handling and update test cases across multiple packages ([4012b85](https://github.com/hugomrdias/iso-repo/commit/4012b8537370ac86908df4825acf30964393f6e8))

## [2.1.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v2.0.0...iso-web-v2.1.0) (2025-12-03)


### Features

* **iso-web:** support retrying on 2xx status codes ([#438](https://github.com/hugomrdias/iso-repo/issues/438)) ([b30218c](https://github.com/hugomrdias/iso-repo/commit/b30218c26d623886592c85ff40d0b030d2358d3f))

## [2.0.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.4.3...iso-web-v2.0.0) (2025-11-25)


### ⚠ BREAKING CHANGES

* msw api changed

### Features

* msw api changed ([b85e5f7](https://github.com/hugomrdias/iso-repo/commit/b85e5f777091a60457aaa6f981c5e9b6aec56814))

## [1.4.3](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.4.2...iso-web-v1.4.3) (2025-11-12)


### Bug Fixes

* fix json fetch options ([abc30a1](https://github.com/hugomrdias/iso-repo/commit/abc30a1e9b45011804fd9481a7d90192ae428dce))

## [1.4.2](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.4.1...iso-web-v1.4.2) (2025-10-22)


### Bug Fixes

* improve retry logic and error handling in request tests ([204cf6a](https://github.com/hugomrdias/iso-repo/commit/204cf6a790fbaedea1e869f8324ee8d1ee227bc4))
* refine retry logic in request function ([9b5817a](https://github.com/hugomrdias/iso-repo/commit/9b5817ade1a897836dfb6ce624ff3308ccaf43f8))

## [1.4.1](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.4.0...iso-web-v1.4.1) (2025-10-22)


### Bug Fixes

* enhance request timeout and retry options ([4985e86](https://github.com/hugomrdias/iso-repo/commit/4985e862e19cecc480196928469b7de077c8fbcb))

## [1.4.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.3.0...iso-web-v1.4.0) (2025-09-19)


### Features

* **iso-web:** add shoudlRetry option, update p-retry to v7.0.0 and remove RetryError class ([a2256ad](https://github.com/hugomrdias/iso-repo/commit/a2256ad76302fd681cd634b410c238fa47ceac99))

## [1.3.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.2.0...iso-web-v1.3.0) (2025-08-27)


### Features

* update to ts 5.9 ([e1012fb](https://github.com/hugomrdias/iso-repo/commit/e1012fb008ae79d921c36df9e5faae4131fdfd93))

## [1.2.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.1.1...iso-web-v1.2.0) (2025-08-26)


### Features

* enhance request function with onResponse hook and retry options ([9d78bd2](https://github.com/hugomrdias/iso-repo/commit/9d78bd2c3deb60d6bc2b47e03b2a1fc61650e7a1))

## [1.1.1](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.1.0...iso-web-v1.1.1) (2025-03-28)


### Bug Fixes

* dnslink for empty result ([89570a4](https://github.com/hugomrdias/iso-repo/commit/89570a4f79d874b24628251e81366a7ac22d58bd))

## [1.1.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.0.6...iso-web-v1.1.0) (2025-02-10)


### Features

* add typed event target ([b15e299](https://github.com/hugomrdias/iso-repo/commit/b15e2996f89f163e137083d8a55ff84783f2e217))


### Bug Fixes

* move a type error throw into MaybeResult ([cc66a47](https://github.com/hugomrdias/iso-repo/commit/cc66a4771316edf2be46ee12f31702d52c0afff8))

## [1.0.6](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.0.5...iso-web-v1.0.6) (2024-05-16)


### Bug Fixes

* update readme and descriptions ([5c9c2cc](https://github.com/hugomrdias/iso-repo/commit/5c9c2cca303efa513be94a45ff10e5e5b9ea4a06))

## [1.0.5](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.0.4...iso-web-v1.0.5) (2024-03-25)


### Bug Fixes

* support generic result from doh resolve ([0a0ebaa](https://github.com/hugomrdias/iso-repo/commit/0a0ebaaa15637c3daec7c2dec9b789c4ccd17f15))

## [1.0.4](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.0.3...iso-web-v1.0.4) (2024-02-05)


### Bug Fixes

* update doh to new iso-kv ttl in seconds ([6023226](https://github.com/hugomrdias/iso-repo/commit/6023226bfe6d27a299defe65b3e87c99831436f0))

## [1.0.3](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.0.2...iso-web-v1.0.3) (2024-02-04)


### Bug Fixes

* updated iso-kv types ([6689622](https://github.com/hugomrdias/iso-repo/commit/66896222f01c81c2d7eebc973c307deba53272a4))

## [1.0.2](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.0.1...iso-web-v1.0.2) (2024-01-31)


### Bug Fixes

* fix doh exports ([db92f55](https://github.com/hugomrdias/iso-repo/commit/db92f55ac4d3f387f641d6a72eb63f74755fa6dc))
* relax http json parsing ([cfd33df](https://github.com/hugomrdias/iso-repo/commit/cfd33df20a50a9c5d3f922a64b2d65074fe7155c))

## [1.0.1](https://github.com/hugomrdias/iso-repo/compare/iso-web-v1.0.0...iso-web-v1.0.1) (2024-01-30)


### Bug Fixes

* add delay to deps ([08292c2](https://github.com/hugomrdias/iso-repo/commit/08292c2867af32cc8afc40cf19ed2fa9a42a88c3))

## [1.0.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v0.3.3...iso-web-v1.0.0) (2024-01-30)


### ⚠ BREAKING CHANGES

* request returns response directly, has http verb method and json method

### Features

* request returns response directly, has http verb method and json method ([a2d97eb](https://github.com/hugomrdias/iso-repo/commit/a2d97ebc6b35d40e3aaf716c2ff48bb1b5738b51))

## [0.3.3](https://github.com/hugomrdias/iso-repo/compare/iso-web-v0.3.2...iso-web-v0.3.3) (2024-01-17)


### Bug Fixes

* more docs ([f92b7e2](https://github.com/hugomrdias/iso-repo/commit/f92b7e26fac5e2594b6ce32797c2a33a0d66f024))

## [0.3.2](https://github.com/hugomrdias/iso-repo/compare/iso-web-v0.3.1...iso-web-v0.3.2) (2024-01-17)


### Bug Fixes

* export doh and msw ([37f843e](https://github.com/hugomrdias/iso-repo/commit/37f843ec6750af4609044af4790bce7861b11bae))

## [0.3.1](https://github.com/hugomrdias/iso-repo/compare/iso-web-v0.3.0...iso-web-v0.3.1) (2023-12-21)


### Bug Fixes

* export types ([93aa0a4](https://github.com/hugomrdias/iso-repo/commit/93aa0a409493bb01fc15b981a19822b416785dc6))

## [0.3.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v0.2.0...iso-web-v0.3.0) (2023-12-15)


### Features

* updare msw to 2.0 ([fa934ae](https://github.com/hugomrdias/iso-repo/commit/fa934ae9d4d1f81dc74f15ada04dbe3621b38be4))

## [0.2.0](https://github.com/hugomrdias/iso-repo/compare/iso-web-v0.1.5...iso-web-v0.2.0) (2023-10-31)


### Features

* doh and dnslink ([d6cd9a1](https://github.com/hugomrdias/iso-repo/commit/d6cd9a1fa3fe160114fdb8904f0b2d6655b751a0))
* request, doh and msw ([3b779d3](https://github.com/hugomrdias/iso-repo/commit/3b779d3dd105f0bf6de6a5b454eea83078046f52))
* websocket client ([d16b624](https://github.com/hugomrdias/iso-repo/commit/d16b624a5d1b560e2756816f9b298ed2ac067b59))


### Bug Fixes

* export and docs for http and doh ([831fc22](https://github.com/hugomrdias/iso-repo/commit/831fc227304474b784e34c75f83de40a7d7ed758))
* export dnslink and doh ([f6fcf39](https://github.com/hugomrdias/iso-repo/commit/f6fcf3905dfd9b65c4b3b1983e0ac5d1230b161f))
* use seconds for ttl ([76fcce5](https://github.com/hugomrdias/iso-repo/commit/76fcce5643bfa2f53c7cc0fa90770d7437f60b4d))

## [0.1.5](https://github.com/hugomrdias/iso-repo/compare/iso-web-v0.0.1...iso-web-v0.1.5) (2023-09-05)


### Features

* iso-web supports signals and crypto ([0a0da99](https://github.com/hugomrdias/iso-repo/commit/0a0da99c4eb59325fc65329fccab345c6777300e))


### Bug Fixes

* suport undefined in signals iterable type ([51b861e](https://github.com/hugomrdias/iso-repo/commit/51b861e0478a0b84a89e9cead03c263839718bca))
* update deps ([1e0e7ef](https://github.com/hugomrdias/iso-repo/commit/1e0e7ef49e0d48719672129d8aff5c4ddd225ad8))


### Miscellaneous Chores

* **main:** release iso-base 0.1.5 ([3849a49](https://github.com/hugomrdias/iso-repo/commit/3849a49eb867fbdaf3ed95173144b448d4a42f4c))
