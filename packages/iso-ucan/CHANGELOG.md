# Changelog

## [2.0.0](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v1.0.0...iso-ucan-v2.0.0) (2026-10-01)


### ⚠ BREAKING CHANGES

* **iso-ucan:** newly created delegations and invocations use the `ucan/dlg@1.0.0` / `ucan/inv@1.0.0` payload tags, so their bytes and CIDs differ from what iso-ucan <= 1.0.0 produced for the same payload. Tokens tagged `@1.0.0-rc.1` are still accepted on decode and keep their original CIDs. Envelopes with any other version, an unknown spec, a non DAG-CBOR varsig encoding or a malformed shape are now rejected.

### Bug Fixes

* **iso-ucan:** check proof CIDs against prf and align invocation payload validation with spec ([#650](https://github.com/hugomrdias/iso-repo/issues/650)) ([ee10995](https://github.com/hugomrdias/iso-repo/commit/ee10995063274984d0c22ef2758e0b3fab6e9d7f))
* **iso-ucan:** emit ucan/{dlg,inv}[@1](https://github.com/1).0.0 payload tags and validate envelopes on decode ([#649](https://github.com/hugomrdias/iso-repo/issues/649)) ([4b1137d](https://github.com/hugomrdias/iso-repo/commit/4b1137df8e1634d32c202519b6717d4afdfbebed))
* **iso-ucan:** rewrite policy selector parser and evaluator to match spec ([#651](https://github.com/hugomrdias/iso-repo/issues/651)) ([c116987](https://github.com/hugomrdias/iso-repo/commit/c11698713249b787bf94254bb7f06192c380b2fa)), closes [#641](https://github.com/hugomrdias/iso-repo/issues/641) [#644](https://github.com/hugomrdias/iso-repo/issues/644) [#642](https://github.com/hugomrdias/iso-repo/issues/642) [#645](https://github.com/hugomrdias/iso-repo/issues/645)

## [1.0.0](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.5.2...iso-ucan-v1.0.0) (2026-09-30)


### ⚠ BREAKING CHANGES

* **iso-ucan:** invocations with `aud` equal to `sub` are rejected. Every invocation created by iso-ucan <= 0.5.2 has this shape, including all RPC client requests, so clients must upgrade alongside servers.

### Bug Fixes

* **iso-ucan:** omit invocation aud when it equals sub and check receiver against aud ([#637](https://github.com/hugomrdias/iso-repo/issues/637)) ([a0b39fd](https://github.com/hugomrdias/iso-repo/commit/a0b39fd2d52070b0d34fdd670992e29f96775b3f))

## [0.5.2](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.5.1...iso-ucan-v0.5.2) (2026-09-30)


### Bug Fixes

* **iso-ucan:** check isRevoked against every equivalent signature encoding ([ea7b212](https://github.com/hugomrdias/iso-repo/commit/ea7b2126f26f98e1761de2d48e8c2900108d9011))
* **iso-ucan:** reject replayed invocations ([6299177](https://github.com/hugomrdias/iso-repo/commit/6299177a53841447fe549d3f9771dfbd2fc330e8))

## [0.5.1](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.5.0...iso-ucan-v0.5.1) (2026-09-30)


### Bug Fixes

* **iso-ucan:** compare commands by path segment when checking proof attenuation ([#629](https://github.com/hugomrdias/iso-repo/issues/629)) ([72868a0](https://github.com/hugomrdias/iso-repo/commit/72868a09a113c416da29563a0059a2b9ab76cfcf))

## [0.5.0](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.4.2...iso-ucan-v0.5.0) (2026-04-19)


### Features

* add RPC layer with protocol definition and example usage ([2db3500](https://github.com/hugomrdias/iso-repo/commit/2db3500030dc198185247b8e47a05de9795f17c6))
* restructure RPC module and remove deprecated client/server files ([2f4104e](https://github.com/hugomrdias/iso-repo/commit/2f4104e1269527c7d729924a56d76842cf0f2ae9))
* update proof assertion logic and enhance chain resolution in store ([eede4dc](https://github.com/hugomrdias/iso-repo/commit/eede4dc591516ca50241db5312ffca3667af7c71))


### Bug Fixes

* add spec invocation fixtures to the tests ([0621d9a](https://github.com/hugomrdias/iso-repo/commit/0621d9a6eb961010865bf1e450d69f3f7ee70b3f))
* refine TypeScript error handling and update test cases across multiple packages ([4012b85](https://github.com/hugomrdias/iso-repo/commit/4012b8537370ac86908df4825acf30964393f6e8))
* replace base64pad with base64 in delegation module ([3bf3b2c](https://github.com/hugomrdias/iso-repo/commit/3bf3b2cd47ec83e9e5992e5c93a140401c3be9f8))

## [0.4.2](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.4.1...iso-ucan-v0.4.2) (2025-11-12)


### Bug Fixes

* update zod ([b4f2aba](https://github.com/hugomrdias/iso-repo/commit/b4f2aba1a1cb953548cf364457404ca591ca4cf9))

## [0.4.1](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.4.0...iso-ucan-v0.4.1) (2025-09-29)


### Bug Fixes

* replace BufferSource with Uint8Array in type definitions and function parameters ([09a2277](https://github.com/hugomrdias/iso-repo/commit/09a2277ee5587091bb1b7152d479c1a608ef0d82))

## [0.4.0](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.3.0...iso-ucan-v0.4.0) (2025-08-27)


### Features

* update to ts 5.9 ([68cfb3b](https://github.com/hugomrdias/iso-repo/commit/68cfb3b3ddfea1ed88a21f002f3db551bacc97bb))

## [0.3.0](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.2.1...iso-ucan-v0.3.0) (2025-08-13)


### Features

* **iso-ucan:** add delegation creation and validation methods ([f81ab7b](https://github.com/hugomrdias/iso-repo/commit/f81ab7b08ce4517a790eeddc0b9a8384f257354c))
* wired policy validation ([cd317bb](https://github.com/hugomrdias/iso-repo/commit/cd317bb865931d579937bd101c84b903c1fcd2dc))


### Bug Fixes

* zod ([a7640af](https://github.com/hugomrdias/iso-repo/commit/a7640afbd2a7d149e16ff85271997415f4782765))

## [0.2.1](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.2.0...iso-ucan-v0.2.1) (2025-07-28)


### Bug Fixes

* **iso-ucan:** correct signature payload validation logic in decodeSignaturePayload ([db8bd18](https://github.com/hugomrdias/iso-repo/commit/db8bd18c6dd94605db1aa4c536d0ade37caaa07c))

## [0.2.0](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.1.6...iso-ucan-v0.2.0) (2025-07-28)


### Features

* **iso-ucan:** enhance envelope functionality with signature payload handling ([863fd43](https://github.com/hugomrdias/iso-repo/commit/863fd438d793b362620cefb3220591e35e7a56d2))


### Bug Fixes

* **iso-ucan:** return signature payload directly in getSignaturePayload ([16eb072](https://github.com/hugomrdias/iso-repo/commit/16eb072f562ce5e401116dcd17f37fe998c0f72c))

## [0.1.6](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.1.5...iso-ucan-v0.1.6) (2025-07-25)


### Bug Fixes

* **iso-ucan:** update package.json and tsconfig.json for improved type definitions and include test files ([f4c1218](https://github.com/hugomrdias/iso-repo/commit/f4c1218aebdc64c169d4163f9694d76081382b24))

## [0.1.5](https://github.com/hugomrdias/iso-repo/compare/iso-ucan-v0.0.1...iso-ucan-v0.1.5) (2025-07-23)


### Features

* add server, client, and policy types; refactor capability and delegation ([ded9771](https://github.com/hugomrdias/iso-repo/commit/ded97717a43d42cc5dd889ee219986e042e7c3f7))


### Bug Fixes

* change server.ts to server.js ([e3c3bcf](https://github.com/hugomrdias/iso-repo/commit/e3c3bcf444051a5306ff2d4b4d86a8f24501c2d4))
* **iso-ucan:** initial commit ([ded8355](https://github.com/hugomrdias/iso-repo/commit/ded83558f550e175814819bbdbdc9656662013a7))
* policy and proofs ([e548cfc](https://github.com/hugomrdias/iso-repo/commit/e548cfc60ead34f72df75c4d7776f9313b1bbeb3))
* policy and proofs add files ([608ff1b](https://github.com/hugomrdias/iso-repo/commit/608ff1bc5e885f3394be768baf551459f3890d90))
* update audience property in createClient function ([00ffdfb](https://github.com/hugomrdias/iso-repo/commit/00ffdfbbab92516bad5b7136098035e0e8137849))


### Miscellaneous Chores

* **main:** release iso-base 0.1.5 ([3849a49](https://github.com/hugomrdias/iso-repo/commit/3849a49eb867fbdaf3ed95173144b448d4a42f4c))
