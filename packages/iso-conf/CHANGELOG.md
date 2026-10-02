# Changelog

## [0.4.2](https://github.com/hugomrdias/iso-repo/compare/iso-conf-v0.4.1...iso-conf-v0.4.2) (2026-10-02)


### Bug Fixes

* **iso-conf:** write config atomically without installing signal handlers ([#657](https://github.com/hugomrdias/iso-repo/issues/657)) ([93f1015](https://github.com/hugomrdias/iso-repo/commit/93f1015e81dfa191383d7ed77e86f73a933c2521)), closes [#656](https://github.com/hugomrdias/iso-repo/issues/656)

## [0.4.1](https://github.com/hugomrdias/iso-repo/compare/iso-conf-v0.4.0...iso-conf-v0.4.1) (2026-09-27)


### Bug Fixes

* **iso-conf:** cancel pending change on close and handle watcher errors ([#571](https://github.com/hugomrdias/iso-repo/issues/571)) ([248c761](https://github.com/hugomrdias/iso-repo/commit/248c761fbd802b63b46eb2a303188c5f92be6a06))
* **iso-conf:** clear config on any deserialize or validation error ([#569](https://github.com/hugomrdias/iso-repo/issues/569)) ([0db23fd](https://github.com/hugomrdias/iso-repo/commit/0db23fd4939c0e55dc29fe9dfdc547c636722fa9)), closes [#555](https://github.com/hugomrdias/iso-repo/issues/555)
* **iso-conf:** dispatch listener and watch read errors instead of crashing ([#572](https://github.com/hugomrdias/iso-repo/issues/572)) ([f74d3ec](https://github.com/hugomrdias/iso-repo/commit/f74d3ec1cd70befb3c3356c5d80112a41aa479e0)), closes [#551](https://github.com/hugomrdias/iso-repo/issues/551)
* **iso-conf:** omit trailing dot for empty fileExtension ([#573](https://github.com/hugomrdias/iso-repo/issues/573)) ([34219bf](https://github.com/hugomrdias/iso-repo/commit/34219bfeb95bd39b78305e90614c4a981645eafc))
* **iso-conf:** persist normalised schema output on init ([#566](https://github.com/hugomrdias/iso-repo/issues/566)) ([20c4ca3](https://github.com/hugomrdias/iso-repo/commit/20c4ca3af9922999da1d9e967491e95b4509983f)), closes [#559](https://github.com/hugomrdias/iso-repo/issues/559)
* **iso-conf:** read the store once per operation and per change event ([#568](https://github.com/hugomrdias/iso-repo/issues/568)) ([3c14596](https://github.com/hugomrdias/iso-repo/commit/3c14596b41dea3d23d91972289706c101c22c966))
* **iso-conf:** reject null and array keys in set() ([#574](https://github.com/hugomrdias/iso-repo/issues/574)) ([ffa5285](https://github.com/hugomrdias/iso-repo/commit/ffa52850ba178e2cf51206edbc269f7f08886ca8))

## [0.4.0](https://github.com/hugomrdias/iso-repo/compare/iso-conf-v0.3.0...iso-conf-v0.4.0) (2026-06-15)


### Features

* **string:** add kebabCase function for string formatting ([58d60be](https://github.com/hugomrdias/iso-repo/commit/58d60be6bcd6115a80ca72e1ac1f165390bdd9cd))

## [0.3.0](https://github.com/hugomrdias/iso-repo/compare/iso-conf-v0.2.0...iso-conf-v0.3.0) (2026-06-12)


### Features

* **types:** enhance type definitions for configuration schema ([c1acfa4](https://github.com/hugomrdias/iso-repo/commit/c1acfa4f98c5fc372027005f6fe8691eb9fdaadd))

## [0.2.0](https://github.com/hugomrdias/iso-repo/compare/iso-conf-v0.1.0...iso-conf-v0.2.0) (2026-05-29)


### Features

* **iso-base:** add shared extended JSON serializer ([d570beb](https://github.com/hugomrdias/iso-repo/commit/d570beb2c6551f4ff40956aae084ed7112bcc1c7))
* **iso-conf:** add config package with Standard Schema validation ([b79b5d0](https://github.com/hugomrdias/iso-repo/commit/b79b5d0e1b911e699e9e71342e9d023ab92eeabd))
