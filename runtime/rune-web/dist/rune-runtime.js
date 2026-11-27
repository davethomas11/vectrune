/* Leaflet license:
BSD 2-Clause License

Copyright (c) 2010-2023, Volodymyr Agafonkin
Copyright (c) 2010-2011, CloudMade
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/
"use strict";
var __RuneWeb = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key2, value) => key2 in obj ? __defProp(obj, key2, { enumerable: true, configurable: true, writable: true, value }) : obj[key2] = value;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name2 in all)
      __defProp(target, name2, { get: all[name2], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key2, value) => __defNormalProp(obj, typeof key2 !== "symbol" ? key2 + "" : key2, value);

  // node_modules/@msgpack/msgpack/dist.esm/utils/utf8.mjs
  function utf8Count(str) {
    const strLength = str.length;
    let byteLength = 0;
    let pos = 0;
    while (pos < strLength) {
      let value = str.charCodeAt(pos++);
      if ((value & 4294967168) === 0) {
        byteLength++;
        continue;
      } else if ((value & 4294965248) === 0) {
        byteLength += 2;
      } else {
        if (value >= 55296 && value <= 56319) {
          if (pos < strLength) {
            const extra = str.charCodeAt(pos);
            if ((extra & 64512) === 56320) {
              ++pos;
              value = ((value & 1023) << 10) + (extra & 1023) + 65536;
            }
          }
        }
        if ((value & 4294901760) === 0) {
          byteLength += 3;
        } else {
          byteLength += 4;
        }
      }
    }
    return byteLength;
  }
  function utf8EncodeJs(str, output, outputOffset) {
    const strLength = str.length;
    let offset = outputOffset;
    let pos = 0;
    while (pos < strLength) {
      let value = str.charCodeAt(pos++);
      if ((value & 4294967168) === 0) {
        output[offset++] = value;
        continue;
      } else if ((value & 4294965248) === 0) {
        output[offset++] = value >> 6 & 31 | 192;
      } else {
        if (value >= 55296 && value <= 56319) {
          if (pos < strLength) {
            const extra = str.charCodeAt(pos);
            if ((extra & 64512) === 56320) {
              ++pos;
              value = ((value & 1023) << 10) + (extra & 1023) + 65536;
            }
          }
        }
        if ((value & 4294901760) === 0) {
          output[offset++] = value >> 12 & 15 | 224;
          output[offset++] = value >> 6 & 63 | 128;
        } else {
          output[offset++] = value >> 18 & 7 | 240;
          output[offset++] = value >> 12 & 63 | 128;
          output[offset++] = value >> 6 & 63 | 128;
        }
      }
      output[offset++] = value & 63 | 128;
    }
  }
  function utf8EncodeTE(str, output, outputOffset) {
    sharedTextEncoder.encodeInto(str, output.subarray(outputOffset));
  }
  function utf8Encode(str, output, outputOffset) {
    if (str.length > TEXT_ENCODER_THRESHOLD) {
      utf8EncodeTE(str, output, outputOffset);
    } else {
      utf8EncodeJs(str, output, outputOffset);
    }
  }
  function utf8DecodeJs(bytes, inputOffset, byteLength) {
    let offset = inputOffset;
    const end = offset + byteLength;
    const units = [];
    let result = "";
    while (offset < end) {
      const byte1 = bytes[offset++];
      if ((byte1 & 128) === 0) {
        units.push(byte1);
      } else if ((byte1 & 224) === 192) {
        const byte2 = bytes[offset++] & 63;
        units.push((byte1 & 31) << 6 | byte2);
      } else if ((byte1 & 240) === 224) {
        const byte2 = bytes[offset++] & 63;
        const byte3 = bytes[offset++] & 63;
        units.push((byte1 & 31) << 12 | byte2 << 6 | byte3);
      } else if ((byte1 & 248) === 240) {
        const byte2 = bytes[offset++] & 63;
        const byte3 = bytes[offset++] & 63;
        const byte4 = bytes[offset++] & 63;
        let unit = (byte1 & 7) << 18 | byte2 << 12 | byte3 << 6 | byte4;
        if (unit > 65535) {
          unit -= 65536;
          units.push(unit >>> 10 & 1023 | 55296);
          unit = 56320 | unit & 1023;
        }
        units.push(unit);
      } else {
        units.push(byte1);
      }
      if (units.length >= CHUNK_SIZE) {
        result += String.fromCharCode(...units);
        units.length = 0;
      }
    }
    if (units.length > 0) {
      result += String.fromCharCode(...units);
    }
    return result;
  }
  function utf8DecodeTD(bytes, inputOffset, byteLength) {
    const stringBytes = bytes.subarray(inputOffset, inputOffset + byteLength);
    return sharedTextDecoder.decode(stringBytes);
  }
  function utf8Decode(bytes, inputOffset, byteLength) {
    if (byteLength > TEXT_DECODER_THRESHOLD) {
      return utf8DecodeTD(bytes, inputOffset, byteLength);
    } else {
      return utf8DecodeJs(bytes, inputOffset, byteLength);
    }
  }
  var sharedTextEncoder, TEXT_ENCODER_THRESHOLD, CHUNK_SIZE, sharedTextDecoder, TEXT_DECODER_THRESHOLD;
  var init_utf8 = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/utils/utf8.mjs"() {
      sharedTextEncoder = new TextEncoder();
      TEXT_ENCODER_THRESHOLD = 50;
      CHUNK_SIZE = 4096;
      sharedTextDecoder = new TextDecoder();
      TEXT_DECODER_THRESHOLD = 200;
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/ExtData.mjs
  var ExtData;
  var init_ExtData = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/ExtData.mjs"() {
      ExtData = class {
        constructor(type, data) {
          __publicField(this, "type");
          __publicField(this, "data");
          this.type = type;
          this.data = data;
        }
      };
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/DecodeError.mjs
  var DecodeError;
  var init_DecodeError = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/DecodeError.mjs"() {
      DecodeError = class _DecodeError extends Error {
        constructor(message) {
          super(message);
          const proto = Object.create(_DecodeError.prototype);
          Object.setPrototypeOf(this, proto);
          Object.defineProperty(this, "name", {
            configurable: true,
            enumerable: false,
            value: _DecodeError.name
          });
        }
      };
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/utils/int.mjs
  function setUint64(view, offset, value) {
    const high = value / 4294967296;
    const low = value;
    view.setUint32(offset, high);
    view.setUint32(offset + 4, low);
  }
  function setInt64(view, offset, value) {
    const high = Math.floor(value / 4294967296);
    const low = value;
    view.setUint32(offset, high);
    view.setUint32(offset + 4, low);
  }
  function getInt64(view, offset) {
    const high = view.getInt32(offset);
    const low = view.getUint32(offset + 4);
    return high * 4294967296 + low;
  }
  function getUint64(view, offset) {
    const high = view.getUint32(offset);
    const low = view.getUint32(offset + 4);
    return high * 4294967296 + low;
  }
  var UINT32_MAX;
  var init_int = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/utils/int.mjs"() {
      UINT32_MAX = 4294967295;
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/timestamp.mjs
  function encodeTimeSpecToTimestamp({ sec, nsec }) {
    if (sec >= 0 && nsec >= 0 && sec <= TIMESTAMP64_MAX_SEC) {
      if (nsec === 0 && sec <= TIMESTAMP32_MAX_SEC) {
        const rv = new Uint8Array(4);
        const view = new DataView(rv.buffer);
        view.setUint32(0, sec);
        return rv;
      } else {
        const secHigh = sec / 4294967296;
        const secLow = sec & 4294967295;
        const rv = new Uint8Array(8);
        const view = new DataView(rv.buffer);
        view.setUint32(0, nsec << 2 | secHigh & 3);
        view.setUint32(4, secLow);
        return rv;
      }
    } else {
      const rv = new Uint8Array(12);
      const view = new DataView(rv.buffer);
      view.setUint32(0, nsec);
      setInt64(view, 4, sec);
      return rv;
    }
  }
  function encodeDateToTimeSpec(date) {
    const msec = date.getTime();
    const sec = Math.floor(msec / 1e3);
    const nsec = (msec - sec * 1e3) * 1e6;
    const nsecInSec = Math.floor(nsec / 1e9);
    return {
      sec: sec + nsecInSec,
      nsec: nsec - nsecInSec * 1e9
    };
  }
  function encodeTimestampExtension(object) {
    if (object instanceof Date) {
      const timeSpec = encodeDateToTimeSpec(object);
      return encodeTimeSpecToTimestamp(timeSpec);
    } else {
      return null;
    }
  }
  function decodeTimestampToTimeSpec(data) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    switch (data.byteLength) {
      case 4: {
        const sec = view.getUint32(0);
        const nsec = 0;
        return { sec, nsec };
      }
      case 8: {
        const nsec30AndSecHigh2 = view.getUint32(0);
        const secLow32 = view.getUint32(4);
        const sec = (nsec30AndSecHigh2 & 3) * 4294967296 + secLow32;
        const nsec = nsec30AndSecHigh2 >>> 2;
        return { sec, nsec };
      }
      case 12: {
        const sec = getInt64(view, 4);
        const nsec = view.getUint32(0);
        return { sec, nsec };
      }
      default:
        throw new DecodeError(`Unrecognized data size for timestamp (expected 4, 8, or 12): ${data.length}`);
    }
  }
  function decodeTimestampExtension(data) {
    const timeSpec = decodeTimestampToTimeSpec(data);
    return new Date(timeSpec.sec * 1e3 + timeSpec.nsec / 1e6);
  }
  var EXT_TIMESTAMP, TIMESTAMP32_MAX_SEC, TIMESTAMP64_MAX_SEC, timestampExtension;
  var init_timestamp = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/timestamp.mjs"() {
      init_DecodeError();
      init_int();
      EXT_TIMESTAMP = -1;
      TIMESTAMP32_MAX_SEC = 4294967296 - 1;
      TIMESTAMP64_MAX_SEC = 17179869184 - 1;
      timestampExtension = {
        type: EXT_TIMESTAMP,
        encode: encodeTimestampExtension,
        decode: decodeTimestampExtension
      };
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/ExtensionCodec.mjs
  var _ExtensionCodec, ExtensionCodec;
  var init_ExtensionCodec = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/ExtensionCodec.mjs"() {
      init_ExtData();
      init_timestamp();
      _ExtensionCodec = class _ExtensionCodec {
        constructor() {
          // ensures ExtensionCodecType<X> matches ExtensionCodec<X>
          // this will make type errors a lot more clear
          // eslint-disable-next-line @typescript-eslint/naming-convention
          __publicField(this, "__brand");
          // built-in extensions
          __publicField(this, "builtInEncoders", []);
          __publicField(this, "builtInDecoders", []);
          // custom extensions
          __publicField(this, "encoders", []);
          __publicField(this, "decoders", []);
          this.register(timestampExtension);
        }
        register({ type, encode: encode3, decode: decode3 }) {
          if (type >= 0) {
            this.encoders[type] = encode3;
            this.decoders[type] = decode3;
          } else {
            const index2 = -1 - type;
            this.builtInEncoders[index2] = encode3;
            this.builtInDecoders[index2] = decode3;
          }
        }
        tryToEncode(object, context) {
          for (let i = 0; i < this.builtInEncoders.length; i++) {
            const encodeExt = this.builtInEncoders[i];
            if (encodeExt != null) {
              const data = encodeExt(object, context);
              if (data != null) {
                const type = -1 - i;
                return new ExtData(type, data);
              }
            }
          }
          for (let i = 0; i < this.encoders.length; i++) {
            const encodeExt = this.encoders[i];
            if (encodeExt != null) {
              const data = encodeExt(object, context);
              if (data != null) {
                const type = i;
                return new ExtData(type, data);
              }
            }
          }
          if (object instanceof ExtData) {
            return object;
          }
          return null;
        }
        decode(data, type, context) {
          const decodeExt = type < 0 ? this.builtInDecoders[-1 - type] : this.decoders[type];
          if (decodeExt) {
            return decodeExt(data, type, context);
          } else {
            return new ExtData(type, data);
          }
        }
      };
      __publicField(_ExtensionCodec, "defaultCodec", new _ExtensionCodec());
      ExtensionCodec = _ExtensionCodec;
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/utils/typedArrays.mjs
  function isArrayBufferLike(buffer) {
    return buffer instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer;
  }
  function ensureUint8Array(buffer) {
    if (buffer instanceof Uint8Array) {
      return buffer;
    } else if (ArrayBuffer.isView(buffer)) {
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else if (isArrayBufferLike(buffer)) {
      return new Uint8Array(buffer);
    } else {
      return Uint8Array.from(buffer);
    }
  }
  var init_typedArrays = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/utils/typedArrays.mjs"() {
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/Encoder.mjs
  var DEFAULT_MAX_DEPTH, DEFAULT_INITIAL_BUFFER_SIZE, Encoder;
  var init_Encoder = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/Encoder.mjs"() {
      init_utf8();
      init_ExtensionCodec();
      init_int();
      init_typedArrays();
      DEFAULT_MAX_DEPTH = 100;
      DEFAULT_INITIAL_BUFFER_SIZE = 2048;
      Encoder = class _Encoder {
        constructor(options) {
          __publicField(this, "extensionCodec");
          __publicField(this, "context");
          __publicField(this, "useBigInt64");
          __publicField(this, "maxDepth");
          __publicField(this, "initialBufferSize");
          __publicField(this, "sortKeys");
          __publicField(this, "forceFloat32");
          __publicField(this, "ignoreUndefined");
          __publicField(this, "forceIntegerToFloat");
          __publicField(this, "pos");
          __publicField(this, "view");
          __publicField(this, "bytes");
          __publicField(this, "entered", false);
          this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
          this.context = options?.context;
          this.useBigInt64 = options?.useBigInt64 ?? false;
          this.maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
          this.initialBufferSize = options?.initialBufferSize ?? DEFAULT_INITIAL_BUFFER_SIZE;
          this.sortKeys = options?.sortKeys ?? false;
          this.forceFloat32 = options?.forceFloat32 ?? false;
          this.ignoreUndefined = options?.ignoreUndefined ?? false;
          this.forceIntegerToFloat = options?.forceIntegerToFloat ?? false;
          this.pos = 0;
          this.view = new DataView(new ArrayBuffer(this.initialBufferSize));
          this.bytes = new Uint8Array(this.view.buffer);
        }
        clone() {
          return new _Encoder({
            extensionCodec: this.extensionCodec,
            context: this.context,
            useBigInt64: this.useBigInt64,
            maxDepth: this.maxDepth,
            initialBufferSize: this.initialBufferSize,
            sortKeys: this.sortKeys,
            forceFloat32: this.forceFloat32,
            ignoreUndefined: this.ignoreUndefined,
            forceIntegerToFloat: this.forceIntegerToFloat
          });
        }
        reinitializeState() {
          this.pos = 0;
        }
        /**
         * This is almost equivalent to {@link Encoder#encode}, but it returns an reference of the encoder's internal buffer and thus much faster than {@link Encoder#encode}.
         *
         * @returns Encodes the object and returns a shared reference the encoder's internal buffer.
         */
        encodeSharedRef(object) {
          if (this.entered) {
            const instance = this.clone();
            return instance.encodeSharedRef(object);
          }
          try {
            this.entered = true;
            this.reinitializeState();
            this.doEncode(object, 1);
            return this.bytes.subarray(0, this.pos);
          } finally {
            this.entered = false;
          }
        }
        /**
         * @returns Encodes the object and returns a copy of the encoder's internal buffer.
         */
        encode(object) {
          if (this.entered) {
            const instance = this.clone();
            return instance.encode(object);
          }
          try {
            this.entered = true;
            this.reinitializeState();
            this.doEncode(object, 1);
            return this.bytes.slice(0, this.pos);
          } finally {
            this.entered = false;
          }
        }
        doEncode(object, depth) {
          if (depth > this.maxDepth) {
            throw new Error(`Too deep objects in depth ${depth}`);
          }
          if (object == null) {
            this.encodeNil();
          } else if (typeof object === "boolean") {
            this.encodeBoolean(object);
          } else if (typeof object === "number") {
            if (!this.forceIntegerToFloat) {
              this.encodeNumber(object);
            } else {
              this.encodeNumberAsFloat(object);
            }
          } else if (typeof object === "string") {
            this.encodeString(object);
          } else if (this.useBigInt64 && typeof object === "bigint") {
            this.encodeBigInt64(object);
          } else {
            this.encodeObject(object, depth);
          }
        }
        ensureBufferSizeToWrite(sizeToWrite) {
          const requiredSize = this.pos + sizeToWrite;
          if (this.view.byteLength < requiredSize) {
            this.resizeBuffer(requiredSize * 2);
          }
        }
        resizeBuffer(newSize) {
          const newBuffer = new ArrayBuffer(newSize);
          const newBytes = new Uint8Array(newBuffer);
          const newView = new DataView(newBuffer);
          newBytes.set(this.bytes);
          this.view = newView;
          this.bytes = newBytes;
        }
        encodeNil() {
          this.writeU8(192);
        }
        encodeBoolean(object) {
          if (object === false) {
            this.writeU8(194);
          } else {
            this.writeU8(195);
          }
        }
        encodeNumber(object) {
          if (!this.forceIntegerToFloat && Number.isSafeInteger(object)) {
            if (object >= 0) {
              if (object < 128) {
                this.writeU8(object);
              } else if (object < 256) {
                this.writeU8(204);
                this.writeU8(object);
              } else if (object < 65536) {
                this.writeU8(205);
                this.writeU16(object);
              } else if (object < 4294967296) {
                this.writeU8(206);
                this.writeU32(object);
              } else if (!this.useBigInt64) {
                this.writeU8(207);
                this.writeU64(object);
              } else {
                this.encodeNumberAsFloat(object);
              }
            } else {
              if (object >= -32) {
                this.writeU8(224 | object + 32);
              } else if (object >= -128) {
                this.writeU8(208);
                this.writeI8(object);
              } else if (object >= -32768) {
                this.writeU8(209);
                this.writeI16(object);
              } else if (object >= -2147483648) {
                this.writeU8(210);
                this.writeI32(object);
              } else if (!this.useBigInt64) {
                this.writeU8(211);
                this.writeI64(object);
              } else {
                this.encodeNumberAsFloat(object);
              }
            }
          } else {
            this.encodeNumberAsFloat(object);
          }
        }
        encodeNumberAsFloat(object) {
          if (this.forceFloat32) {
            this.writeU8(202);
            this.writeF32(object);
          } else {
            this.writeU8(203);
            this.writeF64(object);
          }
        }
        encodeBigInt64(object) {
          if (object >= BigInt(0)) {
            this.writeU8(207);
            this.writeBigUint64(object);
          } else {
            this.writeU8(211);
            this.writeBigInt64(object);
          }
        }
        writeStringHeader(byteLength) {
          if (byteLength < 32) {
            this.writeU8(160 + byteLength);
          } else if (byteLength < 256) {
            this.writeU8(217);
            this.writeU8(byteLength);
          } else if (byteLength < 65536) {
            this.writeU8(218);
            this.writeU16(byteLength);
          } else if (byteLength < 4294967296) {
            this.writeU8(219);
            this.writeU32(byteLength);
          } else {
            throw new Error(`Too long string: ${byteLength} bytes in UTF-8`);
          }
        }
        encodeString(object) {
          const maxHeaderSize = 1 + 4;
          const byteLength = utf8Count(object);
          this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
          this.writeStringHeader(byteLength);
          utf8Encode(object, this.bytes, this.pos);
          this.pos += byteLength;
        }
        encodeObject(object, depth) {
          const ext = this.extensionCodec.tryToEncode(object, this.context);
          if (ext != null) {
            this.encodeExtension(ext);
          } else if (Array.isArray(object)) {
            this.encodeArray(object, depth);
          } else if (ArrayBuffer.isView(object)) {
            this.encodeBinary(object);
          } else if (typeof object === "object") {
            this.encodeMap(object, depth);
          } else {
            throw new Error(`Unrecognized object: ${Object.prototype.toString.apply(object)}`);
          }
        }
        encodeBinary(object) {
          const size = object.byteLength;
          if (size < 256) {
            this.writeU8(196);
            this.writeU8(size);
          } else if (size < 65536) {
            this.writeU8(197);
            this.writeU16(size);
          } else if (size < 4294967296) {
            this.writeU8(198);
            this.writeU32(size);
          } else {
            throw new Error(`Too large binary: ${size}`);
          }
          const bytes = ensureUint8Array(object);
          this.writeU8a(bytes);
        }
        encodeArray(object, depth) {
          const size = object.length;
          if (size < 16) {
            this.writeU8(144 + size);
          } else if (size < 65536) {
            this.writeU8(220);
            this.writeU16(size);
          } else if (size < 4294967296) {
            this.writeU8(221);
            this.writeU32(size);
          } else {
            throw new Error(`Too large array: ${size}`);
          }
          for (const item of object) {
            this.doEncode(item, depth + 1);
          }
        }
        countWithoutUndefined(object, keys) {
          let count = 0;
          for (const key2 of keys) {
            if (object[key2] !== void 0) {
              count++;
            }
          }
          return count;
        }
        encodeMap(object, depth) {
          const keys = Object.keys(object);
          if (this.sortKeys) {
            keys.sort();
          }
          const size = this.ignoreUndefined ? this.countWithoutUndefined(object, keys) : keys.length;
          if (size < 16) {
            this.writeU8(128 + size);
          } else if (size < 65536) {
            this.writeU8(222);
            this.writeU16(size);
          } else if (size < 4294967296) {
            this.writeU8(223);
            this.writeU32(size);
          } else {
            throw new Error(`Too large map object: ${size}`);
          }
          for (const key2 of keys) {
            const value = object[key2];
            if (!(this.ignoreUndefined && value === void 0)) {
              this.encodeString(key2);
              this.doEncode(value, depth + 1);
            }
          }
        }
        encodeExtension(ext) {
          if (typeof ext.data === "function") {
            const data = ext.data(this.pos + 6);
            const size2 = data.length;
            if (size2 >= 4294967296) {
              throw new Error(`Too large extension object: ${size2}`);
            }
            this.writeU8(201);
            this.writeU32(size2);
            this.writeI8(ext.type);
            this.writeU8a(data);
            return;
          }
          const size = ext.data.length;
          if (size === 1) {
            this.writeU8(212);
          } else if (size === 2) {
            this.writeU8(213);
          } else if (size === 4) {
            this.writeU8(214);
          } else if (size === 8) {
            this.writeU8(215);
          } else if (size === 16) {
            this.writeU8(216);
          } else if (size < 256) {
            this.writeU8(199);
            this.writeU8(size);
          } else if (size < 65536) {
            this.writeU8(200);
            this.writeU16(size);
          } else if (size < 4294967296) {
            this.writeU8(201);
            this.writeU32(size);
          } else {
            throw new Error(`Too large extension object: ${size}`);
          }
          this.writeI8(ext.type);
          this.writeU8a(ext.data);
        }
        writeU8(value) {
          this.ensureBufferSizeToWrite(1);
          this.view.setUint8(this.pos, value);
          this.pos++;
        }
        writeU8a(values) {
          const size = values.length;
          this.ensureBufferSizeToWrite(size);
          this.bytes.set(values, this.pos);
          this.pos += size;
        }
        writeI8(value) {
          this.ensureBufferSizeToWrite(1);
          this.view.setInt8(this.pos, value);
          this.pos++;
        }
        writeU16(value) {
          this.ensureBufferSizeToWrite(2);
          this.view.setUint16(this.pos, value);
          this.pos += 2;
        }
        writeI16(value) {
          this.ensureBufferSizeToWrite(2);
          this.view.setInt16(this.pos, value);
          this.pos += 2;
        }
        writeU32(value) {
          this.ensureBufferSizeToWrite(4);
          this.view.setUint32(this.pos, value);
          this.pos += 4;
        }
        writeI32(value) {
          this.ensureBufferSizeToWrite(4);
          this.view.setInt32(this.pos, value);
          this.pos += 4;
        }
        writeF32(value) {
          this.ensureBufferSizeToWrite(4);
          this.view.setFloat32(this.pos, value);
          this.pos += 4;
        }
        writeF64(value) {
          this.ensureBufferSizeToWrite(8);
          this.view.setFloat64(this.pos, value);
          this.pos += 8;
        }
        writeU64(value) {
          this.ensureBufferSizeToWrite(8);
          setUint64(this.view, this.pos, value);
          this.pos += 8;
        }
        writeI64(value) {
          this.ensureBufferSizeToWrite(8);
          setInt64(this.view, this.pos, value);
          this.pos += 8;
        }
        writeBigUint64(value) {
          this.ensureBufferSizeToWrite(8);
          this.view.setBigUint64(this.pos, value);
          this.pos += 8;
        }
        writeBigInt64(value) {
          this.ensureBufferSizeToWrite(8);
          this.view.setBigInt64(this.pos, value);
          this.pos += 8;
        }
      };
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/encode.mjs
  function encode(value, options) {
    const encoder = new Encoder(options);
    return encoder.encodeSharedRef(value);
  }
  var init_encode = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/encode.mjs"() {
      init_Encoder();
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/utils/prettyByte.mjs
  function prettyByte(byte) {
    return `${byte < 0 ? "-" : ""}0x${Math.abs(byte).toString(16).padStart(2, "0")}`;
  }
  var init_prettyByte = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/utils/prettyByte.mjs"() {
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/CachedKeyDecoder.mjs
  var DEFAULT_MAX_KEY_LENGTH, DEFAULT_MAX_LENGTH_PER_KEY, CachedKeyDecoder;
  var init_CachedKeyDecoder = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/CachedKeyDecoder.mjs"() {
      init_utf8();
      DEFAULT_MAX_KEY_LENGTH = 16;
      DEFAULT_MAX_LENGTH_PER_KEY = 16;
      CachedKeyDecoder = class {
        constructor(maxKeyLength = DEFAULT_MAX_KEY_LENGTH, maxLengthPerKey = DEFAULT_MAX_LENGTH_PER_KEY) {
          __publicField(this, "hit", 0);
          __publicField(this, "miss", 0);
          __publicField(this, "caches");
          __publicField(this, "maxKeyLength");
          __publicField(this, "maxLengthPerKey");
          this.maxKeyLength = maxKeyLength;
          this.maxLengthPerKey = maxLengthPerKey;
          this.caches = [];
          for (let i = 0; i < this.maxKeyLength; i++) {
            this.caches.push([]);
          }
        }
        canBeCached(byteLength) {
          return byteLength > 0 && byteLength <= this.maxKeyLength;
        }
        find(bytes, inputOffset, byteLength) {
          const records = this.caches[byteLength - 1];
          FIND_CHUNK: for (const record of records) {
            const recordBytes = record.bytes;
            for (let j = 0; j < byteLength; j++) {
              if (recordBytes[j] !== bytes[inputOffset + j]) {
                continue FIND_CHUNK;
              }
            }
            return record.str;
          }
          return null;
        }
        store(bytes, value) {
          const records = this.caches[bytes.length - 1];
          const record = { bytes, str: value };
          if (records.length >= this.maxLengthPerKey) {
            records[Math.random() * records.length | 0] = record;
          } else {
            records.push(record);
          }
        }
        decode(bytes, inputOffset, byteLength) {
          const cachedValue = this.find(bytes, inputOffset, byteLength);
          if (cachedValue != null) {
            this.hit++;
            return cachedValue;
          }
          this.miss++;
          const str = utf8DecodeJs(bytes, inputOffset, byteLength);
          const slicedCopyOfBytes = Uint8Array.prototype.slice.call(bytes, inputOffset, inputOffset + byteLength);
          this.store(slicedCopyOfBytes, str);
          return str;
        }
      };
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/Decoder.mjs
  var STATE_ARRAY, STATE_MAP_KEY, STATE_MAP_VALUE, mapKeyConverter, StackPool, HEAD_BYTE_REQUIRED, EMPTY_VIEW, EMPTY_BYTES, MORE_DATA, sharedCachedKeyDecoder, Decoder;
  var init_Decoder = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/Decoder.mjs"() {
      init_prettyByte();
      init_ExtensionCodec();
      init_int();
      init_utf8();
      init_typedArrays();
      init_CachedKeyDecoder();
      init_DecodeError();
      STATE_ARRAY = "array";
      STATE_MAP_KEY = "map_key";
      STATE_MAP_VALUE = "map_value";
      mapKeyConverter = (key2) => {
        if (typeof key2 === "string" || typeof key2 === "number") {
          return key2;
        }
        throw new DecodeError("The type of key must be string or number but " + typeof key2);
      };
      StackPool = class {
        constructor() {
          __publicField(this, "stack", []);
          __publicField(this, "stackHeadPosition", -1);
        }
        get length() {
          return this.stackHeadPosition + 1;
        }
        top() {
          return this.stack[this.stackHeadPosition];
        }
        pushArrayState(size) {
          const state = this.getUninitializedStateFromPool();
          state.type = STATE_ARRAY;
          state.position = 0;
          state.size = size;
          state.array = new Array(size);
        }
        pushMapState(size) {
          const state = this.getUninitializedStateFromPool();
          state.type = STATE_MAP_KEY;
          state.readCount = 0;
          state.size = size;
          state.map = {};
        }
        getUninitializedStateFromPool() {
          this.stackHeadPosition++;
          if (this.stackHeadPosition === this.stack.length) {
            const partialState = {
              type: void 0,
              size: 0,
              array: void 0,
              position: 0,
              readCount: 0,
              map: void 0,
              key: null
            };
            this.stack.push(partialState);
          }
          return this.stack[this.stackHeadPosition];
        }
        release(state) {
          const topStackState = this.stack[this.stackHeadPosition];
          if (topStackState !== state) {
            throw new Error("Invalid stack state. Released state is not on top of the stack.");
          }
          if (state.type === STATE_ARRAY) {
            const partialState = state;
            partialState.size = 0;
            partialState.array = void 0;
            partialState.position = 0;
            partialState.type = void 0;
          }
          if (state.type === STATE_MAP_KEY || state.type === STATE_MAP_VALUE) {
            const partialState = state;
            partialState.size = 0;
            partialState.map = void 0;
            partialState.readCount = 0;
            partialState.type = void 0;
          }
          this.stackHeadPosition--;
        }
        reset() {
          this.stack.length = 0;
          this.stackHeadPosition = -1;
        }
      };
      HEAD_BYTE_REQUIRED = -1;
      EMPTY_VIEW = new DataView(new ArrayBuffer(0));
      EMPTY_BYTES = new Uint8Array(EMPTY_VIEW.buffer);
      try {
        EMPTY_VIEW.getInt8(0);
      } catch (e) {
        if (!(e instanceof RangeError)) {
          throw new Error("This module is not supported in the current JavaScript engine because DataView does not throw RangeError on out-of-bounds access");
        }
      }
      MORE_DATA = new RangeError("Insufficient data");
      sharedCachedKeyDecoder = new CachedKeyDecoder();
      Decoder = class _Decoder {
        constructor(options) {
          __publicField(this, "extensionCodec");
          __publicField(this, "context");
          __publicField(this, "useBigInt64");
          __publicField(this, "rawStrings");
          __publicField(this, "maxStrLength");
          __publicField(this, "maxBinLength");
          __publicField(this, "maxArrayLength");
          __publicField(this, "maxMapLength");
          __publicField(this, "maxExtLength");
          __publicField(this, "keyDecoder");
          __publicField(this, "mapKeyConverter");
          __publicField(this, "totalPos", 0);
          __publicField(this, "pos", 0);
          __publicField(this, "view", EMPTY_VIEW);
          __publicField(this, "bytes", EMPTY_BYTES);
          __publicField(this, "headByte", HEAD_BYTE_REQUIRED);
          __publicField(this, "stack", new StackPool());
          __publicField(this, "entered", false);
          this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
          this.context = options?.context;
          this.useBigInt64 = options?.useBigInt64 ?? false;
          this.rawStrings = options?.rawStrings ?? false;
          this.maxStrLength = options?.maxStrLength ?? UINT32_MAX;
          this.maxBinLength = options?.maxBinLength ?? UINT32_MAX;
          this.maxArrayLength = options?.maxArrayLength ?? UINT32_MAX;
          this.maxMapLength = options?.maxMapLength ?? UINT32_MAX;
          this.maxExtLength = options?.maxExtLength ?? UINT32_MAX;
          this.keyDecoder = options?.keyDecoder !== void 0 ? options.keyDecoder : sharedCachedKeyDecoder;
          this.mapKeyConverter = options?.mapKeyConverter ?? mapKeyConverter;
        }
        clone() {
          return new _Decoder({
            extensionCodec: this.extensionCodec,
            context: this.context,
            useBigInt64: this.useBigInt64,
            rawStrings: this.rawStrings,
            maxStrLength: this.maxStrLength,
            maxBinLength: this.maxBinLength,
            maxArrayLength: this.maxArrayLength,
            maxMapLength: this.maxMapLength,
            maxExtLength: this.maxExtLength,
            keyDecoder: this.keyDecoder
          });
        }
        reinitializeState() {
          this.totalPos = 0;
          this.headByte = HEAD_BYTE_REQUIRED;
          this.stack.reset();
        }
        setBuffer(buffer) {
          const bytes = ensureUint8Array(buffer);
          this.bytes = bytes;
          this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          this.pos = 0;
        }
        appendBuffer(buffer) {
          if (this.headByte === HEAD_BYTE_REQUIRED && !this.hasRemaining(1)) {
            this.setBuffer(buffer);
          } else {
            const remainingData = this.bytes.subarray(this.pos);
            const newData = ensureUint8Array(buffer);
            const newBuffer = new Uint8Array(remainingData.length + newData.length);
            newBuffer.set(remainingData);
            newBuffer.set(newData, remainingData.length);
            this.setBuffer(newBuffer);
          }
        }
        hasRemaining(size) {
          return this.view.byteLength - this.pos >= size;
        }
        createExtraByteError(posToShow) {
          const { view, pos } = this;
          return new RangeError(`Extra ${view.byteLength - pos} of ${view.byteLength} byte(s) found at buffer[${posToShow}]`);
        }
        /**
         * @throws {@link DecodeError}
         * @throws {@link RangeError}
         */
        decode(buffer) {
          if (this.entered) {
            const instance = this.clone();
            return instance.decode(buffer);
          }
          try {
            this.entered = true;
            this.reinitializeState();
            this.setBuffer(buffer);
            const object = this.doDecodeSync();
            if (this.hasRemaining(1)) {
              throw this.createExtraByteError(this.pos);
            }
            return object;
          } finally {
            this.entered = false;
          }
        }
        *decodeMulti(buffer) {
          if (this.entered) {
            const instance = this.clone();
            yield* instance.decodeMulti(buffer);
            return;
          }
          try {
            this.entered = true;
            this.reinitializeState();
            this.setBuffer(buffer);
            while (this.hasRemaining(1)) {
              yield this.doDecodeSync();
            }
          } finally {
            this.entered = false;
          }
        }
        async decodeAsync(stream) {
          if (this.entered) {
            const instance = this.clone();
            return instance.decodeAsync(stream);
          }
          try {
            this.entered = true;
            let decoded = false;
            let object;
            for await (const buffer of stream) {
              if (decoded) {
                this.entered = false;
                throw this.createExtraByteError(this.totalPos);
              }
              this.appendBuffer(buffer);
              try {
                object = this.doDecodeSync();
                decoded = true;
              } catch (e) {
                if (!(e instanceof RangeError)) {
                  throw e;
                }
              }
              this.totalPos += this.pos;
            }
            if (decoded) {
              if (this.hasRemaining(1)) {
                throw this.createExtraByteError(this.totalPos);
              }
              return object;
            }
            const { headByte, pos, totalPos } = this;
            throw new RangeError(`Insufficient data in parsing ${prettyByte(headByte)} at ${totalPos} (${pos} in the current buffer)`);
          } finally {
            this.entered = false;
          }
        }
        decodeArrayStream(stream) {
          return this.decodeMultiAsync(stream, true);
        }
        decodeStream(stream) {
          return this.decodeMultiAsync(stream, false);
        }
        async *decodeMultiAsync(stream, isArray) {
          if (this.entered) {
            const instance = this.clone();
            yield* instance.decodeMultiAsync(stream, isArray);
            return;
          }
          try {
            this.entered = true;
            let isArrayHeaderRequired = isArray;
            let arrayItemsLeft = -1;
            for await (const buffer of stream) {
              if (isArray && arrayItemsLeft === 0) {
                throw this.createExtraByteError(this.totalPos);
              }
              this.appendBuffer(buffer);
              if (isArrayHeaderRequired) {
                arrayItemsLeft = this.readArraySize();
                isArrayHeaderRequired = false;
                this.complete();
              }
              try {
                while (true) {
                  yield this.doDecodeSync();
                  if (--arrayItemsLeft === 0) {
                    break;
                  }
                }
              } catch (e) {
                if (!(e instanceof RangeError)) {
                  throw e;
                }
              }
              this.totalPos += this.pos;
            }
          } finally {
            this.entered = false;
          }
        }
        doDecodeSync() {
          DECODE: while (true) {
            const headByte = this.readHeadByte();
            let object;
            if (headByte >= 224) {
              object = headByte - 256;
            } else if (headByte < 192) {
              if (headByte < 128) {
                object = headByte;
              } else if (headByte < 144) {
                const size = headByte - 128;
                if (size !== 0) {
                  this.pushMapState(size);
                  this.complete();
                  continue DECODE;
                } else {
                  object = {};
                }
              } else if (headByte < 160) {
                const size = headByte - 144;
                if (size !== 0) {
                  this.pushArrayState(size);
                  this.complete();
                  continue DECODE;
                } else {
                  object = [];
                }
              } else {
                const byteLength = headByte - 160;
                object = this.decodeString(byteLength, 0);
              }
            } else if (headByte === 192) {
              object = null;
            } else if (headByte === 194) {
              object = false;
            } else if (headByte === 195) {
              object = true;
            } else if (headByte === 202) {
              object = this.readF32();
            } else if (headByte === 203) {
              object = this.readF64();
            } else if (headByte === 204) {
              object = this.readU8();
            } else if (headByte === 205) {
              object = this.readU16();
            } else if (headByte === 206) {
              object = this.readU32();
            } else if (headByte === 207) {
              if (this.useBigInt64) {
                object = this.readU64AsBigInt();
              } else {
                object = this.readU64();
              }
            } else if (headByte === 208) {
              object = this.readI8();
            } else if (headByte === 209) {
              object = this.readI16();
            } else if (headByte === 210) {
              object = this.readI32();
            } else if (headByte === 211) {
              if (this.useBigInt64) {
                object = this.readI64AsBigInt();
              } else {
                object = this.readI64();
              }
            } else if (headByte === 217) {
              const byteLength = this.lookU8();
              object = this.decodeString(byteLength, 1);
            } else if (headByte === 218) {
              const byteLength = this.lookU16();
              object = this.decodeString(byteLength, 2);
            } else if (headByte === 219) {
              const byteLength = this.lookU32();
              object = this.decodeString(byteLength, 4);
            } else if (headByte === 220) {
              const size = this.readU16();
              if (size !== 0) {
                this.pushArrayState(size);
                this.complete();
                continue DECODE;
              } else {
                object = [];
              }
            } else if (headByte === 221) {
              const size = this.readU32();
              if (size !== 0) {
                this.pushArrayState(size);
                this.complete();
                continue DECODE;
              } else {
                object = [];
              }
            } else if (headByte === 222) {
              const size = this.readU16();
              if (size !== 0) {
                this.pushMapState(size);
                this.complete();
                continue DECODE;
              } else {
                object = {};
              }
            } else if (headByte === 223) {
              const size = this.readU32();
              if (size !== 0) {
                this.pushMapState(size);
                this.complete();
                continue DECODE;
              } else {
                object = {};
              }
            } else if (headByte === 196) {
              const size = this.lookU8();
              object = this.decodeBinary(size, 1);
            } else if (headByte === 197) {
              const size = this.lookU16();
              object = this.decodeBinary(size, 2);
            } else if (headByte === 198) {
              const size = this.lookU32();
              object = this.decodeBinary(size, 4);
            } else if (headByte === 212) {
              object = this.decodeExtension(1, 0);
            } else if (headByte === 213) {
              object = this.decodeExtension(2, 0);
            } else if (headByte === 214) {
              object = this.decodeExtension(4, 0);
            } else if (headByte === 215) {
              object = this.decodeExtension(8, 0);
            } else if (headByte === 216) {
              object = this.decodeExtension(16, 0);
            } else if (headByte === 199) {
              const size = this.lookU8();
              object = this.decodeExtension(size, 1);
            } else if (headByte === 200) {
              const size = this.lookU16();
              object = this.decodeExtension(size, 2);
            } else if (headByte === 201) {
              const size = this.lookU32();
              object = this.decodeExtension(size, 4);
            } else {
              throw new DecodeError(`Unrecognized type byte: ${prettyByte(headByte)}`);
            }
            this.complete();
            const stack = this.stack;
            while (stack.length > 0) {
              const state = stack.top();
              if (state.type === STATE_ARRAY) {
                state.array[state.position] = object;
                state.position++;
                if (state.position === state.size) {
                  object = state.array;
                  stack.release(state);
                } else {
                  continue DECODE;
                }
              } else if (state.type === STATE_MAP_KEY) {
                if (object === "__proto__") {
                  throw new DecodeError("The key __proto__ is not allowed");
                }
                state.key = this.mapKeyConverter(object);
                state.type = STATE_MAP_VALUE;
                continue DECODE;
              } else {
                state.map[state.key] = object;
                state.readCount++;
                if (state.readCount === state.size) {
                  object = state.map;
                  stack.release(state);
                } else {
                  state.key = null;
                  state.type = STATE_MAP_KEY;
                  continue DECODE;
                }
              }
            }
            return object;
          }
        }
        readHeadByte() {
          if (this.headByte === HEAD_BYTE_REQUIRED) {
            this.headByte = this.readU8();
          }
          return this.headByte;
        }
        complete() {
          this.headByte = HEAD_BYTE_REQUIRED;
        }
        readArraySize() {
          const headByte = this.readHeadByte();
          switch (headByte) {
            case 220:
              return this.readU16();
            case 221:
              return this.readU32();
            default: {
              if (headByte < 160) {
                return headByte - 144;
              } else {
                throw new DecodeError(`Unrecognized array type byte: ${prettyByte(headByte)}`);
              }
            }
          }
        }
        pushMapState(size) {
          if (size > this.maxMapLength) {
            throw new DecodeError(`Max length exceeded: map length (${size}) > maxMapLengthLength (${this.maxMapLength})`);
          }
          this.stack.pushMapState(size);
        }
        pushArrayState(size) {
          if (size > this.maxArrayLength) {
            throw new DecodeError(`Max length exceeded: array length (${size}) > maxArrayLength (${this.maxArrayLength})`);
          }
          this.stack.pushArrayState(size);
        }
        decodeString(byteLength, headerOffset) {
          if (!this.rawStrings || this.stateIsMapKey()) {
            return this.decodeUtf8String(byteLength, headerOffset);
          }
          return this.decodeBinary(byteLength, headerOffset);
        }
        /**
         * @throws {@link RangeError}
         */
        decodeUtf8String(byteLength, headerOffset) {
          if (byteLength > this.maxStrLength) {
            throw new DecodeError(`Max length exceeded: UTF-8 byte length (${byteLength}) > maxStrLength (${this.maxStrLength})`);
          }
          if (this.bytes.byteLength < this.pos + headerOffset + byteLength) {
            throw MORE_DATA;
          }
          const offset = this.pos + headerOffset;
          let object;
          if (this.stateIsMapKey() && this.keyDecoder?.canBeCached(byteLength)) {
            object = this.keyDecoder.decode(this.bytes, offset, byteLength);
          } else {
            object = utf8Decode(this.bytes, offset, byteLength);
          }
          this.pos += headerOffset + byteLength;
          return object;
        }
        stateIsMapKey() {
          if (this.stack.length > 0) {
            const state = this.stack.top();
            return state.type === STATE_MAP_KEY;
          }
          return false;
        }
        /**
         * @throws {@link RangeError}
         */
        decodeBinary(byteLength, headOffset) {
          if (byteLength > this.maxBinLength) {
            throw new DecodeError(`Max length exceeded: bin length (${byteLength}) > maxBinLength (${this.maxBinLength})`);
          }
          if (!this.hasRemaining(byteLength + headOffset)) {
            throw MORE_DATA;
          }
          const offset = this.pos + headOffset;
          const object = this.bytes.subarray(offset, offset + byteLength);
          this.pos += headOffset + byteLength;
          return object;
        }
        decodeExtension(size, headOffset) {
          if (size > this.maxExtLength) {
            throw new DecodeError(`Max length exceeded: ext length (${size}) > maxExtLength (${this.maxExtLength})`);
          }
          const extType = this.view.getInt8(this.pos + headOffset);
          const data = this.decodeBinary(
            size,
            headOffset + 1
            /* extType */
          );
          return this.extensionCodec.decode(data, extType, this.context);
        }
        lookU8() {
          return this.view.getUint8(this.pos);
        }
        lookU16() {
          return this.view.getUint16(this.pos);
        }
        lookU32() {
          return this.view.getUint32(this.pos);
        }
        readU8() {
          const value = this.view.getUint8(this.pos);
          this.pos++;
          return value;
        }
        readI8() {
          const value = this.view.getInt8(this.pos);
          this.pos++;
          return value;
        }
        readU16() {
          const value = this.view.getUint16(this.pos);
          this.pos += 2;
          return value;
        }
        readI16() {
          const value = this.view.getInt16(this.pos);
          this.pos += 2;
          return value;
        }
        readU32() {
          const value = this.view.getUint32(this.pos);
          this.pos += 4;
          return value;
        }
        readI32() {
          const value = this.view.getInt32(this.pos);
          this.pos += 4;
          return value;
        }
        readU64() {
          const value = getUint64(this.view, this.pos);
          this.pos += 8;
          return value;
        }
        readI64() {
          const value = getInt64(this.view, this.pos);
          this.pos += 8;
          return value;
        }
        readU64AsBigInt() {
          const value = this.view.getBigUint64(this.pos);
          this.pos += 8;
          return value;
        }
        readI64AsBigInt() {
          const value = this.view.getBigInt64(this.pos);
          this.pos += 8;
          return value;
        }
        readF32() {
          const value = this.view.getFloat32(this.pos);
          this.pos += 4;
          return value;
        }
        readF64() {
          const value = this.view.getFloat64(this.pos);
          this.pos += 8;
          return value;
        }
      };
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/decode.mjs
  function decode(buffer, options) {
    const decoder = new Decoder(options);
    return decoder.decode(buffer);
  }
  function decodeMulti(buffer, options) {
    const decoder = new Decoder(options);
    return decoder.decodeMulti(buffer);
  }
  var init_decode = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/decode.mjs"() {
      init_Decoder();
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/utils/stream.mjs
  function isAsyncIterable(object) {
    return object[Symbol.asyncIterator] != null;
  }
  async function* asyncIterableFromStream(stream) {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          return;
        }
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }
  function ensureAsyncIterable(streamLike) {
    if (isAsyncIterable(streamLike)) {
      return streamLike;
    } else {
      return asyncIterableFromStream(streamLike);
    }
  }
  var init_stream = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/utils/stream.mjs"() {
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/decodeAsync.mjs
  async function decodeAsync(streamLike, options) {
    const stream = ensureAsyncIterable(streamLike);
    const decoder = new Decoder(options);
    return decoder.decodeAsync(stream);
  }
  function decodeArrayStream(streamLike, options) {
    const stream = ensureAsyncIterable(streamLike);
    const decoder = new Decoder(options);
    return decoder.decodeArrayStream(stream);
  }
  function decodeMultiStream(streamLike, options) {
    const stream = ensureAsyncIterable(streamLike);
    const decoder = new Decoder(options);
    return decoder.decodeStream(stream);
  }
  var init_decodeAsync = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/decodeAsync.mjs"() {
      init_Decoder();
      init_stream();
    }
  });

  // node_modules/@msgpack/msgpack/dist.esm/index.mjs
  var dist_exports = {};
  __export(dist_exports, {
    DecodeError: () => DecodeError,
    Decoder: () => Decoder,
    EXT_TIMESTAMP: () => EXT_TIMESTAMP,
    Encoder: () => Encoder,
    ExtData: () => ExtData,
    ExtensionCodec: () => ExtensionCodec,
    decode: () => decode,
    decodeArrayStream: () => decodeArrayStream,
    decodeAsync: () => decodeAsync,
    decodeMulti: () => decodeMulti,
    decodeMultiStream: () => decodeMultiStream,
    decodeTimestampExtension: () => decodeTimestampExtension,
    decodeTimestampToTimeSpec: () => decodeTimestampToTimeSpec,
    encode: () => encode,
    encodeDateToTimeSpec: () => encodeDateToTimeSpec,
    encodeTimeSpecToTimestamp: () => encodeTimeSpecToTimestamp,
    encodeTimestampExtension: () => encodeTimestampExtension
  });
  var init_dist = __esm({
    "node_modules/@msgpack/msgpack/dist.esm/index.mjs"() {
      init_encode();
      init_decode();
      init_decodeAsync();
      init_Decoder();
      init_DecodeError();
      init_Encoder();
      init_ExtensionCodec();
      init_ExtData();
      init_timestamp();
    }
  });

  // node_modules/leaflet/dist/leaflet-src.js
  var require_leaflet_src = __commonJS({
    "node_modules/leaflet/dist/leaflet-src.js"(exports, module) {
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.leaflet = {}));
      })(exports, (function(exports2) {
        "use strict";
        var version = "1.9.4";
        function extend(dest) {
          var i, j, len, src;
          for (j = 1, len = arguments.length; j < len; j++) {
            src = arguments[j];
            for (i in src) {
              dest[i] = src[i];
            }
          }
          return dest;
        }
        var create$2 = Object.create || /* @__PURE__ */ (function() {
          function F() {
          }
          return function(proto) {
            F.prototype = proto;
            return new F();
          };
        })();
        function bind(fn, obj) {
          var slice = Array.prototype.slice;
          if (fn.bind) {
            return fn.bind.apply(fn, slice.call(arguments, 1));
          }
          var args = slice.call(arguments, 2);
          return function() {
            return fn.apply(obj, args.length ? args.concat(slice.call(arguments)) : arguments);
          };
        }
        var lastId = 0;
        function stamp(obj) {
          if (!("_leaflet_id" in obj)) {
            obj["_leaflet_id"] = ++lastId;
          }
          return obj._leaflet_id;
        }
        function throttle(fn, time, context) {
          var lock, args, wrapperFn, later;
          later = function() {
            lock = false;
            if (args) {
              wrapperFn.apply(context, args);
              args = false;
            }
          };
          wrapperFn = function() {
            if (lock) {
              args = arguments;
            } else {
              fn.apply(context, arguments);
              setTimeout(later, time);
              lock = true;
            }
          };
          return wrapperFn;
        }
        function wrapNum(x, range, includeMax) {
          var max = range[1], min = range[0], d = max - min;
          return x === max && includeMax ? x : ((x - min) % d + d) % d + min;
        }
        function falseFn() {
          return false;
        }
        function formatNum(num, precision) {
          if (precision === false) {
            return num;
          }
          var pow = Math.pow(10, precision === void 0 ? 6 : precision);
          return Math.round(num * pow) / pow;
        }
        function trim(str) {
          return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, "");
        }
        function splitWords(str) {
          return trim(str).split(/\s+/);
        }
        function setOptions(obj, options) {
          if (!Object.prototype.hasOwnProperty.call(obj, "options")) {
            obj.options = obj.options ? create$2(obj.options) : {};
          }
          for (var i in options) {
            obj.options[i] = options[i];
          }
          return obj.options;
        }
        function getParamString(obj, existingUrl, uppercase) {
          var params = [];
          for (var i in obj) {
            params.push(encodeURIComponent(uppercase ? i.toUpperCase() : i) + "=" + encodeURIComponent(obj[i]));
          }
          return (!existingUrl || existingUrl.indexOf("?") === -1 ? "?" : "&") + params.join("&");
        }
        var templateRe = /\{ *([\w_ -]+) *\}/g;
        function template(str, data) {
          return str.replace(templateRe, function(str2, key2) {
            var value = data[key2];
            if (value === void 0) {
              throw new Error("No value provided for variable " + str2);
            } else if (typeof value === "function") {
              value = value(data);
            }
            return value;
          });
        }
        var isArray = Array.isArray || function(obj) {
          return Object.prototype.toString.call(obj) === "[object Array]";
        };
        function indexOf(array, el) {
          for (var i = 0; i < array.length; i++) {
            if (array[i] === el) {
              return i;
            }
          }
          return -1;
        }
        var emptyImageUrl = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
        function getPrefixed(name2) {
          return window["webkit" + name2] || window["moz" + name2] || window["ms" + name2];
        }
        var lastTime = 0;
        function timeoutDefer(fn) {
          var time = +/* @__PURE__ */ new Date(), timeToCall = Math.max(0, 16 - (time - lastTime));
          lastTime = time + timeToCall;
          return window.setTimeout(fn, timeToCall);
        }
        var requestFn = window.requestAnimationFrame || getPrefixed("RequestAnimationFrame") || timeoutDefer;
        var cancelFn = window.cancelAnimationFrame || getPrefixed("CancelAnimationFrame") || getPrefixed("CancelRequestAnimationFrame") || function(id) {
          window.clearTimeout(id);
        };
        function requestAnimFrame(fn, context, immediate) {
          if (immediate && requestFn === timeoutDefer) {
            fn.call(context);
          } else {
            return requestFn.call(window, bind(fn, context));
          }
        }
        function cancelAnimFrame(id) {
          if (id) {
            cancelFn.call(window, id);
          }
        }
        var Util = {
          __proto__: null,
          extend,
          create: create$2,
          bind,
          get lastId() {
            return lastId;
          },
          stamp,
          throttle,
          wrapNum,
          falseFn,
          formatNum,
          trim,
          splitWords,
          setOptions,
          getParamString,
          template,
          isArray,
          indexOf,
          emptyImageUrl,
          requestFn,
          cancelFn,
          requestAnimFrame,
          cancelAnimFrame
        };
        function Class() {
        }
        Class.extend = function(props) {
          var NewClass = function() {
            setOptions(this);
            if (this.initialize) {
              this.initialize.apply(this, arguments);
            }
            this.callInitHooks();
          };
          var parentProto = NewClass.__super__ = this.prototype;
          var proto = create$2(parentProto);
          proto.constructor = NewClass;
          NewClass.prototype = proto;
          for (var i in this) {
            if (Object.prototype.hasOwnProperty.call(this, i) && i !== "prototype" && i !== "__super__") {
              NewClass[i] = this[i];
            }
          }
          if (props.statics) {
            extend(NewClass, props.statics);
          }
          if (props.includes) {
            checkDeprecatedMixinEvents(props.includes);
            extend.apply(null, [proto].concat(props.includes));
          }
          extend(proto, props);
          delete proto.statics;
          delete proto.includes;
          if (proto.options) {
            proto.options = parentProto.options ? create$2(parentProto.options) : {};
            extend(proto.options, props.options);
          }
          proto._initHooks = [];
          proto.callInitHooks = function() {
            if (this._initHooksCalled) {
              return;
            }
            if (parentProto.callInitHooks) {
              parentProto.callInitHooks.call(this);
            }
            this._initHooksCalled = true;
            for (var i2 = 0, len = proto._initHooks.length; i2 < len; i2++) {
              proto._initHooks[i2].call(this);
            }
          };
          return NewClass;
        };
        Class.include = function(props) {
          var parentOptions = this.prototype.options;
          extend(this.prototype, props);
          if (props.options) {
            this.prototype.options = parentOptions;
            this.mergeOptions(props.options);
          }
          return this;
        };
        Class.mergeOptions = function(options) {
          extend(this.prototype.options, options);
          return this;
        };
        Class.addInitHook = function(fn) {
          var args = Array.prototype.slice.call(arguments, 1);
          var init = typeof fn === "function" ? fn : function() {
            this[fn].apply(this, args);
          };
          this.prototype._initHooks = this.prototype._initHooks || [];
          this.prototype._initHooks.push(init);
          return this;
        };
        function checkDeprecatedMixinEvents(includes) {
          if (typeof L === "undefined" || !L || !L.Mixin) {
            return;
          }
          includes = isArray(includes) ? includes : [includes];
          for (var i = 0; i < includes.length; i++) {
            if (includes[i] === L.Mixin.Events) {
              console.warn("Deprecated include of L.Mixin.Events: this property will be removed in future releases, please inherit from L.Evented instead.", new Error().stack);
            }
          }
        }
        var Events = {
          /* @method on(type: String, fn: Function, context?: Object): this
           * Adds a listener function (`fn`) to a particular event type of the object. You can optionally specify the context of the listener (object the this keyword will point to). You can also pass several space-separated types (e.g. `'click dblclick'`).
           *
           * @alternative
           * @method on(eventMap: Object): this
           * Adds a set of type/listener pairs, e.g. `{click: onClick, mousemove: onMouseMove}`
           */
          on: function(types, fn, context) {
            if (typeof types === "object") {
              for (var type in types) {
                this._on(type, types[type], fn);
              }
            } else {
              types = splitWords(types);
              for (var i = 0, len = types.length; i < len; i++) {
                this._on(types[i], fn, context);
              }
            }
            return this;
          },
          /* @method off(type: String, fn?: Function, context?: Object): this
           * Removes a previously added listener function. If no function is specified, it will remove all the listeners of that particular event from the object. Note that if you passed a custom context to `on`, you must pass the same context to `off` in order to remove the listener.
           *
           * @alternative
           * @method off(eventMap: Object): this
           * Removes a set of type/listener pairs.
           *
           * @alternative
           * @method off: this
           * Removes all listeners to all events on the object. This includes implicitly attached events.
           */
          off: function(types, fn, context) {
            if (!arguments.length) {
              delete this._events;
            } else if (typeof types === "object") {
              for (var type in types) {
                this._off(type, types[type], fn);
              }
            } else {
              types = splitWords(types);
              var removeAll = arguments.length === 1;
              for (var i = 0, len = types.length; i < len; i++) {
                if (removeAll) {
                  this._off(types[i]);
                } else {
                  this._off(types[i], fn, context);
                }
              }
            }
            return this;
          },
          // attach listener (without syntactic sugar now)
          _on: function(type, fn, context, _once) {
            if (typeof fn !== "function") {
              console.warn("wrong listener type: " + typeof fn);
              return;
            }
            if (this._listens(type, fn, context) !== false) {
              return;
            }
            if (context === this) {
              context = void 0;
            }
            var newListener = { fn, ctx: context };
            if (_once) {
              newListener.once = true;
            }
            this._events = this._events || {};
            this._events[type] = this._events[type] || [];
            this._events[type].push(newListener);
          },
          _off: function(type, fn, context) {
            var listeners2, i, len;
            if (!this._events) {
              return;
            }
            listeners2 = this._events[type];
            if (!listeners2) {
              return;
            }
            if (arguments.length === 1) {
              if (this._firingCount) {
                for (i = 0, len = listeners2.length; i < len; i++) {
                  listeners2[i].fn = falseFn;
                }
              }
              delete this._events[type];
              return;
            }
            if (typeof fn !== "function") {
              console.warn("wrong listener type: " + typeof fn);
              return;
            }
            var index3 = this._listens(type, fn, context);
            if (index3 !== false) {
              var listener = listeners2[index3];
              if (this._firingCount) {
                listener.fn = falseFn;
                this._events[type] = listeners2 = listeners2.slice();
              }
              listeners2.splice(index3, 1);
            }
          },
          // @method fire(type: String, data?: Object, propagate?: Boolean): this
          // Fires an event of the specified type. You can optionally provide a data
          // object — the first argument of the listener function will contain its
          // properties. The event can optionally be propagated to event parents.
          fire: function(type, data, propagate) {
            if (!this.listens(type, propagate)) {
              return this;
            }
            var event = extend({}, data, {
              type,
              target: this,
              sourceTarget: data && data.sourceTarget || this
            });
            if (this._events) {
              var listeners2 = this._events[type];
              if (listeners2) {
                this._firingCount = this._firingCount + 1 || 1;
                for (var i = 0, len = listeners2.length; i < len; i++) {
                  var l = listeners2[i];
                  var fn = l.fn;
                  if (l.once) {
                    this.off(type, fn, l.ctx);
                  }
                  fn.call(l.ctx || this, event);
                }
                this._firingCount--;
              }
            }
            if (propagate) {
              this._propagateEvent(event);
            }
            return this;
          },
          // @method listens(type: String, propagate?: Boolean): Boolean
          // @method listens(type: String, fn: Function, context?: Object, propagate?: Boolean): Boolean
          // Returns `true` if a particular event type has any listeners attached to it.
          // The verification can optionally be propagated, it will return `true` if parents have the listener attached to it.
          listens: function(type, fn, context, propagate) {
            if (typeof type !== "string") {
              console.warn('"string" type argument expected');
            }
            var _fn = fn;
            if (typeof fn !== "function") {
              propagate = !!fn;
              _fn = void 0;
              context = void 0;
            }
            var listeners2 = this._events && this._events[type];
            if (listeners2 && listeners2.length) {
              if (this._listens(type, _fn, context) !== false) {
                return true;
              }
            }
            if (propagate) {
              for (var id in this._eventParents) {
                if (this._eventParents[id].listens(type, fn, context, propagate)) {
                  return true;
                }
              }
            }
            return false;
          },
          // returns the index (number) or false
          _listens: function(type, fn, context) {
            if (!this._events) {
              return false;
            }
            var listeners2 = this._events[type] || [];
            if (!fn) {
              return !!listeners2.length;
            }
            if (context === this) {
              context = void 0;
            }
            for (var i = 0, len = listeners2.length; i < len; i++) {
              if (listeners2[i].fn === fn && listeners2[i].ctx === context) {
                return i;
              }
            }
            return false;
          },
          // @method once(…): this
          // Behaves as [`on(…)`](#evented-on), except the listener will only get fired once and then removed.
          once: function(types, fn, context) {
            if (typeof types === "object") {
              for (var type in types) {
                this._on(type, types[type], fn, true);
              }
            } else {
              types = splitWords(types);
              for (var i = 0, len = types.length; i < len; i++) {
                this._on(types[i], fn, context, true);
              }
            }
            return this;
          },
          // @method addEventParent(obj: Evented): this
          // Adds an event parent - an `Evented` that will receive propagated events
          addEventParent: function(obj) {
            this._eventParents = this._eventParents || {};
            this._eventParents[stamp(obj)] = obj;
            return this;
          },
          // @method removeEventParent(obj: Evented): this
          // Removes an event parent, so it will stop receiving propagated events
          removeEventParent: function(obj) {
            if (this._eventParents) {
              delete this._eventParents[stamp(obj)];
            }
            return this;
          },
          _propagateEvent: function(e) {
            for (var id in this._eventParents) {
              this._eventParents[id].fire(e.type, extend({
                layer: e.target,
                propagatedFrom: e.target
              }, e), true);
            }
          }
        };
        Events.addEventListener = Events.on;
        Events.removeEventListener = Events.clearAllEventListeners = Events.off;
        Events.addOneTimeEventListener = Events.once;
        Events.fireEvent = Events.fire;
        Events.hasEventListeners = Events.listens;
        var Evented = Class.extend(Events);
        function Point(x, y, round) {
          this.x = round ? Math.round(x) : x;
          this.y = round ? Math.round(y) : y;
        }
        var trunc = Math.trunc || function(v) {
          return v > 0 ? Math.floor(v) : Math.ceil(v);
        };
        Point.prototype = {
          // @method clone(): Point
          // Returns a copy of the current point.
          clone: function() {
            return new Point(this.x, this.y);
          },
          // @method add(otherPoint: Point): Point
          // Returns the result of addition of the current and the given points.
          add: function(point) {
            return this.clone()._add(toPoint(point));
          },
          _add: function(point) {
            this.x += point.x;
            this.y += point.y;
            return this;
          },
          // @method subtract(otherPoint: Point): Point
          // Returns the result of subtraction of the given point from the current.
          subtract: function(point) {
            return this.clone()._subtract(toPoint(point));
          },
          _subtract: function(point) {
            this.x -= point.x;
            this.y -= point.y;
            return this;
          },
          // @method divideBy(num: Number): Point
          // Returns the result of division of the current point by the given number.
          divideBy: function(num) {
            return this.clone()._divideBy(num);
          },
          _divideBy: function(num) {
            this.x /= num;
            this.y /= num;
            return this;
          },
          // @method multiplyBy(num: Number): Point
          // Returns the result of multiplication of the current point by the given number.
          multiplyBy: function(num) {
            return this.clone()._multiplyBy(num);
          },
          _multiplyBy: function(num) {
            this.x *= num;
            this.y *= num;
            return this;
          },
          // @method scaleBy(scale: Point): Point
          // Multiply each coordinate of the current point by each coordinate of
          // `scale`. In linear algebra terms, multiply the point by the
          // [scaling matrix](https://en.wikipedia.org/wiki/Scaling_%28geometry%29#Matrix_representation)
          // defined by `scale`.
          scaleBy: function(point) {
            return new Point(this.x * point.x, this.y * point.y);
          },
          // @method unscaleBy(scale: Point): Point
          // Inverse of `scaleBy`. Divide each coordinate of the current point by
          // each coordinate of `scale`.
          unscaleBy: function(point) {
            return new Point(this.x / point.x, this.y / point.y);
          },
          // @method round(): Point
          // Returns a copy of the current point with rounded coordinates.
          round: function() {
            return this.clone()._round();
          },
          _round: function() {
            this.x = Math.round(this.x);
            this.y = Math.round(this.y);
            return this;
          },
          // @method floor(): Point
          // Returns a copy of the current point with floored coordinates (rounded down).
          floor: function() {
            return this.clone()._floor();
          },
          _floor: function() {
            this.x = Math.floor(this.x);
            this.y = Math.floor(this.y);
            return this;
          },
          // @method ceil(): Point
          // Returns a copy of the current point with ceiled coordinates (rounded up).
          ceil: function() {
            return this.clone()._ceil();
          },
          _ceil: function() {
            this.x = Math.ceil(this.x);
            this.y = Math.ceil(this.y);
            return this;
          },
          // @method trunc(): Point
          // Returns a copy of the current point with truncated coordinates (rounded towards zero).
          trunc: function() {
            return this.clone()._trunc();
          },
          _trunc: function() {
            this.x = trunc(this.x);
            this.y = trunc(this.y);
            return this;
          },
          // @method distanceTo(otherPoint: Point): Number
          // Returns the cartesian distance between the current and the given points.
          distanceTo: function(point) {
            point = toPoint(point);
            var x = point.x - this.x, y = point.y - this.y;
            return Math.sqrt(x * x + y * y);
          },
          // @method equals(otherPoint: Point): Boolean
          // Returns `true` if the given point has the same coordinates.
          equals: function(point) {
            point = toPoint(point);
            return point.x === this.x && point.y === this.y;
          },
          // @method contains(otherPoint: Point): Boolean
          // Returns `true` if both coordinates of the given point are less than the corresponding current point coordinates (in absolute values).
          contains: function(point) {
            point = toPoint(point);
            return Math.abs(point.x) <= Math.abs(this.x) && Math.abs(point.y) <= Math.abs(this.y);
          },
          // @method toString(): String
          // Returns a string representation of the point for debugging purposes.
          toString: function() {
            return "Point(" + formatNum(this.x) + ", " + formatNum(this.y) + ")";
          }
        };
        function toPoint(x, y, round) {
          if (x instanceof Point) {
            return x;
          }
          if (isArray(x)) {
            return new Point(x[0], x[1]);
          }
          if (x === void 0 || x === null) {
            return x;
          }
          if (typeof x === "object" && "x" in x && "y" in x) {
            return new Point(x.x, x.y);
          }
          return new Point(x, y, round);
        }
        function Bounds(a, b) {
          if (!a) {
            return;
          }
          var points = b ? [a, b] : a;
          for (var i = 0, len = points.length; i < len; i++) {
            this.extend(points[i]);
          }
        }
        Bounds.prototype = {
          // @method extend(point: Point): this
          // Extends the bounds to contain the given point.
          // @alternative
          // @method extend(otherBounds: Bounds): this
          // Extend the bounds to contain the given bounds
          extend: function(obj) {
            var min2, max2;
            if (!obj) {
              return this;
            }
            if (obj instanceof Point || typeof obj[0] === "number" || "x" in obj) {
              min2 = max2 = toPoint(obj);
            } else {
              obj = toBounds(obj);
              min2 = obj.min;
              max2 = obj.max;
              if (!min2 || !max2) {
                return this;
              }
            }
            if (!this.min && !this.max) {
              this.min = min2.clone();
              this.max = max2.clone();
            } else {
              this.min.x = Math.min(min2.x, this.min.x);
              this.max.x = Math.max(max2.x, this.max.x);
              this.min.y = Math.min(min2.y, this.min.y);
              this.max.y = Math.max(max2.y, this.max.y);
            }
            return this;
          },
          // @method getCenter(round?: Boolean): Point
          // Returns the center point of the bounds.
          getCenter: function(round) {
            return toPoint(
              (this.min.x + this.max.x) / 2,
              (this.min.y + this.max.y) / 2,
              round
            );
          },
          // @method getBottomLeft(): Point
          // Returns the bottom-left point of the bounds.
          getBottomLeft: function() {
            return toPoint(this.min.x, this.max.y);
          },
          // @method getTopRight(): Point
          // Returns the top-right point of the bounds.
          getTopRight: function() {
            return toPoint(this.max.x, this.min.y);
          },
          // @method getTopLeft(): Point
          // Returns the top-left point of the bounds (i.e. [`this.min`](#bounds-min)).
          getTopLeft: function() {
            return this.min;
          },
          // @method getBottomRight(): Point
          // Returns the bottom-right point of the bounds (i.e. [`this.max`](#bounds-max)).
          getBottomRight: function() {
            return this.max;
          },
          // @method getSize(): Point
          // Returns the size of the given bounds
          getSize: function() {
            return this.max.subtract(this.min);
          },
          // @method contains(otherBounds: Bounds): Boolean
          // Returns `true` if the rectangle contains the given one.
          // @alternative
          // @method contains(point: Point): Boolean
          // Returns `true` if the rectangle contains the given point.
          contains: function(obj) {
            var min, max;
            if (typeof obj[0] === "number" || obj instanceof Point) {
              obj = toPoint(obj);
            } else {
              obj = toBounds(obj);
            }
            if (obj instanceof Bounds) {
              min = obj.min;
              max = obj.max;
            } else {
              min = max = obj;
            }
            return min.x >= this.min.x && max.x <= this.max.x && min.y >= this.min.y && max.y <= this.max.y;
          },
          // @method intersects(otherBounds: Bounds): Boolean
          // Returns `true` if the rectangle intersects the given bounds. Two bounds
          // intersect if they have at least one point in common.
          intersects: function(bounds) {
            bounds = toBounds(bounds);
            var min = this.min, max = this.max, min2 = bounds.min, max2 = bounds.max, xIntersects = max2.x >= min.x && min2.x <= max.x, yIntersects = max2.y >= min.y && min2.y <= max.y;
            return xIntersects && yIntersects;
          },
          // @method overlaps(otherBounds: Bounds): Boolean
          // Returns `true` if the rectangle overlaps the given bounds. Two bounds
          // overlap if their intersection is an area.
          overlaps: function(bounds) {
            bounds = toBounds(bounds);
            var min = this.min, max = this.max, min2 = bounds.min, max2 = bounds.max, xOverlaps = max2.x > min.x && min2.x < max.x, yOverlaps = max2.y > min.y && min2.y < max.y;
            return xOverlaps && yOverlaps;
          },
          // @method isValid(): Boolean
          // Returns `true` if the bounds are properly initialized.
          isValid: function() {
            return !!(this.min && this.max);
          },
          // @method pad(bufferRatio: Number): Bounds
          // Returns bounds created by extending or retracting the current bounds by a given ratio in each direction.
          // For example, a ratio of 0.5 extends the bounds by 50% in each direction.
          // Negative values will retract the bounds.
          pad: function(bufferRatio) {
            var min = this.min, max = this.max, heightBuffer = Math.abs(min.x - max.x) * bufferRatio, widthBuffer = Math.abs(min.y - max.y) * bufferRatio;
            return toBounds(
              toPoint(min.x - heightBuffer, min.y - widthBuffer),
              toPoint(max.x + heightBuffer, max.y + widthBuffer)
            );
          },
          // @method equals(otherBounds: Bounds): Boolean
          // Returns `true` if the rectangle is equivalent to the given bounds.
          equals: function(bounds) {
            if (!bounds) {
              return false;
            }
            bounds = toBounds(bounds);
            return this.min.equals(bounds.getTopLeft()) && this.max.equals(bounds.getBottomRight());
          }
        };
        function toBounds(a, b) {
          if (!a || a instanceof Bounds) {
            return a;
          }
          return new Bounds(a, b);
        }
        function LatLngBounds(corner1, corner2) {
          if (!corner1) {
            return;
          }
          var latlngs = corner2 ? [corner1, corner2] : corner1;
          for (var i = 0, len = latlngs.length; i < len; i++) {
            this.extend(latlngs[i]);
          }
        }
        LatLngBounds.prototype = {
          // @method extend(latlng: LatLng): this
          // Extend the bounds to contain the given point
          // @alternative
          // @method extend(otherBounds: LatLngBounds): this
          // Extend the bounds to contain the given bounds
          extend: function(obj) {
            var sw = this._southWest, ne = this._northEast, sw2, ne2;
            if (obj instanceof LatLng) {
              sw2 = obj;
              ne2 = obj;
            } else if (obj instanceof LatLngBounds) {
              sw2 = obj._southWest;
              ne2 = obj._northEast;
              if (!sw2 || !ne2) {
                return this;
              }
            } else {
              return obj ? this.extend(toLatLng(obj) || toLatLngBounds(obj)) : this;
            }
            if (!sw && !ne) {
              this._southWest = new LatLng(sw2.lat, sw2.lng);
              this._northEast = new LatLng(ne2.lat, ne2.lng);
            } else {
              sw.lat = Math.min(sw2.lat, sw.lat);
              sw.lng = Math.min(sw2.lng, sw.lng);
              ne.lat = Math.max(ne2.lat, ne.lat);
              ne.lng = Math.max(ne2.lng, ne.lng);
            }
            return this;
          },
          // @method pad(bufferRatio: Number): LatLngBounds
          // Returns bounds created by extending or retracting the current bounds by a given ratio in each direction.
          // For example, a ratio of 0.5 extends the bounds by 50% in each direction.
          // Negative values will retract the bounds.
          pad: function(bufferRatio) {
            var sw = this._southWest, ne = this._northEast, heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio, widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;
            return new LatLngBounds(
              new LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
              new LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer)
            );
          },
          // @method getCenter(): LatLng
          // Returns the center point of the bounds.
          getCenter: function() {
            return new LatLng(
              (this._southWest.lat + this._northEast.lat) / 2,
              (this._southWest.lng + this._northEast.lng) / 2
            );
          },
          // @method getSouthWest(): LatLng
          // Returns the south-west point of the bounds.
          getSouthWest: function() {
            return this._southWest;
          },
          // @method getNorthEast(): LatLng
          // Returns the north-east point of the bounds.
          getNorthEast: function() {
            return this._northEast;
          },
          // @method getNorthWest(): LatLng
          // Returns the north-west point of the bounds.
          getNorthWest: function() {
            return new LatLng(this.getNorth(), this.getWest());
          },
          // @method getSouthEast(): LatLng
          // Returns the south-east point of the bounds.
          getSouthEast: function() {
            return new LatLng(this.getSouth(), this.getEast());
          },
          // @method getWest(): Number
          // Returns the west longitude of the bounds
          getWest: function() {
            return this._southWest.lng;
          },
          // @method getSouth(): Number
          // Returns the south latitude of the bounds
          getSouth: function() {
            return this._southWest.lat;
          },
          // @method getEast(): Number
          // Returns the east longitude of the bounds
          getEast: function() {
            return this._northEast.lng;
          },
          // @method getNorth(): Number
          // Returns the north latitude of the bounds
          getNorth: function() {
            return this._northEast.lat;
          },
          // @method contains(otherBounds: LatLngBounds): Boolean
          // Returns `true` if the rectangle contains the given one.
          // @alternative
          // @method contains (latlng: LatLng): Boolean
          // Returns `true` if the rectangle contains the given point.
          contains: function(obj) {
            if (typeof obj[0] === "number" || obj instanceof LatLng || "lat" in obj) {
              obj = toLatLng(obj);
            } else {
              obj = toLatLngBounds(obj);
            }
            var sw = this._southWest, ne = this._northEast, sw2, ne2;
            if (obj instanceof LatLngBounds) {
              sw2 = obj.getSouthWest();
              ne2 = obj.getNorthEast();
            } else {
              sw2 = ne2 = obj;
            }
            return sw2.lat >= sw.lat && ne2.lat <= ne.lat && sw2.lng >= sw.lng && ne2.lng <= ne.lng;
          },
          // @method intersects(otherBounds: LatLngBounds): Boolean
          // Returns `true` if the rectangle intersects the given bounds. Two bounds intersect if they have at least one point in common.
          intersects: function(bounds) {
            bounds = toLatLngBounds(bounds);
            var sw = this._southWest, ne = this._northEast, sw2 = bounds.getSouthWest(), ne2 = bounds.getNorthEast(), latIntersects = ne2.lat >= sw.lat && sw2.lat <= ne.lat, lngIntersects = ne2.lng >= sw.lng && sw2.lng <= ne.lng;
            return latIntersects && lngIntersects;
          },
          // @method overlaps(otherBounds: LatLngBounds): Boolean
          // Returns `true` if the rectangle overlaps the given bounds. Two bounds overlap if their intersection is an area.
          overlaps: function(bounds) {
            bounds = toLatLngBounds(bounds);
            var sw = this._southWest, ne = this._northEast, sw2 = bounds.getSouthWest(), ne2 = bounds.getNorthEast(), latOverlaps = ne2.lat > sw.lat && sw2.lat < ne.lat, lngOverlaps = ne2.lng > sw.lng && sw2.lng < ne.lng;
            return latOverlaps && lngOverlaps;
          },
          // @method toBBoxString(): String
          // Returns a string with bounding box coordinates in a 'southwest_lng,southwest_lat,northeast_lng,northeast_lat' format. Useful for sending requests to web services that return geo data.
          toBBoxString: function() {
            return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(",");
          },
          // @method equals(otherBounds: LatLngBounds, maxMargin?: Number): Boolean
          // Returns `true` if the rectangle is equivalent (within a small margin of error) to the given bounds. The margin of error can be overridden by setting `maxMargin` to a small number.
          equals: function(bounds, maxMargin) {
            if (!bounds) {
              return false;
            }
            bounds = toLatLngBounds(bounds);
            return this._southWest.equals(bounds.getSouthWest(), maxMargin) && this._northEast.equals(bounds.getNorthEast(), maxMargin);
          },
          // @method isValid(): Boolean
          // Returns `true` if the bounds are properly initialized.
          isValid: function() {
            return !!(this._southWest && this._northEast);
          }
        };
        function toLatLngBounds(a, b) {
          if (a instanceof LatLngBounds) {
            return a;
          }
          return new LatLngBounds(a, b);
        }
        function LatLng(lat, lng, alt) {
          if (isNaN(lat) || isNaN(lng)) {
            throw new Error("Invalid LatLng object: (" + lat + ", " + lng + ")");
          }
          this.lat = +lat;
          this.lng = +lng;
          if (alt !== void 0) {
            this.alt = +alt;
          }
        }
        LatLng.prototype = {
          // @method equals(otherLatLng: LatLng, maxMargin?: Number): Boolean
          // Returns `true` if the given `LatLng` point is at the same position (within a small margin of error). The margin of error can be overridden by setting `maxMargin` to a small number.
          equals: function(obj, maxMargin) {
            if (!obj) {
              return false;
            }
            obj = toLatLng(obj);
            var margin = Math.max(
              Math.abs(this.lat - obj.lat),
              Math.abs(this.lng - obj.lng)
            );
            return margin <= (maxMargin === void 0 ? 1e-9 : maxMargin);
          },
          // @method toString(): String
          // Returns a string representation of the point (for debugging purposes).
          toString: function(precision) {
            return "LatLng(" + formatNum(this.lat, precision) + ", " + formatNum(this.lng, precision) + ")";
          },
          // @method distanceTo(otherLatLng: LatLng): Number
          // Returns the distance (in meters) to the given `LatLng` calculated using the [Spherical Law of Cosines](https://en.wikipedia.org/wiki/Spherical_law_of_cosines).
          distanceTo: function(other) {
            return Earth.distance(this, toLatLng(other));
          },
          // @method wrap(): LatLng
          // Returns a new `LatLng` object with the longitude wrapped so it's always between -180 and +180 degrees.
          wrap: function() {
            return Earth.wrapLatLng(this);
          },
          // @method toBounds(sizeInMeters: Number): LatLngBounds
          // Returns a new `LatLngBounds` object in which each boundary is `sizeInMeters/2` meters apart from the `LatLng`.
          toBounds: function(sizeInMeters) {
            var latAccuracy = 180 * sizeInMeters / 40075017, lngAccuracy = latAccuracy / Math.cos(Math.PI / 180 * this.lat);
            return toLatLngBounds(
              [this.lat - latAccuracy, this.lng - lngAccuracy],
              [this.lat + latAccuracy, this.lng + lngAccuracy]
            );
          },
          clone: function() {
            return new LatLng(this.lat, this.lng, this.alt);
          }
        };
        function toLatLng(a, b, c) {
          if (a instanceof LatLng) {
            return a;
          }
          if (isArray(a) && typeof a[0] !== "object") {
            if (a.length === 3) {
              return new LatLng(a[0], a[1], a[2]);
            }
            if (a.length === 2) {
              return new LatLng(a[0], a[1]);
            }
            return null;
          }
          if (a === void 0 || a === null) {
            return a;
          }
          if (typeof a === "object" && "lat" in a) {
            return new LatLng(a.lat, "lng" in a ? a.lng : a.lon, a.alt);
          }
          if (b === void 0) {
            return null;
          }
          return new LatLng(a, b, c);
        }
        var CRS = {
          // @method latLngToPoint(latlng: LatLng, zoom: Number): Point
          // Projects geographical coordinates into pixel coordinates for a given zoom.
          latLngToPoint: function(latlng, zoom2) {
            var projectedPoint = this.projection.project(latlng), scale2 = this.scale(zoom2);
            return this.transformation._transform(projectedPoint, scale2);
          },
          // @method pointToLatLng(point: Point, zoom: Number): LatLng
          // The inverse of `latLngToPoint`. Projects pixel coordinates on a given
          // zoom into geographical coordinates.
          pointToLatLng: function(point, zoom2) {
            var scale2 = this.scale(zoom2), untransformedPoint = this.transformation.untransform(point, scale2);
            return this.projection.unproject(untransformedPoint);
          },
          // @method project(latlng: LatLng): Point
          // Projects geographical coordinates into coordinates in units accepted for
          // this CRS (e.g. meters for EPSG:3857, for passing it to WMS services).
          project: function(latlng) {
            return this.projection.project(latlng);
          },
          // @method unproject(point: Point): LatLng
          // Given a projected coordinate returns the corresponding LatLng.
          // The inverse of `project`.
          unproject: function(point) {
            return this.projection.unproject(point);
          },
          // @method scale(zoom: Number): Number
          // Returns the scale used when transforming projected coordinates into
          // pixel coordinates for a particular zoom. For example, it returns
          // `256 * 2^zoom` for Mercator-based CRS.
          scale: function(zoom2) {
            return 256 * Math.pow(2, zoom2);
          },
          // @method zoom(scale: Number): Number
          // Inverse of `scale()`, returns the zoom level corresponding to a scale
          // factor of `scale`.
          zoom: function(scale2) {
            return Math.log(scale2 / 256) / Math.LN2;
          },
          // @method getProjectedBounds(zoom: Number): Bounds
          // Returns the projection's bounds scaled and transformed for the provided `zoom`.
          getProjectedBounds: function(zoom2) {
            if (this.infinite) {
              return null;
            }
            var b = this.projection.bounds, s = this.scale(zoom2), min = this.transformation.transform(b.min, s), max = this.transformation.transform(b.max, s);
            return new Bounds(min, max);
          },
          // @method distance(latlng1: LatLng, latlng2: LatLng): Number
          // Returns the distance between two geographical coordinates.
          // @property code: String
          // Standard code name of the CRS passed into WMS services (e.g. `'EPSG:3857'`)
          //
          // @property wrapLng: Number[]
          // An array of two numbers defining whether the longitude (horizontal) coordinate
          // axis wraps around a given range and how. Defaults to `[-180, 180]` in most
          // geographical CRSs. If `undefined`, the longitude axis does not wrap around.
          //
          // @property wrapLat: Number[]
          // Like `wrapLng`, but for the latitude (vertical) axis.
          // wrapLng: [min, max],
          // wrapLat: [min, max],
          // @property infinite: Boolean
          // If true, the coordinate space will be unbounded (infinite in both axes)
          infinite: false,
          // @method wrapLatLng(latlng: LatLng): LatLng
          // Returns a `LatLng` where lat and lng has been wrapped according to the
          // CRS's `wrapLat` and `wrapLng` properties, if they are outside the CRS's bounds.
          wrapLatLng: function(latlng) {
            var lng = this.wrapLng ? wrapNum(latlng.lng, this.wrapLng, true) : latlng.lng, lat = this.wrapLat ? wrapNum(latlng.lat, this.wrapLat, true) : latlng.lat, alt = latlng.alt;
            return new LatLng(lat, lng, alt);
          },
          // @method wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds
          // Returns a `LatLngBounds` with the same size as the given one, ensuring
          // that its center is within the CRS's bounds.
          // Only accepts actual `L.LatLngBounds` instances, not arrays.
          wrapLatLngBounds: function(bounds) {
            var center = bounds.getCenter(), newCenter = this.wrapLatLng(center), latShift = center.lat - newCenter.lat, lngShift = center.lng - newCenter.lng;
            if (latShift === 0 && lngShift === 0) {
              return bounds;
            }
            var sw = bounds.getSouthWest(), ne = bounds.getNorthEast(), newSw = new LatLng(sw.lat - latShift, sw.lng - lngShift), newNe = new LatLng(ne.lat - latShift, ne.lng - lngShift);
            return new LatLngBounds(newSw, newNe);
          }
        };
        var Earth = extend({}, CRS, {
          wrapLng: [-180, 180],
          // Mean Earth Radius, as recommended for use by
          // the International Union of Geodesy and Geophysics,
          // see https://rosettacode.org/wiki/Haversine_formula
          R: 6371e3,
          // distance between two geographical points using spherical law of cosines approximation
          distance: function(latlng1, latlng2) {
            var rad = Math.PI / 180, lat1 = latlng1.lat * rad, lat2 = latlng2.lat * rad, sinDLat = Math.sin((latlng2.lat - latlng1.lat) * rad / 2), sinDLon = Math.sin((latlng2.lng - latlng1.lng) * rad / 2), a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon, c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return this.R * c;
          }
        });
        var earthRadius = 6378137;
        var SphericalMercator = {
          R: earthRadius,
          MAX_LATITUDE: 85.0511287798,
          project: function(latlng) {
            var d = Math.PI / 180, max = this.MAX_LATITUDE, lat = Math.max(Math.min(max, latlng.lat), -max), sin = Math.sin(lat * d);
            return new Point(
              this.R * latlng.lng * d,
              this.R * Math.log((1 + sin) / (1 - sin)) / 2
            );
          },
          unproject: function(point) {
            var d = 180 / Math.PI;
            return new LatLng(
              (2 * Math.atan(Math.exp(point.y / this.R)) - Math.PI / 2) * d,
              point.x * d / this.R
            );
          },
          bounds: (function() {
            var d = earthRadius * Math.PI;
            return new Bounds([-d, -d], [d, d]);
          })()
        };
        function Transformation(a, b, c, d) {
          if (isArray(a)) {
            this._a = a[0];
            this._b = a[1];
            this._c = a[2];
            this._d = a[3];
            return;
          }
          this._a = a;
          this._b = b;
          this._c = c;
          this._d = d;
        }
        Transformation.prototype = {
          // @method transform(point: Point, scale?: Number): Point
          // Returns a transformed point, optionally multiplied by the given scale.
          // Only accepts actual `L.Point` instances, not arrays.
          transform: function(point, scale2) {
            return this._transform(point.clone(), scale2);
          },
          // destructive transform (faster)
          _transform: function(point, scale2) {
            scale2 = scale2 || 1;
            point.x = scale2 * (this._a * point.x + this._b);
            point.y = scale2 * (this._c * point.y + this._d);
            return point;
          },
          // @method untransform(point: Point, scale?: Number): Point
          // Returns the reverse transformation of the given point, optionally divided
          // by the given scale. Only accepts actual `L.Point` instances, not arrays.
          untransform: function(point, scale2) {
            scale2 = scale2 || 1;
            return new Point(
              (point.x / scale2 - this._b) / this._a,
              (point.y / scale2 - this._d) / this._c
            );
          }
        };
        function toTransformation(a, b, c, d) {
          return new Transformation(a, b, c, d);
        }
        var EPSG3857 = extend({}, Earth, {
          code: "EPSG:3857",
          projection: SphericalMercator,
          transformation: (function() {
            var scale2 = 0.5 / (Math.PI * SphericalMercator.R);
            return toTransformation(scale2, 0.5, -scale2, 0.5);
          })()
        });
        var EPSG900913 = extend({}, EPSG3857, {
          code: "EPSG:900913"
        });
        function svgCreate(name2) {
          return document.createElementNS("http://www.w3.org/2000/svg", name2);
        }
        function pointsToPath(rings, closed) {
          var str = "", i, j, len, len2, points, p;
          for (i = 0, len = rings.length; i < len; i++) {
            points = rings[i];
            for (j = 0, len2 = points.length; j < len2; j++) {
              p = points[j];
              str += (j ? "L" : "M") + p.x + " " + p.y;
            }
            str += closed ? Browser.svg ? "z" : "x" : "";
          }
          return str || "M0 0";
        }
        var style = document.documentElement.style;
        var ie = "ActiveXObject" in window;
        var ielt9 = ie && !document.addEventListener;
        var edge = "msLaunchUri" in navigator && !("documentMode" in document);
        var webkit = userAgentContains("webkit");
        var android = userAgentContains("android");
        var android23 = userAgentContains("android 2") || userAgentContains("android 3");
        var webkitVer = parseInt(/WebKit\/([0-9]+)|$/.exec(navigator.userAgent)[1], 10);
        var androidStock = android && userAgentContains("Google") && webkitVer < 537 && !("AudioNode" in window);
        var opera = !!window.opera;
        var chrome = !edge && userAgentContains("chrome");
        var gecko = userAgentContains("gecko") && !webkit && !opera && !ie;
        var safari = !chrome && userAgentContains("safari");
        var phantom = userAgentContains("phantom");
        var opera12 = "OTransition" in style;
        var win = navigator.platform.indexOf("Win") === 0;
        var ie3d = ie && "transition" in style;
        var webkit3d = "WebKitCSSMatrix" in window && "m11" in new window.WebKitCSSMatrix() && !android23;
        var gecko3d = "MozPerspective" in style;
        var any3d = !window.L_DISABLE_3D && (ie3d || webkit3d || gecko3d) && !opera12 && !phantom;
        var mobile = typeof orientation !== "undefined" || userAgentContains("mobile");
        var mobileWebkit = mobile && webkit;
        var mobileWebkit3d = mobile && webkit3d;
        var msPointer = !window.PointerEvent && window.MSPointerEvent;
        var pointer = !!(window.PointerEvent || msPointer);
        var touchNative = "ontouchstart" in window || !!window.TouchEvent;
        var touch = !window.L_NO_TOUCH && (touchNative || pointer);
        var mobileOpera = mobile && opera;
        var mobileGecko = mobile && gecko;
        var retina = (window.devicePixelRatio || window.screen.deviceXDPI / window.screen.logicalXDPI) > 1;
        var passiveEvents = (function() {
          var supportsPassiveOption = false;
          try {
            var opts = Object.defineProperty({}, "passive", {
              get: function() {
                supportsPassiveOption = true;
              }
            });
            window.addEventListener("testPassiveEventSupport", falseFn, opts);
            window.removeEventListener("testPassiveEventSupport", falseFn, opts);
          } catch (e) {
          }
          return supportsPassiveOption;
        })();
        var canvas$1 = (function() {
          return !!document.createElement("canvas").getContext;
        })();
        var svg$1 = !!(document.createElementNS && svgCreate("svg").createSVGRect);
        var inlineSvg = !!svg$1 && (function() {
          var div = document.createElement("div");
          div.innerHTML = "<svg/>";
          return (div.firstChild && div.firstChild.namespaceURI) === "http://www.w3.org/2000/svg";
        })();
        var vml = !svg$1 && (function() {
          try {
            var div = document.createElement("div");
            div.innerHTML = '<v:shape adj="1"/>';
            var shape = div.firstChild;
            shape.style.behavior = "url(#default#VML)";
            return shape && typeof shape.adj === "object";
          } catch (e) {
            return false;
          }
        })();
        var mac = navigator.platform.indexOf("Mac") === 0;
        var linux = navigator.platform.indexOf("Linux") === 0;
        function userAgentContains(str) {
          return navigator.userAgent.toLowerCase().indexOf(str) >= 0;
        }
        var Browser = {
          ie,
          ielt9,
          edge,
          webkit,
          android,
          android23,
          androidStock,
          opera,
          chrome,
          gecko,
          safari,
          phantom,
          opera12,
          win,
          ie3d,
          webkit3d,
          gecko3d,
          any3d,
          mobile,
          mobileWebkit,
          mobileWebkit3d,
          msPointer,
          pointer,
          touch,
          touchNative,
          mobileOpera,
          mobileGecko,
          retina,
          passiveEvents,
          canvas: canvas$1,
          svg: svg$1,
          vml,
          inlineSvg,
          mac,
          linux
        };
        var POINTER_DOWN = Browser.msPointer ? "MSPointerDown" : "pointerdown";
        var POINTER_MOVE = Browser.msPointer ? "MSPointerMove" : "pointermove";
        var POINTER_UP = Browser.msPointer ? "MSPointerUp" : "pointerup";
        var POINTER_CANCEL = Browser.msPointer ? "MSPointerCancel" : "pointercancel";
        var pEvent = {
          touchstart: POINTER_DOWN,
          touchmove: POINTER_MOVE,
          touchend: POINTER_UP,
          touchcancel: POINTER_CANCEL
        };
        var handle = {
          touchstart: _onPointerStart,
          touchmove: _handlePointer,
          touchend: _handlePointer,
          touchcancel: _handlePointer
        };
        var _pointers = {};
        var _pointerDocListener = false;
        function addPointerListener(obj, type, handler) {
          if (type === "touchstart") {
            _addPointerDocListener();
          }
          if (!handle[type]) {
            console.warn("wrong event specified:", type);
            return falseFn;
          }
          handler = handle[type].bind(this, handler);
          obj.addEventListener(pEvent[type], handler, false);
          return handler;
        }
        function removePointerListener(obj, type, handler) {
          if (!pEvent[type]) {
            console.warn("wrong event specified:", type);
            return;
          }
          obj.removeEventListener(pEvent[type], handler, false);
        }
        function _globalPointerDown(e) {
          _pointers[e.pointerId] = e;
        }
        function _globalPointerMove(e) {
          if (_pointers[e.pointerId]) {
            _pointers[e.pointerId] = e;
          }
        }
        function _globalPointerUp(e) {
          delete _pointers[e.pointerId];
        }
        function _addPointerDocListener() {
          if (!_pointerDocListener) {
            document.addEventListener(POINTER_DOWN, _globalPointerDown, true);
            document.addEventListener(POINTER_MOVE, _globalPointerMove, true);
            document.addEventListener(POINTER_UP, _globalPointerUp, true);
            document.addEventListener(POINTER_CANCEL, _globalPointerUp, true);
            _pointerDocListener = true;
          }
        }
        function _handlePointer(handler, e) {
          if (e.pointerType === (e.MSPOINTER_TYPE_MOUSE || "mouse")) {
            return;
          }
          e.touches = [];
          for (var i in _pointers) {
            e.touches.push(_pointers[i]);
          }
          e.changedTouches = [e];
          handler(e);
        }
        function _onPointerStart(handler, e) {
          if (e.MSPOINTER_TYPE_TOUCH && e.pointerType === e.MSPOINTER_TYPE_TOUCH) {
            preventDefault(e);
          }
          _handlePointer(handler, e);
        }
        function makeDblclick(event) {
          var newEvent = {}, prop, i;
          for (i in event) {
            prop = event[i];
            newEvent[i] = prop && prop.bind ? prop.bind(event) : prop;
          }
          event = newEvent;
          newEvent.type = "dblclick";
          newEvent.detail = 2;
          newEvent.isTrusted = false;
          newEvent._simulated = true;
          return newEvent;
        }
        var delay = 200;
        function addDoubleTapListener(obj, handler) {
          obj.addEventListener("dblclick", handler);
          var last = 0, detail;
          function simDblclick(e) {
            if (e.detail !== 1) {
              detail = e.detail;
              return;
            }
            if (e.pointerType === "mouse" || e.sourceCapabilities && !e.sourceCapabilities.firesTouchEvents) {
              return;
            }
            var path = getPropagationPath(e);
            if (path.some(function(el) {
              return el instanceof HTMLLabelElement && el.attributes.for;
            }) && !path.some(function(el) {
              return el instanceof HTMLInputElement || el instanceof HTMLSelectElement;
            })) {
              return;
            }
            var now = Date.now();
            if (now - last <= delay) {
              detail++;
              if (detail === 2) {
                handler(makeDblclick(e));
              }
            } else {
              detail = 1;
            }
            last = now;
          }
          obj.addEventListener("click", simDblclick);
          return {
            dblclick: handler,
            simDblclick
          };
        }
        function removeDoubleTapListener(obj, handlers) {
          obj.removeEventListener("dblclick", handlers.dblclick);
          obj.removeEventListener("click", handlers.simDblclick);
        }
        var TRANSFORM = testProp(
          ["transform", "webkitTransform", "OTransform", "MozTransform", "msTransform"]
        );
        var TRANSITION = testProp(
          ["webkitTransition", "transition", "OTransition", "MozTransition", "msTransition"]
        );
        var TRANSITION_END = TRANSITION === "webkitTransition" || TRANSITION === "OTransition" ? TRANSITION + "End" : "transitionend";
        function get(id) {
          return typeof id === "string" ? document.getElementById(id) : id;
        }
        function getStyle(el, style2) {
          var value = el.style[style2] || el.currentStyle && el.currentStyle[style2];
          if ((!value || value === "auto") && document.defaultView) {
            var css = document.defaultView.getComputedStyle(el, null);
            value = css ? css[style2] : null;
          }
          return value === "auto" ? null : value;
        }
        function create$1(tagName, className, container) {
          var el = document.createElement(tagName);
          el.className = className || "";
          if (container) {
            container.appendChild(el);
          }
          return el;
        }
        function remove(el) {
          var parent = el.parentNode;
          if (parent) {
            parent.removeChild(el);
          }
        }
        function empty(el) {
          while (el.firstChild) {
            el.removeChild(el.firstChild);
          }
        }
        function toFront(el) {
          var parent = el.parentNode;
          if (parent && parent.lastChild !== el) {
            parent.appendChild(el);
          }
        }
        function toBack(el) {
          var parent = el.parentNode;
          if (parent && parent.firstChild !== el) {
            parent.insertBefore(el, parent.firstChild);
          }
        }
        function hasClass(el, name2) {
          if (el.classList !== void 0) {
            return el.classList.contains(name2);
          }
          var className = getClass(el);
          return className.length > 0 && new RegExp("(^|\\s)" + name2 + "(\\s|$)").test(className);
        }
        function addClass(el, name2) {
          if (el.classList !== void 0) {
            var classes = splitWords(name2);
            for (var i = 0, len = classes.length; i < len; i++) {
              el.classList.add(classes[i]);
            }
          } else if (!hasClass(el, name2)) {
            var className = getClass(el);
            setClass(el, (className ? className + " " : "") + name2);
          }
        }
        function removeClass(el, name2) {
          if (el.classList !== void 0) {
            el.classList.remove(name2);
          } else {
            setClass(el, trim((" " + getClass(el) + " ").replace(" " + name2 + " ", " ")));
          }
        }
        function setClass(el, name2) {
          if (el.className.baseVal === void 0) {
            el.className = name2;
          } else {
            el.className.baseVal = name2;
          }
        }
        function getClass(el) {
          if (el.correspondingElement) {
            el = el.correspondingElement;
          }
          return el.className.baseVal === void 0 ? el.className : el.className.baseVal;
        }
        function setOpacity(el, value) {
          if ("opacity" in el.style) {
            el.style.opacity = value;
          } else if ("filter" in el.style) {
            _setOpacityIE(el, value);
          }
        }
        function _setOpacityIE(el, value) {
          var filter = false, filterName = "DXImageTransform.Microsoft.Alpha";
          try {
            filter = el.filters.item(filterName);
          } catch (e) {
            if (value === 1) {
              return;
            }
          }
          value = Math.round(value * 100);
          if (filter) {
            filter.Enabled = value !== 100;
            filter.Opacity = value;
          } else {
            el.style.filter += " progid:" + filterName + "(opacity=" + value + ")";
          }
        }
        function testProp(props) {
          var style2 = document.documentElement.style;
          for (var i = 0; i < props.length; i++) {
            if (props[i] in style2) {
              return props[i];
            }
          }
          return false;
        }
        function setTransform(el, offset, scale2) {
          var pos = offset || new Point(0, 0);
          el.style[TRANSFORM] = (Browser.ie3d ? "translate(" + pos.x + "px," + pos.y + "px)" : "translate3d(" + pos.x + "px," + pos.y + "px,0)") + (scale2 ? " scale(" + scale2 + ")" : "");
        }
        function setPosition(el, point) {
          el._leaflet_pos = point;
          if (Browser.any3d) {
            setTransform(el, point);
          } else {
            el.style.left = point.x + "px";
            el.style.top = point.y + "px";
          }
        }
        function getPosition(el) {
          return el._leaflet_pos || new Point(0, 0);
        }
        var disableTextSelection;
        var enableTextSelection;
        var _userSelect;
        if ("onselectstart" in document) {
          disableTextSelection = function() {
            on(window, "selectstart", preventDefault);
          };
          enableTextSelection = function() {
            off(window, "selectstart", preventDefault);
          };
        } else {
          var userSelectProperty = testProp(
            ["userSelect", "WebkitUserSelect", "OUserSelect", "MozUserSelect", "msUserSelect"]
          );
          disableTextSelection = function() {
            if (userSelectProperty) {
              var style2 = document.documentElement.style;
              _userSelect = style2[userSelectProperty];
              style2[userSelectProperty] = "none";
            }
          };
          enableTextSelection = function() {
            if (userSelectProperty) {
              document.documentElement.style[userSelectProperty] = _userSelect;
              _userSelect = void 0;
            }
          };
        }
        function disableImageDrag() {
          on(window, "dragstart", preventDefault);
        }
        function enableImageDrag() {
          off(window, "dragstart", preventDefault);
        }
        var _outlineElement, _outlineStyle;
        function preventOutline(element) {
          while (element.tabIndex === -1) {
            element = element.parentNode;
          }
          if (!element.style) {
            return;
          }
          restoreOutline();
          _outlineElement = element;
          _outlineStyle = element.style.outlineStyle;
          element.style.outlineStyle = "none";
          on(window, "keydown", restoreOutline);
        }
        function restoreOutline() {
          if (!_outlineElement) {
            return;
          }
          _outlineElement.style.outlineStyle = _outlineStyle;
          _outlineElement = void 0;
          _outlineStyle = void 0;
          off(window, "keydown", restoreOutline);
        }
        function getSizedParentNode(element) {
          do {
            element = element.parentNode;
          } while ((!element.offsetWidth || !element.offsetHeight) && element !== document.body);
          return element;
        }
        function getScale(element) {
          var rect = element.getBoundingClientRect();
          return {
            x: rect.width / element.offsetWidth || 1,
            y: rect.height / element.offsetHeight || 1,
            boundingClientRect: rect
          };
        }
        var DomUtil = {
          __proto__: null,
          TRANSFORM,
          TRANSITION,
          TRANSITION_END,
          get,
          getStyle,
          create: create$1,
          remove,
          empty,
          toFront,
          toBack,
          hasClass,
          addClass,
          removeClass,
          setClass,
          getClass,
          setOpacity,
          testProp,
          setTransform,
          setPosition,
          getPosition,
          get disableTextSelection() {
            return disableTextSelection;
          },
          get enableTextSelection() {
            return enableTextSelection;
          },
          disableImageDrag,
          enableImageDrag,
          preventOutline,
          restoreOutline,
          getSizedParentNode,
          getScale
        };
        function on(obj, types, fn, context) {
          if (types && typeof types === "object") {
            for (var type in types) {
              addOne(obj, type, types[type], fn);
            }
          } else {
            types = splitWords(types);
            for (var i = 0, len = types.length; i < len; i++) {
              addOne(obj, types[i], fn, context);
            }
          }
          return this;
        }
        var eventsKey = "_leaflet_events";
        function off(obj, types, fn, context) {
          if (arguments.length === 1) {
            batchRemove(obj);
            delete obj[eventsKey];
          } else if (types && typeof types === "object") {
            for (var type in types) {
              removeOne(obj, type, types[type], fn);
            }
          } else {
            types = splitWords(types);
            if (arguments.length === 2) {
              batchRemove(obj, function(type2) {
                return indexOf(types, type2) !== -1;
              });
            } else {
              for (var i = 0, len = types.length; i < len; i++) {
                removeOne(obj, types[i], fn, context);
              }
            }
          }
          return this;
        }
        function batchRemove(obj, filterFn) {
          for (var id in obj[eventsKey]) {
            var type = id.split(/\d/)[0];
            if (!filterFn || filterFn(type)) {
              removeOne(obj, type, null, null, id);
            }
          }
        }
        var mouseSubst = {
          mouseenter: "mouseover",
          mouseleave: "mouseout",
          wheel: !("onwheel" in window) && "mousewheel"
        };
        function addOne(obj, type, fn, context) {
          var id = type + stamp(fn) + (context ? "_" + stamp(context) : "");
          if (obj[eventsKey] && obj[eventsKey][id]) {
            return this;
          }
          var handler = function(e) {
            return fn.call(context || obj, e || window.event);
          };
          var originalHandler = handler;
          if (!Browser.touchNative && Browser.pointer && type.indexOf("touch") === 0) {
            handler = addPointerListener(obj, type, handler);
          } else if (Browser.touch && type === "dblclick") {
            handler = addDoubleTapListener(obj, handler);
          } else if ("addEventListener" in obj) {
            if (type === "touchstart" || type === "touchmove" || type === "wheel" || type === "mousewheel") {
              obj.addEventListener(mouseSubst[type] || type, handler, Browser.passiveEvents ? { passive: false } : false);
            } else if (type === "mouseenter" || type === "mouseleave") {
              handler = function(e) {
                e = e || window.event;
                if (isExternalTarget(obj, e)) {
                  originalHandler(e);
                }
              };
              obj.addEventListener(mouseSubst[type], handler, false);
            } else {
              obj.addEventListener(type, originalHandler, false);
            }
          } else {
            obj.attachEvent("on" + type, handler);
          }
          obj[eventsKey] = obj[eventsKey] || {};
          obj[eventsKey][id] = handler;
        }
        function removeOne(obj, type, fn, context, id) {
          id = id || type + stamp(fn) + (context ? "_" + stamp(context) : "");
          var handler = obj[eventsKey] && obj[eventsKey][id];
          if (!handler) {
            return this;
          }
          if (!Browser.touchNative && Browser.pointer && type.indexOf("touch") === 0) {
            removePointerListener(obj, type, handler);
          } else if (Browser.touch && type === "dblclick") {
            removeDoubleTapListener(obj, handler);
          } else if ("removeEventListener" in obj) {
            obj.removeEventListener(mouseSubst[type] || type, handler, false);
          } else {
            obj.detachEvent("on" + type, handler);
          }
          obj[eventsKey][id] = null;
        }
        function stopPropagation(e) {
          if (e.stopPropagation) {
            e.stopPropagation();
          } else if (e.originalEvent) {
            e.originalEvent._stopped = true;
          } else {
            e.cancelBubble = true;
          }
          return this;
        }
        function disableScrollPropagation(el) {
          addOne(el, "wheel", stopPropagation);
          return this;
        }
        function disableClickPropagation(el) {
          on(el, "mousedown touchstart dblclick contextmenu", stopPropagation);
          el["_leaflet_disable_click"] = true;
          return this;
        }
        function preventDefault(e) {
          if (e.preventDefault) {
            e.preventDefault();
          } else {
            e.returnValue = false;
          }
          return this;
        }
        function stop(e) {
          preventDefault(e);
          stopPropagation(e);
          return this;
        }
        function getPropagationPath(ev) {
          if (ev.composedPath) {
            return ev.composedPath();
          }
          var path = [];
          var el = ev.target;
          while (el) {
            path.push(el);
            el = el.parentNode;
          }
          return path;
        }
        function getMousePosition(e, container) {
          if (!container) {
            return new Point(e.clientX, e.clientY);
          }
          var scale2 = getScale(container), offset = scale2.boundingClientRect;
          return new Point(
            // offset.left/top values are in page scale (like clientX/Y),
            // whereas clientLeft/Top (border width) values are the original values (before CSS scale applies).
            (e.clientX - offset.left) / scale2.x - container.clientLeft,
            (e.clientY - offset.top) / scale2.y - container.clientTop
          );
        }
        var wheelPxFactor = Browser.linux && Browser.chrome ? window.devicePixelRatio : Browser.mac ? window.devicePixelRatio * 3 : window.devicePixelRatio > 0 ? 2 * window.devicePixelRatio : 1;
        function getWheelDelta(e) {
          return Browser.edge ? e.wheelDeltaY / 2 : (
            // Don't trust window-geometry-based delta
            e.deltaY && e.deltaMode === 0 ? -e.deltaY / wheelPxFactor : (
              // Pixels
              e.deltaY && e.deltaMode === 1 ? -e.deltaY * 20 : (
                // Lines
                e.deltaY && e.deltaMode === 2 ? -e.deltaY * 60 : (
                  // Pages
                  e.deltaX || e.deltaZ ? 0 : (
                    // Skip horizontal/depth wheel events
                    e.wheelDelta ? (e.wheelDeltaY || e.wheelDelta) / 2 : (
                      // Legacy IE pixels
                      e.detail && Math.abs(e.detail) < 32765 ? -e.detail * 20 : (
                        // Legacy Moz lines
                        e.detail ? e.detail / -32765 * 60 : (
                          // Legacy Moz pages
                          0
                        )
                      )
                    )
                  )
                )
              )
            )
          );
        }
        function isExternalTarget(el, e) {
          var related = e.relatedTarget;
          if (!related) {
            return true;
          }
          try {
            while (related && related !== el) {
              related = related.parentNode;
            }
          } catch (err) {
            return false;
          }
          return related !== el;
        }
        var DomEvent = {
          __proto__: null,
          on,
          off,
          stopPropagation,
          disableScrollPropagation,
          disableClickPropagation,
          preventDefault,
          stop,
          getPropagationPath,
          getMousePosition,
          getWheelDelta,
          isExternalTarget,
          addListener: on,
          removeListener: off
        };
        var PosAnimation = Evented.extend({
          // @method run(el: HTMLElement, newPos: Point, duration?: Number, easeLinearity?: Number)
          // Run an animation of a given element to a new position, optionally setting
          // duration in seconds (`0.25` by default) and easing linearity factor (3rd
          // argument of the [cubic bezier curve](https://cubic-bezier.com/#0,0,.5,1),
          // `0.5` by default).
          run: function(el, newPos, duration, easeLinearity) {
            this.stop();
            this._el = el;
            this._inProgress = true;
            this._duration = duration || 0.25;
            this._easeOutPower = 1 / Math.max(easeLinearity || 0.5, 0.2);
            this._startPos = getPosition(el);
            this._offset = newPos.subtract(this._startPos);
            this._startTime = +/* @__PURE__ */ new Date();
            this.fire("start");
            this._animate();
          },
          // @method stop()
          // Stops the animation (if currently running).
          stop: function() {
            if (!this._inProgress) {
              return;
            }
            this._step(true);
            this._complete();
          },
          _animate: function() {
            this._animId = requestAnimFrame(this._animate, this);
            this._step();
          },
          _step: function(round) {
            var elapsed = +/* @__PURE__ */ new Date() - this._startTime, duration = this._duration * 1e3;
            if (elapsed < duration) {
              this._runFrame(this._easeOut(elapsed / duration), round);
            } else {
              this._runFrame(1);
              this._complete();
            }
          },
          _runFrame: function(progress, round) {
            var pos = this._startPos.add(this._offset.multiplyBy(progress));
            if (round) {
              pos._round();
            }
            setPosition(this._el, pos);
            this.fire("step");
          },
          _complete: function() {
            cancelAnimFrame(this._animId);
            this._inProgress = false;
            this.fire("end");
          },
          _easeOut: function(t) {
            return 1 - Math.pow(1 - t, this._easeOutPower);
          }
        });
        var Map2 = Evented.extend({
          options: {
            // @section Map State Options
            // @option crs: CRS = L.CRS.EPSG3857
            // The [Coordinate Reference System](#crs) to use. Don't change this if you're not
            // sure what it means.
            crs: EPSG3857,
            // @option center: LatLng = undefined
            // Initial geographic center of the map
            center: void 0,
            // @option zoom: Number = undefined
            // Initial map zoom level
            zoom: void 0,
            // @option minZoom: Number = *
            // Minimum zoom level of the map.
            // If not specified and at least one `GridLayer` or `TileLayer` is in the map,
            // the lowest of their `minZoom` options will be used instead.
            minZoom: void 0,
            // @option maxZoom: Number = *
            // Maximum zoom level of the map.
            // If not specified and at least one `GridLayer` or `TileLayer` is in the map,
            // the highest of their `maxZoom` options will be used instead.
            maxZoom: void 0,
            // @option layers: Layer[] = []
            // Array of layers that will be added to the map initially
            layers: [],
            // @option maxBounds: LatLngBounds = null
            // When this option is set, the map restricts the view to the given
            // geographical bounds, bouncing the user back if the user tries to pan
            // outside the view. To set the restriction dynamically, use
            // [`setMaxBounds`](#map-setmaxbounds) method.
            maxBounds: void 0,
            // @option renderer: Renderer = *
            // The default method for drawing vector layers on the map. `L.SVG`
            // or `L.Canvas` by default depending on browser support.
            renderer: void 0,
            // @section Animation Options
            // @option zoomAnimation: Boolean = true
            // Whether the map zoom animation is enabled. By default it's enabled
            // in all browsers that support CSS3 Transitions except Android.
            zoomAnimation: true,
            // @option zoomAnimationThreshold: Number = 4
            // Won't animate zoom if the zoom difference exceeds this value.
            zoomAnimationThreshold: 4,
            // @option fadeAnimation: Boolean = true
            // Whether the tile fade animation is enabled. By default it's enabled
            // in all browsers that support CSS3 Transitions except Android.
            fadeAnimation: true,
            // @option markerZoomAnimation: Boolean = true
            // Whether markers animate their zoom with the zoom animation, if disabled
            // they will disappear for the length of the animation. By default it's
            // enabled in all browsers that support CSS3 Transitions except Android.
            markerZoomAnimation: true,
            // @option transform3DLimit: Number = 2^23
            // Defines the maximum size of a CSS translation transform. The default
            // value should not be changed unless a web browser positions layers in
            // the wrong place after doing a large `panBy`.
            transform3DLimit: 8388608,
            // Precision limit of a 32-bit float
            // @section Interaction Options
            // @option zoomSnap: Number = 1
            // Forces the map's zoom level to always be a multiple of this, particularly
            // right after a [`fitBounds()`](#map-fitbounds) or a pinch-zoom.
            // By default, the zoom level snaps to the nearest integer; lower values
            // (e.g. `0.5` or `0.1`) allow for greater granularity. A value of `0`
            // means the zoom level will not be snapped after `fitBounds` or a pinch-zoom.
            zoomSnap: 1,
            // @option zoomDelta: Number = 1
            // Controls how much the map's zoom level will change after a
            // [`zoomIn()`](#map-zoomin), [`zoomOut()`](#map-zoomout), pressing `+`
            // or `-` on the keyboard, or using the [zoom controls](#control-zoom).
            // Values smaller than `1` (e.g. `0.5`) allow for greater granularity.
            zoomDelta: 1,
            // @option trackResize: Boolean = true
            // Whether the map automatically handles browser window resize to update itself.
            trackResize: true
          },
          initialize: function(id, options) {
            options = setOptions(this, options);
            this._handlers = [];
            this._layers = {};
            this._zoomBoundLayers = {};
            this._sizeChanged = true;
            this._initContainer(id);
            this._initLayout();
            this._onResize = bind(this._onResize, this);
            this._initEvents();
            if (options.maxBounds) {
              this.setMaxBounds(options.maxBounds);
            }
            if (options.zoom !== void 0) {
              this._zoom = this._limitZoom(options.zoom);
            }
            if (options.center && options.zoom !== void 0) {
              this.setView(toLatLng(options.center), options.zoom, { reset: true });
            }
            this.callInitHooks();
            this._zoomAnimated = TRANSITION && Browser.any3d && !Browser.mobileOpera && this.options.zoomAnimation;
            if (this._zoomAnimated) {
              this._createAnimProxy();
              on(this._proxy, TRANSITION_END, this._catchTransitionEnd, this);
            }
            this._addLayers(this.options.layers);
          },
          // @section Methods for modifying map state
          // @method setView(center: LatLng, zoom: Number, options?: Zoom/pan options): this
          // Sets the view of the map (geographical center and zoom) with the given
          // animation options.
          setView: function(center, zoom2, options) {
            zoom2 = zoom2 === void 0 ? this._zoom : this._limitZoom(zoom2);
            center = this._limitCenter(toLatLng(center), zoom2, this.options.maxBounds);
            options = options || {};
            this._stop();
            if (this._loaded && !options.reset && options !== true) {
              if (options.animate !== void 0) {
                options.zoom = extend({ animate: options.animate }, options.zoom);
                options.pan = extend({ animate: options.animate, duration: options.duration }, options.pan);
              }
              var moved = this._zoom !== zoom2 ? this._tryAnimatedZoom && this._tryAnimatedZoom(center, zoom2, options.zoom) : this._tryAnimatedPan(center, options.pan);
              if (moved) {
                clearTimeout(this._sizeTimer);
                return this;
              }
            }
            this._resetView(center, zoom2, options.pan && options.pan.noMoveStart);
            return this;
          },
          // @method setZoom(zoom: Number, options?: Zoom/pan options): this
          // Sets the zoom of the map.
          setZoom: function(zoom2, options) {
            if (!this._loaded) {
              this._zoom = zoom2;
              return this;
            }
            return this.setView(this.getCenter(), zoom2, { zoom: options });
          },
          // @method zoomIn(delta?: Number, options?: Zoom options): this
          // Increases the zoom of the map by `delta` ([`zoomDelta`](#map-zoomdelta) by default).
          zoomIn: function(delta, options) {
            delta = delta || (Browser.any3d ? this.options.zoomDelta : 1);
            return this.setZoom(this._zoom + delta, options);
          },
          // @method zoomOut(delta?: Number, options?: Zoom options): this
          // Decreases the zoom of the map by `delta` ([`zoomDelta`](#map-zoomdelta) by default).
          zoomOut: function(delta, options) {
            delta = delta || (Browser.any3d ? this.options.zoomDelta : 1);
            return this.setZoom(this._zoom - delta, options);
          },
          // @method setZoomAround(latlng: LatLng, zoom: Number, options: Zoom options): this
          // Zooms the map while keeping a specified geographical point on the map
          // stationary (e.g. used internally for scroll zoom and double-click zoom).
          // @alternative
          // @method setZoomAround(offset: Point, zoom: Number, options: Zoom options): this
          // Zooms the map while keeping a specified pixel on the map (relative to the top-left corner) stationary.
          setZoomAround: function(latlng, zoom2, options) {
            var scale2 = this.getZoomScale(zoom2), viewHalf = this.getSize().divideBy(2), containerPoint = latlng instanceof Point ? latlng : this.latLngToContainerPoint(latlng), centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale2), newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));
            return this.setView(newCenter, zoom2, { zoom: options });
          },
          _getBoundsCenterZoom: function(bounds, options) {
            options = options || {};
            bounds = bounds.getBounds ? bounds.getBounds() : toLatLngBounds(bounds);
            var paddingTL = toPoint(options.paddingTopLeft || options.padding || [0, 0]), paddingBR = toPoint(options.paddingBottomRight || options.padding || [0, 0]), zoom2 = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR));
            zoom2 = typeof options.maxZoom === "number" ? Math.min(options.maxZoom, zoom2) : zoom2;
            if (zoom2 === Infinity) {
              return {
                center: bounds.getCenter(),
                zoom: zoom2
              };
            }
            var paddingOffset = paddingBR.subtract(paddingTL).divideBy(2), swPoint = this.project(bounds.getSouthWest(), zoom2), nePoint = this.project(bounds.getNorthEast(), zoom2), center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom2);
            return {
              center,
              zoom: zoom2
            };
          },
          // @method fitBounds(bounds: LatLngBounds, options?: fitBounds options): this
          // Sets a map view that contains the given geographical bounds with the
          // maximum zoom level possible.
          fitBounds: function(bounds, options) {
            bounds = toLatLngBounds(bounds);
            if (!bounds.isValid()) {
              throw new Error("Bounds are not valid.");
            }
            var target = this._getBoundsCenterZoom(bounds, options);
            return this.setView(target.center, target.zoom, options);
          },
          // @method fitWorld(options?: fitBounds options): this
          // Sets a map view that mostly contains the whole world with the maximum
          // zoom level possible.
          fitWorld: function(options) {
            return this.fitBounds([[-90, -180], [90, 180]], options);
          },
          // @method panTo(latlng: LatLng, options?: Pan options): this
          // Pans the map to a given center.
          panTo: function(center, options) {
            return this.setView(center, this._zoom, { pan: options });
          },
          // @method panBy(offset: Point, options?: Pan options): this
          // Pans the map by a given number of pixels (animated).
          panBy: function(offset, options) {
            offset = toPoint(offset).round();
            options = options || {};
            if (!offset.x && !offset.y) {
              return this.fire("moveend");
            }
            if (options.animate !== true && !this.getSize().contains(offset)) {
              this._resetView(this.unproject(this.project(this.getCenter()).add(offset)), this.getZoom());
              return this;
            }
            if (!this._panAnim) {
              this._panAnim = new PosAnimation();
              this._panAnim.on({
                "step": this._onPanTransitionStep,
                "end": this._onPanTransitionEnd
              }, this);
            }
            if (!options.noMoveStart) {
              this.fire("movestart");
            }
            if (options.animate !== false) {
              addClass(this._mapPane, "leaflet-pan-anim");
              var newPos = this._getMapPanePos().subtract(offset).round();
              this._panAnim.run(this._mapPane, newPos, options.duration || 0.25, options.easeLinearity);
            } else {
              this._rawPanBy(offset);
              this.fire("move").fire("moveend");
            }
            return this;
          },
          // @method flyTo(latlng: LatLng, zoom?: Number, options?: Zoom/pan options): this
          // Sets the view of the map (geographical center and zoom) performing a smooth
          // pan-zoom animation.
          flyTo: function(targetCenter, targetZoom, options) {
            options = options || {};
            if (options.animate === false || !Browser.any3d) {
              return this.setView(targetCenter, targetZoom, options);
            }
            this._stop();
            var from = this.project(this.getCenter()), to = this.project(targetCenter), size = this.getSize(), startZoom = this._zoom;
            targetCenter = toLatLng(targetCenter);
            targetZoom = targetZoom === void 0 ? startZoom : targetZoom;
            var w0 = Math.max(size.x, size.y), w1 = w0 * this.getZoomScale(startZoom, targetZoom), u1 = to.distanceTo(from) || 1, rho = 1.42, rho2 = rho * rho;
            function r(i) {
              var s1 = i ? -1 : 1, s2 = i ? w1 : w0, t1 = w1 * w1 - w0 * w0 + s1 * rho2 * rho2 * u1 * u1, b1 = 2 * s2 * rho2 * u1, b = t1 / b1, sq = Math.sqrt(b * b + 1) - b;
              var log = sq < 1e-9 ? -18 : Math.log(sq);
              return log;
            }
            function sinh(n) {
              return (Math.exp(n) - Math.exp(-n)) / 2;
            }
            function cosh(n) {
              return (Math.exp(n) + Math.exp(-n)) / 2;
            }
            function tanh(n) {
              return sinh(n) / cosh(n);
            }
            var r0 = r(0);
            function w(s) {
              return w0 * (cosh(r0) / cosh(r0 + rho * s));
            }
            function u(s) {
              return w0 * (cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2;
            }
            function easeOut(t) {
              return 1 - Math.pow(1 - t, 1.5);
            }
            var start = Date.now(), S = (r(1) - r0) / rho, duration = options.duration ? 1e3 * options.duration : 1e3 * S * 0.8;
            function frame() {
              var t = (Date.now() - start) / duration, s = easeOut(t) * S;
              if (t <= 1) {
                this._flyToFrame = requestAnimFrame(frame, this);
                this._move(
                  this.unproject(from.add(to.subtract(from).multiplyBy(u(s) / u1)), startZoom),
                  this.getScaleZoom(w0 / w(s), startZoom),
                  { flyTo: true }
                );
              } else {
                this._move(targetCenter, targetZoom)._moveEnd(true);
              }
            }
            this._moveStart(true, options.noMoveStart);
            frame.call(this);
            return this;
          },
          // @method flyToBounds(bounds: LatLngBounds, options?: fitBounds options): this
          // Sets the view of the map with a smooth animation like [`flyTo`](#map-flyto),
          // but takes a bounds parameter like [`fitBounds`](#map-fitbounds).
          flyToBounds: function(bounds, options) {
            var target = this._getBoundsCenterZoom(bounds, options);
            return this.flyTo(target.center, target.zoom, options);
          },
          // @method setMaxBounds(bounds: LatLngBounds): this
          // Restricts the map view to the given bounds (see the [maxBounds](#map-maxbounds) option).
          setMaxBounds: function(bounds) {
            bounds = toLatLngBounds(bounds);
            if (this.listens("moveend", this._panInsideMaxBounds)) {
              this.off("moveend", this._panInsideMaxBounds);
            }
            if (!bounds.isValid()) {
              this.options.maxBounds = null;
              return this;
            }
            this.options.maxBounds = bounds;
            if (this._loaded) {
              this._panInsideMaxBounds();
            }
            return this.on("moveend", this._panInsideMaxBounds);
          },
          // @method setMinZoom(zoom: Number): this
          // Sets the lower limit for the available zoom levels (see the [minZoom](#map-minzoom) option).
          setMinZoom: function(zoom2) {
            var oldZoom = this.options.minZoom;
            this.options.minZoom = zoom2;
            if (this._loaded && oldZoom !== zoom2) {
              this.fire("zoomlevelschange");
              if (this.getZoom() < this.options.minZoom) {
                return this.setZoom(zoom2);
              }
            }
            return this;
          },
          // @method setMaxZoom(zoom: Number): this
          // Sets the upper limit for the available zoom levels (see the [maxZoom](#map-maxzoom) option).
          setMaxZoom: function(zoom2) {
            var oldZoom = this.options.maxZoom;
            this.options.maxZoom = zoom2;
            if (this._loaded && oldZoom !== zoom2) {
              this.fire("zoomlevelschange");
              if (this.getZoom() > this.options.maxZoom) {
                return this.setZoom(zoom2);
              }
            }
            return this;
          },
          // @method panInsideBounds(bounds: LatLngBounds, options?: Pan options): this
          // Pans the map to the closest view that would lie inside the given bounds (if it's not already), controlling the animation using the options specific, if any.
          panInsideBounds: function(bounds, options) {
            this._enforcingBounds = true;
            var center = this.getCenter(), newCenter = this._limitCenter(center, this._zoom, toLatLngBounds(bounds));
            if (!center.equals(newCenter)) {
              this.panTo(newCenter, options);
            }
            this._enforcingBounds = false;
            return this;
          },
          // @method panInside(latlng: LatLng, options?: padding options): this
          // Pans the map the minimum amount to make the `latlng` visible. Use
          // padding options to fit the display to more restricted bounds.
          // If `latlng` is already within the (optionally padded) display bounds,
          // the map will not be panned.
          panInside: function(latlng, options) {
            options = options || {};
            var paddingTL = toPoint(options.paddingTopLeft || options.padding || [0, 0]), paddingBR = toPoint(options.paddingBottomRight || options.padding || [0, 0]), pixelCenter = this.project(this.getCenter()), pixelPoint = this.project(latlng), pixelBounds = this.getPixelBounds(), paddedBounds = toBounds([pixelBounds.min.add(paddingTL), pixelBounds.max.subtract(paddingBR)]), paddedSize = paddedBounds.getSize();
            if (!paddedBounds.contains(pixelPoint)) {
              this._enforcingBounds = true;
              var centerOffset = pixelPoint.subtract(paddedBounds.getCenter());
              var offset = paddedBounds.extend(pixelPoint).getSize().subtract(paddedSize);
              pixelCenter.x += centerOffset.x < 0 ? -offset.x : offset.x;
              pixelCenter.y += centerOffset.y < 0 ? -offset.y : offset.y;
              this.panTo(this.unproject(pixelCenter), options);
              this._enforcingBounds = false;
            }
            return this;
          },
          // @method invalidateSize(options: Zoom/pan options): this
          // Checks if the map container size changed and updates the map if so —
          // call it after you've changed the map size dynamically, also animating
          // pan by default. If `options.pan` is `false`, panning will not occur.
          // If `options.debounceMoveend` is `true`, it will delay `moveend` event so
          // that it doesn't happen often even if the method is called many
          // times in a row.
          // @alternative
          // @method invalidateSize(animate: Boolean): this
          // Checks if the map container size changed and updates the map if so —
          // call it after you've changed the map size dynamically, also animating
          // pan by default.
          invalidateSize: function(options) {
            if (!this._loaded) {
              return this;
            }
            options = extend({
              animate: false,
              pan: true
            }, options === true ? { animate: true } : options);
            var oldSize = this.getSize();
            this._sizeChanged = true;
            this._lastCenter = null;
            var newSize = this.getSize(), oldCenter = oldSize.divideBy(2).round(), newCenter = newSize.divideBy(2).round(), offset = oldCenter.subtract(newCenter);
            if (!offset.x && !offset.y) {
              return this;
            }
            if (options.animate && options.pan) {
              this.panBy(offset);
            } else {
              if (options.pan) {
                this._rawPanBy(offset);
              }
              this.fire("move");
              if (options.debounceMoveend) {
                clearTimeout(this._sizeTimer);
                this._sizeTimer = setTimeout(bind(this.fire, this, "moveend"), 200);
              } else {
                this.fire("moveend");
              }
            }
            return this.fire("resize", {
              oldSize,
              newSize
            });
          },
          // @section Methods for modifying map state
          // @method stop(): this
          // Stops the currently running `panTo` or `flyTo` animation, if any.
          stop: function() {
            this.setZoom(this._limitZoom(this._zoom));
            if (!this.options.zoomSnap) {
              this.fire("viewreset");
            }
            return this._stop();
          },
          // @section Geolocation methods
          // @method locate(options?: Locate options): this
          // Tries to locate the user using the Geolocation API, firing a [`locationfound`](#map-locationfound)
          // event with location data on success or a [`locationerror`](#map-locationerror) event on failure,
          // and optionally sets the map view to the user's location with respect to
          // detection accuracy (or to the world view if geolocation failed).
          // Note that, if your page doesn't use HTTPS, this method will fail in
          // modern browsers ([Chrome 50 and newer](https://sites.google.com/a/chromium.org/dev/Home/chromium-security/deprecating-powerful-features-on-insecure-origins))
          // See `Locate options` for more details.
          locate: function(options) {
            options = this._locateOptions = extend({
              timeout: 1e4,
              watch: false
              // setView: false
              // maxZoom: <Number>
              // maximumAge: 0
              // enableHighAccuracy: false
            }, options);
            if (!("geolocation" in navigator)) {
              this._handleGeolocationError({
                code: 0,
                message: "Geolocation not supported."
              });
              return this;
            }
            var onResponse = bind(this._handleGeolocationResponse, this), onError = bind(this._handleGeolocationError, this);
            if (options.watch) {
              this._locationWatchId = navigator.geolocation.watchPosition(onResponse, onError, options);
            } else {
              navigator.geolocation.getCurrentPosition(onResponse, onError, options);
            }
            return this;
          },
          // @method stopLocate(): this
          // Stops watching location previously initiated by `map.locate({watch: true})`
          // and aborts resetting the map view if map.locate was called with
          // `{setView: true}`.
          stopLocate: function() {
            if (navigator.geolocation && navigator.geolocation.clearWatch) {
              navigator.geolocation.clearWatch(this._locationWatchId);
            }
            if (this._locateOptions) {
              this._locateOptions.setView = false;
            }
            return this;
          },
          _handleGeolocationError: function(error) {
            if (!this._container._leaflet_id) {
              return;
            }
            var c = error.code, message = error.message || (c === 1 ? "permission denied" : c === 2 ? "position unavailable" : "timeout");
            if (this._locateOptions.setView && !this._loaded) {
              this.fitWorld();
            }
            this.fire("locationerror", {
              code: c,
              message: "Geolocation error: " + message + "."
            });
          },
          _handleGeolocationResponse: function(pos) {
            if (!this._container._leaflet_id) {
              return;
            }
            var lat = pos.coords.latitude, lng = pos.coords.longitude, latlng = new LatLng(lat, lng), bounds = latlng.toBounds(pos.coords.accuracy * 2), options = this._locateOptions;
            if (options.setView) {
              var zoom2 = this.getBoundsZoom(bounds);
              this.setView(latlng, options.maxZoom ? Math.min(zoom2, options.maxZoom) : zoom2);
            }
            var data = {
              latlng,
              bounds,
              timestamp: pos.timestamp
            };
            for (var i in pos.coords) {
              if (typeof pos.coords[i] === "number") {
                data[i] = pos.coords[i];
              }
            }
            this.fire("locationfound", data);
          },
          // TODO Appropriate docs section?
          // @section Other Methods
          // @method addHandler(name: String, HandlerClass: Function): this
          // Adds a new `Handler` to the map, given its name and constructor function.
          addHandler: function(name2, HandlerClass) {
            if (!HandlerClass) {
              return this;
            }
            var handler = this[name2] = new HandlerClass(this);
            this._handlers.push(handler);
            if (this.options[name2]) {
              handler.enable();
            }
            return this;
          },
          // @method remove(): this
          // Destroys the map and clears all related event listeners.
          remove: function() {
            this._initEvents(true);
            if (this.options.maxBounds) {
              this.off("moveend", this._panInsideMaxBounds);
            }
            if (this._containerId !== this._container._leaflet_id) {
              throw new Error("Map container is being reused by another instance");
            }
            try {
              delete this._container._leaflet_id;
              delete this._containerId;
            } catch (e) {
              this._container._leaflet_id = void 0;
              this._containerId = void 0;
            }
            if (this._locationWatchId !== void 0) {
              this.stopLocate();
            }
            this._stop();
            remove(this._mapPane);
            if (this._clearControlPos) {
              this._clearControlPos();
            }
            if (this._resizeRequest) {
              cancelAnimFrame(this._resizeRequest);
              this._resizeRequest = null;
            }
            this._clearHandlers();
            if (this._loaded) {
              this.fire("unload");
            }
            var i;
            for (i in this._layers) {
              this._layers[i].remove();
            }
            for (i in this._panes) {
              remove(this._panes[i]);
            }
            this._layers = [];
            this._panes = [];
            delete this._mapPane;
            delete this._renderer;
            return this;
          },
          // @section Other Methods
          // @method createPane(name: String, container?: HTMLElement): HTMLElement
          // Creates a new [map pane](#map-pane) with the given name if it doesn't exist already,
          // then returns it. The pane is created as a child of `container`, or
          // as a child of the main map pane if not set.
          createPane: function(name2, container) {
            var className = "leaflet-pane" + (name2 ? " leaflet-" + name2.replace("Pane", "") + "-pane" : ""), pane = create$1("div", className, container || this._mapPane);
            if (name2) {
              this._panes[name2] = pane;
            }
            return pane;
          },
          // @section Methods for Getting Map State
          // @method getCenter(): LatLng
          // Returns the geographical center of the map view
          getCenter: function() {
            this._checkIfLoaded();
            if (this._lastCenter && !this._moved()) {
              return this._lastCenter.clone();
            }
            return this.layerPointToLatLng(this._getCenterLayerPoint());
          },
          // @method getZoom(): Number
          // Returns the current zoom level of the map view
          getZoom: function() {
            return this._zoom;
          },
          // @method getBounds(): LatLngBounds
          // Returns the geographical bounds visible in the current map view
          getBounds: function() {
            var bounds = this.getPixelBounds(), sw = this.unproject(bounds.getBottomLeft()), ne = this.unproject(bounds.getTopRight());
            return new LatLngBounds(sw, ne);
          },
          // @method getMinZoom(): Number
          // Returns the minimum zoom level of the map (if set in the `minZoom` option of the map or of any layers), or `0` by default.
          getMinZoom: function() {
            return this.options.minZoom === void 0 ? this._layersMinZoom || 0 : this.options.minZoom;
          },
          // @method getMaxZoom(): Number
          // Returns the maximum zoom level of the map (if set in the `maxZoom` option of the map or of any layers).
          getMaxZoom: function() {
            return this.options.maxZoom === void 0 ? this._layersMaxZoom === void 0 ? Infinity : this._layersMaxZoom : this.options.maxZoom;
          },
          // @method getBoundsZoom(bounds: LatLngBounds, inside?: Boolean, padding?: Point): Number
          // Returns the maximum zoom level on which the given bounds fit to the map
          // view in its entirety. If `inside` (optional) is set to `true`, the method
          // instead returns the minimum zoom level on which the map view fits into
          // the given bounds in its entirety.
          getBoundsZoom: function(bounds, inside, padding) {
            bounds = toLatLngBounds(bounds);
            padding = toPoint(padding || [0, 0]);
            var zoom2 = this.getZoom() || 0, min = this.getMinZoom(), max = this.getMaxZoom(), nw = bounds.getNorthWest(), se = bounds.getSouthEast(), size = this.getSize().subtract(padding), boundsSize = toBounds(this.project(se, zoom2), this.project(nw, zoom2)).getSize(), snap = Browser.any3d ? this.options.zoomSnap : 1, scalex = size.x / boundsSize.x, scaley = size.y / boundsSize.y, scale2 = inside ? Math.max(scalex, scaley) : Math.min(scalex, scaley);
            zoom2 = this.getScaleZoom(scale2, zoom2);
            if (snap) {
              zoom2 = Math.round(zoom2 / (snap / 100)) * (snap / 100);
              zoom2 = inside ? Math.ceil(zoom2 / snap) * snap : Math.floor(zoom2 / snap) * snap;
            }
            return Math.max(min, Math.min(max, zoom2));
          },
          // @method getSize(): Point
          // Returns the current size of the map container (in pixels).
          getSize: function() {
            if (!this._size || this._sizeChanged) {
              this._size = new Point(
                this._container.clientWidth || 0,
                this._container.clientHeight || 0
              );
              this._sizeChanged = false;
            }
            return this._size.clone();
          },
          // @method getPixelBounds(): Bounds
          // Returns the bounds of the current map view in projected pixel
          // coordinates (sometimes useful in layer and overlay implementations).
          getPixelBounds: function(center, zoom2) {
            var topLeftPoint = this._getTopLeftPoint(center, zoom2);
            return new Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
          },
          // TODO: Check semantics - isn't the pixel origin the 0,0 coord relative to
          // the map pane? "left point of the map layer" can be confusing, specially
          // since there can be negative offsets.
          // @method getPixelOrigin(): Point
          // Returns the projected pixel coordinates of the top left point of
          // the map layer (useful in custom layer and overlay implementations).
          getPixelOrigin: function() {
            this._checkIfLoaded();
            return this._pixelOrigin;
          },
          // @method getPixelWorldBounds(zoom?: Number): Bounds
          // Returns the world's bounds in pixel coordinates for zoom level `zoom`.
          // If `zoom` is omitted, the map's current zoom level is used.
          getPixelWorldBounds: function(zoom2) {
            return this.options.crs.getProjectedBounds(zoom2 === void 0 ? this.getZoom() : zoom2);
          },
          // @section Other Methods
          // @method getPane(pane: String|HTMLElement): HTMLElement
          // Returns a [map pane](#map-pane), given its name or its HTML element (its identity).
          getPane: function(pane) {
            return typeof pane === "string" ? this._panes[pane] : pane;
          },
          // @method getPanes(): Object
          // Returns a plain object containing the names of all [panes](#map-pane) as keys and
          // the panes as values.
          getPanes: function() {
            return this._panes;
          },
          // @method getContainer: HTMLElement
          // Returns the HTML element that contains the map.
          getContainer: function() {
            return this._container;
          },
          // @section Conversion Methods
          // @method getZoomScale(toZoom: Number, fromZoom: Number): Number
          // Returns the scale factor to be applied to a map transition from zoom level
          // `fromZoom` to `toZoom`. Used internally to help with zoom animations.
          getZoomScale: function(toZoom, fromZoom) {
            var crs = this.options.crs;
            fromZoom = fromZoom === void 0 ? this._zoom : fromZoom;
            return crs.scale(toZoom) / crs.scale(fromZoom);
          },
          // @method getScaleZoom(scale: Number, fromZoom: Number): Number
          // Returns the zoom level that the map would end up at, if it is at `fromZoom`
          // level and everything is scaled by a factor of `scale`. Inverse of
          // [`getZoomScale`](#map-getZoomScale).
          getScaleZoom: function(scale2, fromZoom) {
            var crs = this.options.crs;
            fromZoom = fromZoom === void 0 ? this._zoom : fromZoom;
            var zoom2 = crs.zoom(scale2 * crs.scale(fromZoom));
            return isNaN(zoom2) ? Infinity : zoom2;
          },
          // @method project(latlng: LatLng, zoom: Number): Point
          // Projects a geographical coordinate `LatLng` according to the projection
          // of the map's CRS, then scales it according to `zoom` and the CRS's
          // `Transformation`. The result is pixel coordinate relative to
          // the CRS origin.
          project: function(latlng, zoom2) {
            zoom2 = zoom2 === void 0 ? this._zoom : zoom2;
            return this.options.crs.latLngToPoint(toLatLng(latlng), zoom2);
          },
          // @method unproject(point: Point, zoom: Number): LatLng
          // Inverse of [`project`](#map-project).
          unproject: function(point, zoom2) {
            zoom2 = zoom2 === void 0 ? this._zoom : zoom2;
            return this.options.crs.pointToLatLng(toPoint(point), zoom2);
          },
          // @method layerPointToLatLng(point: Point): LatLng
          // Given a pixel coordinate relative to the [origin pixel](#map-getpixelorigin),
          // returns the corresponding geographical coordinate (for the current zoom level).
          layerPointToLatLng: function(point) {
            var projectedPoint = toPoint(point).add(this.getPixelOrigin());
            return this.unproject(projectedPoint);
          },
          // @method latLngToLayerPoint(latlng: LatLng): Point
          // Given a geographical coordinate, returns the corresponding pixel coordinate
          // relative to the [origin pixel](#map-getpixelorigin).
          latLngToLayerPoint: function(latlng) {
            var projectedPoint = this.project(toLatLng(latlng))._round();
            return projectedPoint._subtract(this.getPixelOrigin());
          },
          // @method wrapLatLng(latlng: LatLng): LatLng
          // Returns a `LatLng` where `lat` and `lng` has been wrapped according to the
          // map's CRS's `wrapLat` and `wrapLng` properties, if they are outside the
          // CRS's bounds.
          // By default this means longitude is wrapped around the dateline so its
          // value is between -180 and +180 degrees.
          wrapLatLng: function(latlng) {
            return this.options.crs.wrapLatLng(toLatLng(latlng));
          },
          // @method wrapLatLngBounds(bounds: LatLngBounds): LatLngBounds
          // Returns a `LatLngBounds` with the same size as the given one, ensuring that
          // its center is within the CRS's bounds.
          // By default this means the center longitude is wrapped around the dateline so its
          // value is between -180 and +180 degrees, and the majority of the bounds
          // overlaps the CRS's bounds.
          wrapLatLngBounds: function(latlng) {
            return this.options.crs.wrapLatLngBounds(toLatLngBounds(latlng));
          },
          // @method distance(latlng1: LatLng, latlng2: LatLng): Number
          // Returns the distance between two geographical coordinates according to
          // the map's CRS. By default this measures distance in meters.
          distance: function(latlng1, latlng2) {
            return this.options.crs.distance(toLatLng(latlng1), toLatLng(latlng2));
          },
          // @method containerPointToLayerPoint(point: Point): Point
          // Given a pixel coordinate relative to the map container, returns the corresponding
          // pixel coordinate relative to the [origin pixel](#map-getpixelorigin).
          containerPointToLayerPoint: function(point) {
            return toPoint(point).subtract(this._getMapPanePos());
          },
          // @method layerPointToContainerPoint(point: Point): Point
          // Given a pixel coordinate relative to the [origin pixel](#map-getpixelorigin),
          // returns the corresponding pixel coordinate relative to the map container.
          layerPointToContainerPoint: function(point) {
            return toPoint(point).add(this._getMapPanePos());
          },
          // @method containerPointToLatLng(point: Point): LatLng
          // Given a pixel coordinate relative to the map container, returns
          // the corresponding geographical coordinate (for the current zoom level).
          containerPointToLatLng: function(point) {
            var layerPoint = this.containerPointToLayerPoint(toPoint(point));
            return this.layerPointToLatLng(layerPoint);
          },
          // @method latLngToContainerPoint(latlng: LatLng): Point
          // Given a geographical coordinate, returns the corresponding pixel coordinate
          // relative to the map container.
          latLngToContainerPoint: function(latlng) {
            return this.layerPointToContainerPoint(this.latLngToLayerPoint(toLatLng(latlng)));
          },
          // @method mouseEventToContainerPoint(ev: MouseEvent): Point
          // Given a MouseEvent object, returns the pixel coordinate relative to the
          // map container where the event took place.
          mouseEventToContainerPoint: function(e) {
            return getMousePosition(e, this._container);
          },
          // @method mouseEventToLayerPoint(ev: MouseEvent): Point
          // Given a MouseEvent object, returns the pixel coordinate relative to
          // the [origin pixel](#map-getpixelorigin) where the event took place.
          mouseEventToLayerPoint: function(e) {
            return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
          },
          // @method mouseEventToLatLng(ev: MouseEvent): LatLng
          // Given a MouseEvent object, returns geographical coordinate where the
          // event took place.
          mouseEventToLatLng: function(e) {
            return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
          },
          // map initialization methods
          _initContainer: function(id) {
            var container = this._container = get(id);
            if (!container) {
              throw new Error("Map container not found.");
            } else if (container._leaflet_id) {
              throw new Error("Map container is already initialized.");
            }
            on(container, "scroll", this._onScroll, this);
            this._containerId = stamp(container);
          },
          _initLayout: function() {
            var container = this._container;
            this._fadeAnimated = this.options.fadeAnimation && Browser.any3d;
            addClass(container, "leaflet-container" + (Browser.touch ? " leaflet-touch" : "") + (Browser.retina ? " leaflet-retina" : "") + (Browser.ielt9 ? " leaflet-oldie" : "") + (Browser.safari ? " leaflet-safari" : "") + (this._fadeAnimated ? " leaflet-fade-anim" : ""));
            var position2 = getStyle(container, "position");
            if (position2 !== "absolute" && position2 !== "relative" && position2 !== "fixed" && position2 !== "sticky") {
              container.style.position = "relative";
            }
            this._initPanes();
            if (this._initControlPos) {
              this._initControlPos();
            }
          },
          _initPanes: function() {
            var panes = this._panes = {};
            this._paneRenderers = {};
            this._mapPane = this.createPane("mapPane", this._container);
            setPosition(this._mapPane, new Point(0, 0));
            this.createPane("tilePane");
            this.createPane("overlayPane");
            this.createPane("shadowPane");
            this.createPane("markerPane");
            this.createPane("tooltipPane");
            this.createPane("popupPane");
            if (!this.options.markerZoomAnimation) {
              addClass(panes.markerPane, "leaflet-zoom-hide");
              addClass(panes.shadowPane, "leaflet-zoom-hide");
            }
          },
          // private methods that modify map state
          // @section Map state change events
          _resetView: function(center, zoom2, noMoveStart) {
            setPosition(this._mapPane, new Point(0, 0));
            var loading = !this._loaded;
            this._loaded = true;
            zoom2 = this._limitZoom(zoom2);
            this.fire("viewprereset");
            var zoomChanged = this._zoom !== zoom2;
            this._moveStart(zoomChanged, noMoveStart)._move(center, zoom2)._moveEnd(zoomChanged);
            this.fire("viewreset");
            if (loading) {
              this.fire("load");
            }
          },
          _moveStart: function(zoomChanged, noMoveStart) {
            if (zoomChanged) {
              this.fire("zoomstart");
            }
            if (!noMoveStart) {
              this.fire("movestart");
            }
            return this;
          },
          _move: function(center, zoom2, data, supressEvent) {
            if (zoom2 === void 0) {
              zoom2 = this._zoom;
            }
            var zoomChanged = this._zoom !== zoom2;
            this._zoom = zoom2;
            this._lastCenter = center;
            this._pixelOrigin = this._getNewPixelOrigin(center);
            if (!supressEvent) {
              if (zoomChanged || data && data.pinch) {
                this.fire("zoom", data);
              }
              this.fire("move", data);
            } else if (data && data.pinch) {
              this.fire("zoom", data);
            }
            return this;
          },
          _moveEnd: function(zoomChanged) {
            if (zoomChanged) {
              this.fire("zoomend");
            }
            return this.fire("moveend");
          },
          _stop: function() {
            cancelAnimFrame(this._flyToFrame);
            if (this._panAnim) {
              this._panAnim.stop();
            }
            return this;
          },
          _rawPanBy: function(offset) {
            setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
          },
          _getZoomSpan: function() {
            return this.getMaxZoom() - this.getMinZoom();
          },
          _panInsideMaxBounds: function() {
            if (!this._enforcingBounds) {
              this.panInsideBounds(this.options.maxBounds);
            }
          },
          _checkIfLoaded: function() {
            if (!this._loaded) {
              throw new Error("Set map center and zoom first.");
            }
          },
          // DOM event handling
          // @section Interaction events
          _initEvents: function(remove2) {
            this._targets = {};
            this._targets[stamp(this._container)] = this;
            var onOff = remove2 ? off : on;
            onOff(this._container, "click dblclick mousedown mouseup mouseover mouseout mousemove contextmenu keypress keydown keyup", this._handleDOMEvent, this);
            if (this.options.trackResize) {
              onOff(window, "resize", this._onResize, this);
            }
            if (Browser.any3d && this.options.transform3DLimit) {
              (remove2 ? this.off : this.on).call(this, "moveend", this._onMoveEnd);
            }
          },
          _onResize: function() {
            cancelAnimFrame(this._resizeRequest);
            this._resizeRequest = requestAnimFrame(
              function() {
                this.invalidateSize({ debounceMoveend: true });
              },
              this
            );
          },
          _onScroll: function() {
            this._container.scrollTop = 0;
            this._container.scrollLeft = 0;
          },
          _onMoveEnd: function() {
            var pos = this._getMapPanePos();
            if (Math.max(Math.abs(pos.x), Math.abs(pos.y)) >= this.options.transform3DLimit) {
              this._resetView(this.getCenter(), this.getZoom());
            }
          },
          _findEventTargets: function(e, type) {
            var targets = [], target, isHover = type === "mouseout" || type === "mouseover", src = e.target || e.srcElement, dragging = false;
            while (src) {
              target = this._targets[stamp(src)];
              if (target && (type === "click" || type === "preclick") && this._draggableMoved(target)) {
                dragging = true;
                break;
              }
              if (target && target.listens(type, true)) {
                if (isHover && !isExternalTarget(src, e)) {
                  break;
                }
                targets.push(target);
                if (isHover) {
                  break;
                }
              }
              if (src === this._container) {
                break;
              }
              src = src.parentNode;
            }
            if (!targets.length && !dragging && !isHover && this.listens(type, true)) {
              targets = [this];
            }
            return targets;
          },
          _isClickDisabled: function(el) {
            while (el && el !== this._container) {
              if (el["_leaflet_disable_click"]) {
                return true;
              }
              el = el.parentNode;
            }
          },
          _handleDOMEvent: function(e) {
            var el = e.target || e.srcElement;
            if (!this._loaded || el["_leaflet_disable_events"] || e.type === "click" && this._isClickDisabled(el)) {
              return;
            }
            var type = e.type;
            if (type === "mousedown") {
              preventOutline(el);
            }
            this._fireDOMEvent(e, type);
          },
          _mouseEvents: ["click", "dblclick", "mouseover", "mouseout", "contextmenu"],
          _fireDOMEvent: function(e, type, canvasTargets) {
            if (e.type === "click") {
              var synth = extend({}, e);
              synth.type = "preclick";
              this._fireDOMEvent(synth, synth.type, canvasTargets);
            }
            var targets = this._findEventTargets(e, type);
            if (canvasTargets) {
              var filtered = [];
              for (var i = 0; i < canvasTargets.length; i++) {
                if (canvasTargets[i].listens(type, true)) {
                  filtered.push(canvasTargets[i]);
                }
              }
              targets = filtered.concat(targets);
            }
            if (!targets.length) {
              return;
            }
            if (type === "contextmenu") {
              preventDefault(e);
            }
            var target = targets[0];
            var data = {
              originalEvent: e
            };
            if (e.type !== "keypress" && e.type !== "keydown" && e.type !== "keyup") {
              var isMarker = target.getLatLng && (!target._radius || target._radius <= 10);
              data.containerPoint = isMarker ? this.latLngToContainerPoint(target.getLatLng()) : this.mouseEventToContainerPoint(e);
              data.layerPoint = this.containerPointToLayerPoint(data.containerPoint);
              data.latlng = isMarker ? target.getLatLng() : this.layerPointToLatLng(data.layerPoint);
            }
            for (i = 0; i < targets.length; i++) {
              targets[i].fire(type, data, true);
              if (data.originalEvent._stopped || targets[i].options.bubblingMouseEvents === false && indexOf(this._mouseEvents, type) !== -1) {
                return;
              }
            }
          },
          _draggableMoved: function(obj) {
            obj = obj.dragging && obj.dragging.enabled() ? obj : this;
            return obj.dragging && obj.dragging.moved() || this.boxZoom && this.boxZoom.moved();
          },
          _clearHandlers: function() {
            for (var i = 0, len = this._handlers.length; i < len; i++) {
              this._handlers[i].disable();
            }
          },
          // @section Other Methods
          // @method whenReady(fn: Function, context?: Object): this
          // Runs the given function `fn` when the map gets initialized with
          // a view (center and zoom) and at least one layer, or immediately
          // if it's already initialized, optionally passing a function context.
          whenReady: function(callback, context) {
            if (this._loaded) {
              callback.call(context || this, { target: this });
            } else {
              this.on("load", callback, context);
            }
            return this;
          },
          // private methods for getting map state
          _getMapPanePos: function() {
            return getPosition(this._mapPane) || new Point(0, 0);
          },
          _moved: function() {
            var pos = this._getMapPanePos();
            return pos && !pos.equals([0, 0]);
          },
          _getTopLeftPoint: function(center, zoom2) {
            var pixelOrigin = center && zoom2 !== void 0 ? this._getNewPixelOrigin(center, zoom2) : this.getPixelOrigin();
            return pixelOrigin.subtract(this._getMapPanePos());
          },
          _getNewPixelOrigin: function(center, zoom2) {
            var viewHalf = this.getSize()._divideBy(2);
            return this.project(center, zoom2)._subtract(viewHalf)._add(this._getMapPanePos())._round();
          },
          _latLngToNewLayerPoint: function(latlng, zoom2, center) {
            var topLeft = this._getNewPixelOrigin(center, zoom2);
            return this.project(latlng, zoom2)._subtract(topLeft);
          },
          _latLngBoundsToNewLayerBounds: function(latLngBounds, zoom2, center) {
            var topLeft = this._getNewPixelOrigin(center, zoom2);
            return toBounds([
              this.project(latLngBounds.getSouthWest(), zoom2)._subtract(topLeft),
              this.project(latLngBounds.getNorthWest(), zoom2)._subtract(topLeft),
              this.project(latLngBounds.getSouthEast(), zoom2)._subtract(topLeft),
              this.project(latLngBounds.getNorthEast(), zoom2)._subtract(topLeft)
            ]);
          },
          // layer point of the current center
          _getCenterLayerPoint: function() {
            return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
          },
          // offset of the specified place to the current center in pixels
          _getCenterOffset: function(latlng) {
            return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
          },
          // adjust center for view to get inside bounds
          _limitCenter: function(center, zoom2, bounds) {
            if (!bounds) {
              return center;
            }
            var centerPoint = this.project(center, zoom2), viewHalf = this.getSize().divideBy(2), viewBounds = new Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)), offset = this._getBoundsOffset(viewBounds, bounds, zoom2);
            if (Math.abs(offset.x) <= 1 && Math.abs(offset.y) <= 1) {
              return center;
            }
            return this.unproject(centerPoint.add(offset), zoom2);
          },
          // adjust offset for view to get inside bounds
          _limitOffset: function(offset, bounds) {
            if (!bounds) {
              return offset;
            }
            var viewBounds = this.getPixelBounds(), newBounds = new Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));
            return offset.add(this._getBoundsOffset(newBounds, bounds));
          },
          // returns offset needed for pxBounds to get inside maxBounds at a specified zoom
          _getBoundsOffset: function(pxBounds, maxBounds, zoom2) {
            var projectedMaxBounds = toBounds(
              this.project(maxBounds.getNorthEast(), zoom2),
              this.project(maxBounds.getSouthWest(), zoom2)
            ), minOffset = projectedMaxBounds.min.subtract(pxBounds.min), maxOffset = projectedMaxBounds.max.subtract(pxBounds.max), dx = this._rebound(minOffset.x, -maxOffset.x), dy = this._rebound(minOffset.y, -maxOffset.y);
            return new Point(dx, dy);
          },
          _rebound: function(left, right) {
            return left + right > 0 ? Math.round(left - right) / 2 : Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
          },
          _limitZoom: function(zoom2) {
            var min = this.getMinZoom(), max = this.getMaxZoom(), snap = Browser.any3d ? this.options.zoomSnap : 1;
            if (snap) {
              zoom2 = Math.round(zoom2 / snap) * snap;
            }
            return Math.max(min, Math.min(max, zoom2));
          },
          _onPanTransitionStep: function() {
            this.fire("move");
          },
          _onPanTransitionEnd: function() {
            removeClass(this._mapPane, "leaflet-pan-anim");
            this.fire("moveend");
          },
          _tryAnimatedPan: function(center, options) {
            var offset = this._getCenterOffset(center)._trunc();
            if ((options && options.animate) !== true && !this.getSize().contains(offset)) {
              return false;
            }
            this.panBy(offset, options);
            return true;
          },
          _createAnimProxy: function() {
            var proxy = this._proxy = create$1("div", "leaflet-proxy leaflet-zoom-animated");
            this._panes.mapPane.appendChild(proxy);
            this.on("zoomanim", function(e) {
              var prop = TRANSFORM, transform = this._proxy.style[prop];
              setTransform(this._proxy, this.project(e.center, e.zoom), this.getZoomScale(e.zoom, 1));
              if (transform === this._proxy.style[prop] && this._animatingZoom) {
                this._onZoomTransitionEnd();
              }
            }, this);
            this.on("load moveend", this._animMoveEnd, this);
            this._on("unload", this._destroyAnimProxy, this);
          },
          _destroyAnimProxy: function() {
            remove(this._proxy);
            this.off("load moveend", this._animMoveEnd, this);
            delete this._proxy;
          },
          _animMoveEnd: function() {
            var c = this.getCenter(), z = this.getZoom();
            setTransform(this._proxy, this.project(c, z), this.getZoomScale(z, 1));
          },
          _catchTransitionEnd: function(e) {
            if (this._animatingZoom && e.propertyName.indexOf("transform") >= 0) {
              this._onZoomTransitionEnd();
            }
          },
          _nothingToAnimate: function() {
            return !this._container.getElementsByClassName("leaflet-zoom-animated").length;
          },
          _tryAnimatedZoom: function(center, zoom2, options) {
            if (this._animatingZoom) {
              return true;
            }
            options = options || {};
            if (!this._zoomAnimated || options.animate === false || this._nothingToAnimate() || Math.abs(zoom2 - this._zoom) > this.options.zoomAnimationThreshold) {
              return false;
            }
            var scale2 = this.getZoomScale(zoom2), offset = this._getCenterOffset(center)._divideBy(1 - 1 / scale2);
            if (options.animate !== true && !this.getSize().contains(offset)) {
              return false;
            }
            requestAnimFrame(function() {
              this._moveStart(true, options.noMoveStart || false)._animateZoom(center, zoom2, true);
            }, this);
            return true;
          },
          _animateZoom: function(center, zoom2, startAnim, noUpdate) {
            if (!this._mapPane) {
              return;
            }
            if (startAnim) {
              this._animatingZoom = true;
              this._animateToCenter = center;
              this._animateToZoom = zoom2;
              addClass(this._mapPane, "leaflet-zoom-anim");
            }
            this.fire("zoomanim", {
              center,
              zoom: zoom2,
              noUpdate
            });
            if (!this._tempFireZoomEvent) {
              this._tempFireZoomEvent = this._zoom !== this._animateToZoom;
            }
            this._move(this._animateToCenter, this._animateToZoom, void 0, true);
            setTimeout(bind(this._onZoomTransitionEnd, this), 250);
          },
          _onZoomTransitionEnd: function() {
            if (!this._animatingZoom) {
              return;
            }
            if (this._mapPane) {
              removeClass(this._mapPane, "leaflet-zoom-anim");
            }
            this._animatingZoom = false;
            this._move(this._animateToCenter, this._animateToZoom, void 0, true);
            if (this._tempFireZoomEvent) {
              this.fire("zoom");
            }
            delete this._tempFireZoomEvent;
            this.fire("move");
            this._moveEnd(true);
          }
        });
        function createMap(id, options) {
          return new Map2(id, options);
        }
        var Control = Class.extend({
          // @section
          // @aka Control Options
          options: {
            // @option position: String = 'topright'
            // The position of the control (one of the map corners). Possible values are `'topleft'`,
            // `'topright'`, `'bottomleft'` or `'bottomright'`
            position: "topright"
          },
          initialize: function(options) {
            setOptions(this, options);
          },
          /* @section
           * Classes extending L.Control will inherit the following methods:
           *
           * @method getPosition: string
           * Returns the position of the control.
           */
          getPosition: function() {
            return this.options.position;
          },
          // @method setPosition(position: string): this
          // Sets the position of the control.
          setPosition: function(position2) {
            var map = this._map;
            if (map) {
              map.removeControl(this);
            }
            this.options.position = position2;
            if (map) {
              map.addControl(this);
            }
            return this;
          },
          // @method getContainer: HTMLElement
          // Returns the HTMLElement that contains the control.
          getContainer: function() {
            return this._container;
          },
          // @method addTo(map: Map): this
          // Adds the control to the given map.
          addTo: function(map) {
            this.remove();
            this._map = map;
            var container = this._container = this.onAdd(map), pos = this.getPosition(), corner = map._controlCorners[pos];
            addClass(container, "leaflet-control");
            if (pos.indexOf("bottom") !== -1) {
              corner.insertBefore(container, corner.firstChild);
            } else {
              corner.appendChild(container);
            }
            this._map.on("unload", this.remove, this);
            return this;
          },
          // @method remove: this
          // Removes the control from the map it is currently active on.
          remove: function() {
            if (!this._map) {
              return this;
            }
            remove(this._container);
            if (this.onRemove) {
              this.onRemove(this._map);
            }
            this._map.off("unload", this.remove, this);
            this._map = null;
            return this;
          },
          _refocusOnMap: function(e) {
            if (this._map && e && e.screenX > 0 && e.screenY > 0) {
              this._map.getContainer().focus();
            }
          }
        });
        var control = function(options) {
          return new Control(options);
        };
        Map2.include({
          // @method addControl(control: Control): this
          // Adds the given control to the map
          addControl: function(control2) {
            control2.addTo(this);
            return this;
          },
          // @method removeControl(control: Control): this
          // Removes the given control from the map
          removeControl: function(control2) {
            control2.remove();
            return this;
          },
          _initControlPos: function() {
            var corners = this._controlCorners = {}, l = "leaflet-", container = this._controlContainer = create$1("div", l + "control-container", this._container);
            function createCorner(vSide, hSide) {
              var className = l + vSide + " " + l + hSide;
              corners[vSide + hSide] = create$1("div", className, container);
            }
            createCorner("top", "left");
            createCorner("top", "right");
            createCorner("bottom", "left");
            createCorner("bottom", "right");
          },
          _clearControlPos: function() {
            for (var i in this._controlCorners) {
              remove(this._controlCorners[i]);
            }
            remove(this._controlContainer);
            delete this._controlCorners;
            delete this._controlContainer;
          }
        });
        var Layers = Control.extend({
          // @section
          // @aka Control.Layers options
          options: {
            // @option collapsed: Boolean = true
            // If `true`, the control will be collapsed into an icon and expanded on mouse hover, touch, or keyboard activation.
            collapsed: true,
            position: "topright",
            // @option autoZIndex: Boolean = true
            // If `true`, the control will assign zIndexes in increasing order to all of its layers so that the order is preserved when switching them on/off.
            autoZIndex: true,
            // @option hideSingleBase: Boolean = false
            // If `true`, the base layers in the control will be hidden when there is only one.
            hideSingleBase: false,
            // @option sortLayers: Boolean = false
            // Whether to sort the layers. When `false`, layers will keep the order
            // in which they were added to the control.
            sortLayers: false,
            // @option sortFunction: Function = *
            // A [compare function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
            // that will be used for sorting the layers, when `sortLayers` is `true`.
            // The function receives both the `L.Layer` instances and their names, as in
            // `sortFunction(layerA, layerB, nameA, nameB)`.
            // By default, it sorts layers alphabetically by their name.
            sortFunction: function(layerA, layerB, nameA, nameB) {
              return nameA < nameB ? -1 : nameB < nameA ? 1 : 0;
            }
          },
          initialize: function(baseLayers, overlays, options) {
            setOptions(this, options);
            this._layerControlInputs = [];
            this._layers = [];
            this._lastZIndex = 0;
            this._handlingClick = false;
            this._preventClick = false;
            for (var i in baseLayers) {
              this._addLayer(baseLayers[i], i);
            }
            for (i in overlays) {
              this._addLayer(overlays[i], i, true);
            }
          },
          onAdd: function(map) {
            this._initLayout();
            this._update();
            this._map = map;
            map.on("zoomend", this._checkDisabledLayers, this);
            for (var i = 0; i < this._layers.length; i++) {
              this._layers[i].layer.on("add remove", this._onLayerChange, this);
            }
            return this._container;
          },
          addTo: function(map) {
            Control.prototype.addTo.call(this, map);
            return this._expandIfNotCollapsed();
          },
          onRemove: function() {
            this._map.off("zoomend", this._checkDisabledLayers, this);
            for (var i = 0; i < this._layers.length; i++) {
              this._layers[i].layer.off("add remove", this._onLayerChange, this);
            }
          },
          // @method addBaseLayer(layer: Layer, name: String): this
          // Adds a base layer (radio button entry) with the given name to the control.
          addBaseLayer: function(layer, name2) {
            this._addLayer(layer, name2);
            return this._map ? this._update() : this;
          },
          // @method addOverlay(layer: Layer, name: String): this
          // Adds an overlay (checkbox entry) with the given name to the control.
          addOverlay: function(layer, name2) {
            this._addLayer(layer, name2, true);
            return this._map ? this._update() : this;
          },
          // @method removeLayer(layer: Layer): this
          // Remove the given layer from the control.
          removeLayer: function(layer) {
            layer.off("add remove", this._onLayerChange, this);
            var obj = this._getLayer(stamp(layer));
            if (obj) {
              this._layers.splice(this._layers.indexOf(obj), 1);
            }
            return this._map ? this._update() : this;
          },
          // @method expand(): this
          // Expand the control container if collapsed.
          expand: function() {
            addClass(this._container, "leaflet-control-layers-expanded");
            this._section.style.height = null;
            var acceptableHeight = this._map.getSize().y - (this._container.offsetTop + 50);
            if (acceptableHeight < this._section.clientHeight) {
              addClass(this._section, "leaflet-control-layers-scrollbar");
              this._section.style.height = acceptableHeight + "px";
            } else {
              removeClass(this._section, "leaflet-control-layers-scrollbar");
            }
            this._checkDisabledLayers();
            return this;
          },
          // @method collapse(): this
          // Collapse the control container if expanded.
          collapse: function() {
            removeClass(this._container, "leaflet-control-layers-expanded");
            return this;
          },
          _initLayout: function() {
            var className = "leaflet-control-layers", container = this._container = create$1("div", className), collapsed = this.options.collapsed;
            container.setAttribute("aria-haspopup", true);
            disableClickPropagation(container);
            disableScrollPropagation(container);
            var section = this._section = create$1("section", className + "-list");
            if (collapsed) {
              this._map.on("click", this.collapse, this);
              on(container, {
                mouseenter: this._expandSafely,
                mouseleave: this.collapse
              }, this);
            }
            var link = this._layersLink = create$1("a", className + "-toggle", container);
            link.href = "#";
            link.title = "Layers";
            link.setAttribute("role", "button");
            on(link, {
              keydown: function(e) {
                if (e.keyCode === 13) {
                  this._expandSafely();
                }
              },
              // Certain screen readers intercept the key event and instead send a click event
              click: function(e) {
                preventDefault(e);
                this._expandSafely();
              }
            }, this);
            if (!collapsed) {
              this.expand();
            }
            this._baseLayersList = create$1("div", className + "-base", section);
            this._separator = create$1("div", className + "-separator", section);
            this._overlaysList = create$1("div", className + "-overlays", section);
            container.appendChild(section);
          },
          _getLayer: function(id) {
            for (var i = 0; i < this._layers.length; i++) {
              if (this._layers[i] && stamp(this._layers[i].layer) === id) {
                return this._layers[i];
              }
            }
          },
          _addLayer: function(layer, name2, overlay2) {
            if (this._map) {
              layer.on("add remove", this._onLayerChange, this);
            }
            this._layers.push({
              layer,
              name: name2,
              overlay: overlay2
            });
            if (this.options.sortLayers) {
              this._layers.sort(bind(function(a, b) {
                return this.options.sortFunction(a.layer, b.layer, a.name, b.name);
              }, this));
            }
            if (this.options.autoZIndex && layer.setZIndex) {
              this._lastZIndex++;
              layer.setZIndex(this._lastZIndex);
            }
            this._expandIfNotCollapsed();
          },
          _update: function() {
            if (!this._container) {
              return this;
            }
            empty(this._baseLayersList);
            empty(this._overlaysList);
            this._layerControlInputs = [];
            var baseLayersPresent, overlaysPresent, i, obj, baseLayersCount = 0;
            for (i = 0; i < this._layers.length; i++) {
              obj = this._layers[i];
              this._addItem(obj);
              overlaysPresent = overlaysPresent || obj.overlay;
              baseLayersPresent = baseLayersPresent || !obj.overlay;
              baseLayersCount += !obj.overlay ? 1 : 0;
            }
            if (this.options.hideSingleBase) {
              baseLayersPresent = baseLayersPresent && baseLayersCount > 1;
              this._baseLayersList.style.display = baseLayersPresent ? "" : "none";
            }
            this._separator.style.display = overlaysPresent && baseLayersPresent ? "" : "none";
            return this;
          },
          _onLayerChange: function(e) {
            if (!this._handlingClick) {
              this._update();
            }
            var obj = this._getLayer(stamp(e.target));
            var type = obj.overlay ? e.type === "add" ? "overlayadd" : "overlayremove" : e.type === "add" ? "baselayerchange" : null;
            if (type) {
              this._map.fire(type, obj);
            }
          },
          // IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see https://stackoverflow.com/a/119079)
          _createRadioElement: function(name2, checked) {
            var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' + name2 + '"' + (checked ? ' checked="checked"' : "") + "/>";
            var radioFragment = document.createElement("div");
            radioFragment.innerHTML = radioHtml;
            return radioFragment.firstChild;
          },
          _addItem: function(obj) {
            var label = document.createElement("label"), checked = this._map.hasLayer(obj.layer), input;
            if (obj.overlay) {
              input = document.createElement("input");
              input.type = "checkbox";
              input.className = "leaflet-control-layers-selector";
              input.defaultChecked = checked;
            } else {
              input = this._createRadioElement("leaflet-base-layers_" + stamp(this), checked);
            }
            this._layerControlInputs.push(input);
            input.layerId = stamp(obj.layer);
            on(input, "click", this._onInputClick, this);
            var name2 = document.createElement("span");
            name2.innerHTML = " " + obj.name;
            var holder = document.createElement("span");
            label.appendChild(holder);
            holder.appendChild(input);
            holder.appendChild(name2);
            var container = obj.overlay ? this._overlaysList : this._baseLayersList;
            container.appendChild(label);
            this._checkDisabledLayers();
            return label;
          },
          _onInputClick: function() {
            if (this._preventClick) {
              return;
            }
            var inputs = this._layerControlInputs, input, layer;
            var addedLayers = [], removedLayers = [];
            this._handlingClick = true;
            for (var i = inputs.length - 1; i >= 0; i--) {
              input = inputs[i];
              layer = this._getLayer(input.layerId).layer;
              if (input.checked) {
                addedLayers.push(layer);
              } else if (!input.checked) {
                removedLayers.push(layer);
              }
            }
            for (i = 0; i < removedLayers.length; i++) {
              if (this._map.hasLayer(removedLayers[i])) {
                this._map.removeLayer(removedLayers[i]);
              }
            }
            for (i = 0; i < addedLayers.length; i++) {
              if (!this._map.hasLayer(addedLayers[i])) {
                this._map.addLayer(addedLayers[i]);
              }
            }
            this._handlingClick = false;
            this._refocusOnMap();
          },
          _checkDisabledLayers: function() {
            var inputs = this._layerControlInputs, input, layer, zoom2 = this._map.getZoom();
            for (var i = inputs.length - 1; i >= 0; i--) {
              input = inputs[i];
              layer = this._getLayer(input.layerId).layer;
              input.disabled = layer.options.minZoom !== void 0 && zoom2 < layer.options.minZoom || layer.options.maxZoom !== void 0 && zoom2 > layer.options.maxZoom;
            }
          },
          _expandIfNotCollapsed: function() {
            if (this._map && !this.options.collapsed) {
              this.expand();
            }
            return this;
          },
          _expandSafely: function() {
            var section = this._section;
            this._preventClick = true;
            on(section, "click", preventDefault);
            this.expand();
            var that = this;
            setTimeout(function() {
              off(section, "click", preventDefault);
              that._preventClick = false;
            });
          }
        });
        var layers = function(baseLayers, overlays, options) {
          return new Layers(baseLayers, overlays, options);
        };
        var Zoom = Control.extend({
          // @section
          // @aka Control.Zoom options
          options: {
            position: "topleft",
            // @option zoomInText: String = '<span aria-hidden="true">+</span>'
            // The text set on the 'zoom in' button.
            zoomInText: '<span aria-hidden="true">+</span>',
            // @option zoomInTitle: String = 'Zoom in'
            // The title set on the 'zoom in' button.
            zoomInTitle: "Zoom in",
            // @option zoomOutText: String = '<span aria-hidden="true">&#x2212;</span>'
            // The text set on the 'zoom out' button.
            zoomOutText: '<span aria-hidden="true">&#x2212;</span>',
            // @option zoomOutTitle: String = 'Zoom out'
            // The title set on the 'zoom out' button.
            zoomOutTitle: "Zoom out"
          },
          onAdd: function(map) {
            var zoomName = "leaflet-control-zoom", container = create$1("div", zoomName + " leaflet-bar"), options = this.options;
            this._zoomInButton = this._createButton(
              options.zoomInText,
              options.zoomInTitle,
              zoomName + "-in",
              container,
              this._zoomIn
            );
            this._zoomOutButton = this._createButton(
              options.zoomOutText,
              options.zoomOutTitle,
              zoomName + "-out",
              container,
              this._zoomOut
            );
            this._updateDisabled();
            map.on("zoomend zoomlevelschange", this._updateDisabled, this);
            return container;
          },
          onRemove: function(map) {
            map.off("zoomend zoomlevelschange", this._updateDisabled, this);
          },
          disable: function() {
            this._disabled = true;
            this._updateDisabled();
            return this;
          },
          enable: function() {
            this._disabled = false;
            this._updateDisabled();
            return this;
          },
          _zoomIn: function(e) {
            if (!this._disabled && this._map._zoom < this._map.getMaxZoom()) {
              this._map.zoomIn(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
            }
          },
          _zoomOut: function(e) {
            if (!this._disabled && this._map._zoom > this._map.getMinZoom()) {
              this._map.zoomOut(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
            }
          },
          _createButton: function(html, title, className, container, fn) {
            var link = create$1("a", className, container);
            link.innerHTML = html;
            link.href = "#";
            link.title = title;
            link.setAttribute("role", "button");
            link.setAttribute("aria-label", title);
            disableClickPropagation(link);
            on(link, "click", stop);
            on(link, "click", fn, this);
            on(link, "click", this._refocusOnMap, this);
            return link;
          },
          _updateDisabled: function() {
            var map = this._map, className = "leaflet-disabled";
            removeClass(this._zoomInButton, className);
            removeClass(this._zoomOutButton, className);
            this._zoomInButton.setAttribute("aria-disabled", "false");
            this._zoomOutButton.setAttribute("aria-disabled", "false");
            if (this._disabled || map._zoom === map.getMinZoom()) {
              addClass(this._zoomOutButton, className);
              this._zoomOutButton.setAttribute("aria-disabled", "true");
            }
            if (this._disabled || map._zoom === map.getMaxZoom()) {
              addClass(this._zoomInButton, className);
              this._zoomInButton.setAttribute("aria-disabled", "true");
            }
          }
        });
        Map2.mergeOptions({
          zoomControl: true
        });
        Map2.addInitHook(function() {
          if (this.options.zoomControl) {
            this.zoomControl = new Zoom();
            this.addControl(this.zoomControl);
          }
        });
        var zoom = function(options) {
          return new Zoom(options);
        };
        var Scale = Control.extend({
          // @section
          // @aka Control.Scale options
          options: {
            position: "bottomleft",
            // @option maxWidth: Number = 100
            // Maximum width of the control in pixels. The width is set dynamically to show round values (e.g. 100, 200, 500).
            maxWidth: 100,
            // @option metric: Boolean = True
            // Whether to show the metric scale line (m/km).
            metric: true,
            // @option imperial: Boolean = True
            // Whether to show the imperial scale line (mi/ft).
            imperial: true
            // @option updateWhenIdle: Boolean = false
            // If `true`, the control is updated on [`moveend`](#map-moveend), otherwise it's always up-to-date (updated on [`move`](#map-move)).
          },
          onAdd: function(map) {
            var className = "leaflet-control-scale", container = create$1("div", className), options = this.options;
            this._addScales(options, className + "-line", container);
            map.on(options.updateWhenIdle ? "moveend" : "move", this._update, this);
            map.whenReady(this._update, this);
            return container;
          },
          onRemove: function(map) {
            map.off(this.options.updateWhenIdle ? "moveend" : "move", this._update, this);
          },
          _addScales: function(options, className, container) {
            if (options.metric) {
              this._mScale = create$1("div", className, container);
            }
            if (options.imperial) {
              this._iScale = create$1("div", className, container);
            }
          },
          _update: function() {
            var map = this._map, y = map.getSize().y / 2;
            var maxMeters = map.distance(
              map.containerPointToLatLng([0, y]),
              map.containerPointToLatLng([this.options.maxWidth, y])
            );
            this._updateScales(maxMeters);
          },
          _updateScales: function(maxMeters) {
            if (this.options.metric && maxMeters) {
              this._updateMetric(maxMeters);
            }
            if (this.options.imperial && maxMeters) {
              this._updateImperial(maxMeters);
            }
          },
          _updateMetric: function(maxMeters) {
            var meters = this._getRoundNum(maxMeters), label = meters < 1e3 ? meters + " m" : meters / 1e3 + " km";
            this._updateScale(this._mScale, label, meters / maxMeters);
          },
          _updateImperial: function(maxMeters) {
            var maxFeet = maxMeters * 3.2808399, maxMiles, miles, feet;
            if (maxFeet > 5280) {
              maxMiles = maxFeet / 5280;
              miles = this._getRoundNum(maxMiles);
              this._updateScale(this._iScale, miles + " mi", miles / maxMiles);
            } else {
              feet = this._getRoundNum(maxFeet);
              this._updateScale(this._iScale, feet + " ft", feet / maxFeet);
            }
          },
          _updateScale: function(scale2, text, ratio) {
            scale2.style.width = Math.round(this.options.maxWidth * ratio) + "px";
            scale2.innerHTML = text;
          },
          _getRoundNum: function(num) {
            var pow10 = Math.pow(10, (Math.floor(num) + "").length - 1), d = num / pow10;
            d = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;
            return pow10 * d;
          }
        });
        var scale = function(options) {
          return new Scale(options);
        };
        var ukrainianFlag = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" class="leaflet-attribution-flag"><path fill="#4C7BE1" d="M0 0h12v4H0z"/><path fill="#FFD500" d="M0 4h12v3H0z"/><path fill="#E0BC00" d="M0 7h12v1H0z"/></svg>';
        var Attribution = Control.extend({
          // @section
          // @aka Control.Attribution options
          options: {
            position: "bottomright",
            // @option prefix: String|false = 'Leaflet'
            // The HTML text shown before the attributions. Pass `false` to disable.
            prefix: '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">' + (Browser.inlineSvg ? ukrainianFlag + " " : "") + "Leaflet</a>"
          },
          initialize: function(options) {
            setOptions(this, options);
            this._attributions = {};
          },
          onAdd: function(map) {
            map.attributionControl = this;
            this._container = create$1("div", "leaflet-control-attribution");
            disableClickPropagation(this._container);
            for (var i in map._layers) {
              if (map._layers[i].getAttribution) {
                this.addAttribution(map._layers[i].getAttribution());
              }
            }
            this._update();
            map.on("layeradd", this._addAttribution, this);
            return this._container;
          },
          onRemove: function(map) {
            map.off("layeradd", this._addAttribution, this);
          },
          _addAttribution: function(ev) {
            if (ev.layer.getAttribution) {
              this.addAttribution(ev.layer.getAttribution());
              ev.layer.once("remove", function() {
                this.removeAttribution(ev.layer.getAttribution());
              }, this);
            }
          },
          // @method setPrefix(prefix: String|false): this
          // The HTML text shown before the attributions. Pass `false` to disable.
          setPrefix: function(prefix) {
            this.options.prefix = prefix;
            this._update();
            return this;
          },
          // @method addAttribution(text: String): this
          // Adds an attribution text (e.g. `'&copy; OpenStreetMap contributors'`).
          addAttribution: function(text) {
            if (!text) {
              return this;
            }
            if (!this._attributions[text]) {
              this._attributions[text] = 0;
            }
            this._attributions[text]++;
            this._update();
            return this;
          },
          // @method removeAttribution(text: String): this
          // Removes an attribution text.
          removeAttribution: function(text) {
            if (!text) {
              return this;
            }
            if (this._attributions[text]) {
              this._attributions[text]--;
              this._update();
            }
            return this;
          },
          _update: function() {
            if (!this._map) {
              return;
            }
            var attribs = [];
            for (var i in this._attributions) {
              if (this._attributions[i]) {
                attribs.push(i);
              }
            }
            var prefixAndAttribs = [];
            if (this.options.prefix) {
              prefixAndAttribs.push(this.options.prefix);
            }
            if (attribs.length) {
              prefixAndAttribs.push(attribs.join(", "));
            }
            this._container.innerHTML = prefixAndAttribs.join(' <span aria-hidden="true">|</span> ');
          }
        });
        Map2.mergeOptions({
          attributionControl: true
        });
        Map2.addInitHook(function() {
          if (this.options.attributionControl) {
            new Attribution().addTo(this);
          }
        });
        var attribution = function(options) {
          return new Attribution(options);
        };
        Control.Layers = Layers;
        Control.Zoom = Zoom;
        Control.Scale = Scale;
        Control.Attribution = Attribution;
        control.layers = layers;
        control.zoom = zoom;
        control.scale = scale;
        control.attribution = attribution;
        var Handler = Class.extend({
          initialize: function(map) {
            this._map = map;
          },
          // @method enable(): this
          // Enables the handler
          enable: function() {
            if (this._enabled) {
              return this;
            }
            this._enabled = true;
            this.addHooks();
            return this;
          },
          // @method disable(): this
          // Disables the handler
          disable: function() {
            if (!this._enabled) {
              return this;
            }
            this._enabled = false;
            this.removeHooks();
            return this;
          },
          // @method enabled(): Boolean
          // Returns `true` if the handler is enabled
          enabled: function() {
            return !!this._enabled;
          }
          // @section Extension methods
          // Classes inheriting from `Handler` must implement the two following methods:
          // @method addHooks()
          // Called when the handler is enabled, should add event hooks.
          // @method removeHooks()
          // Called when the handler is disabled, should remove the event hooks added previously.
        });
        Handler.addTo = function(map, name2) {
          map.addHandler(name2, this);
          return this;
        };
        var Mixin = { Events };
        var START = Browser.touch ? "touchstart mousedown" : "mousedown";
        var Draggable = Evented.extend({
          options: {
            // @section
            // @aka Draggable options
            // @option clickTolerance: Number = 3
            // The max number of pixels a user can shift the mouse pointer during a click
            // for it to be considered a valid click (as opposed to a mouse drag).
            clickTolerance: 3
          },
          // @constructor L.Draggable(el: HTMLElement, dragHandle?: HTMLElement, preventOutline?: Boolean, options?: Draggable options)
          // Creates a `Draggable` object for moving `el` when you start dragging the `dragHandle` element (equals `el` itself by default).
          initialize: function(element, dragStartTarget, preventOutline2, options) {
            setOptions(this, options);
            this._element = element;
            this._dragStartTarget = dragStartTarget || element;
            this._preventOutline = preventOutline2;
          },
          // @method enable()
          // Enables the dragging ability
          enable: function() {
            if (this._enabled) {
              return;
            }
            on(this._dragStartTarget, START, this._onDown, this);
            this._enabled = true;
          },
          // @method disable()
          // Disables the dragging ability
          disable: function() {
            if (!this._enabled) {
              return;
            }
            if (Draggable._dragging === this) {
              this.finishDrag(true);
            }
            off(this._dragStartTarget, START, this._onDown, this);
            this._enabled = false;
            this._moved = false;
          },
          _onDown: function(e) {
            if (!this._enabled) {
              return;
            }
            this._moved = false;
            if (hasClass(this._element, "leaflet-zoom-anim")) {
              return;
            }
            if (e.touches && e.touches.length !== 1) {
              if (Draggable._dragging === this) {
                this.finishDrag();
              }
              return;
            }
            if (Draggable._dragging || e.shiftKey || e.which !== 1 && e.button !== 1 && !e.touches) {
              return;
            }
            Draggable._dragging = this;
            if (this._preventOutline) {
              preventOutline(this._element);
            }
            disableImageDrag();
            disableTextSelection();
            if (this._moving) {
              return;
            }
            this.fire("down");
            var first = e.touches ? e.touches[0] : e, sizedParent = getSizedParentNode(this._element);
            this._startPoint = new Point(first.clientX, first.clientY);
            this._startPos = getPosition(this._element);
            this._parentScale = getScale(sizedParent);
            var mouseevent = e.type === "mousedown";
            on(document, mouseevent ? "mousemove" : "touchmove", this._onMove, this);
            on(document, mouseevent ? "mouseup" : "touchend touchcancel", this._onUp, this);
          },
          _onMove: function(e) {
            if (!this._enabled) {
              return;
            }
            if (e.touches && e.touches.length > 1) {
              this._moved = true;
              return;
            }
            var first = e.touches && e.touches.length === 1 ? e.touches[0] : e, offset = new Point(first.clientX, first.clientY)._subtract(this._startPoint);
            if (!offset.x && !offset.y) {
              return;
            }
            if (Math.abs(offset.x) + Math.abs(offset.y) < this.options.clickTolerance) {
              return;
            }
            offset.x /= this._parentScale.x;
            offset.y /= this._parentScale.y;
            preventDefault(e);
            if (!this._moved) {
              this.fire("dragstart");
              this._moved = true;
              addClass(document.body, "leaflet-dragging");
              this._lastTarget = e.target || e.srcElement;
              if (window.SVGElementInstance && this._lastTarget instanceof window.SVGElementInstance) {
                this._lastTarget = this._lastTarget.correspondingUseElement;
              }
              addClass(this._lastTarget, "leaflet-drag-target");
            }
            this._newPos = this._startPos.add(offset);
            this._moving = true;
            this._lastEvent = e;
            this._updatePosition();
          },
          _updatePosition: function() {
            var e = { originalEvent: this._lastEvent };
            this.fire("predrag", e);
            setPosition(this._element, this._newPos);
            this.fire("drag", e);
          },
          _onUp: function() {
            if (!this._enabled) {
              return;
            }
            this.finishDrag();
          },
          finishDrag: function(noInertia) {
            removeClass(document.body, "leaflet-dragging");
            if (this._lastTarget) {
              removeClass(this._lastTarget, "leaflet-drag-target");
              this._lastTarget = null;
            }
            off(document, "mousemove touchmove", this._onMove, this);
            off(document, "mouseup touchend touchcancel", this._onUp, this);
            enableImageDrag();
            enableTextSelection();
            var fireDragend = this._moved && this._moving;
            this._moving = false;
            Draggable._dragging = false;
            if (fireDragend) {
              this.fire("dragend", {
                noInertia,
                distance: this._newPos.distanceTo(this._startPos)
              });
            }
          }
        });
        function clipPolygon(points, bounds, round) {
          var clippedPoints, edges = [1, 4, 2, 8], i, j, k, a, b, len, edge2, p;
          for (i = 0, len = points.length; i < len; i++) {
            points[i]._code = _getBitCode(points[i], bounds);
          }
          for (k = 0; k < 4; k++) {
            edge2 = edges[k];
            clippedPoints = [];
            for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
              a = points[i];
              b = points[j];
              if (!(a._code & edge2)) {
                if (b._code & edge2) {
                  p = _getEdgeIntersection(b, a, edge2, bounds, round);
                  p._code = _getBitCode(p, bounds);
                  clippedPoints.push(p);
                }
                clippedPoints.push(a);
              } else if (!(b._code & edge2)) {
                p = _getEdgeIntersection(b, a, edge2, bounds, round);
                p._code = _getBitCode(p, bounds);
                clippedPoints.push(p);
              }
            }
            points = clippedPoints;
          }
          return points;
        }
        function polygonCenter(latlngs, crs) {
          var i, j, p1, p2, f, area, x, y, center;
          if (!latlngs || latlngs.length === 0) {
            throw new Error("latlngs not passed");
          }
          if (!isFlat(latlngs)) {
            console.warn("latlngs are not flat! Only the first ring will be used");
            latlngs = latlngs[0];
          }
          var centroidLatLng = toLatLng([0, 0]);
          var bounds = toLatLngBounds(latlngs);
          var areaBounds = bounds.getNorthWest().distanceTo(bounds.getSouthWest()) * bounds.getNorthEast().distanceTo(bounds.getNorthWest());
          if (areaBounds < 1700) {
            centroidLatLng = centroid(latlngs);
          }
          var len = latlngs.length;
          var points = [];
          for (i = 0; i < len; i++) {
            var latlng = toLatLng(latlngs[i]);
            points.push(crs.project(toLatLng([latlng.lat - centroidLatLng.lat, latlng.lng - centroidLatLng.lng])));
          }
          area = x = y = 0;
          for (i = 0, j = len - 1; i < len; j = i++) {
            p1 = points[i];
            p2 = points[j];
            f = p1.y * p2.x - p2.y * p1.x;
            x += (p1.x + p2.x) * f;
            y += (p1.y + p2.y) * f;
            area += f * 3;
          }
          if (area === 0) {
            center = points[0];
          } else {
            center = [x / area, y / area];
          }
          var latlngCenter = crs.unproject(toPoint(center));
          return toLatLng([latlngCenter.lat + centroidLatLng.lat, latlngCenter.lng + centroidLatLng.lng]);
        }
        function centroid(coords) {
          var latSum = 0;
          var lngSum = 0;
          var len = 0;
          for (var i = 0; i < coords.length; i++) {
            var latlng = toLatLng(coords[i]);
            latSum += latlng.lat;
            lngSum += latlng.lng;
            len++;
          }
          return toLatLng([latSum / len, lngSum / len]);
        }
        var PolyUtil = {
          __proto__: null,
          clipPolygon,
          polygonCenter,
          centroid
        };
        function simplify(points, tolerance) {
          if (!tolerance || !points.length) {
            return points.slice();
          }
          var sqTolerance = tolerance * tolerance;
          points = _reducePoints(points, sqTolerance);
          points = _simplifyDP(points, sqTolerance);
          return points;
        }
        function pointToSegmentDistance(p, p1, p2) {
          return Math.sqrt(_sqClosestPointOnSegment(p, p1, p2, true));
        }
        function closestPointOnSegment(p, p1, p2) {
          return _sqClosestPointOnSegment(p, p1, p2);
        }
        function _simplifyDP(points, sqTolerance) {
          var len = points.length, ArrayConstructor = typeof Uint8Array !== "undefined" ? Uint8Array : Array, markers = new ArrayConstructor(len);
          markers[0] = markers[len - 1] = 1;
          _simplifyDPStep(points, markers, sqTolerance, 0, len - 1);
          var i, newPoints = [];
          for (i = 0; i < len; i++) {
            if (markers[i]) {
              newPoints.push(points[i]);
            }
          }
          return newPoints;
        }
        function _simplifyDPStep(points, markers, sqTolerance, first, last) {
          var maxSqDist = 0, index3, i, sqDist;
          for (i = first + 1; i <= last - 1; i++) {
            sqDist = _sqClosestPointOnSegment(points[i], points[first], points[last], true);
            if (sqDist > maxSqDist) {
              index3 = i;
              maxSqDist = sqDist;
            }
          }
          if (maxSqDist > sqTolerance) {
            markers[index3] = 1;
            _simplifyDPStep(points, markers, sqTolerance, first, index3);
            _simplifyDPStep(points, markers, sqTolerance, index3, last);
          }
        }
        function _reducePoints(points, sqTolerance) {
          var reducedPoints = [points[0]];
          for (var i = 1, prev = 0, len = points.length; i < len; i++) {
            if (_sqDist(points[i], points[prev]) > sqTolerance) {
              reducedPoints.push(points[i]);
              prev = i;
            }
          }
          if (prev < len - 1) {
            reducedPoints.push(points[len - 1]);
          }
          return reducedPoints;
        }
        var _lastCode;
        function clipSegment(a, b, bounds, useLastCode, round) {
          var codeA = useLastCode ? _lastCode : _getBitCode(a, bounds), codeB = _getBitCode(b, bounds), codeOut, p, newCode;
          _lastCode = codeB;
          while (true) {
            if (!(codeA | codeB)) {
              return [a, b];
            }
            if (codeA & codeB) {
              return false;
            }
            codeOut = codeA || codeB;
            p = _getEdgeIntersection(a, b, codeOut, bounds, round);
            newCode = _getBitCode(p, bounds);
            if (codeOut === codeA) {
              a = p;
              codeA = newCode;
            } else {
              b = p;
              codeB = newCode;
            }
          }
        }
        function _getEdgeIntersection(a, b, code, bounds, round) {
          var dx = b.x - a.x, dy = b.y - a.y, min = bounds.min, max = bounds.max, x, y;
          if (code & 8) {
            x = a.x + dx * (max.y - a.y) / dy;
            y = max.y;
          } else if (code & 4) {
            x = a.x + dx * (min.y - a.y) / dy;
            y = min.y;
          } else if (code & 2) {
            x = max.x;
            y = a.y + dy * (max.x - a.x) / dx;
          } else if (code & 1) {
            x = min.x;
            y = a.y + dy * (min.x - a.x) / dx;
          }
          return new Point(x, y, round);
        }
        function _getBitCode(p, bounds) {
          var code = 0;
          if (p.x < bounds.min.x) {
            code |= 1;
          } else if (p.x > bounds.max.x) {
            code |= 2;
          }
          if (p.y < bounds.min.y) {
            code |= 4;
          } else if (p.y > bounds.max.y) {
            code |= 8;
          }
          return code;
        }
        function _sqDist(p1, p2) {
          var dx = p2.x - p1.x, dy = p2.y - p1.y;
          return dx * dx + dy * dy;
        }
        function _sqClosestPointOnSegment(p, p1, p2, sqDist) {
          var x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y, dot = dx * dx + dy * dy, t;
          if (dot > 0) {
            t = ((p.x - x) * dx + (p.y - y) * dy) / dot;
            if (t > 1) {
              x = p2.x;
              y = p2.y;
            } else if (t > 0) {
              x += dx * t;
              y += dy * t;
            }
          }
          dx = p.x - x;
          dy = p.y - y;
          return sqDist ? dx * dx + dy * dy : new Point(x, y);
        }
        function isFlat(latlngs) {
          return !isArray(latlngs[0]) || typeof latlngs[0][0] !== "object" && typeof latlngs[0][0] !== "undefined";
        }
        function _flat(latlngs) {
          console.warn("Deprecated use of _flat, please use L.LineUtil.isFlat instead.");
          return isFlat(latlngs);
        }
        function polylineCenter(latlngs, crs) {
          var i, halfDist, segDist, dist, p1, p2, ratio, center;
          if (!latlngs || latlngs.length === 0) {
            throw new Error("latlngs not passed");
          }
          if (!isFlat(latlngs)) {
            console.warn("latlngs are not flat! Only the first ring will be used");
            latlngs = latlngs[0];
          }
          var centroidLatLng = toLatLng([0, 0]);
          var bounds = toLatLngBounds(latlngs);
          var areaBounds = bounds.getNorthWest().distanceTo(bounds.getSouthWest()) * bounds.getNorthEast().distanceTo(bounds.getNorthWest());
          if (areaBounds < 1700) {
            centroidLatLng = centroid(latlngs);
          }
          var len = latlngs.length;
          var points = [];
          for (i = 0; i < len; i++) {
            var latlng = toLatLng(latlngs[i]);
            points.push(crs.project(toLatLng([latlng.lat - centroidLatLng.lat, latlng.lng - centroidLatLng.lng])));
          }
          for (i = 0, halfDist = 0; i < len - 1; i++) {
            halfDist += points[i].distanceTo(points[i + 1]) / 2;
          }
          if (halfDist === 0) {
            center = points[0];
          } else {
            for (i = 0, dist = 0; i < len - 1; i++) {
              p1 = points[i];
              p2 = points[i + 1];
              segDist = p1.distanceTo(p2);
              dist += segDist;
              if (dist > halfDist) {
                ratio = (dist - halfDist) / segDist;
                center = [
                  p2.x - ratio * (p2.x - p1.x),
                  p2.y - ratio * (p2.y - p1.y)
                ];
                break;
              }
            }
          }
          var latlngCenter = crs.unproject(toPoint(center));
          return toLatLng([latlngCenter.lat + centroidLatLng.lat, latlngCenter.lng + centroidLatLng.lng]);
        }
        var LineUtil = {
          __proto__: null,
          simplify,
          pointToSegmentDistance,
          closestPointOnSegment,
          clipSegment,
          _getEdgeIntersection,
          _getBitCode,
          _sqClosestPointOnSegment,
          isFlat,
          _flat,
          polylineCenter
        };
        var LonLat = {
          project: function(latlng) {
            return new Point(latlng.lng, latlng.lat);
          },
          unproject: function(point) {
            return new LatLng(point.y, point.x);
          },
          bounds: new Bounds([-180, -90], [180, 90])
        };
        var Mercator = {
          R: 6378137,
          R_MINOR: 6356752314245179e-9,
          bounds: new Bounds([-2003750834279e-5, -1549657073972e-5], [2003750834279e-5, 1876465623138e-5]),
          project: function(latlng) {
            var d = Math.PI / 180, r = this.R, y = latlng.lat * d, tmp = this.R_MINOR / r, e = Math.sqrt(1 - tmp * tmp), con = e * Math.sin(y);
            var ts = Math.tan(Math.PI / 4 - y / 2) / Math.pow((1 - con) / (1 + con), e / 2);
            y = -r * Math.log(Math.max(ts, 1e-10));
            return new Point(latlng.lng * d * r, y);
          },
          unproject: function(point) {
            var d = 180 / Math.PI, r = this.R, tmp = this.R_MINOR / r, e = Math.sqrt(1 - tmp * tmp), ts = Math.exp(-point.y / r), phi = Math.PI / 2 - 2 * Math.atan(ts);
            for (var i = 0, dphi = 0.1, con; i < 15 && Math.abs(dphi) > 1e-7; i++) {
              con = e * Math.sin(phi);
              con = Math.pow((1 - con) / (1 + con), e / 2);
              dphi = Math.PI / 2 - 2 * Math.atan(ts * con) - phi;
              phi += dphi;
            }
            return new LatLng(phi * d, point.x * d / r);
          }
        };
        var index2 = {
          __proto__: null,
          LonLat,
          Mercator,
          SphericalMercator
        };
        var EPSG3395 = extend({}, Earth, {
          code: "EPSG:3395",
          projection: Mercator,
          transformation: (function() {
            var scale2 = 0.5 / (Math.PI * Mercator.R);
            return toTransformation(scale2, 0.5, -scale2, 0.5);
          })()
        });
        var EPSG4326 = extend({}, Earth, {
          code: "EPSG:4326",
          projection: LonLat,
          transformation: toTransformation(1 / 180, 1, -1 / 180, 0.5)
        });
        var Simple = extend({}, CRS, {
          projection: LonLat,
          transformation: toTransformation(1, 0, -1, 0),
          scale: function(zoom2) {
            return Math.pow(2, zoom2);
          },
          zoom: function(scale2) {
            return Math.log(scale2) / Math.LN2;
          },
          distance: function(latlng1, latlng2) {
            var dx = latlng2.lng - latlng1.lng, dy = latlng2.lat - latlng1.lat;
            return Math.sqrt(dx * dx + dy * dy);
          },
          infinite: true
        });
        CRS.Earth = Earth;
        CRS.EPSG3395 = EPSG3395;
        CRS.EPSG3857 = EPSG3857;
        CRS.EPSG900913 = EPSG900913;
        CRS.EPSG4326 = EPSG4326;
        CRS.Simple = Simple;
        var Layer = Evented.extend({
          // Classes extending `L.Layer` will inherit the following options:
          options: {
            // @option pane: String = 'overlayPane'
            // By default the layer will be added to the map's [overlay pane](#map-overlaypane). Overriding this option will cause the layer to be placed on another pane by default.
            pane: "overlayPane",
            // @option attribution: String = null
            // String to be shown in the attribution control, e.g. "© OpenStreetMap contributors". It describes the layer data and is often a legal obligation towards copyright holders and tile providers.
            attribution: null,
            bubblingMouseEvents: true
          },
          /* @section
           * Classes extending `L.Layer` will inherit the following methods:
           *
           * @method addTo(map: Map|LayerGroup): this
           * Adds the layer to the given map or layer group.
           */
          addTo: function(map) {
            map.addLayer(this);
            return this;
          },
          // @method remove: this
          // Removes the layer from the map it is currently active on.
          remove: function() {
            return this.removeFrom(this._map || this._mapToAdd);
          },
          // @method removeFrom(map: Map): this
          // Removes the layer from the given map
          //
          // @alternative
          // @method removeFrom(group: LayerGroup): this
          // Removes the layer from the given `LayerGroup`
          removeFrom: function(obj) {
            if (obj) {
              obj.removeLayer(this);
            }
            return this;
          },
          // @method getPane(name? : String): HTMLElement
          // Returns the `HTMLElement` representing the named pane on the map. If `name` is omitted, returns the pane for this layer.
          getPane: function(name2) {
            return this._map.getPane(name2 ? this.options[name2] || name2 : this.options.pane);
          },
          addInteractiveTarget: function(targetEl) {
            this._map._targets[stamp(targetEl)] = this;
            return this;
          },
          removeInteractiveTarget: function(targetEl) {
            delete this._map._targets[stamp(targetEl)];
            return this;
          },
          // @method getAttribution: String
          // Used by the `attribution control`, returns the [attribution option](#gridlayer-attribution).
          getAttribution: function() {
            return this.options.attribution;
          },
          _layerAdd: function(e) {
            var map = e.target;
            if (!map.hasLayer(this)) {
              return;
            }
            this._map = map;
            this._zoomAnimated = map._zoomAnimated;
            if (this.getEvents) {
              var events = this.getEvents();
              map.on(events, this);
              this.once("remove", function() {
                map.off(events, this);
              }, this);
            }
            this.onAdd(map);
            this.fire("add");
            map.fire("layeradd", { layer: this });
          }
        });
        Map2.include({
          // @method addLayer(layer: Layer): this
          // Adds the given layer to the map
          addLayer: function(layer) {
            if (!layer._layerAdd) {
              throw new Error("The provided object is not a Layer.");
            }
            var id = stamp(layer);
            if (this._layers[id]) {
              return this;
            }
            this._layers[id] = layer;
            layer._mapToAdd = this;
            if (layer.beforeAdd) {
              layer.beforeAdd(this);
            }
            this.whenReady(layer._layerAdd, layer);
            return this;
          },
          // @method removeLayer(layer: Layer): this
          // Removes the given layer from the map.
          removeLayer: function(layer) {
            var id = stamp(layer);
            if (!this._layers[id]) {
              return this;
            }
            if (this._loaded) {
              layer.onRemove(this);
            }
            delete this._layers[id];
            if (this._loaded) {
              this.fire("layerremove", { layer });
              layer.fire("remove");
            }
            layer._map = layer._mapToAdd = null;
            return this;
          },
          // @method hasLayer(layer: Layer): Boolean
          // Returns `true` if the given layer is currently added to the map
          hasLayer: function(layer) {
            return stamp(layer) in this._layers;
          },
          /* @method eachLayer(fn: Function, context?: Object): this
           * Iterates over the layers of the map, optionally specifying context of the iterator function.
           * ```
           * map.eachLayer(function(layer){
           *     layer.bindPopup('Hello');
           * });
           * ```
           */
          eachLayer: function(method, context) {
            for (var i in this._layers) {
              method.call(context, this._layers[i]);
            }
            return this;
          },
          _addLayers: function(layers2) {
            layers2 = layers2 ? isArray(layers2) ? layers2 : [layers2] : [];
            for (var i = 0, len = layers2.length; i < len; i++) {
              this.addLayer(layers2[i]);
            }
          },
          _addZoomLimit: function(layer) {
            if (!isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom)) {
              this._zoomBoundLayers[stamp(layer)] = layer;
              this._updateZoomLevels();
            }
          },
          _removeZoomLimit: function(layer) {
            var id = stamp(layer);
            if (this._zoomBoundLayers[id]) {
              delete this._zoomBoundLayers[id];
              this._updateZoomLevels();
            }
          },
          _updateZoomLevels: function() {
            var minZoom = Infinity, maxZoom = -Infinity, oldZoomSpan = this._getZoomSpan();
            for (var i in this._zoomBoundLayers) {
              var options = this._zoomBoundLayers[i].options;
              minZoom = options.minZoom === void 0 ? minZoom : Math.min(minZoom, options.minZoom);
              maxZoom = options.maxZoom === void 0 ? maxZoom : Math.max(maxZoom, options.maxZoom);
            }
            this._layersMaxZoom = maxZoom === -Infinity ? void 0 : maxZoom;
            this._layersMinZoom = minZoom === Infinity ? void 0 : minZoom;
            if (oldZoomSpan !== this._getZoomSpan()) {
              this.fire("zoomlevelschange");
            }
            if (this.options.maxZoom === void 0 && this._layersMaxZoom && this.getZoom() > this._layersMaxZoom) {
              this.setZoom(this._layersMaxZoom);
            }
            if (this.options.minZoom === void 0 && this._layersMinZoom && this.getZoom() < this._layersMinZoom) {
              this.setZoom(this._layersMinZoom);
            }
          }
        });
        var LayerGroup = Layer.extend({
          initialize: function(layers2, options) {
            setOptions(this, options);
            this._layers = {};
            var i, len;
            if (layers2) {
              for (i = 0, len = layers2.length; i < len; i++) {
                this.addLayer(layers2[i]);
              }
            }
          },
          // @method addLayer(layer: Layer): this
          // Adds the given layer to the group.
          addLayer: function(layer) {
            var id = this.getLayerId(layer);
            this._layers[id] = layer;
            if (this._map) {
              this._map.addLayer(layer);
            }
            return this;
          },
          // @method removeLayer(layer: Layer): this
          // Removes the given layer from the group.
          // @alternative
          // @method removeLayer(id: Number): this
          // Removes the layer with the given internal ID from the group.
          removeLayer: function(layer) {
            var id = layer in this._layers ? layer : this.getLayerId(layer);
            if (this._map && this._layers[id]) {
              this._map.removeLayer(this._layers[id]);
            }
            delete this._layers[id];
            return this;
          },
          // @method hasLayer(layer: Layer): Boolean
          // Returns `true` if the given layer is currently added to the group.
          // @alternative
          // @method hasLayer(id: Number): Boolean
          // Returns `true` if the given internal ID is currently added to the group.
          hasLayer: function(layer) {
            var layerId = typeof layer === "number" ? layer : this.getLayerId(layer);
            return layerId in this._layers;
          },
          // @method clearLayers(): this
          // Removes all the layers from the group.
          clearLayers: function() {
            return this.eachLayer(this.removeLayer, this);
          },
          // @method invoke(methodName: String, …): this
          // Calls `methodName` on every layer contained in this group, passing any
          // additional parameters. Has no effect if the layers contained do not
          // implement `methodName`.
          invoke: function(methodName) {
            var args = Array.prototype.slice.call(arguments, 1), i, layer;
            for (i in this._layers) {
              layer = this._layers[i];
              if (layer[methodName]) {
                layer[methodName].apply(layer, args);
              }
            }
            return this;
          },
          onAdd: function(map) {
            this.eachLayer(map.addLayer, map);
          },
          onRemove: function(map) {
            this.eachLayer(map.removeLayer, map);
          },
          // @method eachLayer(fn: Function, context?: Object): this
          // Iterates over the layers of the group, optionally specifying context of the iterator function.
          // ```js
          // group.eachLayer(function (layer) {
          // 	layer.bindPopup('Hello');
          // });
          // ```
          eachLayer: function(method, context) {
            for (var i in this._layers) {
              method.call(context, this._layers[i]);
            }
            return this;
          },
          // @method getLayer(id: Number): Layer
          // Returns the layer with the given internal ID.
          getLayer: function(id) {
            return this._layers[id];
          },
          // @method getLayers(): Layer[]
          // Returns an array of all the layers added to the group.
          getLayers: function() {
            var layers2 = [];
            this.eachLayer(layers2.push, layers2);
            return layers2;
          },
          // @method setZIndex(zIndex: Number): this
          // Calls `setZIndex` on every layer contained in this group, passing the z-index.
          setZIndex: function(zIndex) {
            return this.invoke("setZIndex", zIndex);
          },
          // @method getLayerId(layer: Layer): Number
          // Returns the internal ID for a layer
          getLayerId: function(layer) {
            return stamp(layer);
          }
        });
        var layerGroup = function(layers2, options) {
          return new LayerGroup(layers2, options);
        };
        var FeatureGroup = LayerGroup.extend({
          addLayer: function(layer) {
            if (this.hasLayer(layer)) {
              return this;
            }
            layer.addEventParent(this);
            LayerGroup.prototype.addLayer.call(this, layer);
            return this.fire("layeradd", { layer });
          },
          removeLayer: function(layer) {
            if (!this.hasLayer(layer)) {
              return this;
            }
            if (layer in this._layers) {
              layer = this._layers[layer];
            }
            layer.removeEventParent(this);
            LayerGroup.prototype.removeLayer.call(this, layer);
            return this.fire("layerremove", { layer });
          },
          // @method setStyle(style: Path options): this
          // Sets the given path options to each layer of the group that has a `setStyle` method.
          setStyle: function(style2) {
            return this.invoke("setStyle", style2);
          },
          // @method bringToFront(): this
          // Brings the layer group to the top of all other layers
          bringToFront: function() {
            return this.invoke("bringToFront");
          },
          // @method bringToBack(): this
          // Brings the layer group to the back of all other layers
          bringToBack: function() {
            return this.invoke("bringToBack");
          },
          // @method getBounds(): LatLngBounds
          // Returns the LatLngBounds of the Feature Group (created from bounds and coordinates of its children).
          getBounds: function() {
            var bounds = new LatLngBounds();
            for (var id in this._layers) {
              var layer = this._layers[id];
              bounds.extend(layer.getBounds ? layer.getBounds() : layer.getLatLng());
            }
            return bounds;
          }
        });
        var featureGroup = function(layers2, options) {
          return new FeatureGroup(layers2, options);
        };
        var Icon = Class.extend({
          /* @section
           * @aka Icon options
           *
           * @option iconUrl: String = null
           * **(required)** The URL to the icon image (absolute or relative to your script path).
           *
           * @option iconRetinaUrl: String = null
           * The URL to a retina sized version of the icon image (absolute or relative to your
           * script path). Used for Retina screen devices.
           *
           * @option iconSize: Point = null
           * Size of the icon image in pixels.
           *
           * @option iconAnchor: Point = null
           * The coordinates of the "tip" of the icon (relative to its top left corner). The icon
           * will be aligned so that this point is at the marker's geographical location. Centered
           * by default if size is specified, also can be set in CSS with negative margins.
           *
           * @option popupAnchor: Point = [0, 0]
           * The coordinates of the point from which popups will "open", relative to the icon anchor.
           *
           * @option tooltipAnchor: Point = [0, 0]
           * The coordinates of the point from which tooltips will "open", relative to the icon anchor.
           *
           * @option shadowUrl: String = null
           * The URL to the icon shadow image. If not specified, no shadow image will be created.
           *
           * @option shadowRetinaUrl: String = null
           *
           * @option shadowSize: Point = null
           * Size of the shadow image in pixels.
           *
           * @option shadowAnchor: Point = null
           * The coordinates of the "tip" of the shadow (relative to its top left corner) (the same
           * as iconAnchor if not specified).
           *
           * @option className: String = ''
           * A custom class name to assign to both icon and shadow images. Empty by default.
           */
          options: {
            popupAnchor: [0, 0],
            tooltipAnchor: [0, 0],
            // @option crossOrigin: Boolean|String = false
            // Whether the crossOrigin attribute will be added to the tiles.
            // If a String is provided, all tiles will have their crossOrigin attribute set to the String provided. This is needed if you want to access tile pixel data.
            // Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
            crossOrigin: false
          },
          initialize: function(options) {
            setOptions(this, options);
          },
          // @method createIcon(oldIcon?: HTMLElement): HTMLElement
          // Called internally when the icon has to be shown, returns a `<img>` HTML element
          // styled according to the options.
          createIcon: function(oldIcon) {
            return this._createIcon("icon", oldIcon);
          },
          // @method createShadow(oldIcon?: HTMLElement): HTMLElement
          // As `createIcon`, but for the shadow beneath it.
          createShadow: function(oldIcon) {
            return this._createIcon("shadow", oldIcon);
          },
          _createIcon: function(name2, oldIcon) {
            var src = this._getIconUrl(name2);
            if (!src) {
              if (name2 === "icon") {
                throw new Error("iconUrl not set in Icon options (see the docs).");
              }
              return null;
            }
            var img = this._createImg(src, oldIcon && oldIcon.tagName === "IMG" ? oldIcon : null);
            this._setIconStyles(img, name2);
            if (this.options.crossOrigin || this.options.crossOrigin === "") {
              img.crossOrigin = this.options.crossOrigin === true ? "" : this.options.crossOrigin;
            }
            return img;
          },
          _setIconStyles: function(img, name2) {
            var options = this.options;
            var sizeOption = options[name2 + "Size"];
            if (typeof sizeOption === "number") {
              sizeOption = [sizeOption, sizeOption];
            }
            var size = toPoint(sizeOption), anchor = toPoint(name2 === "shadow" && options.shadowAnchor || options.iconAnchor || size && size.divideBy(2, true));
            img.className = "leaflet-marker-" + name2 + " " + (options.className || "");
            if (anchor) {
              img.style.marginLeft = -anchor.x + "px";
              img.style.marginTop = -anchor.y + "px";
            }
            if (size) {
              img.style.width = size.x + "px";
              img.style.height = size.y + "px";
            }
          },
          _createImg: function(src, el) {
            el = el || document.createElement("img");
            el.src = src;
            return el;
          },
          _getIconUrl: function(name2) {
            return Browser.retina && this.options[name2 + "RetinaUrl"] || this.options[name2 + "Url"];
          }
        });
        function icon(options) {
          return new Icon(options);
        }
        var IconDefault = Icon.extend({
          options: {
            iconUrl: "marker-icon.png",
            iconRetinaUrl: "marker-icon-2x.png",
            shadowUrl: "marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [16, -28],
            shadowSize: [41, 41]
          },
          _getIconUrl: function(name2) {
            if (typeof IconDefault.imagePath !== "string") {
              IconDefault.imagePath = this._detectIconPath();
            }
            return (this.options.imagePath || IconDefault.imagePath) + Icon.prototype._getIconUrl.call(this, name2);
          },
          _stripUrl: function(path) {
            var strip = function(str, re, idx) {
              var match = re.exec(str);
              return match && match[idx];
            };
            path = strip(path, /^url\((['"])?(.+)\1\)$/, 2);
            return path && strip(path, /^(.*)marker-icon\.png$/, 1);
          },
          _detectIconPath: function() {
            var el = create$1("div", "leaflet-default-icon-path", document.body);
            var path = getStyle(el, "background-image") || getStyle(el, "backgroundImage");
            document.body.removeChild(el);
            path = this._stripUrl(path);
            if (path) {
              return path;
            }
            var link = document.querySelector('link[href$="leaflet.css"]');
            if (!link) {
              return "";
            }
            return link.href.substring(0, link.href.length - "leaflet.css".length - 1);
          }
        });
        var MarkerDrag = Handler.extend({
          initialize: function(marker2) {
            this._marker = marker2;
          },
          addHooks: function() {
            var icon2 = this._marker._icon;
            if (!this._draggable) {
              this._draggable = new Draggable(icon2, icon2, true);
            }
            this._draggable.on({
              dragstart: this._onDragStart,
              predrag: this._onPreDrag,
              drag: this._onDrag,
              dragend: this._onDragEnd
            }, this).enable();
            addClass(icon2, "leaflet-marker-draggable");
          },
          removeHooks: function() {
            this._draggable.off({
              dragstart: this._onDragStart,
              predrag: this._onPreDrag,
              drag: this._onDrag,
              dragend: this._onDragEnd
            }, this).disable();
            if (this._marker._icon) {
              removeClass(this._marker._icon, "leaflet-marker-draggable");
            }
          },
          moved: function() {
            return this._draggable && this._draggable._moved;
          },
          _adjustPan: function(e) {
            var marker2 = this._marker, map = marker2._map, speed = this._marker.options.autoPanSpeed, padding = this._marker.options.autoPanPadding, iconPos = getPosition(marker2._icon), bounds = map.getPixelBounds(), origin = map.getPixelOrigin();
            var panBounds = toBounds(
              bounds.min._subtract(origin).add(padding),
              bounds.max._subtract(origin).subtract(padding)
            );
            if (!panBounds.contains(iconPos)) {
              var movement = toPoint(
                (Math.max(panBounds.max.x, iconPos.x) - panBounds.max.x) / (bounds.max.x - panBounds.max.x) - (Math.min(panBounds.min.x, iconPos.x) - panBounds.min.x) / (bounds.min.x - panBounds.min.x),
                (Math.max(panBounds.max.y, iconPos.y) - panBounds.max.y) / (bounds.max.y - panBounds.max.y) - (Math.min(panBounds.min.y, iconPos.y) - panBounds.min.y) / (bounds.min.y - panBounds.min.y)
              ).multiplyBy(speed);
              map.panBy(movement, { animate: false });
              this._draggable._newPos._add(movement);
              this._draggable._startPos._add(movement);
              setPosition(marker2._icon, this._draggable._newPos);
              this._onDrag(e);
              this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
            }
          },
          _onDragStart: function() {
            this._oldLatLng = this._marker.getLatLng();
            this._marker.closePopup && this._marker.closePopup();
            this._marker.fire("movestart").fire("dragstart");
          },
          _onPreDrag: function(e) {
            if (this._marker.options.autoPan) {
              cancelAnimFrame(this._panRequest);
              this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
            }
          },
          _onDrag: function(e) {
            var marker2 = this._marker, shadow = marker2._shadow, iconPos = getPosition(marker2._icon), latlng = marker2._map.layerPointToLatLng(iconPos);
            if (shadow) {
              setPosition(shadow, iconPos);
            }
            marker2._latlng = latlng;
            e.latlng = latlng;
            e.oldLatLng = this._oldLatLng;
            marker2.fire("move", e).fire("drag", e);
          },
          _onDragEnd: function(e) {
            cancelAnimFrame(this._panRequest);
            delete this._oldLatLng;
            this._marker.fire("moveend").fire("dragend", e);
          }
        });
        var Marker = Layer.extend({
          // @section
          // @aka Marker options
          options: {
            // @option icon: Icon = *
            // Icon instance to use for rendering the marker.
            // See [Icon documentation](#L.Icon) for details on how to customize the marker icon.
            // If not specified, a common instance of `L.Icon.Default` is used.
            icon: new IconDefault(),
            // Option inherited from "Interactive layer" abstract class
            interactive: true,
            // @option keyboard: Boolean = true
            // Whether the marker can be tabbed to with a keyboard and clicked by pressing enter.
            keyboard: true,
            // @option title: String = ''
            // Text for the browser tooltip that appear on marker hover (no tooltip by default).
            // [Useful for accessibility](https://leafletjs.com/examples/accessibility/#markers-must-be-labelled).
            title: "",
            // @option alt: String = 'Marker'
            // Text for the `alt` attribute of the icon image.
            // [Useful for accessibility](https://leafletjs.com/examples/accessibility/#markers-must-be-labelled).
            alt: "Marker",
            // @option zIndexOffset: Number = 0
            // By default, marker images zIndex is set automatically based on its latitude. Use this option if you want to put the marker on top of all others (or below), specifying a high value like `1000` (or high negative value, respectively).
            zIndexOffset: 0,
            // @option opacity: Number = 1.0
            // The opacity of the marker.
            opacity: 1,
            // @option riseOnHover: Boolean = false
            // If `true`, the marker will get on top of others when you hover the mouse over it.
            riseOnHover: false,
            // @option riseOffset: Number = 250
            // The z-index offset used for the `riseOnHover` feature.
            riseOffset: 250,
            // @option pane: String = 'markerPane'
            // `Map pane` where the markers icon will be added.
            pane: "markerPane",
            // @option shadowPane: String = 'shadowPane'
            // `Map pane` where the markers shadow will be added.
            shadowPane: "shadowPane",
            // @option bubblingMouseEvents: Boolean = false
            // When `true`, a mouse event on this marker will trigger the same event on the map
            // (unless [`L.DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
            bubblingMouseEvents: false,
            // @option autoPanOnFocus: Boolean = true
            // When `true`, the map will pan whenever the marker is focused (via
            // e.g. pressing `tab` on the keyboard) to ensure the marker is
            // visible within the map's bounds
            autoPanOnFocus: true,
            // @section Draggable marker options
            // @option draggable: Boolean = false
            // Whether the marker is draggable with mouse/touch or not.
            draggable: false,
            // @option autoPan: Boolean = false
            // Whether to pan the map when dragging this marker near its edge or not.
            autoPan: false,
            // @option autoPanPadding: Point = Point(50, 50)
            // Distance (in pixels to the left/right and to the top/bottom) of the
            // map edge to start panning the map.
            autoPanPadding: [50, 50],
            // @option autoPanSpeed: Number = 10
            // Number of pixels the map should pan by.
            autoPanSpeed: 10
          },
          /* @section
           *
           * In addition to [shared layer methods](#Layer) like `addTo()` and `remove()` and [popup methods](#Popup) like bindPopup() you can also use the following methods:
           */
          initialize: function(latlng, options) {
            setOptions(this, options);
            this._latlng = toLatLng(latlng);
          },
          onAdd: function(map) {
            this._zoomAnimated = this._zoomAnimated && map.options.markerZoomAnimation;
            if (this._zoomAnimated) {
              map.on("zoomanim", this._animateZoom, this);
            }
            this._initIcon();
            this.update();
          },
          onRemove: function(map) {
            if (this.dragging && this.dragging.enabled()) {
              this.options.draggable = true;
              this.dragging.removeHooks();
            }
            delete this.dragging;
            if (this._zoomAnimated) {
              map.off("zoomanim", this._animateZoom, this);
            }
            this._removeIcon();
            this._removeShadow();
          },
          getEvents: function() {
            return {
              zoom: this.update,
              viewreset: this.update
            };
          },
          // @method getLatLng: LatLng
          // Returns the current geographical position of the marker.
          getLatLng: function() {
            return this._latlng;
          },
          // @method setLatLng(latlng: LatLng): this
          // Changes the marker position to the given point.
          setLatLng: function(latlng) {
            var oldLatLng = this._latlng;
            this._latlng = toLatLng(latlng);
            this.update();
            return this.fire("move", { oldLatLng, latlng: this._latlng });
          },
          // @method setZIndexOffset(offset: Number): this
          // Changes the [zIndex offset](#marker-zindexoffset) of the marker.
          setZIndexOffset: function(offset) {
            this.options.zIndexOffset = offset;
            return this.update();
          },
          // @method getIcon: Icon
          // Returns the current icon used by the marker
          getIcon: function() {
            return this.options.icon;
          },
          // @method setIcon(icon: Icon): this
          // Changes the marker icon.
          setIcon: function(icon2) {
            this.options.icon = icon2;
            if (this._map) {
              this._initIcon();
              this.update();
            }
            if (this._popup) {
              this.bindPopup(this._popup, this._popup.options);
            }
            return this;
          },
          getElement: function() {
            return this._icon;
          },
          update: function() {
            if (this._icon && this._map) {
              var pos = this._map.latLngToLayerPoint(this._latlng).round();
              this._setPos(pos);
            }
            return this;
          },
          _initIcon: function() {
            var options = this.options, classToAdd = "leaflet-zoom-" + (this._zoomAnimated ? "animated" : "hide");
            var icon2 = options.icon.createIcon(this._icon), addIcon = false;
            if (icon2 !== this._icon) {
              if (this._icon) {
                this._removeIcon();
              }
              addIcon = true;
              if (options.title) {
                icon2.title = options.title;
              }
              if (icon2.tagName === "IMG") {
                icon2.alt = options.alt || "";
              }
            }
            addClass(icon2, classToAdd);
            if (options.keyboard) {
              icon2.tabIndex = "0";
              icon2.setAttribute("role", "button");
            }
            this._icon = icon2;
            if (options.riseOnHover) {
              this.on({
                mouseover: this._bringToFront,
                mouseout: this._resetZIndex
              });
            }
            if (this.options.autoPanOnFocus) {
              on(icon2, "focus", this._panOnFocus, this);
            }
            var newShadow = options.icon.createShadow(this._shadow), addShadow = false;
            if (newShadow !== this._shadow) {
              this._removeShadow();
              addShadow = true;
            }
            if (newShadow) {
              addClass(newShadow, classToAdd);
              newShadow.alt = "";
            }
            this._shadow = newShadow;
            if (options.opacity < 1) {
              this._updateOpacity();
            }
            if (addIcon) {
              this.getPane().appendChild(this._icon);
            }
            this._initInteraction();
            if (newShadow && addShadow) {
              this.getPane(options.shadowPane).appendChild(this._shadow);
            }
          },
          _removeIcon: function() {
            if (this.options.riseOnHover) {
              this.off({
                mouseover: this._bringToFront,
                mouseout: this._resetZIndex
              });
            }
            if (this.options.autoPanOnFocus) {
              off(this._icon, "focus", this._panOnFocus, this);
            }
            remove(this._icon);
            this.removeInteractiveTarget(this._icon);
            this._icon = null;
          },
          _removeShadow: function() {
            if (this._shadow) {
              remove(this._shadow);
            }
            this._shadow = null;
          },
          _setPos: function(pos) {
            if (this._icon) {
              setPosition(this._icon, pos);
            }
            if (this._shadow) {
              setPosition(this._shadow, pos);
            }
            this._zIndex = pos.y + this.options.zIndexOffset;
            this._resetZIndex();
          },
          _updateZIndex: function(offset) {
            if (this._icon) {
              this._icon.style.zIndex = this._zIndex + offset;
            }
          },
          _animateZoom: function(opt) {
            var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();
            this._setPos(pos);
          },
          _initInteraction: function() {
            if (!this.options.interactive) {
              return;
            }
            addClass(this._icon, "leaflet-interactive");
            this.addInteractiveTarget(this._icon);
            if (MarkerDrag) {
              var draggable = this.options.draggable;
              if (this.dragging) {
                draggable = this.dragging.enabled();
                this.dragging.disable();
              }
              this.dragging = new MarkerDrag(this);
              if (draggable) {
                this.dragging.enable();
              }
            }
          },
          // @method setOpacity(opacity: Number): this
          // Changes the opacity of the marker.
          setOpacity: function(opacity) {
            this.options.opacity = opacity;
            if (this._map) {
              this._updateOpacity();
            }
            return this;
          },
          _updateOpacity: function() {
            var opacity = this.options.opacity;
            if (this._icon) {
              setOpacity(this._icon, opacity);
            }
            if (this._shadow) {
              setOpacity(this._shadow, opacity);
            }
          },
          _bringToFront: function() {
            this._updateZIndex(this.options.riseOffset);
          },
          _resetZIndex: function() {
            this._updateZIndex(0);
          },
          _panOnFocus: function() {
            var map = this._map;
            if (!map) {
              return;
            }
            var iconOpts = this.options.icon.options;
            var size = iconOpts.iconSize ? toPoint(iconOpts.iconSize) : toPoint(0, 0);
            var anchor = iconOpts.iconAnchor ? toPoint(iconOpts.iconAnchor) : toPoint(0, 0);
            map.panInside(this._latlng, {
              paddingTopLeft: anchor,
              paddingBottomRight: size.subtract(anchor)
            });
          },
          _getPopupAnchor: function() {
            return this.options.icon.options.popupAnchor;
          },
          _getTooltipAnchor: function() {
            return this.options.icon.options.tooltipAnchor;
          }
        });
        function marker(latlng, options) {
          return new Marker(latlng, options);
        }
        var Path = Layer.extend({
          // @section
          // @aka Path options
          options: {
            // @option stroke: Boolean = true
            // Whether to draw stroke along the path. Set it to `false` to disable borders on polygons or circles.
            stroke: true,
            // @option color: String = '#3388ff'
            // Stroke color
            color: "#3388ff",
            // @option weight: Number = 3
            // Stroke width in pixels
            weight: 3,
            // @option opacity: Number = 1.0
            // Stroke opacity
            opacity: 1,
            // @option lineCap: String= 'round'
            // A string that defines [shape to be used at the end](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linecap) of the stroke.
            lineCap: "round",
            // @option lineJoin: String = 'round'
            // A string that defines [shape to be used at the corners](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linejoin) of the stroke.
            lineJoin: "round",
            // @option dashArray: String = null
            // A string that defines the stroke [dash pattern](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dasharray). Doesn't work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
            dashArray: null,
            // @option dashOffset: String = null
            // A string that defines the [distance into the dash pattern to start the dash](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dashoffset). Doesn't work on `Canvas`-powered layers in [some old browsers](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility).
            dashOffset: null,
            // @option fill: Boolean = depends
            // Whether to fill the path with color. Set it to `false` to disable filling on polygons or circles.
            fill: false,
            // @option fillColor: String = *
            // Fill color. Defaults to the value of the [`color`](#path-color) option
            fillColor: null,
            // @option fillOpacity: Number = 0.2
            // Fill opacity.
            fillOpacity: 0.2,
            // @option fillRule: String = 'evenodd'
            // A string that defines [how the inside of a shape](https://developer.mozilla.org/docs/Web/SVG/Attribute/fill-rule) is determined.
            fillRule: "evenodd",
            // className: '',
            // Option inherited from "Interactive layer" abstract class
            interactive: true,
            // @option bubblingMouseEvents: Boolean = true
            // When `true`, a mouse event on this path will trigger the same event on the map
            // (unless [`L.DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
            bubblingMouseEvents: true
          },
          beforeAdd: function(map) {
            this._renderer = map.getRenderer(this);
          },
          onAdd: function() {
            this._renderer._initPath(this);
            this._reset();
            this._renderer._addPath(this);
          },
          onRemove: function() {
            this._renderer._removePath(this);
          },
          // @method redraw(): this
          // Redraws the layer. Sometimes useful after you changed the coordinates that the path uses.
          redraw: function() {
            if (this._map) {
              this._renderer._updatePath(this);
            }
            return this;
          },
          // @method setStyle(style: Path options): this
          // Changes the appearance of a Path based on the options in the `Path options` object.
          setStyle: function(style2) {
            setOptions(this, style2);
            if (this._renderer) {
              this._renderer._updateStyle(this);
              if (this.options.stroke && style2 && Object.prototype.hasOwnProperty.call(style2, "weight")) {
                this._updateBounds();
              }
            }
            return this;
          },
          // @method bringToFront(): this
          // Brings the layer to the top of all path layers.
          bringToFront: function() {
            if (this._renderer) {
              this._renderer._bringToFront(this);
            }
            return this;
          },
          // @method bringToBack(): this
          // Brings the layer to the bottom of all path layers.
          bringToBack: function() {
            if (this._renderer) {
              this._renderer._bringToBack(this);
            }
            return this;
          },
          getElement: function() {
            return this._path;
          },
          _reset: function() {
            this._project();
            this._update();
          },
          _clickTolerance: function() {
            return (this.options.stroke ? this.options.weight / 2 : 0) + (this._renderer.options.tolerance || 0);
          }
        });
        var CircleMarker = Path.extend({
          // @section
          // @aka CircleMarker options
          options: {
            fill: true,
            // @option radius: Number = 10
            // Radius of the circle marker, in pixels
            radius: 10
          },
          initialize: function(latlng, options) {
            setOptions(this, options);
            this._latlng = toLatLng(latlng);
            this._radius = this.options.radius;
          },
          // @method setLatLng(latLng: LatLng): this
          // Sets the position of a circle marker to a new location.
          setLatLng: function(latlng) {
            var oldLatLng = this._latlng;
            this._latlng = toLatLng(latlng);
            this.redraw();
            return this.fire("move", { oldLatLng, latlng: this._latlng });
          },
          // @method getLatLng(): LatLng
          // Returns the current geographical position of the circle marker
          getLatLng: function() {
            return this._latlng;
          },
          // @method setRadius(radius: Number): this
          // Sets the radius of a circle marker. Units are in pixels.
          setRadius: function(radius) {
            this.options.radius = this._radius = radius;
            return this.redraw();
          },
          // @method getRadius(): Number
          // Returns the current radius of the circle
          getRadius: function() {
            return this._radius;
          },
          setStyle: function(options) {
            var radius = options && options.radius || this._radius;
            Path.prototype.setStyle.call(this, options);
            this.setRadius(radius);
            return this;
          },
          _project: function() {
            this._point = this._map.latLngToLayerPoint(this._latlng);
            this._updateBounds();
          },
          _updateBounds: function() {
            var r = this._radius, r2 = this._radiusY || r, w = this._clickTolerance(), p = [r + w, r2 + w];
            this._pxBounds = new Bounds(this._point.subtract(p), this._point.add(p));
          },
          _update: function() {
            if (this._map) {
              this._updatePath();
            }
          },
          _updatePath: function() {
            this._renderer._updateCircle(this);
          },
          _empty: function() {
            return this._radius && !this._renderer._bounds.intersects(this._pxBounds);
          },
          // Needed by the `Canvas` renderer for interactivity
          _containsPoint: function(p) {
            return p.distanceTo(this._point) <= this._radius + this._clickTolerance();
          }
        });
        function circleMarker(latlng, options) {
          return new CircleMarker(latlng, options);
        }
        var Circle = CircleMarker.extend({
          initialize: function(latlng, options, legacyOptions) {
            if (typeof options === "number") {
              options = extend({}, legacyOptions, { radius: options });
            }
            setOptions(this, options);
            this._latlng = toLatLng(latlng);
            if (isNaN(this.options.radius)) {
              throw new Error("Circle radius cannot be NaN");
            }
            this._mRadius = this.options.radius;
          },
          // @method setRadius(radius: Number): this
          // Sets the radius of a circle. Units are in meters.
          setRadius: function(radius) {
            this._mRadius = radius;
            return this.redraw();
          },
          // @method getRadius(): Number
          // Returns the current radius of a circle. Units are in meters.
          getRadius: function() {
            return this._mRadius;
          },
          // @method getBounds(): LatLngBounds
          // Returns the `LatLngBounds` of the path.
          getBounds: function() {
            var half = [this._radius, this._radiusY || this._radius];
            return new LatLngBounds(
              this._map.layerPointToLatLng(this._point.subtract(half)),
              this._map.layerPointToLatLng(this._point.add(half))
            );
          },
          setStyle: Path.prototype.setStyle,
          _project: function() {
            var lng = this._latlng.lng, lat = this._latlng.lat, map = this._map, crs = map.options.crs;
            if (crs.distance === Earth.distance) {
              var d = Math.PI / 180, latR = this._mRadius / Earth.R / d, top = map.project([lat + latR, lng]), bottom = map.project([lat - latR, lng]), p = top.add(bottom).divideBy(2), lat2 = map.unproject(p).lat, lngR = Math.acos((Math.cos(latR * d) - Math.sin(lat * d) * Math.sin(lat2 * d)) / (Math.cos(lat * d) * Math.cos(lat2 * d))) / d;
              if (isNaN(lngR) || lngR === 0) {
                lngR = latR / Math.cos(Math.PI / 180 * lat);
              }
              this._point = p.subtract(map.getPixelOrigin());
              this._radius = isNaN(lngR) ? 0 : p.x - map.project([lat2, lng - lngR]).x;
              this._radiusY = p.y - top.y;
            } else {
              var latlng2 = crs.unproject(crs.project(this._latlng).subtract([this._mRadius, 0]));
              this._point = map.latLngToLayerPoint(this._latlng);
              this._radius = this._point.x - map.latLngToLayerPoint(latlng2).x;
            }
            this._updateBounds();
          }
        });
        function circle(latlng, options, legacyOptions) {
          return new Circle(latlng, options, legacyOptions);
        }
        var Polyline = Path.extend({
          // @section
          // @aka Polyline options
          options: {
            // @option smoothFactor: Number = 1.0
            // How much to simplify the polyline on each zoom level. More means
            // better performance and smoother look, and less means more accurate representation.
            smoothFactor: 1,
            // @option noClip: Boolean = false
            // Disable polyline clipping.
            noClip: false
          },
          initialize: function(latlngs, options) {
            setOptions(this, options);
            this._setLatLngs(latlngs);
          },
          // @method getLatLngs(): LatLng[]
          // Returns an array of the points in the path, or nested arrays of points in case of multi-polyline.
          getLatLngs: function() {
            return this._latlngs;
          },
          // @method setLatLngs(latlngs: LatLng[]): this
          // Replaces all the points in the polyline with the given array of geographical points.
          setLatLngs: function(latlngs) {
            this._setLatLngs(latlngs);
            return this.redraw();
          },
          // @method isEmpty(): Boolean
          // Returns `true` if the Polyline has no LatLngs.
          isEmpty: function() {
            return !this._latlngs.length;
          },
          // @method closestLayerPoint(p: Point): Point
          // Returns the point closest to `p` on the Polyline.
          closestLayerPoint: function(p) {
            var minDistance = Infinity, minPoint = null, closest = _sqClosestPointOnSegment, p1, p2;
            for (var j = 0, jLen = this._parts.length; j < jLen; j++) {
              var points = this._parts[j];
              for (var i = 1, len = points.length; i < len; i++) {
                p1 = points[i - 1];
                p2 = points[i];
                var sqDist = closest(p, p1, p2, true);
                if (sqDist < minDistance) {
                  minDistance = sqDist;
                  minPoint = closest(p, p1, p2);
                }
              }
            }
            if (minPoint) {
              minPoint.distance = Math.sqrt(minDistance);
            }
            return minPoint;
          },
          // @method getCenter(): LatLng
          // Returns the center ([centroid](https://en.wikipedia.org/wiki/Centroid)) of the polyline.
          getCenter: function() {
            if (!this._map) {
              throw new Error("Must add layer to map before using getCenter()");
            }
            return polylineCenter(this._defaultShape(), this._map.options.crs);
          },
          // @method getBounds(): LatLngBounds
          // Returns the `LatLngBounds` of the path.
          getBounds: function() {
            return this._bounds;
          },
          // @method addLatLng(latlng: LatLng, latlngs?: LatLng[]): this
          // Adds a given point to the polyline. By default, adds to the first ring of
          // the polyline in case of a multi-polyline, but can be overridden by passing
          // a specific ring as a LatLng array (that you can earlier access with [`getLatLngs`](#polyline-getlatlngs)).
          addLatLng: function(latlng, latlngs) {
            latlngs = latlngs || this._defaultShape();
            latlng = toLatLng(latlng);
            latlngs.push(latlng);
            this._bounds.extend(latlng);
            return this.redraw();
          },
          _setLatLngs: function(latlngs) {
            this._bounds = new LatLngBounds();
            this._latlngs = this._convertLatLngs(latlngs);
          },
          _defaultShape: function() {
            return isFlat(this._latlngs) ? this._latlngs : this._latlngs[0];
          },
          // recursively convert latlngs input into actual LatLng instances; calculate bounds along the way
          _convertLatLngs: function(latlngs) {
            var result = [], flat = isFlat(latlngs);
            for (var i = 0, len = latlngs.length; i < len; i++) {
              if (flat) {
                result[i] = toLatLng(latlngs[i]);
                this._bounds.extend(result[i]);
              } else {
                result[i] = this._convertLatLngs(latlngs[i]);
              }
            }
            return result;
          },
          _project: function() {
            var pxBounds = new Bounds();
            this._rings = [];
            this._projectLatlngs(this._latlngs, this._rings, pxBounds);
            if (this._bounds.isValid() && pxBounds.isValid()) {
              this._rawPxBounds = pxBounds;
              this._updateBounds();
            }
          },
          _updateBounds: function() {
            var w = this._clickTolerance(), p = new Point(w, w);
            if (!this._rawPxBounds) {
              return;
            }
            this._pxBounds = new Bounds([
              this._rawPxBounds.min.subtract(p),
              this._rawPxBounds.max.add(p)
            ]);
          },
          // recursively turns latlngs into a set of rings with projected coordinates
          _projectLatlngs: function(latlngs, result, projectedBounds) {
            var flat = latlngs[0] instanceof LatLng, len = latlngs.length, i, ring;
            if (flat) {
              ring = [];
              for (i = 0; i < len; i++) {
                ring[i] = this._map.latLngToLayerPoint(latlngs[i]);
                projectedBounds.extend(ring[i]);
              }
              result.push(ring);
            } else {
              for (i = 0; i < len; i++) {
                this._projectLatlngs(latlngs[i], result, projectedBounds);
              }
            }
          },
          // clip polyline by renderer bounds so that we have less to render for performance
          _clipPoints: function() {
            var bounds = this._renderer._bounds;
            this._parts = [];
            if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
              return;
            }
            if (this.options.noClip) {
              this._parts = this._rings;
              return;
            }
            var parts = this._parts, i, j, k, len, len2, segment, points;
            for (i = 0, k = 0, len = this._rings.length; i < len; i++) {
              points = this._rings[i];
              for (j = 0, len2 = points.length; j < len2 - 1; j++) {
                segment = clipSegment(points[j], points[j + 1], bounds, j, true);
                if (!segment) {
                  continue;
                }
                parts[k] = parts[k] || [];
                parts[k].push(segment[0]);
                if (segment[1] !== points[j + 1] || j === len2 - 2) {
                  parts[k].push(segment[1]);
                  k++;
                }
              }
            }
          },
          // simplify each clipped part of the polyline for performance
          _simplifyPoints: function() {
            var parts = this._parts, tolerance = this.options.smoothFactor;
            for (var i = 0, len = parts.length; i < len; i++) {
              parts[i] = simplify(parts[i], tolerance);
            }
          },
          _update: function() {
            if (!this._map) {
              return;
            }
            this._clipPoints();
            this._simplifyPoints();
            this._updatePath();
          },
          _updatePath: function() {
            this._renderer._updatePoly(this);
          },
          // Needed by the `Canvas` renderer for interactivity
          _containsPoint: function(p, closed) {
            var i, j, k, len, len2, part, w = this._clickTolerance();
            if (!this._pxBounds || !this._pxBounds.contains(p)) {
              return false;
            }
            for (i = 0, len = this._parts.length; i < len; i++) {
              part = this._parts[i];
              for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
                if (!closed && j === 0) {
                  continue;
                }
                if (pointToSegmentDistance(p, part[k], part[j]) <= w) {
                  return true;
                }
              }
            }
            return false;
          }
        });
        function polyline(latlngs, options) {
          return new Polyline(latlngs, options);
        }
        Polyline._flat = _flat;
        var Polygon = Polyline.extend({
          options: {
            fill: true
          },
          isEmpty: function() {
            return !this._latlngs.length || !this._latlngs[0].length;
          },
          // @method getCenter(): LatLng
          // Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid)) of the Polygon.
          getCenter: function() {
            if (!this._map) {
              throw new Error("Must add layer to map before using getCenter()");
            }
            return polygonCenter(this._defaultShape(), this._map.options.crs);
          },
          _convertLatLngs: function(latlngs) {
            var result = Polyline.prototype._convertLatLngs.call(this, latlngs), len = result.length;
            if (len >= 2 && result[0] instanceof LatLng && result[0].equals(result[len - 1])) {
              result.pop();
            }
            return result;
          },
          _setLatLngs: function(latlngs) {
            Polyline.prototype._setLatLngs.call(this, latlngs);
            if (isFlat(this._latlngs)) {
              this._latlngs = [this._latlngs];
            }
          },
          _defaultShape: function() {
            return isFlat(this._latlngs[0]) ? this._latlngs[0] : this._latlngs[0][0];
          },
          _clipPoints: function() {
            var bounds = this._renderer._bounds, w = this.options.weight, p = new Point(w, w);
            bounds = new Bounds(bounds.min.subtract(p), bounds.max.add(p));
            this._parts = [];
            if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
              return;
            }
            if (this.options.noClip) {
              this._parts = this._rings;
              return;
            }
            for (var i = 0, len = this._rings.length, clipped; i < len; i++) {
              clipped = clipPolygon(this._rings[i], bounds, true);
              if (clipped.length) {
                this._parts.push(clipped);
              }
            }
          },
          _updatePath: function() {
            this._renderer._updatePoly(this, true);
          },
          // Needed by the `Canvas` renderer for interactivity
          _containsPoint: function(p) {
            var inside = false, part, p1, p2, i, j, k, len, len2;
            if (!this._pxBounds || !this._pxBounds.contains(p)) {
              return false;
            }
            for (i = 0, len = this._parts.length; i < len; i++) {
              part = this._parts[i];
              for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
                p1 = part[j];
                p2 = part[k];
                if (p1.y > p.y !== p2.y > p.y && p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x) {
                  inside = !inside;
                }
              }
            }
            return inside || Polyline.prototype._containsPoint.call(this, p, true);
          }
        });
        function polygon(latlngs, options) {
          return new Polygon(latlngs, options);
        }
        var GeoJSON = FeatureGroup.extend({
          /* @section
           * @aka GeoJSON options
           *
           * @option pointToLayer: Function = *
           * A `Function` defining how GeoJSON points spawn Leaflet layers. It is internally
           * called when data is added, passing the GeoJSON point feature and its `LatLng`.
           * The default is to spawn a default `Marker`:
           * ```js
           * function(geoJsonPoint, latlng) {
           * 	return L.marker(latlng);
           * }
           * ```
           *
           * @option style: Function = *
           * A `Function` defining the `Path options` for styling GeoJSON lines and polygons,
           * called internally when data is added.
           * The default value is to not override any defaults:
           * ```js
           * function (geoJsonFeature) {
           * 	return {}
           * }
           * ```
           *
           * @option onEachFeature: Function = *
           * A `Function` that will be called once for each created `Feature`, after it has
           * been created and styled. Useful for attaching events and popups to features.
           * The default is to do nothing with the newly created layers:
           * ```js
           * function (feature, layer) {}
           * ```
           *
           * @option filter: Function = *
           * A `Function` that will be used to decide whether to include a feature or not.
           * The default is to include all features:
           * ```js
           * function (geoJsonFeature) {
           * 	return true;
           * }
           * ```
           * Note: dynamically changing the `filter` option will have effect only on newly
           * added data. It will _not_ re-evaluate already included features.
           *
           * @option coordsToLatLng: Function = *
           * A `Function` that will be used for converting GeoJSON coordinates to `LatLng`s.
           * The default is the `coordsToLatLng` static method.
           *
           * @option markersInheritOptions: Boolean = false
           * Whether default Markers for "Point" type Features inherit from group options.
           */
          initialize: function(geojson, options) {
            setOptions(this, options);
            this._layers = {};
            if (geojson) {
              this.addData(geojson);
            }
          },
          // @method addData( <GeoJSON> data ): this
          // Adds a GeoJSON object to the layer.
          addData: function(geojson) {
            var features = isArray(geojson) ? geojson : geojson.features, i, len, feature;
            if (features) {
              for (i = 0, len = features.length; i < len; i++) {
                feature = features[i];
                if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
                  this.addData(feature);
                }
              }
              return this;
            }
            var options = this.options;
            if (options.filter && !options.filter(geojson)) {
              return this;
            }
            var layer = geometryToLayer(geojson, options);
            if (!layer) {
              return this;
            }
            layer.feature = asFeature(geojson);
            layer.defaultOptions = layer.options;
            this.resetStyle(layer);
            if (options.onEachFeature) {
              options.onEachFeature(geojson, layer);
            }
            return this.addLayer(layer);
          },
          // @method resetStyle( <Path> layer? ): this
          // Resets the given vector layer's style to the original GeoJSON style, useful for resetting style after hover events.
          // If `layer` is omitted, the style of all features in the current layer is reset.
          resetStyle: function(layer) {
            if (layer === void 0) {
              return this.eachLayer(this.resetStyle, this);
            }
            layer.options = extend({}, layer.defaultOptions);
            this._setLayerStyle(layer, this.options.style);
            return this;
          },
          // @method setStyle( <Function> style ): this
          // Changes styles of GeoJSON vector layers with the given style function.
          setStyle: function(style2) {
            return this.eachLayer(function(layer) {
              this._setLayerStyle(layer, style2);
            }, this);
          },
          _setLayerStyle: function(layer, style2) {
            if (layer.setStyle) {
              if (typeof style2 === "function") {
                style2 = style2(layer.feature);
              }
              layer.setStyle(style2);
            }
          }
        });
        function geometryToLayer(geojson, options) {
          var geometry = geojson.type === "Feature" ? geojson.geometry : geojson, coords = geometry ? geometry.coordinates : null, layers2 = [], pointToLayer = options && options.pointToLayer, _coordsToLatLng = options && options.coordsToLatLng || coordsToLatLng, latlng, latlngs, i, len;
          if (!coords && !geometry) {
            return null;
          }
          switch (geometry.type) {
            case "Point":
              latlng = _coordsToLatLng(coords);
              return _pointToLayer(pointToLayer, geojson, latlng, options);
            case "MultiPoint":
              for (i = 0, len = coords.length; i < len; i++) {
                latlng = _coordsToLatLng(coords[i]);
                layers2.push(_pointToLayer(pointToLayer, geojson, latlng, options));
              }
              return new FeatureGroup(layers2);
            case "LineString":
            case "MultiLineString":
              latlngs = coordsToLatLngs(coords, geometry.type === "LineString" ? 0 : 1, _coordsToLatLng);
              return new Polyline(latlngs, options);
            case "Polygon":
            case "MultiPolygon":
              latlngs = coordsToLatLngs(coords, geometry.type === "Polygon" ? 1 : 2, _coordsToLatLng);
              return new Polygon(latlngs, options);
            case "GeometryCollection":
              for (i = 0, len = geometry.geometries.length; i < len; i++) {
                var geoLayer = geometryToLayer({
                  geometry: geometry.geometries[i],
                  type: "Feature",
                  properties: geojson.properties
                }, options);
                if (geoLayer) {
                  layers2.push(geoLayer);
                }
              }
              return new FeatureGroup(layers2);
            case "FeatureCollection":
              for (i = 0, len = geometry.features.length; i < len; i++) {
                var featureLayer = geometryToLayer(geometry.features[i], options);
                if (featureLayer) {
                  layers2.push(featureLayer);
                }
              }
              return new FeatureGroup(layers2);
            default:
              throw new Error("Invalid GeoJSON object.");
          }
        }
        function _pointToLayer(pointToLayerFn, geojson, latlng, options) {
          return pointToLayerFn ? pointToLayerFn(geojson, latlng) : new Marker(latlng, options && options.markersInheritOptions && options);
        }
        function coordsToLatLng(coords) {
          return new LatLng(coords[1], coords[0], coords[2]);
        }
        function coordsToLatLngs(coords, levelsDeep, _coordsToLatLng) {
          var latlngs = [];
          for (var i = 0, len = coords.length, latlng; i < len; i++) {
            latlng = levelsDeep ? coordsToLatLngs(coords[i], levelsDeep - 1, _coordsToLatLng) : (_coordsToLatLng || coordsToLatLng)(coords[i]);
            latlngs.push(latlng);
          }
          return latlngs;
        }
        function latLngToCoords(latlng, precision) {
          latlng = toLatLng(latlng);
          return latlng.alt !== void 0 ? [formatNum(latlng.lng, precision), formatNum(latlng.lat, precision), formatNum(latlng.alt, precision)] : [formatNum(latlng.lng, precision), formatNum(latlng.lat, precision)];
        }
        function latLngsToCoords(latlngs, levelsDeep, closed, precision) {
          var coords = [];
          for (var i = 0, len = latlngs.length; i < len; i++) {
            coords.push(levelsDeep ? latLngsToCoords(latlngs[i], isFlat(latlngs[i]) ? 0 : levelsDeep - 1, closed, precision) : latLngToCoords(latlngs[i], precision));
          }
          if (!levelsDeep && closed && coords.length > 0) {
            coords.push(coords[0].slice());
          }
          return coords;
        }
        function getFeature(layer, newGeometry) {
          return layer.feature ? extend({}, layer.feature, { geometry: newGeometry }) : asFeature(newGeometry);
        }
        function asFeature(geojson) {
          if (geojson.type === "Feature" || geojson.type === "FeatureCollection") {
            return geojson;
          }
          return {
            type: "Feature",
            properties: {},
            geometry: geojson
          };
        }
        var PointToGeoJSON = {
          toGeoJSON: function(precision) {
            return getFeature(this, {
              type: "Point",
              coordinates: latLngToCoords(this.getLatLng(), precision)
            });
          }
        };
        Marker.include(PointToGeoJSON);
        Circle.include(PointToGeoJSON);
        CircleMarker.include(PointToGeoJSON);
        Polyline.include({
          toGeoJSON: function(precision) {
            var multi = !isFlat(this._latlngs);
            var coords = latLngsToCoords(this._latlngs, multi ? 1 : 0, false, precision);
            return getFeature(this, {
              type: (multi ? "Multi" : "") + "LineString",
              coordinates: coords
            });
          }
        });
        Polygon.include({
          toGeoJSON: function(precision) {
            var holes = !isFlat(this._latlngs), multi = holes && !isFlat(this._latlngs[0]);
            var coords = latLngsToCoords(this._latlngs, multi ? 2 : holes ? 1 : 0, true, precision);
            if (!holes) {
              coords = [coords];
            }
            return getFeature(this, {
              type: (multi ? "Multi" : "") + "Polygon",
              coordinates: coords
            });
          }
        });
        LayerGroup.include({
          toMultiPoint: function(precision) {
            var coords = [];
            this.eachLayer(function(layer) {
              coords.push(layer.toGeoJSON(precision).geometry.coordinates);
            });
            return getFeature(this, {
              type: "MultiPoint",
              coordinates: coords
            });
          },
          // @method toGeoJSON(precision?: Number|false): Object
          // Coordinates values are rounded with [`formatNum`](#util-formatnum) function with given `precision`.
          // Returns a [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) representation of the layer group (as a GeoJSON `FeatureCollection`, `GeometryCollection`, or `MultiPoint`).
          toGeoJSON: function(precision) {
            var type = this.feature && this.feature.geometry && this.feature.geometry.type;
            if (type === "MultiPoint") {
              return this.toMultiPoint(precision);
            }
            var isGeometryCollection = type === "GeometryCollection", jsons = [];
            this.eachLayer(function(layer) {
              if (layer.toGeoJSON) {
                var json = layer.toGeoJSON(precision);
                if (isGeometryCollection) {
                  jsons.push(json.geometry);
                } else {
                  var feature = asFeature(json);
                  if (feature.type === "FeatureCollection") {
                    jsons.push.apply(jsons, feature.features);
                  } else {
                    jsons.push(feature);
                  }
                }
              }
            });
            if (isGeometryCollection) {
              return getFeature(this, {
                geometries: jsons,
                type: "GeometryCollection"
              });
            }
            return {
              type: "FeatureCollection",
              features: jsons
            };
          }
        });
        function geoJSON(geojson, options) {
          return new GeoJSON(geojson, options);
        }
        var geoJson = geoJSON;
        var ImageOverlay = Layer.extend({
          // @section
          // @aka ImageOverlay options
          options: {
            // @option opacity: Number = 1.0
            // The opacity of the image overlay.
            opacity: 1,
            // @option alt: String = ''
            // Text for the `alt` attribute of the image (useful for accessibility).
            alt: "",
            // @option interactive: Boolean = false
            // If `true`, the image overlay will emit [mouse events](#interactive-layer) when clicked or hovered.
            interactive: false,
            // @option crossOrigin: Boolean|String = false
            // Whether the crossOrigin attribute will be added to the image.
            // If a String is provided, the image will have its crossOrigin attribute set to the String provided. This is needed if you want to access image pixel data.
            // Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
            crossOrigin: false,
            // @option errorOverlayUrl: String = ''
            // URL to the overlay image to show in place of the overlay that failed to load.
            errorOverlayUrl: "",
            // @option zIndex: Number = 1
            // The explicit [zIndex](https://developer.mozilla.org/docs/Web/CSS/CSS_Positioning/Understanding_z_index) of the overlay layer.
            zIndex: 1,
            // @option className: String = ''
            // A custom class name to assign to the image. Empty by default.
            className: ""
          },
          initialize: function(url, bounds, options) {
            this._url = url;
            this._bounds = toLatLngBounds(bounds);
            setOptions(this, options);
          },
          onAdd: function() {
            if (!this._image) {
              this._initImage();
              if (this.options.opacity < 1) {
                this._updateOpacity();
              }
            }
            if (this.options.interactive) {
              addClass(this._image, "leaflet-interactive");
              this.addInteractiveTarget(this._image);
            }
            this.getPane().appendChild(this._image);
            this._reset();
          },
          onRemove: function() {
            remove(this._image);
            if (this.options.interactive) {
              this.removeInteractiveTarget(this._image);
            }
          },
          // @method setOpacity(opacity: Number): this
          // Sets the opacity of the overlay.
          setOpacity: function(opacity) {
            this.options.opacity = opacity;
            if (this._image) {
              this._updateOpacity();
            }
            return this;
          },
          setStyle: function(styleOpts) {
            if (styleOpts.opacity) {
              this.setOpacity(styleOpts.opacity);
            }
            return this;
          },
          // @method bringToFront(): this
          // Brings the layer to the top of all overlays.
          bringToFront: function() {
            if (this._map) {
              toFront(this._image);
            }
            return this;
          },
          // @method bringToBack(): this
          // Brings the layer to the bottom of all overlays.
          bringToBack: function() {
            if (this._map) {
              toBack(this._image);
            }
            return this;
          },
          // @method setUrl(url: String): this
          // Changes the URL of the image.
          setUrl: function(url) {
            this._url = url;
            if (this._image) {
              this._image.src = url;
            }
            return this;
          },
          // @method setBounds(bounds: LatLngBounds): this
          // Update the bounds that this ImageOverlay covers
          setBounds: function(bounds) {
            this._bounds = toLatLngBounds(bounds);
            if (this._map) {
              this._reset();
            }
            return this;
          },
          getEvents: function() {
            var events = {
              zoom: this._reset,
              viewreset: this._reset
            };
            if (this._zoomAnimated) {
              events.zoomanim = this._animateZoom;
            }
            return events;
          },
          // @method setZIndex(value: Number): this
          // Changes the [zIndex](#imageoverlay-zindex) of the image overlay.
          setZIndex: function(value) {
            this.options.zIndex = value;
            this._updateZIndex();
            return this;
          },
          // @method getBounds(): LatLngBounds
          // Get the bounds that this ImageOverlay covers
          getBounds: function() {
            return this._bounds;
          },
          // @method getElement(): HTMLElement
          // Returns the instance of [`HTMLImageElement`](https://developer.mozilla.org/docs/Web/API/HTMLImageElement)
          // used by this overlay.
          getElement: function() {
            return this._image;
          },
          _initImage: function() {
            var wasElementSupplied = this._url.tagName === "IMG";
            var img = this._image = wasElementSupplied ? this._url : create$1("img");
            addClass(img, "leaflet-image-layer");
            if (this._zoomAnimated) {
              addClass(img, "leaflet-zoom-animated");
            }
            if (this.options.className) {
              addClass(img, this.options.className);
            }
            img.onselectstart = falseFn;
            img.onmousemove = falseFn;
            img.onload = bind(this.fire, this, "load");
            img.onerror = bind(this._overlayOnError, this, "error");
            if (this.options.crossOrigin || this.options.crossOrigin === "") {
              img.crossOrigin = this.options.crossOrigin === true ? "" : this.options.crossOrigin;
            }
            if (this.options.zIndex) {
              this._updateZIndex();
            }
            if (wasElementSupplied) {
              this._url = img.src;
              return;
            }
            img.src = this._url;
            img.alt = this.options.alt;
          },
          _animateZoom: function(e) {
            var scale2 = this._map.getZoomScale(e.zoom), offset = this._map._latLngBoundsToNewLayerBounds(this._bounds, e.zoom, e.center).min;
            setTransform(this._image, offset, scale2);
          },
          _reset: function() {
            var image = this._image, bounds = new Bounds(
              this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
              this._map.latLngToLayerPoint(this._bounds.getSouthEast())
            ), size = bounds.getSize();
            setPosition(image, bounds.min);
            image.style.width = size.x + "px";
            image.style.height = size.y + "px";
          },
          _updateOpacity: function() {
            setOpacity(this._image, this.options.opacity);
          },
          _updateZIndex: function() {
            if (this._image && this.options.zIndex !== void 0 && this.options.zIndex !== null) {
              this._image.style.zIndex = this.options.zIndex;
            }
          },
          _overlayOnError: function() {
            this.fire("error");
            var errorUrl = this.options.errorOverlayUrl;
            if (errorUrl && this._url !== errorUrl) {
              this._url = errorUrl;
              this._image.src = errorUrl;
            }
          },
          // @method getCenter(): LatLng
          // Returns the center of the ImageOverlay.
          getCenter: function() {
            return this._bounds.getCenter();
          }
        });
        var imageOverlay = function(url, bounds, options) {
          return new ImageOverlay(url, bounds, options);
        };
        var VideoOverlay = ImageOverlay.extend({
          // @section
          // @aka VideoOverlay options
          options: {
            // @option autoplay: Boolean = true
            // Whether the video starts playing automatically when loaded.
            // On some browsers autoplay will only work with `muted: true`
            autoplay: true,
            // @option loop: Boolean = true
            // Whether the video will loop back to the beginning when played.
            loop: true,
            // @option keepAspectRatio: Boolean = true
            // Whether the video will save aspect ratio after the projection.
            // Relevant for supported browsers. See [browser compatibility](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit)
            keepAspectRatio: true,
            // @option muted: Boolean = false
            // Whether the video starts on mute when loaded.
            muted: false,
            // @option playsInline: Boolean = true
            // Mobile browsers will play the video right where it is instead of open it up in fullscreen mode.
            playsInline: true
          },
          _initImage: function() {
            var wasElementSupplied = this._url.tagName === "VIDEO";
            var vid = this._image = wasElementSupplied ? this._url : create$1("video");
            addClass(vid, "leaflet-image-layer");
            if (this._zoomAnimated) {
              addClass(vid, "leaflet-zoom-animated");
            }
            if (this.options.className) {
              addClass(vid, this.options.className);
            }
            vid.onselectstart = falseFn;
            vid.onmousemove = falseFn;
            vid.onloadeddata = bind(this.fire, this, "load");
            if (wasElementSupplied) {
              var sourceElements = vid.getElementsByTagName("source");
              var sources = [];
              for (var j = 0; j < sourceElements.length; j++) {
                sources.push(sourceElements[j].src);
              }
              this._url = sourceElements.length > 0 ? sources : [vid.src];
              return;
            }
            if (!isArray(this._url)) {
              this._url = [this._url];
            }
            if (!this.options.keepAspectRatio && Object.prototype.hasOwnProperty.call(vid.style, "objectFit")) {
              vid.style["objectFit"] = "fill";
            }
            vid.autoplay = !!this.options.autoplay;
            vid.loop = !!this.options.loop;
            vid.muted = !!this.options.muted;
            vid.playsInline = !!this.options.playsInline;
            for (var i = 0; i < this._url.length; i++) {
              var source = create$1("source");
              source.src = this._url[i];
              vid.appendChild(source);
            }
          }
          // @method getElement(): HTMLVideoElement
          // Returns the instance of [`HTMLVideoElement`](https://developer.mozilla.org/docs/Web/API/HTMLVideoElement)
          // used by this overlay.
        });
        function videoOverlay(video, bounds, options) {
          return new VideoOverlay(video, bounds, options);
        }
        var SVGOverlay = ImageOverlay.extend({
          _initImage: function() {
            var el = this._image = this._url;
            addClass(el, "leaflet-image-layer");
            if (this._zoomAnimated) {
              addClass(el, "leaflet-zoom-animated");
            }
            if (this.options.className) {
              addClass(el, this.options.className);
            }
            el.onselectstart = falseFn;
            el.onmousemove = falseFn;
          }
          // @method getElement(): SVGElement
          // Returns the instance of [`SVGElement`](https://developer.mozilla.org/docs/Web/API/SVGElement)
          // used by this overlay.
        });
        function svgOverlay(el, bounds, options) {
          return new SVGOverlay(el, bounds, options);
        }
        var DivOverlay = Layer.extend({
          // @section
          // @aka DivOverlay options
          options: {
            // @option interactive: Boolean = false
            // If true, the popup/tooltip will listen to the mouse events.
            interactive: false,
            // @option offset: Point = Point(0, 0)
            // The offset of the overlay position.
            offset: [0, 0],
            // @option className: String = ''
            // A custom CSS class name to assign to the overlay.
            className: "",
            // @option pane: String = undefined
            // `Map pane` where the overlay will be added.
            pane: void 0,
            // @option content: String|HTMLElement|Function = ''
            // Sets the HTML content of the overlay while initializing. If a function is passed the source layer will be
            // passed to the function. The function should return a `String` or `HTMLElement` to be used in the overlay.
            content: ""
          },
          initialize: function(options, source) {
            if (options && (options instanceof LatLng || isArray(options))) {
              this._latlng = toLatLng(options);
              setOptions(this, source);
            } else {
              setOptions(this, options);
              this._source = source;
            }
            if (this.options.content) {
              this._content = this.options.content;
            }
          },
          // @method openOn(map: Map): this
          // Adds the overlay to the map.
          // Alternative to `map.openPopup(popup)`/`.openTooltip(tooltip)`.
          openOn: function(map) {
            map = arguments.length ? map : this._source._map;
            if (!map.hasLayer(this)) {
              map.addLayer(this);
            }
            return this;
          },
          // @method close(): this
          // Closes the overlay.
          // Alternative to `map.closePopup(popup)`/`.closeTooltip(tooltip)`
          // and `layer.closePopup()`/`.closeTooltip()`.
          close: function() {
            if (this._map) {
              this._map.removeLayer(this);
            }
            return this;
          },
          // @method toggle(layer?: Layer): this
          // Opens or closes the overlay bound to layer depending on its current state.
          // Argument may be omitted only for overlay bound to layer.
          // Alternative to `layer.togglePopup()`/`.toggleTooltip()`.
          toggle: function(layer) {
            if (this._map) {
              this.close();
            } else {
              if (arguments.length) {
                this._source = layer;
              } else {
                layer = this._source;
              }
              this._prepareOpen();
              this.openOn(layer._map);
            }
            return this;
          },
          onAdd: function(map) {
            this._zoomAnimated = map._zoomAnimated;
            if (!this._container) {
              this._initLayout();
            }
            if (map._fadeAnimated) {
              setOpacity(this._container, 0);
            }
            clearTimeout(this._removeTimeout);
            this.getPane().appendChild(this._container);
            this.update();
            if (map._fadeAnimated) {
              setOpacity(this._container, 1);
            }
            this.bringToFront();
            if (this.options.interactive) {
              addClass(this._container, "leaflet-interactive");
              this.addInteractiveTarget(this._container);
            }
          },
          onRemove: function(map) {
            if (map._fadeAnimated) {
              setOpacity(this._container, 0);
              this._removeTimeout = setTimeout(bind(remove, void 0, this._container), 200);
            } else {
              remove(this._container);
            }
            if (this.options.interactive) {
              removeClass(this._container, "leaflet-interactive");
              this.removeInteractiveTarget(this._container);
            }
          },
          // @namespace DivOverlay
          // @method getLatLng: LatLng
          // Returns the geographical point of the overlay.
          getLatLng: function() {
            return this._latlng;
          },
          // @method setLatLng(latlng: LatLng): this
          // Sets the geographical point where the overlay will open.
          setLatLng: function(latlng) {
            this._latlng = toLatLng(latlng);
            if (this._map) {
              this._updatePosition();
              this._adjustPan();
            }
            return this;
          },
          // @method getContent: String|HTMLElement
          // Returns the content of the overlay.
          getContent: function() {
            return this._content;
          },
          // @method setContent(htmlContent: String|HTMLElement|Function): this
          // Sets the HTML content of the overlay. If a function is passed the source layer will be passed to the function.
          // The function should return a `String` or `HTMLElement` to be used in the overlay.
          setContent: function(content) {
            this._content = content;
            this.update();
            return this;
          },
          // @method getElement: String|HTMLElement
          // Returns the HTML container of the overlay.
          getElement: function() {
            return this._container;
          },
          // @method update: null
          // Updates the overlay content, layout and position. Useful for updating the overlay after something inside changed, e.g. image loaded.
          update: function() {
            if (!this._map) {
              return;
            }
            this._container.style.visibility = "hidden";
            this._updateContent();
            this._updateLayout();
            this._updatePosition();
            this._container.style.visibility = "";
            this._adjustPan();
          },
          getEvents: function() {
            var events = {
              zoom: this._updatePosition,
              viewreset: this._updatePosition
            };
            if (this._zoomAnimated) {
              events.zoomanim = this._animateZoom;
            }
            return events;
          },
          // @method isOpen: Boolean
          // Returns `true` when the overlay is visible on the map.
          isOpen: function() {
            return !!this._map && this._map.hasLayer(this);
          },
          // @method bringToFront: this
          // Brings this overlay in front of other overlays (in the same map pane).
          bringToFront: function() {
            if (this._map) {
              toFront(this._container);
            }
            return this;
          },
          // @method bringToBack: this
          // Brings this overlay to the back of other overlays (in the same map pane).
          bringToBack: function() {
            if (this._map) {
              toBack(this._container);
            }
            return this;
          },
          // prepare bound overlay to open: update latlng pos / content source (for FeatureGroup)
          _prepareOpen: function(latlng) {
            var source = this._source;
            if (!source._map) {
              return false;
            }
            if (source instanceof FeatureGroup) {
              source = null;
              var layers2 = this._source._layers;
              for (var id in layers2) {
                if (layers2[id]._map) {
                  source = layers2[id];
                  break;
                }
              }
              if (!source) {
                return false;
              }
              this._source = source;
            }
            if (!latlng) {
              if (source.getCenter) {
                latlng = source.getCenter();
              } else if (source.getLatLng) {
                latlng = source.getLatLng();
              } else if (source.getBounds) {
                latlng = source.getBounds().getCenter();
              } else {
                throw new Error("Unable to get source layer LatLng.");
              }
            }
            this.setLatLng(latlng);
            if (this._map) {
              this.update();
            }
            return true;
          },
          _updateContent: function() {
            if (!this._content) {
              return;
            }
            var node = this._contentNode;
            var content = typeof this._content === "function" ? this._content(this._source || this) : this._content;
            if (typeof content === "string") {
              node.innerHTML = content;
            } else {
              while (node.hasChildNodes()) {
                node.removeChild(node.firstChild);
              }
              node.appendChild(content);
            }
            this.fire("contentupdate");
          },
          _updatePosition: function() {
            if (!this._map) {
              return;
            }
            var pos = this._map.latLngToLayerPoint(this._latlng), offset = toPoint(this.options.offset), anchor = this._getAnchor();
            if (this._zoomAnimated) {
              setPosition(this._container, pos.add(anchor));
            } else {
              offset = offset.add(pos).add(anchor);
            }
            var bottom = this._containerBottom = -offset.y, left = this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x;
            this._container.style.bottom = bottom + "px";
            this._container.style.left = left + "px";
          },
          _getAnchor: function() {
            return [0, 0];
          }
        });
        Map2.include({
          _initOverlay: function(OverlayClass, content, latlng, options) {
            var overlay2 = content;
            if (!(overlay2 instanceof OverlayClass)) {
              overlay2 = new OverlayClass(options).setContent(content);
            }
            if (latlng) {
              overlay2.setLatLng(latlng);
            }
            return overlay2;
          }
        });
        Layer.include({
          _initOverlay: function(OverlayClass, old, content, options) {
            var overlay2 = content;
            if (overlay2 instanceof OverlayClass) {
              setOptions(overlay2, options);
              overlay2._source = this;
            } else {
              overlay2 = old && !options ? old : new OverlayClass(options, this);
              overlay2.setContent(content);
            }
            return overlay2;
          }
        });
        var Popup = DivOverlay.extend({
          // @section
          // @aka Popup options
          options: {
            // @option pane: String = 'popupPane'
            // `Map pane` where the popup will be added.
            pane: "popupPane",
            // @option offset: Point = Point(0, 7)
            // The offset of the popup position.
            offset: [0, 7],
            // @option maxWidth: Number = 300
            // Max width of the popup, in pixels.
            maxWidth: 300,
            // @option minWidth: Number = 50
            // Min width of the popup, in pixels.
            minWidth: 50,
            // @option maxHeight: Number = null
            // If set, creates a scrollable container of the given height
            // inside a popup if its content exceeds it.
            // The scrollable container can be styled using the
            // `leaflet-popup-scrolled` CSS class selector.
            maxHeight: null,
            // @option autoPan: Boolean = true
            // Set it to `false` if you don't want the map to do panning animation
            // to fit the opened popup.
            autoPan: true,
            // @option autoPanPaddingTopLeft: Point = null
            // The margin between the popup and the top left corner of the map
            // view after autopanning was performed.
            autoPanPaddingTopLeft: null,
            // @option autoPanPaddingBottomRight: Point = null
            // The margin between the popup and the bottom right corner of the map
            // view after autopanning was performed.
            autoPanPaddingBottomRight: null,
            // @option autoPanPadding: Point = Point(5, 5)
            // Equivalent of setting both top left and bottom right autopan padding to the same value.
            autoPanPadding: [5, 5],
            // @option keepInView: Boolean = false
            // Set it to `true` if you want to prevent users from panning the popup
            // off of the screen while it is open.
            keepInView: false,
            // @option closeButton: Boolean = true
            // Controls the presence of a close button in the popup.
            closeButton: true,
            // @option autoClose: Boolean = true
            // Set it to `false` if you want to override the default behavior of
            // the popup closing when another popup is opened.
            autoClose: true,
            // @option closeOnEscapeKey: Boolean = true
            // Set it to `false` if you want to override the default behavior of
            // the ESC key for closing of the popup.
            closeOnEscapeKey: true,
            // @option closeOnClick: Boolean = *
            // Set it if you want to override the default behavior of the popup closing when user clicks
            // on the map. Defaults to the map's [`closePopupOnClick`](#map-closepopuponclick) option.
            // @option className: String = ''
            // A custom CSS class name to assign to the popup.
            className: ""
          },
          // @namespace Popup
          // @method openOn(map: Map): this
          // Alternative to `map.openPopup(popup)`.
          // Adds the popup to the map and closes the previous one.
          openOn: function(map) {
            map = arguments.length ? map : this._source._map;
            if (!map.hasLayer(this) && map._popup && map._popup.options.autoClose) {
              map.removeLayer(map._popup);
            }
            map._popup = this;
            return DivOverlay.prototype.openOn.call(this, map);
          },
          onAdd: function(map) {
            DivOverlay.prototype.onAdd.call(this, map);
            map.fire("popupopen", { popup: this });
            if (this._source) {
              this._source.fire("popupopen", { popup: this }, true);
              if (!(this._source instanceof Path)) {
                this._source.on("preclick", stopPropagation);
              }
            }
          },
          onRemove: function(map) {
            DivOverlay.prototype.onRemove.call(this, map);
            map.fire("popupclose", { popup: this });
            if (this._source) {
              this._source.fire("popupclose", { popup: this }, true);
              if (!(this._source instanceof Path)) {
                this._source.off("preclick", stopPropagation);
              }
            }
          },
          getEvents: function() {
            var events = DivOverlay.prototype.getEvents.call(this);
            if (this.options.closeOnClick !== void 0 ? this.options.closeOnClick : this._map.options.closePopupOnClick) {
              events.preclick = this.close;
            }
            if (this.options.keepInView) {
              events.moveend = this._adjustPan;
            }
            return events;
          },
          _initLayout: function() {
            var prefix = "leaflet-popup", container = this._container = create$1(
              "div",
              prefix + " " + (this.options.className || "") + " leaflet-zoom-animated"
            );
            var wrapper = this._wrapper = create$1("div", prefix + "-content-wrapper", container);
            this._contentNode = create$1("div", prefix + "-content", wrapper);
            disableClickPropagation(container);
            disableScrollPropagation(this._contentNode);
            on(container, "contextmenu", stopPropagation);
            this._tipContainer = create$1("div", prefix + "-tip-container", container);
            this._tip = create$1("div", prefix + "-tip", this._tipContainer);
            if (this.options.closeButton) {
              var closeButton = this._closeButton = create$1("a", prefix + "-close-button", container);
              closeButton.setAttribute("role", "button");
              closeButton.setAttribute("aria-label", "Close popup");
              closeButton.href = "#close";
              closeButton.innerHTML = '<span aria-hidden="true">&#215;</span>';
              on(closeButton, "click", function(ev) {
                preventDefault(ev);
                this.close();
              }, this);
            }
          },
          _updateLayout: function() {
            var container = this._contentNode, style2 = container.style;
            style2.width = "";
            style2.whiteSpace = "nowrap";
            var width = container.offsetWidth;
            width = Math.min(width, this.options.maxWidth);
            width = Math.max(width, this.options.minWidth);
            style2.width = width + 1 + "px";
            style2.whiteSpace = "";
            style2.height = "";
            var height = container.offsetHeight, maxHeight = this.options.maxHeight, scrolledClass = "leaflet-popup-scrolled";
            if (maxHeight && height > maxHeight) {
              style2.height = maxHeight + "px";
              addClass(container, scrolledClass);
            } else {
              removeClass(container, scrolledClass);
            }
            this._containerWidth = this._container.offsetWidth;
          },
          _animateZoom: function(e) {
            var pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center), anchor = this._getAnchor();
            setPosition(this._container, pos.add(anchor));
          },
          _adjustPan: function() {
            if (!this.options.autoPan) {
              return;
            }
            if (this._map._panAnim) {
              this._map._panAnim.stop();
            }
            if (this._autopanning) {
              this._autopanning = false;
              return;
            }
            var map = this._map, marginBottom = parseInt(getStyle(this._container, "marginBottom"), 10) || 0, containerHeight = this._container.offsetHeight + marginBottom, containerWidth = this._containerWidth, layerPos = new Point(this._containerLeft, -containerHeight - this._containerBottom);
            layerPos._add(getPosition(this._container));
            var containerPos = map.layerPointToContainerPoint(layerPos), padding = toPoint(this.options.autoPanPadding), paddingTL = toPoint(this.options.autoPanPaddingTopLeft || padding), paddingBR = toPoint(this.options.autoPanPaddingBottomRight || padding), size = map.getSize(), dx = 0, dy = 0;
            if (containerPos.x + containerWidth + paddingBR.x > size.x) {
              dx = containerPos.x + containerWidth - size.x + paddingBR.x;
            }
            if (containerPos.x - dx - paddingTL.x < 0) {
              dx = containerPos.x - paddingTL.x;
            }
            if (containerPos.y + containerHeight + paddingBR.y > size.y) {
              dy = containerPos.y + containerHeight - size.y + paddingBR.y;
            }
            if (containerPos.y - dy - paddingTL.y < 0) {
              dy = containerPos.y - paddingTL.y;
            }
            if (dx || dy) {
              if (this.options.keepInView) {
                this._autopanning = true;
              }
              map.fire("autopanstart").panBy([dx, dy]);
            }
          },
          _getAnchor: function() {
            return toPoint(this._source && this._source._getPopupAnchor ? this._source._getPopupAnchor() : [0, 0]);
          }
        });
        var popup = function(options, source) {
          return new Popup(options, source);
        };
        Map2.mergeOptions({
          closePopupOnClick: true
        });
        Map2.include({
          // @method openPopup(popup: Popup): this
          // Opens the specified popup while closing the previously opened (to make sure only one is opened at one time for usability).
          // @alternative
          // @method openPopup(content: String|HTMLElement, latlng: LatLng, options?: Popup options): this
          // Creates a popup with the specified content and options and opens it in the given point on a map.
          openPopup: function(popup2, latlng, options) {
            this._initOverlay(Popup, popup2, latlng, options).openOn(this);
            return this;
          },
          // @method closePopup(popup?: Popup): this
          // Closes the popup previously opened with [openPopup](#map-openpopup) (or the given one).
          closePopup: function(popup2) {
            popup2 = arguments.length ? popup2 : this._popup;
            if (popup2) {
              popup2.close();
            }
            return this;
          }
        });
        Layer.include({
          // @method bindPopup(content: String|HTMLElement|Function|Popup, options?: Popup options): this
          // Binds a popup to the layer with the passed `content` and sets up the
          // necessary event listeners. If a `Function` is passed it will receive
          // the layer as the first argument and should return a `String` or `HTMLElement`.
          bindPopup: function(content, options) {
            this._popup = this._initOverlay(Popup, this._popup, content, options);
            if (!this._popupHandlersAdded) {
              this.on({
                click: this._openPopup,
                keypress: this._onKeyPress,
                remove: this.closePopup,
                move: this._movePopup
              });
              this._popupHandlersAdded = true;
            }
            return this;
          },
          // @method unbindPopup(): this
          // Removes the popup previously bound with `bindPopup`.
          unbindPopup: function() {
            if (this._popup) {
              this.off({
                click: this._openPopup,
                keypress: this._onKeyPress,
                remove: this.closePopup,
                move: this._movePopup
              });
              this._popupHandlersAdded = false;
              this._popup = null;
            }
            return this;
          },
          // @method openPopup(latlng?: LatLng): this
          // Opens the bound popup at the specified `latlng` or at the default popup anchor if no `latlng` is passed.
          openPopup: function(latlng) {
            if (this._popup) {
              if (!(this instanceof FeatureGroup)) {
                this._popup._source = this;
              }
              if (this._popup._prepareOpen(latlng || this._latlng)) {
                this._popup.openOn(this._map);
              }
            }
            return this;
          },
          // @method closePopup(): this
          // Closes the popup bound to this layer if it is open.
          closePopup: function() {
            if (this._popup) {
              this._popup.close();
            }
            return this;
          },
          // @method togglePopup(): this
          // Opens or closes the popup bound to this layer depending on its current state.
          togglePopup: function() {
            if (this._popup) {
              this._popup.toggle(this);
            }
            return this;
          },
          // @method isPopupOpen(): boolean
          // Returns `true` if the popup bound to this layer is currently open.
          isPopupOpen: function() {
            return this._popup ? this._popup.isOpen() : false;
          },
          // @method setPopupContent(content: String|HTMLElement|Popup): this
          // Sets the content of the popup bound to this layer.
          setPopupContent: function(content) {
            if (this._popup) {
              this._popup.setContent(content);
            }
            return this;
          },
          // @method getPopup(): Popup
          // Returns the popup bound to this layer.
          getPopup: function() {
            return this._popup;
          },
          _openPopup: function(e) {
            if (!this._popup || !this._map) {
              return;
            }
            stop(e);
            var target = e.layer || e.target;
            if (this._popup._source === target && !(target instanceof Path)) {
              if (this._map.hasLayer(this._popup)) {
                this.closePopup();
              } else {
                this.openPopup(e.latlng);
              }
              return;
            }
            this._popup._source = target;
            this.openPopup(e.latlng);
          },
          _movePopup: function(e) {
            this._popup.setLatLng(e.latlng);
          },
          _onKeyPress: function(e) {
            if (e.originalEvent.keyCode === 13) {
              this._openPopup(e);
            }
          }
        });
        var Tooltip = DivOverlay.extend({
          // @section
          // @aka Tooltip options
          options: {
            // @option pane: String = 'tooltipPane'
            // `Map pane` where the tooltip will be added.
            pane: "tooltipPane",
            // @option offset: Point = Point(0, 0)
            // Optional offset of the tooltip position.
            offset: [0, 0],
            // @option direction: String = 'auto'
            // Direction where to open the tooltip. Possible values are: `right`, `left`,
            // `top`, `bottom`, `center`, `auto`.
            // `auto` will dynamically switch between `right` and `left` according to the tooltip
            // position on the map.
            direction: "auto",
            // @option permanent: Boolean = false
            // Whether to open the tooltip permanently or only on mouseover.
            permanent: false,
            // @option sticky: Boolean = false
            // If true, the tooltip will follow the mouse instead of being fixed at the feature center.
            sticky: false,
            // @option opacity: Number = 0.9
            // Tooltip container opacity.
            opacity: 0.9
          },
          onAdd: function(map) {
            DivOverlay.prototype.onAdd.call(this, map);
            this.setOpacity(this.options.opacity);
            map.fire("tooltipopen", { tooltip: this });
            if (this._source) {
              this.addEventParent(this._source);
              this._source.fire("tooltipopen", { tooltip: this }, true);
            }
          },
          onRemove: function(map) {
            DivOverlay.prototype.onRemove.call(this, map);
            map.fire("tooltipclose", { tooltip: this });
            if (this._source) {
              this.removeEventParent(this._source);
              this._source.fire("tooltipclose", { tooltip: this }, true);
            }
          },
          getEvents: function() {
            var events = DivOverlay.prototype.getEvents.call(this);
            if (!this.options.permanent) {
              events.preclick = this.close;
            }
            return events;
          },
          _initLayout: function() {
            var prefix = "leaflet-tooltip", className = prefix + " " + (this.options.className || "") + " leaflet-zoom-" + (this._zoomAnimated ? "animated" : "hide");
            this._contentNode = this._container = create$1("div", className);
            this._container.setAttribute("role", "tooltip");
            this._container.setAttribute("id", "leaflet-tooltip-" + stamp(this));
          },
          _updateLayout: function() {
          },
          _adjustPan: function() {
          },
          _setPosition: function(pos) {
            var subX, subY, map = this._map, container = this._container, centerPoint = map.latLngToContainerPoint(map.getCenter()), tooltipPoint = map.layerPointToContainerPoint(pos), direction = this.options.direction, tooltipWidth = container.offsetWidth, tooltipHeight = container.offsetHeight, offset = toPoint(this.options.offset), anchor = this._getAnchor();
            if (direction === "top") {
              subX = tooltipWidth / 2;
              subY = tooltipHeight;
            } else if (direction === "bottom") {
              subX = tooltipWidth / 2;
              subY = 0;
            } else if (direction === "center") {
              subX = tooltipWidth / 2;
              subY = tooltipHeight / 2;
            } else if (direction === "right") {
              subX = 0;
              subY = tooltipHeight / 2;
            } else if (direction === "left") {
              subX = tooltipWidth;
              subY = tooltipHeight / 2;
            } else if (tooltipPoint.x < centerPoint.x) {
              direction = "right";
              subX = 0;
              subY = tooltipHeight / 2;
            } else {
              direction = "left";
              subX = tooltipWidth + (offset.x + anchor.x) * 2;
              subY = tooltipHeight / 2;
            }
            pos = pos.subtract(toPoint(subX, subY, true)).add(offset).add(anchor);
            removeClass(container, "leaflet-tooltip-right");
            removeClass(container, "leaflet-tooltip-left");
            removeClass(container, "leaflet-tooltip-top");
            removeClass(container, "leaflet-tooltip-bottom");
            addClass(container, "leaflet-tooltip-" + direction);
            setPosition(container, pos);
          },
          _updatePosition: function() {
            var pos = this._map.latLngToLayerPoint(this._latlng);
            this._setPosition(pos);
          },
          setOpacity: function(opacity) {
            this.options.opacity = opacity;
            if (this._container) {
              setOpacity(this._container, opacity);
            }
          },
          _animateZoom: function(e) {
            var pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center);
            this._setPosition(pos);
          },
          _getAnchor: function() {
            return toPoint(this._source && this._source._getTooltipAnchor && !this.options.sticky ? this._source._getTooltipAnchor() : [0, 0]);
          }
        });
        var tooltip = function(options, source) {
          return new Tooltip(options, source);
        };
        Map2.include({
          // @method openTooltip(tooltip: Tooltip): this
          // Opens the specified tooltip.
          // @alternative
          // @method openTooltip(content: String|HTMLElement, latlng: LatLng, options?: Tooltip options): this
          // Creates a tooltip with the specified content and options and open it.
          openTooltip: function(tooltip2, latlng, options) {
            this._initOverlay(Tooltip, tooltip2, latlng, options).openOn(this);
            return this;
          },
          // @method closeTooltip(tooltip: Tooltip): this
          // Closes the tooltip given as parameter.
          closeTooltip: function(tooltip2) {
            tooltip2.close();
            return this;
          }
        });
        Layer.include({
          // @method bindTooltip(content: String|HTMLElement|Function|Tooltip, options?: Tooltip options): this
          // Binds a tooltip to the layer with the passed `content` and sets up the
          // necessary event listeners. If a `Function` is passed it will receive
          // the layer as the first argument and should return a `String` or `HTMLElement`.
          bindTooltip: function(content, options) {
            if (this._tooltip && this.isTooltipOpen()) {
              this.unbindTooltip();
            }
            this._tooltip = this._initOverlay(Tooltip, this._tooltip, content, options);
            this._initTooltipInteractions();
            if (this._tooltip.options.permanent && this._map && this._map.hasLayer(this)) {
              this.openTooltip();
            }
            return this;
          },
          // @method unbindTooltip(): this
          // Removes the tooltip previously bound with `bindTooltip`.
          unbindTooltip: function() {
            if (this._tooltip) {
              this._initTooltipInteractions(true);
              this.closeTooltip();
              this._tooltip = null;
            }
            return this;
          },
          _initTooltipInteractions: function(remove2) {
            if (!remove2 && this._tooltipHandlersAdded) {
              return;
            }
            var onOff = remove2 ? "off" : "on", events = {
              remove: this.closeTooltip,
              move: this._moveTooltip
            };
            if (!this._tooltip.options.permanent) {
              events.mouseover = this._openTooltip;
              events.mouseout = this.closeTooltip;
              events.click = this._openTooltip;
              if (this._map) {
                this._addFocusListeners();
              } else {
                events.add = this._addFocusListeners;
              }
            } else {
              events.add = this._openTooltip;
            }
            if (this._tooltip.options.sticky) {
              events.mousemove = this._moveTooltip;
            }
            this[onOff](events);
            this._tooltipHandlersAdded = !remove2;
          },
          // @method openTooltip(latlng?: LatLng): this
          // Opens the bound tooltip at the specified `latlng` or at the default tooltip anchor if no `latlng` is passed.
          openTooltip: function(latlng) {
            if (this._tooltip) {
              if (!(this instanceof FeatureGroup)) {
                this._tooltip._source = this;
              }
              if (this._tooltip._prepareOpen(latlng)) {
                this._tooltip.openOn(this._map);
                if (this.getElement) {
                  this._setAriaDescribedByOnLayer(this);
                } else if (this.eachLayer) {
                  this.eachLayer(this._setAriaDescribedByOnLayer, this);
                }
              }
            }
            return this;
          },
          // @method closeTooltip(): this
          // Closes the tooltip bound to this layer if it is open.
          closeTooltip: function() {
            if (this._tooltip) {
              return this._tooltip.close();
            }
          },
          // @method toggleTooltip(): this
          // Opens or closes the tooltip bound to this layer depending on its current state.
          toggleTooltip: function() {
            if (this._tooltip) {
              this._tooltip.toggle(this);
            }
            return this;
          },
          // @method isTooltipOpen(): boolean
          // Returns `true` if the tooltip bound to this layer is currently open.
          isTooltipOpen: function() {
            return this._tooltip.isOpen();
          },
          // @method setTooltipContent(content: String|HTMLElement|Tooltip): this
          // Sets the content of the tooltip bound to this layer.
          setTooltipContent: function(content) {
            if (this._tooltip) {
              this._tooltip.setContent(content);
            }
            return this;
          },
          // @method getTooltip(): Tooltip
          // Returns the tooltip bound to this layer.
          getTooltip: function() {
            return this._tooltip;
          },
          _addFocusListeners: function() {
            if (this.getElement) {
              this._addFocusListenersOnLayer(this);
            } else if (this.eachLayer) {
              this.eachLayer(this._addFocusListenersOnLayer, this);
            }
          },
          _addFocusListenersOnLayer: function(layer) {
            var el = typeof layer.getElement === "function" && layer.getElement();
            if (el) {
              on(el, "focus", function() {
                this._tooltip._source = layer;
                this.openTooltip();
              }, this);
              on(el, "blur", this.closeTooltip, this);
            }
          },
          _setAriaDescribedByOnLayer: function(layer) {
            var el = typeof layer.getElement === "function" && layer.getElement();
            if (el) {
              el.setAttribute("aria-describedby", this._tooltip._container.id);
            }
          },
          _openTooltip: function(e) {
            if (!this._tooltip || !this._map) {
              return;
            }
            if (this._map.dragging && this._map.dragging.moving() && !this._openOnceFlag) {
              this._openOnceFlag = true;
              var that = this;
              this._map.once("moveend", function() {
                that._openOnceFlag = false;
                that._openTooltip(e);
              });
              return;
            }
            this._tooltip._source = e.layer || e.target;
            this.openTooltip(this._tooltip.options.sticky ? e.latlng : void 0);
          },
          _moveTooltip: function(e) {
            var latlng = e.latlng, containerPoint, layerPoint;
            if (this._tooltip.options.sticky && e.originalEvent) {
              containerPoint = this._map.mouseEventToContainerPoint(e.originalEvent);
              layerPoint = this._map.containerPointToLayerPoint(containerPoint);
              latlng = this._map.layerPointToLatLng(layerPoint);
            }
            this._tooltip.setLatLng(latlng);
          }
        });
        var DivIcon = Icon.extend({
          options: {
            // @section
            // @aka DivIcon options
            iconSize: [12, 12],
            // also can be set through CSS
            // iconAnchor: (Point),
            // popupAnchor: (Point),
            // @option html: String|HTMLElement = ''
            // Custom HTML code to put inside the div element, empty by default. Alternatively,
            // an instance of `HTMLElement`.
            html: false,
            // @option bgPos: Point = [0, 0]
            // Optional relative position of the background, in pixels
            bgPos: null,
            className: "leaflet-div-icon"
          },
          createIcon: function(oldIcon) {
            var div = oldIcon && oldIcon.tagName === "DIV" ? oldIcon : document.createElement("div"), options = this.options;
            if (options.html instanceof Element) {
              empty(div);
              div.appendChild(options.html);
            } else {
              div.innerHTML = options.html !== false ? options.html : "";
            }
            if (options.bgPos) {
              var bgPos = toPoint(options.bgPos);
              div.style.backgroundPosition = -bgPos.x + "px " + -bgPos.y + "px";
            }
            this._setIconStyles(div, "icon");
            return div;
          },
          createShadow: function() {
            return null;
          }
        });
        function divIcon(options) {
          return new DivIcon(options);
        }
        Icon.Default = IconDefault;
        var GridLayer = Layer.extend({
          // @section
          // @aka GridLayer options
          options: {
            // @option tileSize: Number|Point = 256
            // Width and height of tiles in the grid. Use a number if width and height are equal, or `L.point(width, height)` otherwise.
            tileSize: 256,
            // @option opacity: Number = 1.0
            // Opacity of the tiles. Can be used in the `createTile()` function.
            opacity: 1,
            // @option updateWhenIdle: Boolean = (depends)
            // Load new tiles only when panning ends.
            // `true` by default on mobile browsers, in order to avoid too many requests and keep smooth navigation.
            // `false` otherwise in order to display new tiles _during_ panning, since it is easy to pan outside the
            // [`keepBuffer`](#gridlayer-keepbuffer) option in desktop browsers.
            updateWhenIdle: Browser.mobile,
            // @option updateWhenZooming: Boolean = true
            // By default, a smooth zoom animation (during a [touch zoom](#map-touchzoom) or a [`flyTo()`](#map-flyto)) will update grid layers every integer zoom level. Setting this option to `false` will update the grid layer only when the smooth animation ends.
            updateWhenZooming: true,
            // @option updateInterval: Number = 200
            // Tiles will not update more than once every `updateInterval` milliseconds when panning.
            updateInterval: 200,
            // @option zIndex: Number = 1
            // The explicit zIndex of the tile layer.
            zIndex: 1,
            // @option bounds: LatLngBounds = undefined
            // If set, tiles will only be loaded inside the set `LatLngBounds`.
            bounds: null,
            // @option minZoom: Number = 0
            // The minimum zoom level down to which this layer will be displayed (inclusive).
            minZoom: 0,
            // @option maxZoom: Number = undefined
            // The maximum zoom level up to which this layer will be displayed (inclusive).
            maxZoom: void 0,
            // @option maxNativeZoom: Number = undefined
            // Maximum zoom number the tile source has available. If it is specified,
            // the tiles on all zoom levels higher than `maxNativeZoom` will be loaded
            // from `maxNativeZoom` level and auto-scaled.
            maxNativeZoom: void 0,
            // @option minNativeZoom: Number = undefined
            // Minimum zoom number the tile source has available. If it is specified,
            // the tiles on all zoom levels lower than `minNativeZoom` will be loaded
            // from `minNativeZoom` level and auto-scaled.
            minNativeZoom: void 0,
            // @option noWrap: Boolean = false
            // Whether the layer is wrapped around the antimeridian. If `true`, the
            // GridLayer will only be displayed once at low zoom levels. Has no
            // effect when the [map CRS](#map-crs) doesn't wrap around. Can be used
            // in combination with [`bounds`](#gridlayer-bounds) to prevent requesting
            // tiles outside the CRS limits.
            noWrap: false,
            // @option pane: String = 'tilePane'
            // `Map pane` where the grid layer will be added.
            pane: "tilePane",
            // @option className: String = ''
            // A custom class name to assign to the tile layer. Empty by default.
            className: "",
            // @option keepBuffer: Number = 2
            // When panning the map, keep this many rows and columns of tiles before unloading them.
            keepBuffer: 2
          },
          initialize: function(options) {
            setOptions(this, options);
          },
          onAdd: function() {
            this._initContainer();
            this._levels = {};
            this._tiles = {};
            this._resetView();
          },
          beforeAdd: function(map) {
            map._addZoomLimit(this);
          },
          onRemove: function(map) {
            this._removeAllTiles();
            remove(this._container);
            map._removeZoomLimit(this);
            this._container = null;
            this._tileZoom = void 0;
          },
          // @method bringToFront: this
          // Brings the tile layer to the top of all tile layers.
          bringToFront: function() {
            if (this._map) {
              toFront(this._container);
              this._setAutoZIndex(Math.max);
            }
            return this;
          },
          // @method bringToBack: this
          // Brings the tile layer to the bottom of all tile layers.
          bringToBack: function() {
            if (this._map) {
              toBack(this._container);
              this._setAutoZIndex(Math.min);
            }
            return this;
          },
          // @method getContainer: HTMLElement
          // Returns the HTML element that contains the tiles for this layer.
          getContainer: function() {
            return this._container;
          },
          // @method setOpacity(opacity: Number): this
          // Changes the [opacity](#gridlayer-opacity) of the grid layer.
          setOpacity: function(opacity) {
            this.options.opacity = opacity;
            this._updateOpacity();
            return this;
          },
          // @method setZIndex(zIndex: Number): this
          // Changes the [zIndex](#gridlayer-zindex) of the grid layer.
          setZIndex: function(zIndex) {
            this.options.zIndex = zIndex;
            this._updateZIndex();
            return this;
          },
          // @method isLoading: Boolean
          // Returns `true` if any tile in the grid layer has not finished loading.
          isLoading: function() {
            return this._loading;
          },
          // @method redraw: this
          // Causes the layer to clear all the tiles and request them again.
          redraw: function() {
            if (this._map) {
              this._removeAllTiles();
              var tileZoom = this._clampZoom(this._map.getZoom());
              if (tileZoom !== this._tileZoom) {
                this._tileZoom = tileZoom;
                this._updateLevels();
              }
              this._update();
            }
            return this;
          },
          getEvents: function() {
            var events = {
              viewprereset: this._invalidateAll,
              viewreset: this._resetView,
              zoom: this._resetView,
              moveend: this._onMoveEnd
            };
            if (!this.options.updateWhenIdle) {
              if (!this._onMove) {
                this._onMove = throttle(this._onMoveEnd, this.options.updateInterval, this);
              }
              events.move = this._onMove;
            }
            if (this._zoomAnimated) {
              events.zoomanim = this._animateZoom;
            }
            return events;
          },
          // @section Extension methods
          // Layers extending `GridLayer` shall reimplement the following method.
          // @method createTile(coords: Object, done?: Function): HTMLElement
          // Called only internally, must be overridden by classes extending `GridLayer`.
          // Returns the `HTMLElement` corresponding to the given `coords`. If the `done` callback
          // is specified, it must be called when the tile has finished loading and drawing.
          createTile: function() {
            return document.createElement("div");
          },
          // @section
          // @method getTileSize: Point
          // Normalizes the [tileSize option](#gridlayer-tilesize) into a point. Used by the `createTile()` method.
          getTileSize: function() {
            var s = this.options.tileSize;
            return s instanceof Point ? s : new Point(s, s);
          },
          _updateZIndex: function() {
            if (this._container && this.options.zIndex !== void 0 && this.options.zIndex !== null) {
              this._container.style.zIndex = this.options.zIndex;
            }
          },
          _setAutoZIndex: function(compare) {
            var layers2 = this.getPane().children, edgeZIndex = -compare(-Infinity, Infinity);
            for (var i = 0, len = layers2.length, zIndex; i < len; i++) {
              zIndex = layers2[i].style.zIndex;
              if (layers2[i] !== this._container && zIndex) {
                edgeZIndex = compare(edgeZIndex, +zIndex);
              }
            }
            if (isFinite(edgeZIndex)) {
              this.options.zIndex = edgeZIndex + compare(-1, 1);
              this._updateZIndex();
            }
          },
          _updateOpacity: function() {
            if (!this._map) {
              return;
            }
            if (Browser.ielt9) {
              return;
            }
            setOpacity(this._container, this.options.opacity);
            var now = +/* @__PURE__ */ new Date(), nextFrame = false, willPrune = false;
            for (var key2 in this._tiles) {
              var tile = this._tiles[key2];
              if (!tile.current || !tile.loaded) {
                continue;
              }
              var fade = Math.min(1, (now - tile.loaded) / 200);
              setOpacity(tile.el, fade);
              if (fade < 1) {
                nextFrame = true;
              } else {
                if (tile.active) {
                  willPrune = true;
                } else {
                  this._onOpaqueTile(tile);
                }
                tile.active = true;
              }
            }
            if (willPrune && !this._noPrune) {
              this._pruneTiles();
            }
            if (nextFrame) {
              cancelAnimFrame(this._fadeFrame);
              this._fadeFrame = requestAnimFrame(this._updateOpacity, this);
            }
          },
          _onOpaqueTile: falseFn,
          _initContainer: function() {
            if (this._container) {
              return;
            }
            this._container = create$1("div", "leaflet-layer " + (this.options.className || ""));
            this._updateZIndex();
            if (this.options.opacity < 1) {
              this._updateOpacity();
            }
            this.getPane().appendChild(this._container);
          },
          _updateLevels: function() {
            var zoom2 = this._tileZoom, maxZoom = this.options.maxZoom;
            if (zoom2 === void 0) {
              return void 0;
            }
            for (var z in this._levels) {
              z = Number(z);
              if (this._levels[z].el.children.length || z === zoom2) {
                this._levels[z].el.style.zIndex = maxZoom - Math.abs(zoom2 - z);
                this._onUpdateLevel(z);
              } else {
                remove(this._levels[z].el);
                this._removeTilesAtZoom(z);
                this._onRemoveLevel(z);
                delete this._levels[z];
              }
            }
            var level = this._levels[zoom2], map = this._map;
            if (!level) {
              level = this._levels[zoom2] = {};
              level.el = create$1("div", "leaflet-tile-container leaflet-zoom-animated", this._container);
              level.el.style.zIndex = maxZoom;
              level.origin = map.project(map.unproject(map.getPixelOrigin()), zoom2).round();
              level.zoom = zoom2;
              this._setZoomTransform(level, map.getCenter(), map.getZoom());
              falseFn(level.el.offsetWidth);
              this._onCreateLevel(level);
            }
            this._level = level;
            return level;
          },
          _onUpdateLevel: falseFn,
          _onRemoveLevel: falseFn,
          _onCreateLevel: falseFn,
          _pruneTiles: function() {
            if (!this._map) {
              return;
            }
            var key2, tile;
            var zoom2 = this._map.getZoom();
            if (zoom2 > this.options.maxZoom || zoom2 < this.options.minZoom) {
              this._removeAllTiles();
              return;
            }
            for (key2 in this._tiles) {
              tile = this._tiles[key2];
              tile.retain = tile.current;
            }
            for (key2 in this._tiles) {
              tile = this._tiles[key2];
              if (tile.current && !tile.active) {
                var coords = tile.coords;
                if (!this._retainParent(coords.x, coords.y, coords.z, coords.z - 5)) {
                  this._retainChildren(coords.x, coords.y, coords.z, coords.z + 2);
                }
              }
            }
            for (key2 in this._tiles) {
              if (!this._tiles[key2].retain) {
                this._removeTile(key2);
              }
            }
          },
          _removeTilesAtZoom: function(zoom2) {
            for (var key2 in this._tiles) {
              if (this._tiles[key2].coords.z !== zoom2) {
                continue;
              }
              this._removeTile(key2);
            }
          },
          _removeAllTiles: function() {
            for (var key2 in this._tiles) {
              this._removeTile(key2);
            }
          },
          _invalidateAll: function() {
            for (var z in this._levels) {
              remove(this._levels[z].el);
              this._onRemoveLevel(Number(z));
              delete this._levels[z];
            }
            this._removeAllTiles();
            this._tileZoom = void 0;
          },
          _retainParent: function(x, y, z, minZoom) {
            var x2 = Math.floor(x / 2), y2 = Math.floor(y / 2), z2 = z - 1, coords2 = new Point(+x2, +y2);
            coords2.z = +z2;
            var key2 = this._tileCoordsToKey(coords2), tile = this._tiles[key2];
            if (tile && tile.active) {
              tile.retain = true;
              return true;
            } else if (tile && tile.loaded) {
              tile.retain = true;
            }
            if (z2 > minZoom) {
              return this._retainParent(x2, y2, z2, minZoom);
            }
            return false;
          },
          _retainChildren: function(x, y, z, maxZoom) {
            for (var i = 2 * x; i < 2 * x + 2; i++) {
              for (var j = 2 * y; j < 2 * y + 2; j++) {
                var coords = new Point(i, j);
                coords.z = z + 1;
                var key2 = this._tileCoordsToKey(coords), tile = this._tiles[key2];
                if (tile && tile.active) {
                  tile.retain = true;
                  continue;
                } else if (tile && tile.loaded) {
                  tile.retain = true;
                }
                if (z + 1 < maxZoom) {
                  this._retainChildren(i, j, z + 1, maxZoom);
                }
              }
            }
          },
          _resetView: function(e) {
            var animating = e && (e.pinch || e.flyTo);
            this._setView(this._map.getCenter(), this._map.getZoom(), animating, animating);
          },
          _animateZoom: function(e) {
            this._setView(e.center, e.zoom, true, e.noUpdate);
          },
          _clampZoom: function(zoom2) {
            var options = this.options;
            if (void 0 !== options.minNativeZoom && zoom2 < options.minNativeZoom) {
              return options.minNativeZoom;
            }
            if (void 0 !== options.maxNativeZoom && options.maxNativeZoom < zoom2) {
              return options.maxNativeZoom;
            }
            return zoom2;
          },
          _setView: function(center, zoom2, noPrune, noUpdate) {
            var tileZoom = Math.round(zoom2);
            if (this.options.maxZoom !== void 0 && tileZoom > this.options.maxZoom || this.options.minZoom !== void 0 && tileZoom < this.options.minZoom) {
              tileZoom = void 0;
            } else {
              tileZoom = this._clampZoom(tileZoom);
            }
            var tileZoomChanged = this.options.updateWhenZooming && tileZoom !== this._tileZoom;
            if (!noUpdate || tileZoomChanged) {
              this._tileZoom = tileZoom;
              if (this._abortLoading) {
                this._abortLoading();
              }
              this._updateLevels();
              this._resetGrid();
              if (tileZoom !== void 0) {
                this._update(center);
              }
              if (!noPrune) {
                this._pruneTiles();
              }
              this._noPrune = !!noPrune;
            }
            this._setZoomTransforms(center, zoom2);
          },
          _setZoomTransforms: function(center, zoom2) {
            for (var i in this._levels) {
              this._setZoomTransform(this._levels[i], center, zoom2);
            }
          },
          _setZoomTransform: function(level, center, zoom2) {
            var scale2 = this._map.getZoomScale(zoom2, level.zoom), translate = level.origin.multiplyBy(scale2).subtract(this._map._getNewPixelOrigin(center, zoom2)).round();
            if (Browser.any3d) {
              setTransform(level.el, translate, scale2);
            } else {
              setPosition(level.el, translate);
            }
          },
          _resetGrid: function() {
            var map = this._map, crs = map.options.crs, tileSize = this._tileSize = this.getTileSize(), tileZoom = this._tileZoom;
            var bounds = this._map.getPixelWorldBounds(this._tileZoom);
            if (bounds) {
              this._globalTileRange = this._pxBoundsToTileRange(bounds);
            }
            this._wrapX = crs.wrapLng && !this.options.noWrap && [
              Math.floor(map.project([0, crs.wrapLng[0]], tileZoom).x / tileSize.x),
              Math.ceil(map.project([0, crs.wrapLng[1]], tileZoom).x / tileSize.y)
            ];
            this._wrapY = crs.wrapLat && !this.options.noWrap && [
              Math.floor(map.project([crs.wrapLat[0], 0], tileZoom).y / tileSize.x),
              Math.ceil(map.project([crs.wrapLat[1], 0], tileZoom).y / tileSize.y)
            ];
          },
          _onMoveEnd: function() {
            if (!this._map || this._map._animatingZoom) {
              return;
            }
            this._update();
          },
          _getTiledPixelBounds: function(center) {
            var map = this._map, mapZoom = map._animatingZoom ? Math.max(map._animateToZoom, map.getZoom()) : map.getZoom(), scale2 = map.getZoomScale(mapZoom, this._tileZoom), pixelCenter = map.project(center, this._tileZoom).floor(), halfSize = map.getSize().divideBy(scale2 * 2);
            return new Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize));
          },
          // Private method to load tiles in the grid's active zoom level according to map bounds
          _update: function(center) {
            var map = this._map;
            if (!map) {
              return;
            }
            var zoom2 = this._clampZoom(map.getZoom());
            if (center === void 0) {
              center = map.getCenter();
            }
            if (this._tileZoom === void 0) {
              return;
            }
            var pixelBounds = this._getTiledPixelBounds(center), tileRange = this._pxBoundsToTileRange(pixelBounds), tileCenter = tileRange.getCenter(), queue = [], margin = this.options.keepBuffer, noPruneRange = new Bounds(
              tileRange.getBottomLeft().subtract([margin, -margin]),
              tileRange.getTopRight().add([margin, -margin])
            );
            if (!(isFinite(tileRange.min.x) && isFinite(tileRange.min.y) && isFinite(tileRange.max.x) && isFinite(tileRange.max.y))) {
              throw new Error("Attempted to load an infinite number of tiles");
            }
            for (var key2 in this._tiles) {
              var c = this._tiles[key2].coords;
              if (c.z !== this._tileZoom || !noPruneRange.contains(new Point(c.x, c.y))) {
                this._tiles[key2].current = false;
              }
            }
            if (Math.abs(zoom2 - this._tileZoom) > 1) {
              this._setView(center, zoom2);
              return;
            }
            for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
              for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
                var coords = new Point(i, j);
                coords.z = this._tileZoom;
                if (!this._isValidTile(coords)) {
                  continue;
                }
                var tile = this._tiles[this._tileCoordsToKey(coords)];
                if (tile) {
                  tile.current = true;
                } else {
                  queue.push(coords);
                }
              }
            }
            queue.sort(function(a, b) {
              return a.distanceTo(tileCenter) - b.distanceTo(tileCenter);
            });
            if (queue.length !== 0) {
              if (!this._loading) {
                this._loading = true;
                this.fire("loading");
              }
              var fragment = document.createDocumentFragment();
              for (i = 0; i < queue.length; i++) {
                this._addTile(queue[i], fragment);
              }
              this._level.el.appendChild(fragment);
            }
          },
          _isValidTile: function(coords) {
            var crs = this._map.options.crs;
            if (!crs.infinite) {
              var bounds = this._globalTileRange;
              if (!crs.wrapLng && (coords.x < bounds.min.x || coords.x > bounds.max.x) || !crs.wrapLat && (coords.y < bounds.min.y || coords.y > bounds.max.y)) {
                return false;
              }
            }
            if (!this.options.bounds) {
              return true;
            }
            var tileBounds = this._tileCoordsToBounds(coords);
            return toLatLngBounds(this.options.bounds).overlaps(tileBounds);
          },
          _keyToBounds: function(key2) {
            return this._tileCoordsToBounds(this._keyToTileCoords(key2));
          },
          _tileCoordsToNwSe: function(coords) {
            var map = this._map, tileSize = this.getTileSize(), nwPoint = coords.scaleBy(tileSize), sePoint = nwPoint.add(tileSize), nw = map.unproject(nwPoint, coords.z), se = map.unproject(sePoint, coords.z);
            return [nw, se];
          },
          // converts tile coordinates to its geographical bounds
          _tileCoordsToBounds: function(coords) {
            var bp = this._tileCoordsToNwSe(coords), bounds = new LatLngBounds(bp[0], bp[1]);
            if (!this.options.noWrap) {
              bounds = this._map.wrapLatLngBounds(bounds);
            }
            return bounds;
          },
          // converts tile coordinates to key for the tile cache
          _tileCoordsToKey: function(coords) {
            return coords.x + ":" + coords.y + ":" + coords.z;
          },
          // converts tile cache key to coordinates
          _keyToTileCoords: function(key2) {
            var k = key2.split(":"), coords = new Point(+k[0], +k[1]);
            coords.z = +k[2];
            return coords;
          },
          _removeTile: function(key2) {
            var tile = this._tiles[key2];
            if (!tile) {
              return;
            }
            remove(tile.el);
            delete this._tiles[key2];
            this.fire("tileunload", {
              tile: tile.el,
              coords: this._keyToTileCoords(key2)
            });
          },
          _initTile: function(tile) {
            addClass(tile, "leaflet-tile");
            var tileSize = this.getTileSize();
            tile.style.width = tileSize.x + "px";
            tile.style.height = tileSize.y + "px";
            tile.onselectstart = falseFn;
            tile.onmousemove = falseFn;
            if (Browser.ielt9 && this.options.opacity < 1) {
              setOpacity(tile, this.options.opacity);
            }
          },
          _addTile: function(coords, container) {
            var tilePos = this._getTilePos(coords), key2 = this._tileCoordsToKey(coords);
            var tile = this.createTile(this._wrapCoords(coords), bind(this._tileReady, this, coords));
            this._initTile(tile);
            if (this.createTile.length < 2) {
              requestAnimFrame(bind(this._tileReady, this, coords, null, tile));
            }
            setPosition(tile, tilePos);
            this._tiles[key2] = {
              el: tile,
              coords,
              current: true
            };
            container.appendChild(tile);
            this.fire("tileloadstart", {
              tile,
              coords
            });
          },
          _tileReady: function(coords, err, tile) {
            if (err) {
              this.fire("tileerror", {
                error: err,
                tile,
                coords
              });
            }
            var key2 = this._tileCoordsToKey(coords);
            tile = this._tiles[key2];
            if (!tile) {
              return;
            }
            tile.loaded = +/* @__PURE__ */ new Date();
            if (this._map._fadeAnimated) {
              setOpacity(tile.el, 0);
              cancelAnimFrame(this._fadeFrame);
              this._fadeFrame = requestAnimFrame(this._updateOpacity, this);
            } else {
              tile.active = true;
              this._pruneTiles();
            }
            if (!err) {
              addClass(tile.el, "leaflet-tile-loaded");
              this.fire("tileload", {
                tile: tile.el,
                coords
              });
            }
            if (this._noTilesToLoad()) {
              this._loading = false;
              this.fire("load");
              if (Browser.ielt9 || !this._map._fadeAnimated) {
                requestAnimFrame(this._pruneTiles, this);
              } else {
                setTimeout(bind(this._pruneTiles, this), 250);
              }
            }
          },
          _getTilePos: function(coords) {
            return coords.scaleBy(this.getTileSize()).subtract(this._level.origin);
          },
          _wrapCoords: function(coords) {
            var newCoords = new Point(
              this._wrapX ? wrapNum(coords.x, this._wrapX) : coords.x,
              this._wrapY ? wrapNum(coords.y, this._wrapY) : coords.y
            );
            newCoords.z = coords.z;
            return newCoords;
          },
          _pxBoundsToTileRange: function(bounds) {
            var tileSize = this.getTileSize();
            return new Bounds(
              bounds.min.unscaleBy(tileSize).floor(),
              bounds.max.unscaleBy(tileSize).ceil().subtract([1, 1])
            );
          },
          _noTilesToLoad: function() {
            for (var key2 in this._tiles) {
              if (!this._tiles[key2].loaded) {
                return false;
              }
            }
            return true;
          }
        });
        function gridLayer(options) {
          return new GridLayer(options);
        }
        var TileLayer = GridLayer.extend({
          // @section
          // @aka TileLayer options
          options: {
            // @option minZoom: Number = 0
            // The minimum zoom level down to which this layer will be displayed (inclusive).
            minZoom: 0,
            // @option maxZoom: Number = 18
            // The maximum zoom level up to which this layer will be displayed (inclusive).
            maxZoom: 18,
            // @option subdomains: String|String[] = 'abc'
            // Subdomains of the tile service. Can be passed in the form of one string (where each letter is a subdomain name) or an array of strings.
            subdomains: "abc",
            // @option errorTileUrl: String = ''
            // URL to the tile image to show in place of the tile that failed to load.
            errorTileUrl: "",
            // @option zoomOffset: Number = 0
            // The zoom number used in tile URLs will be offset with this value.
            zoomOffset: 0,
            // @option tms: Boolean = false
            // If `true`, inverses Y axis numbering for tiles (turn this on for [TMS](https://en.wikipedia.org/wiki/Tile_Map_Service) services).
            tms: false,
            // @option zoomReverse: Boolean = false
            // If set to true, the zoom number used in tile URLs will be reversed (`maxZoom - zoom` instead of `zoom`)
            zoomReverse: false,
            // @option detectRetina: Boolean = false
            // If `true` and user is on a retina display, it will request four tiles of half the specified size and a bigger zoom level in place of one to utilize the high resolution.
            detectRetina: false,
            // @option crossOrigin: Boolean|String = false
            // Whether the crossOrigin attribute will be added to the tiles.
            // If a String is provided, all tiles will have their crossOrigin attribute set to the String provided. This is needed if you want to access tile pixel data.
            // Refer to [CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
            crossOrigin: false,
            // @option referrerPolicy: Boolean|String = false
            // Whether the referrerPolicy attribute will be added to the tiles.
            // If a String is provided, all tiles will have their referrerPolicy attribute set to the String provided.
            // This may be needed if your map's rendering context has a strict default but your tile provider expects a valid referrer
            // (e.g. to validate an API token).
            // Refer to [HTMLImageElement.referrerPolicy](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/referrerPolicy) for valid String values.
            referrerPolicy: false
          },
          initialize: function(url, options) {
            this._url = url;
            options = setOptions(this, options);
            if (options.detectRetina && Browser.retina && options.maxZoom > 0) {
              options.tileSize = Math.floor(options.tileSize / 2);
              if (!options.zoomReverse) {
                options.zoomOffset++;
                options.maxZoom = Math.max(options.minZoom, options.maxZoom - 1);
              } else {
                options.zoomOffset--;
                options.minZoom = Math.min(options.maxZoom, options.minZoom + 1);
              }
              options.minZoom = Math.max(0, options.minZoom);
            } else if (!options.zoomReverse) {
              options.maxZoom = Math.max(options.minZoom, options.maxZoom);
            } else {
              options.minZoom = Math.min(options.maxZoom, options.minZoom);
            }
            if (typeof options.subdomains === "string") {
              options.subdomains = options.subdomains.split("");
            }
            this.on("tileunload", this._onTileRemove);
          },
          // @method setUrl(url: String, noRedraw?: Boolean): this
          // Updates the layer's URL template and redraws it (unless `noRedraw` is set to `true`).
          // If the URL does not change, the layer will not be redrawn unless
          // the noRedraw parameter is set to false.
          setUrl: function(url, noRedraw) {
            if (this._url === url && noRedraw === void 0) {
              noRedraw = true;
            }
            this._url = url;
            if (!noRedraw) {
              this.redraw();
            }
            return this;
          },
          // @method createTile(coords: Object, done?: Function): HTMLElement
          // Called only internally, overrides GridLayer's [`createTile()`](#gridlayer-createtile)
          // to return an `<img>` HTML element with the appropriate image URL given `coords`. The `done`
          // callback is called when the tile has been loaded.
          createTile: function(coords, done) {
            var tile = document.createElement("img");
            on(tile, "load", bind(this._tileOnLoad, this, done, tile));
            on(tile, "error", bind(this._tileOnError, this, done, tile));
            if (this.options.crossOrigin || this.options.crossOrigin === "") {
              tile.crossOrigin = this.options.crossOrigin === true ? "" : this.options.crossOrigin;
            }
            if (typeof this.options.referrerPolicy === "string") {
              tile.referrerPolicy = this.options.referrerPolicy;
            }
            tile.alt = "";
            tile.src = this.getTileUrl(coords);
            return tile;
          },
          // @section Extension methods
          // @uninheritable
          // Layers extending `TileLayer` might reimplement the following method.
          // @method getTileUrl(coords: Object): String
          // Called only internally, returns the URL for a tile given its coordinates.
          // Classes extending `TileLayer` can override this function to provide custom tile URL naming schemes.
          getTileUrl: function(coords) {
            var data = {
              r: Browser.retina ? "@2x" : "",
              s: this._getSubdomain(coords),
              x: coords.x,
              y: coords.y,
              z: this._getZoomForUrl()
            };
            if (this._map && !this._map.options.crs.infinite) {
              var invertedY = this._globalTileRange.max.y - coords.y;
              if (this.options.tms) {
                data["y"] = invertedY;
              }
              data["-y"] = invertedY;
            }
            return template(this._url, extend(data, this.options));
          },
          _tileOnLoad: function(done, tile) {
            if (Browser.ielt9) {
              setTimeout(bind(done, this, null, tile), 0);
            } else {
              done(null, tile);
            }
          },
          _tileOnError: function(done, tile, e) {
            var errorUrl = this.options.errorTileUrl;
            if (errorUrl && tile.getAttribute("src") !== errorUrl) {
              tile.src = errorUrl;
            }
            done(e, tile);
          },
          _onTileRemove: function(e) {
            e.tile.onload = null;
          },
          _getZoomForUrl: function() {
            var zoom2 = this._tileZoom, maxZoom = this.options.maxZoom, zoomReverse = this.options.zoomReverse, zoomOffset = this.options.zoomOffset;
            if (zoomReverse) {
              zoom2 = maxZoom - zoom2;
            }
            return zoom2 + zoomOffset;
          },
          _getSubdomain: function(tilePoint) {
            var index3 = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
            return this.options.subdomains[index3];
          },
          // stops loading all tiles in the background layer
          _abortLoading: function() {
            var i, tile;
            for (i in this._tiles) {
              if (this._tiles[i].coords.z !== this._tileZoom) {
                tile = this._tiles[i].el;
                tile.onload = falseFn;
                tile.onerror = falseFn;
                if (!tile.complete) {
                  tile.src = emptyImageUrl;
                  var coords = this._tiles[i].coords;
                  remove(tile);
                  delete this._tiles[i];
                  this.fire("tileabort", {
                    tile,
                    coords
                  });
                }
              }
            }
          },
          _removeTile: function(key2) {
            var tile = this._tiles[key2];
            if (!tile) {
              return;
            }
            tile.el.setAttribute("src", emptyImageUrl);
            return GridLayer.prototype._removeTile.call(this, key2);
          },
          _tileReady: function(coords, err, tile) {
            if (!this._map || tile && tile.getAttribute("src") === emptyImageUrl) {
              return;
            }
            return GridLayer.prototype._tileReady.call(this, coords, err, tile);
          }
        });
        function tileLayer(url, options) {
          return new TileLayer(url, options);
        }
        var TileLayerWMS = TileLayer.extend({
          // @section
          // @aka TileLayer.WMS options
          // If any custom options not documented here are used, they will be sent to the
          // WMS server as extra parameters in each request URL. This can be useful for
          // [non-standard vendor WMS parameters](https://docs.geoserver.org/stable/en/user/services/wms/vendor.html).
          defaultWmsParams: {
            service: "WMS",
            request: "GetMap",
            // @option layers: String = ''
            // **(required)** Comma-separated list of WMS layers to show.
            layers: "",
            // @option styles: String = ''
            // Comma-separated list of WMS styles.
            styles: "",
            // @option format: String = 'image/jpeg'
            // WMS image format (use `'image/png'` for layers with transparency).
            format: "image/jpeg",
            // @option transparent: Boolean = false
            // If `true`, the WMS service will return images with transparency.
            transparent: false,
            // @option version: String = '1.1.1'
            // Version of the WMS service to use
            version: "1.1.1"
          },
          options: {
            // @option crs: CRS = null
            // Coordinate Reference System to use for the WMS requests, defaults to
            // map CRS. Don't change this if you're not sure what it means.
            crs: null,
            // @option uppercase: Boolean = false
            // If `true`, WMS request parameter keys will be uppercase.
            uppercase: false
          },
          initialize: function(url, options) {
            this._url = url;
            var wmsParams = extend({}, this.defaultWmsParams);
            for (var i in options) {
              if (!(i in this.options)) {
                wmsParams[i] = options[i];
              }
            }
            options = setOptions(this, options);
            var realRetina = options.detectRetina && Browser.retina ? 2 : 1;
            var tileSize = this.getTileSize();
            wmsParams.width = tileSize.x * realRetina;
            wmsParams.height = tileSize.y * realRetina;
            this.wmsParams = wmsParams;
          },
          onAdd: function(map) {
            this._crs = this.options.crs || map.options.crs;
            this._wmsVersion = parseFloat(this.wmsParams.version);
            var projectionKey = this._wmsVersion >= 1.3 ? "crs" : "srs";
            this.wmsParams[projectionKey] = this._crs.code;
            TileLayer.prototype.onAdd.call(this, map);
          },
          getTileUrl: function(coords) {
            var tileBounds = this._tileCoordsToNwSe(coords), crs = this._crs, bounds = toBounds(crs.project(tileBounds[0]), crs.project(tileBounds[1])), min = bounds.min, max = bounds.max, bbox = (this._wmsVersion >= 1.3 && this._crs === EPSG4326 ? [min.y, min.x, max.y, max.x] : [min.x, min.y, max.x, max.y]).join(","), url = TileLayer.prototype.getTileUrl.call(this, coords);
            return url + getParamString(this.wmsParams, url, this.options.uppercase) + (this.options.uppercase ? "&BBOX=" : "&bbox=") + bbox;
          },
          // @method setParams(params: Object, noRedraw?: Boolean): this
          // Merges an object with the new parameters and re-requests tiles on the current screen (unless `noRedraw` was set to true).
          setParams: function(params, noRedraw) {
            extend(this.wmsParams, params);
            if (!noRedraw) {
              this.redraw();
            }
            return this;
          }
        });
        function tileLayerWMS(url, options) {
          return new TileLayerWMS(url, options);
        }
        TileLayer.WMS = TileLayerWMS;
        tileLayer.wms = tileLayerWMS;
        var Renderer = Layer.extend({
          // @section
          // @aka Renderer options
          options: {
            // @option padding: Number = 0.1
            // How much to extend the clip area around the map view (relative to its size)
            // e.g. 0.1 would be 10% of map view in each direction
            padding: 0.1
          },
          initialize: function(options) {
            setOptions(this, options);
            stamp(this);
            this._layers = this._layers || {};
          },
          onAdd: function() {
            if (!this._container) {
              this._initContainer();
              addClass(this._container, "leaflet-zoom-animated");
            }
            this.getPane().appendChild(this._container);
            this._update();
            this.on("update", this._updatePaths, this);
          },
          onRemove: function() {
            this.off("update", this._updatePaths, this);
            this._destroyContainer();
          },
          getEvents: function() {
            var events = {
              viewreset: this._reset,
              zoom: this._onZoom,
              moveend: this._update,
              zoomend: this._onZoomEnd
            };
            if (this._zoomAnimated) {
              events.zoomanim = this._onAnimZoom;
            }
            return events;
          },
          _onAnimZoom: function(ev) {
            this._updateTransform(ev.center, ev.zoom);
          },
          _onZoom: function() {
            this._updateTransform(this._map.getCenter(), this._map.getZoom());
          },
          _updateTransform: function(center, zoom2) {
            var scale2 = this._map.getZoomScale(zoom2, this._zoom), viewHalf = this._map.getSize().multiplyBy(0.5 + this.options.padding), currentCenterPoint = this._map.project(this._center, zoom2), topLeftOffset = viewHalf.multiplyBy(-scale2).add(currentCenterPoint).subtract(this._map._getNewPixelOrigin(center, zoom2));
            if (Browser.any3d) {
              setTransform(this._container, topLeftOffset, scale2);
            } else {
              setPosition(this._container, topLeftOffset);
            }
          },
          _reset: function() {
            this._update();
            this._updateTransform(this._center, this._zoom);
            for (var id in this._layers) {
              this._layers[id]._reset();
            }
          },
          _onZoomEnd: function() {
            for (var id in this._layers) {
              this._layers[id]._project();
            }
          },
          _updatePaths: function() {
            for (var id in this._layers) {
              this._layers[id]._update();
            }
          },
          _update: function() {
            var p = this.options.padding, size = this._map.getSize(), min = this._map.containerPointToLayerPoint(size.multiplyBy(-p)).round();
            this._bounds = new Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());
            this._center = this._map.getCenter();
            this._zoom = this._map.getZoom();
          }
        });
        var Canvas = Renderer.extend({
          // @section
          // @aka Canvas options
          options: {
            // @option tolerance: Number = 0
            // How much to extend the click tolerance around a path/object on the map.
            tolerance: 0
          },
          getEvents: function() {
            var events = Renderer.prototype.getEvents.call(this);
            events.viewprereset = this._onViewPreReset;
            return events;
          },
          _onViewPreReset: function() {
            this._postponeUpdatePaths = true;
          },
          onAdd: function() {
            Renderer.prototype.onAdd.call(this);
            this._draw();
          },
          _initContainer: function() {
            var container = this._container = document.createElement("canvas");
            on(container, "mousemove", this._onMouseMove, this);
            on(container, "click dblclick mousedown mouseup contextmenu", this._onClick, this);
            on(container, "mouseout", this._handleMouseOut, this);
            container["_leaflet_disable_events"] = true;
            this._ctx = container.getContext("2d");
          },
          _destroyContainer: function() {
            cancelAnimFrame(this._redrawRequest);
            delete this._ctx;
            remove(this._container);
            off(this._container);
            delete this._container;
          },
          _updatePaths: function() {
            if (this._postponeUpdatePaths) {
              return;
            }
            var layer;
            this._redrawBounds = null;
            for (var id in this._layers) {
              layer = this._layers[id];
              layer._update();
            }
            this._redraw();
          },
          _update: function() {
            if (this._map._animatingZoom && this._bounds) {
              return;
            }
            Renderer.prototype._update.call(this);
            var b = this._bounds, container = this._container, size = b.getSize(), m = Browser.retina ? 2 : 1;
            setPosition(container, b.min);
            container.width = m * size.x;
            container.height = m * size.y;
            container.style.width = size.x + "px";
            container.style.height = size.y + "px";
            if (Browser.retina) {
              this._ctx.scale(2, 2);
            }
            this._ctx.translate(-b.min.x, -b.min.y);
            this.fire("update");
          },
          _reset: function() {
            Renderer.prototype._reset.call(this);
            if (this._postponeUpdatePaths) {
              this._postponeUpdatePaths = false;
              this._updatePaths();
            }
          },
          _initPath: function(layer) {
            this._updateDashArray(layer);
            this._layers[stamp(layer)] = layer;
            var order = layer._order = {
              layer,
              prev: this._drawLast,
              next: null
            };
            if (this._drawLast) {
              this._drawLast.next = order;
            }
            this._drawLast = order;
            this._drawFirst = this._drawFirst || this._drawLast;
          },
          _addPath: function(layer) {
            this._requestRedraw(layer);
          },
          _removePath: function(layer) {
            var order = layer._order;
            var next2 = order.next;
            var prev = order.prev;
            if (next2) {
              next2.prev = prev;
            } else {
              this._drawLast = prev;
            }
            if (prev) {
              prev.next = next2;
            } else {
              this._drawFirst = next2;
            }
            delete layer._order;
            delete this._layers[stamp(layer)];
            this._requestRedraw(layer);
          },
          _updatePath: function(layer) {
            this._extendRedrawBounds(layer);
            layer._project();
            layer._update();
            this._requestRedraw(layer);
          },
          _updateStyle: function(layer) {
            this._updateDashArray(layer);
            this._requestRedraw(layer);
          },
          _updateDashArray: function(layer) {
            if (typeof layer.options.dashArray === "string") {
              var parts = layer.options.dashArray.split(/[, ]+/), dashArray = [], dashValue, i;
              for (i = 0; i < parts.length; i++) {
                dashValue = Number(parts[i]);
                if (isNaN(dashValue)) {
                  return;
                }
                dashArray.push(dashValue);
              }
              layer.options._dashArray = dashArray;
            } else {
              layer.options._dashArray = layer.options.dashArray;
            }
          },
          _requestRedraw: function(layer) {
            if (!this._map) {
              return;
            }
            this._extendRedrawBounds(layer);
            this._redrawRequest = this._redrawRequest || requestAnimFrame(this._redraw, this);
          },
          _extendRedrawBounds: function(layer) {
            if (layer._pxBounds) {
              var padding = (layer.options.weight || 0) + 1;
              this._redrawBounds = this._redrawBounds || new Bounds();
              this._redrawBounds.extend(layer._pxBounds.min.subtract([padding, padding]));
              this._redrawBounds.extend(layer._pxBounds.max.add([padding, padding]));
            }
          },
          _redraw: function() {
            this._redrawRequest = null;
            if (this._redrawBounds) {
              this._redrawBounds.min._floor();
              this._redrawBounds.max._ceil();
            }
            this._clear();
            this._draw();
            this._redrawBounds = null;
          },
          _clear: function() {
            var bounds = this._redrawBounds;
            if (bounds) {
              var size = bounds.getSize();
              this._ctx.clearRect(bounds.min.x, bounds.min.y, size.x, size.y);
            } else {
              this._ctx.save();
              this._ctx.setTransform(1, 0, 0, 1, 0, 0);
              this._ctx.clearRect(0, 0, this._container.width, this._container.height);
              this._ctx.restore();
            }
          },
          _draw: function() {
            var layer, bounds = this._redrawBounds;
            this._ctx.save();
            if (bounds) {
              var size = bounds.getSize();
              this._ctx.beginPath();
              this._ctx.rect(bounds.min.x, bounds.min.y, size.x, size.y);
              this._ctx.clip();
            }
            this._drawing = true;
            for (var order = this._drawFirst; order; order = order.next) {
              layer = order.layer;
              if (!bounds || layer._pxBounds && layer._pxBounds.intersects(bounds)) {
                layer._updatePath();
              }
            }
            this._drawing = false;
            this._ctx.restore();
          },
          _updatePoly: function(layer, closed) {
            if (!this._drawing) {
              return;
            }
            var i, j, len2, p, parts = layer._parts, len = parts.length, ctx2 = this._ctx;
            if (!len) {
              return;
            }
            ctx2.beginPath();
            for (i = 0; i < len; i++) {
              for (j = 0, len2 = parts[i].length; j < len2; j++) {
                p = parts[i][j];
                ctx2[j ? "lineTo" : "moveTo"](p.x, p.y);
              }
              if (closed) {
                ctx2.closePath();
              }
            }
            this._fillStroke(ctx2, layer);
          },
          _updateCircle: function(layer) {
            if (!this._drawing || layer._empty()) {
              return;
            }
            var p = layer._point, ctx2 = this._ctx, r = Math.max(Math.round(layer._radius), 1), s = (Math.max(Math.round(layer._radiusY), 1) || r) / r;
            if (s !== 1) {
              ctx2.save();
              ctx2.scale(1, s);
            }
            ctx2.beginPath();
            ctx2.arc(p.x, p.y / s, r, 0, Math.PI * 2, false);
            if (s !== 1) {
              ctx2.restore();
            }
            this._fillStroke(ctx2, layer);
          },
          _fillStroke: function(ctx2, layer) {
            var options = layer.options;
            if (options.fill) {
              ctx2.globalAlpha = options.fillOpacity;
              ctx2.fillStyle = options.fillColor || options.color;
              ctx2.fill(options.fillRule || "evenodd");
            }
            if (options.stroke && options.weight !== 0) {
              if (ctx2.setLineDash) {
                ctx2.setLineDash(layer.options && layer.options._dashArray || []);
              }
              ctx2.globalAlpha = options.opacity;
              ctx2.lineWidth = options.weight;
              ctx2.strokeStyle = options.color;
              ctx2.lineCap = options.lineCap;
              ctx2.lineJoin = options.lineJoin;
              ctx2.stroke();
            }
          },
          // Canvas obviously doesn't have mouse events for individual drawn objects,
          // so we emulate that by calculating what's under the mouse on mousemove/click manually
          _onClick: function(e) {
            var point = this._map.mouseEventToLayerPoint(e), layer, clickedLayer;
            for (var order = this._drawFirst; order; order = order.next) {
              layer = order.layer;
              if (layer.options.interactive && layer._containsPoint(point)) {
                if (!(e.type === "click" || e.type === "preclick") || !this._map._draggableMoved(layer)) {
                  clickedLayer = layer;
                }
              }
            }
            this._fireEvent(clickedLayer ? [clickedLayer] : false, e);
          },
          _onMouseMove: function(e) {
            if (!this._map || this._map.dragging.moving() || this._map._animatingZoom) {
              return;
            }
            var point = this._map.mouseEventToLayerPoint(e);
            this._handleMouseHover(e, point);
          },
          _handleMouseOut: function(e) {
            var layer = this._hoveredLayer;
            if (layer) {
              removeClass(this._container, "leaflet-interactive");
              this._fireEvent([layer], e, "mouseout");
              this._hoveredLayer = null;
              this._mouseHoverThrottled = false;
            }
          },
          _handleMouseHover: function(e, point) {
            if (this._mouseHoverThrottled) {
              return;
            }
            var layer, candidateHoveredLayer;
            for (var order = this._drawFirst; order; order = order.next) {
              layer = order.layer;
              if (layer.options.interactive && layer._containsPoint(point)) {
                candidateHoveredLayer = layer;
              }
            }
            if (candidateHoveredLayer !== this._hoveredLayer) {
              this._handleMouseOut(e);
              if (candidateHoveredLayer) {
                addClass(this._container, "leaflet-interactive");
                this._fireEvent([candidateHoveredLayer], e, "mouseover");
                this._hoveredLayer = candidateHoveredLayer;
              }
            }
            this._fireEvent(this._hoveredLayer ? [this._hoveredLayer] : false, e);
            this._mouseHoverThrottled = true;
            setTimeout(bind(function() {
              this._mouseHoverThrottled = false;
            }, this), 32);
          },
          _fireEvent: function(layers2, e, type) {
            this._map._fireDOMEvent(e, type || e.type, layers2);
          },
          _bringToFront: function(layer) {
            var order = layer._order;
            if (!order) {
              return;
            }
            var next2 = order.next;
            var prev = order.prev;
            if (next2) {
              next2.prev = prev;
            } else {
              return;
            }
            if (prev) {
              prev.next = next2;
            } else if (next2) {
              this._drawFirst = next2;
            }
            order.prev = this._drawLast;
            this._drawLast.next = order;
            order.next = null;
            this._drawLast = order;
            this._requestRedraw(layer);
          },
          _bringToBack: function(layer) {
            var order = layer._order;
            if (!order) {
              return;
            }
            var next2 = order.next;
            var prev = order.prev;
            if (prev) {
              prev.next = next2;
            } else {
              return;
            }
            if (next2) {
              next2.prev = prev;
            } else if (prev) {
              this._drawLast = prev;
            }
            order.prev = null;
            order.next = this._drawFirst;
            this._drawFirst.prev = order;
            this._drawFirst = order;
            this._requestRedraw(layer);
          }
        });
        function canvas(options) {
          return Browser.canvas ? new Canvas(options) : null;
        }
        var vmlCreate = (function() {
          try {
            document.namespaces.add("lvml", "urn:schemas-microsoft-com:vml");
            return function(name2) {
              return document.createElement("<lvml:" + name2 + ' class="lvml">');
            };
          } catch (e) {
          }
          return function(name2) {
            return document.createElement("<" + name2 + ' xmlns="urn:schemas-microsoft.com:vml" class="lvml">');
          };
        })();
        var vmlMixin = {
          _initContainer: function() {
            this._container = create$1("div", "leaflet-vml-container");
          },
          _update: function() {
            if (this._map._animatingZoom) {
              return;
            }
            Renderer.prototype._update.call(this);
            this.fire("update");
          },
          _initPath: function(layer) {
            var container = layer._container = vmlCreate("shape");
            addClass(container, "leaflet-vml-shape " + (this.options.className || ""));
            container.coordsize = "1 1";
            layer._path = vmlCreate("path");
            container.appendChild(layer._path);
            this._updateStyle(layer);
            this._layers[stamp(layer)] = layer;
          },
          _addPath: function(layer) {
            var container = layer._container;
            this._container.appendChild(container);
            if (layer.options.interactive) {
              layer.addInteractiveTarget(container);
            }
          },
          _removePath: function(layer) {
            var container = layer._container;
            remove(container);
            layer.removeInteractiveTarget(container);
            delete this._layers[stamp(layer)];
          },
          _updateStyle: function(layer) {
            var stroke = layer._stroke, fill = layer._fill, options = layer.options, container = layer._container;
            container.stroked = !!options.stroke;
            container.filled = !!options.fill;
            if (options.stroke) {
              if (!stroke) {
                stroke = layer._stroke = vmlCreate("stroke");
              }
              container.appendChild(stroke);
              stroke.weight = options.weight + "px";
              stroke.color = options.color;
              stroke.opacity = options.opacity;
              if (options.dashArray) {
                stroke.dashStyle = isArray(options.dashArray) ? options.dashArray.join(" ") : options.dashArray.replace(/( *, *)/g, " ");
              } else {
                stroke.dashStyle = "";
              }
              stroke.endcap = options.lineCap.replace("butt", "flat");
              stroke.joinstyle = options.lineJoin;
            } else if (stroke) {
              container.removeChild(stroke);
              layer._stroke = null;
            }
            if (options.fill) {
              if (!fill) {
                fill = layer._fill = vmlCreate("fill");
              }
              container.appendChild(fill);
              fill.color = options.fillColor || options.color;
              fill.opacity = options.fillOpacity;
            } else if (fill) {
              container.removeChild(fill);
              layer._fill = null;
            }
          },
          _updateCircle: function(layer) {
            var p = layer._point.round(), r = Math.round(layer._radius), r2 = Math.round(layer._radiusY || r);
            this._setPath(layer, layer._empty() ? "M0 0" : "AL " + p.x + "," + p.y + " " + r + "," + r2 + " 0," + 65535 * 360);
          },
          _setPath: function(layer, path) {
            layer._path.v = path;
          },
          _bringToFront: function(layer) {
            toFront(layer._container);
          },
          _bringToBack: function(layer) {
            toBack(layer._container);
          }
        };
        var create = Browser.vml ? vmlCreate : svgCreate;
        var SVG = Renderer.extend({
          _initContainer: function() {
            this._container = create("svg");
            this._container.setAttribute("pointer-events", "none");
            this._rootGroup = create("g");
            this._container.appendChild(this._rootGroup);
          },
          _destroyContainer: function() {
            remove(this._container);
            off(this._container);
            delete this._container;
            delete this._rootGroup;
            delete this._svgSize;
          },
          _update: function() {
            if (this._map._animatingZoom && this._bounds) {
              return;
            }
            Renderer.prototype._update.call(this);
            var b = this._bounds, size = b.getSize(), container = this._container;
            if (!this._svgSize || !this._svgSize.equals(size)) {
              this._svgSize = size;
              container.setAttribute("width", size.x);
              container.setAttribute("height", size.y);
            }
            setPosition(container, b.min);
            container.setAttribute("viewBox", [b.min.x, b.min.y, size.x, size.y].join(" "));
            this.fire("update");
          },
          // methods below are called by vector layers implementations
          _initPath: function(layer) {
            var path = layer._path = create("path");
            if (layer.options.className) {
              addClass(path, layer.options.className);
            }
            if (layer.options.interactive) {
              addClass(path, "leaflet-interactive");
            }
            this._updateStyle(layer);
            this._layers[stamp(layer)] = layer;
          },
          _addPath: function(layer) {
            if (!this._rootGroup) {
              this._initContainer();
            }
            this._rootGroup.appendChild(layer._path);
            layer.addInteractiveTarget(layer._path);
          },
          _removePath: function(layer) {
            remove(layer._path);
            layer.removeInteractiveTarget(layer._path);
            delete this._layers[stamp(layer)];
          },
          _updatePath: function(layer) {
            layer._project();
            layer._update();
          },
          _updateStyle: function(layer) {
            var path = layer._path, options = layer.options;
            if (!path) {
              return;
            }
            if (options.stroke) {
              path.setAttribute("stroke", options.color);
              path.setAttribute("stroke-opacity", options.opacity);
              path.setAttribute("stroke-width", options.weight);
              path.setAttribute("stroke-linecap", options.lineCap);
              path.setAttribute("stroke-linejoin", options.lineJoin);
              if (options.dashArray) {
                path.setAttribute("stroke-dasharray", options.dashArray);
              } else {
                path.removeAttribute("stroke-dasharray");
              }
              if (options.dashOffset) {
                path.setAttribute("stroke-dashoffset", options.dashOffset);
              } else {
                path.removeAttribute("stroke-dashoffset");
              }
            } else {
              path.setAttribute("stroke", "none");
            }
            if (options.fill) {
              path.setAttribute("fill", options.fillColor || options.color);
              path.setAttribute("fill-opacity", options.fillOpacity);
              path.setAttribute("fill-rule", options.fillRule || "evenodd");
            } else {
              path.setAttribute("fill", "none");
            }
          },
          _updatePoly: function(layer, closed) {
            this._setPath(layer, pointsToPath(layer._parts, closed));
          },
          _updateCircle: function(layer) {
            var p = layer._point, r = Math.max(Math.round(layer._radius), 1), r2 = Math.max(Math.round(layer._radiusY), 1) || r, arc = "a" + r + "," + r2 + " 0 1,0 ";
            var d = layer._empty() ? "M0 0" : "M" + (p.x - r) + "," + p.y + arc + r * 2 + ",0 " + arc + -r * 2 + ",0 ";
            this._setPath(layer, d);
          },
          _setPath: function(layer, path) {
            layer._path.setAttribute("d", path);
          },
          // SVG does not have the concept of zIndex so we resort to changing the DOM order of elements
          _bringToFront: function(layer) {
            toFront(layer._path);
          },
          _bringToBack: function(layer) {
            toBack(layer._path);
          }
        });
        if (Browser.vml) {
          SVG.include(vmlMixin);
        }
        function svg(options) {
          return Browser.svg || Browser.vml ? new SVG(options) : null;
        }
        Map2.include({
          // @namespace Map; @method getRenderer(layer: Path): Renderer
          // Returns the instance of `Renderer` that should be used to render the given
          // `Path`. It will ensure that the `renderer` options of the map and paths
          // are respected, and that the renderers do exist on the map.
          getRenderer: function(layer) {
            var renderer = layer.options.renderer || this._getPaneRenderer(layer.options.pane) || this.options.renderer || this._renderer;
            if (!renderer) {
              renderer = this._renderer = this._createRenderer();
            }
            if (!this.hasLayer(renderer)) {
              this.addLayer(renderer);
            }
            return renderer;
          },
          _getPaneRenderer: function(name2) {
            if (name2 === "overlayPane" || name2 === void 0) {
              return false;
            }
            var renderer = this._paneRenderers[name2];
            if (renderer === void 0) {
              renderer = this._createRenderer({ pane: name2 });
              this._paneRenderers[name2] = renderer;
            }
            return renderer;
          },
          _createRenderer: function(options) {
            return this.options.preferCanvas && canvas(options) || svg(options);
          }
        });
        var Rectangle = Polygon.extend({
          initialize: function(latLngBounds, options) {
            Polygon.prototype.initialize.call(this, this._boundsToLatLngs(latLngBounds), options);
          },
          // @method setBounds(latLngBounds: LatLngBounds): this
          // Redraws the rectangle with the passed bounds.
          setBounds: function(latLngBounds) {
            return this.setLatLngs(this._boundsToLatLngs(latLngBounds));
          },
          _boundsToLatLngs: function(latLngBounds) {
            latLngBounds = toLatLngBounds(latLngBounds);
            return [
              latLngBounds.getSouthWest(),
              latLngBounds.getNorthWest(),
              latLngBounds.getNorthEast(),
              latLngBounds.getSouthEast()
            ];
          }
        });
        function rectangle(latLngBounds, options) {
          return new Rectangle(latLngBounds, options);
        }
        SVG.create = create;
        SVG.pointsToPath = pointsToPath;
        GeoJSON.geometryToLayer = geometryToLayer;
        GeoJSON.coordsToLatLng = coordsToLatLng;
        GeoJSON.coordsToLatLngs = coordsToLatLngs;
        GeoJSON.latLngToCoords = latLngToCoords;
        GeoJSON.latLngsToCoords = latLngsToCoords;
        GeoJSON.getFeature = getFeature;
        GeoJSON.asFeature = asFeature;
        Map2.mergeOptions({
          // @option boxZoom: Boolean = true
          // Whether the map can be zoomed to a rectangular area specified by
          // dragging the mouse while pressing the shift key.
          boxZoom: true
        });
        var BoxZoom = Handler.extend({
          initialize: function(map) {
            this._map = map;
            this._container = map._container;
            this._pane = map._panes.overlayPane;
            this._resetStateTimeout = 0;
            map.on("unload", this._destroy, this);
          },
          addHooks: function() {
            on(this._container, "mousedown", this._onMouseDown, this);
          },
          removeHooks: function() {
            off(this._container, "mousedown", this._onMouseDown, this);
          },
          moved: function() {
            return this._moved;
          },
          _destroy: function() {
            remove(this._pane);
            delete this._pane;
          },
          _resetState: function() {
            this._resetStateTimeout = 0;
            this._moved = false;
          },
          _clearDeferredResetState: function() {
            if (this._resetStateTimeout !== 0) {
              clearTimeout(this._resetStateTimeout);
              this._resetStateTimeout = 0;
            }
          },
          _onMouseDown: function(e) {
            if (!e.shiftKey || e.which !== 1 && e.button !== 1) {
              return false;
            }
            this._clearDeferredResetState();
            this._resetState();
            disableTextSelection();
            disableImageDrag();
            this._startPoint = this._map.mouseEventToContainerPoint(e);
            on(document, {
              contextmenu: stop,
              mousemove: this._onMouseMove,
              mouseup: this._onMouseUp,
              keydown: this._onKeyDown
            }, this);
          },
          _onMouseMove: function(e) {
            if (!this._moved) {
              this._moved = true;
              this._box = create$1("div", "leaflet-zoom-box", this._container);
              addClass(this._container, "leaflet-crosshair");
              this._map.fire("boxzoomstart");
            }
            this._point = this._map.mouseEventToContainerPoint(e);
            var bounds = new Bounds(this._point, this._startPoint), size = bounds.getSize();
            setPosition(this._box, bounds.min);
            this._box.style.width = size.x + "px";
            this._box.style.height = size.y + "px";
          },
          _finish: function() {
            if (this._moved) {
              remove(this._box);
              removeClass(this._container, "leaflet-crosshair");
            }
            enableTextSelection();
            enableImageDrag();
            off(document, {
              contextmenu: stop,
              mousemove: this._onMouseMove,
              mouseup: this._onMouseUp,
              keydown: this._onKeyDown
            }, this);
          },
          _onMouseUp: function(e) {
            if (e.which !== 1 && e.button !== 1) {
              return;
            }
            this._finish();
            if (!this._moved) {
              return;
            }
            this._clearDeferredResetState();
            this._resetStateTimeout = setTimeout(bind(this._resetState, this), 0);
            var bounds = new LatLngBounds(
              this._map.containerPointToLatLng(this._startPoint),
              this._map.containerPointToLatLng(this._point)
            );
            this._map.fitBounds(bounds).fire("boxzoomend", { boxZoomBounds: bounds });
          },
          _onKeyDown: function(e) {
            if (e.keyCode === 27) {
              this._finish();
              this._clearDeferredResetState();
              this._resetState();
            }
          }
        });
        Map2.addInitHook("addHandler", "boxZoom", BoxZoom);
        Map2.mergeOptions({
          // @option doubleClickZoom: Boolean|String = true
          // Whether the map can be zoomed in by double clicking on it and
          // zoomed out by double clicking while holding shift. If passed
          // `'center'`, double-click zoom will zoom to the center of the
          //  view regardless of where the mouse was.
          doubleClickZoom: true
        });
        var DoubleClickZoom = Handler.extend({
          addHooks: function() {
            this._map.on("dblclick", this._onDoubleClick, this);
          },
          removeHooks: function() {
            this._map.off("dblclick", this._onDoubleClick, this);
          },
          _onDoubleClick: function(e) {
            var map = this._map, oldZoom = map.getZoom(), delta = map.options.zoomDelta, zoom2 = e.originalEvent.shiftKey ? oldZoom - delta : oldZoom + delta;
            if (map.options.doubleClickZoom === "center") {
              map.setZoom(zoom2);
            } else {
              map.setZoomAround(e.containerPoint, zoom2);
            }
          }
        });
        Map2.addInitHook("addHandler", "doubleClickZoom", DoubleClickZoom);
        Map2.mergeOptions({
          // @option dragging: Boolean = true
          // Whether the map is draggable with mouse/touch or not.
          dragging: true,
          // @section Panning Inertia Options
          // @option inertia: Boolean = *
          // If enabled, panning of the map will have an inertia effect where
          // the map builds momentum while dragging and continues moving in
          // the same direction for some time. Feels especially nice on touch
          // devices. Enabled by default.
          inertia: true,
          // @option inertiaDeceleration: Number = 3000
          // The rate with which the inertial movement slows down, in pixels/second².
          inertiaDeceleration: 3400,
          // px/s^2
          // @option inertiaMaxSpeed: Number = Infinity
          // Max speed of the inertial movement, in pixels/second.
          inertiaMaxSpeed: Infinity,
          // px/s
          // @option easeLinearity: Number = 0.2
          easeLinearity: 0.2,
          // TODO refactor, move to CRS
          // @option worldCopyJump: Boolean = false
          // With this option enabled, the map tracks when you pan to another "copy"
          // of the world and seamlessly jumps to the original one so that all overlays
          // like markers and vector layers are still visible.
          worldCopyJump: false,
          // @option maxBoundsViscosity: Number = 0.0
          // If `maxBounds` is set, this option will control how solid the bounds
          // are when dragging the map around. The default value of `0.0` allows the
          // user to drag outside the bounds at normal speed, higher values will
          // slow down map dragging outside bounds, and `1.0` makes the bounds fully
          // solid, preventing the user from dragging outside the bounds.
          maxBoundsViscosity: 0
        });
        var Drag = Handler.extend({
          addHooks: function() {
            if (!this._draggable) {
              var map = this._map;
              this._draggable = new Draggable(map._mapPane, map._container);
              this._draggable.on({
                dragstart: this._onDragStart,
                drag: this._onDrag,
                dragend: this._onDragEnd
              }, this);
              this._draggable.on("predrag", this._onPreDragLimit, this);
              if (map.options.worldCopyJump) {
                this._draggable.on("predrag", this._onPreDragWrap, this);
                map.on("zoomend", this._onZoomEnd, this);
                map.whenReady(this._onZoomEnd, this);
              }
            }
            addClass(this._map._container, "leaflet-grab leaflet-touch-drag");
            this._draggable.enable();
            this._positions = [];
            this._times = [];
          },
          removeHooks: function() {
            removeClass(this._map._container, "leaflet-grab");
            removeClass(this._map._container, "leaflet-touch-drag");
            this._draggable.disable();
          },
          moved: function() {
            return this._draggable && this._draggable._moved;
          },
          moving: function() {
            return this._draggable && this._draggable._moving;
          },
          _onDragStart: function() {
            var map = this._map;
            map._stop();
            if (this._map.options.maxBounds && this._map.options.maxBoundsViscosity) {
              var bounds = toLatLngBounds(this._map.options.maxBounds);
              this._offsetLimit = toBounds(
                this._map.latLngToContainerPoint(bounds.getNorthWest()).multiplyBy(-1),
                this._map.latLngToContainerPoint(bounds.getSouthEast()).multiplyBy(-1).add(this._map.getSize())
              );
              this._viscosity = Math.min(1, Math.max(0, this._map.options.maxBoundsViscosity));
            } else {
              this._offsetLimit = null;
            }
            map.fire("movestart").fire("dragstart");
            if (map.options.inertia) {
              this._positions = [];
              this._times = [];
            }
          },
          _onDrag: function(e) {
            if (this._map.options.inertia) {
              var time = this._lastTime = +/* @__PURE__ */ new Date(), pos = this._lastPos = this._draggable._absPos || this._draggable._newPos;
              this._positions.push(pos);
              this._times.push(time);
              this._prunePositions(time);
            }
            this._map.fire("move", e).fire("drag", e);
          },
          _prunePositions: function(time) {
            while (this._positions.length > 1 && time - this._times[0] > 50) {
              this._positions.shift();
              this._times.shift();
            }
          },
          _onZoomEnd: function() {
            var pxCenter = this._map.getSize().divideBy(2), pxWorldCenter = this._map.latLngToLayerPoint([0, 0]);
            this._initialWorldOffset = pxWorldCenter.subtract(pxCenter).x;
            this._worldWidth = this._map.getPixelWorldBounds().getSize().x;
          },
          _viscousLimit: function(value, threshold) {
            return value - (value - threshold) * this._viscosity;
          },
          _onPreDragLimit: function() {
            if (!this._viscosity || !this._offsetLimit) {
              return;
            }
            var offset = this._draggable._newPos.subtract(this._draggable._startPos);
            var limit = this._offsetLimit;
            if (offset.x < limit.min.x) {
              offset.x = this._viscousLimit(offset.x, limit.min.x);
            }
            if (offset.y < limit.min.y) {
              offset.y = this._viscousLimit(offset.y, limit.min.y);
            }
            if (offset.x > limit.max.x) {
              offset.x = this._viscousLimit(offset.x, limit.max.x);
            }
            if (offset.y > limit.max.y) {
              offset.y = this._viscousLimit(offset.y, limit.max.y);
            }
            this._draggable._newPos = this._draggable._startPos.add(offset);
          },
          _onPreDragWrap: function() {
            var worldWidth = this._worldWidth, halfWidth = Math.round(worldWidth / 2), dx = this._initialWorldOffset, x = this._draggable._newPos.x, newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx, newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx, newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;
            this._draggable._absPos = this._draggable._newPos.clone();
            this._draggable._newPos.x = newX;
          },
          _onDragEnd: function(e) {
            var map = this._map, options = map.options, noInertia = !options.inertia || e.noInertia || this._times.length < 2;
            map.fire("dragend", e);
            if (noInertia) {
              map.fire("moveend");
            } else {
              this._prunePositions(+/* @__PURE__ */ new Date());
              var direction = this._lastPos.subtract(this._positions[0]), duration = (this._lastTime - this._times[0]) / 1e3, ease = options.easeLinearity, speedVector = direction.multiplyBy(ease / duration), speed = speedVector.distanceTo([0, 0]), limitedSpeed = Math.min(options.inertiaMaxSpeed, speed), limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed), decelerationDuration = limitedSpeed / (options.inertiaDeceleration * ease), offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();
              if (!offset.x && !offset.y) {
                map.fire("moveend");
              } else {
                offset = map._limitOffset(offset, map.options.maxBounds);
                requestAnimFrame(function() {
                  map.panBy(offset, {
                    duration: decelerationDuration,
                    easeLinearity: ease,
                    noMoveStart: true,
                    animate: true
                  });
                });
              }
            }
          }
        });
        Map2.addInitHook("addHandler", "dragging", Drag);
        Map2.mergeOptions({
          // @option keyboard: Boolean = true
          // Makes the map focusable and allows users to navigate the map with keyboard
          // arrows and `+`/`-` keys.
          keyboard: true,
          // @option keyboardPanDelta: Number = 80
          // Amount of pixels to pan when pressing an arrow key.
          keyboardPanDelta: 80
        });
        var Keyboard = Handler.extend({
          keyCodes: {
            left: [37],
            right: [39],
            down: [40],
            up: [38],
            zoomIn: [187, 107, 61, 171],
            zoomOut: [189, 109, 54, 173]
          },
          initialize: function(map) {
            this._map = map;
            this._setPanDelta(map.options.keyboardPanDelta);
            this._setZoomDelta(map.options.zoomDelta);
          },
          addHooks: function() {
            var container = this._map._container;
            if (container.tabIndex <= 0) {
              container.tabIndex = "0";
            }
            on(container, {
              focus: this._onFocus,
              blur: this._onBlur,
              mousedown: this._onMouseDown
            }, this);
            this._map.on({
              focus: this._addHooks,
              blur: this._removeHooks
            }, this);
          },
          removeHooks: function() {
            this._removeHooks();
            off(this._map._container, {
              focus: this._onFocus,
              blur: this._onBlur,
              mousedown: this._onMouseDown
            }, this);
            this._map.off({
              focus: this._addHooks,
              blur: this._removeHooks
            }, this);
          },
          _onMouseDown: function() {
            if (this._focused) {
              return;
            }
            var body = document.body, docEl = document.documentElement, top = body.scrollTop || docEl.scrollTop, left = body.scrollLeft || docEl.scrollLeft;
            this._map._container.focus();
            window.scrollTo(left, top);
          },
          _onFocus: function() {
            this._focused = true;
            this._map.fire("focus");
          },
          _onBlur: function() {
            this._focused = false;
            this._map.fire("blur");
          },
          _setPanDelta: function(panDelta) {
            var keys = this._panKeys = {}, codes = this.keyCodes, i, len;
            for (i = 0, len = codes.left.length; i < len; i++) {
              keys[codes.left[i]] = [-1 * panDelta, 0];
            }
            for (i = 0, len = codes.right.length; i < len; i++) {
              keys[codes.right[i]] = [panDelta, 0];
            }
            for (i = 0, len = codes.down.length; i < len; i++) {
              keys[codes.down[i]] = [0, panDelta];
            }
            for (i = 0, len = codes.up.length; i < len; i++) {
              keys[codes.up[i]] = [0, -1 * panDelta];
            }
          },
          _setZoomDelta: function(zoomDelta) {
            var keys = this._zoomKeys = {}, codes = this.keyCodes, i, len;
            for (i = 0, len = codes.zoomIn.length; i < len; i++) {
              keys[codes.zoomIn[i]] = zoomDelta;
            }
            for (i = 0, len = codes.zoomOut.length; i < len; i++) {
              keys[codes.zoomOut[i]] = -zoomDelta;
            }
          },
          _addHooks: function() {
            on(document, "keydown", this._onKeyDown, this);
          },
          _removeHooks: function() {
            off(document, "keydown", this._onKeyDown, this);
          },
          _onKeyDown: function(e) {
            if (e.altKey || e.ctrlKey || e.metaKey) {
              return;
            }
            var key2 = e.keyCode, map = this._map, offset;
            if (key2 in this._panKeys) {
              if (!map._panAnim || !map._panAnim._inProgress) {
                offset = this._panKeys[key2];
                if (e.shiftKey) {
                  offset = toPoint(offset).multiplyBy(3);
                }
                if (map.options.maxBounds) {
                  offset = map._limitOffset(toPoint(offset), map.options.maxBounds);
                }
                if (map.options.worldCopyJump) {
                  var newLatLng = map.wrapLatLng(map.unproject(map.project(map.getCenter()).add(offset)));
                  map.panTo(newLatLng);
                } else {
                  map.panBy(offset);
                }
              }
            } else if (key2 in this._zoomKeys) {
              map.setZoom(map.getZoom() + (e.shiftKey ? 3 : 1) * this._zoomKeys[key2]);
            } else if (key2 === 27 && map._popup && map._popup.options.closeOnEscapeKey) {
              map.closePopup();
            } else {
              return;
            }
            stop(e);
          }
        });
        Map2.addInitHook("addHandler", "keyboard", Keyboard);
        Map2.mergeOptions({
          // @section Mouse wheel options
          // @option scrollWheelZoom: Boolean|String = true
          // Whether the map can be zoomed by using the mouse wheel. If passed `'center'`,
          // it will zoom to the center of the view regardless of where the mouse was.
          scrollWheelZoom: true,
          // @option wheelDebounceTime: Number = 40
          // Limits the rate at which a wheel can fire (in milliseconds). By default
          // user can't zoom via wheel more often than once per 40 ms.
          wheelDebounceTime: 40,
          // @option wheelPxPerZoomLevel: Number = 60
          // How many scroll pixels (as reported by [L.DomEvent.getWheelDelta](#domevent-getwheeldelta))
          // mean a change of one full zoom level. Smaller values will make wheel-zooming
          // faster (and vice versa).
          wheelPxPerZoomLevel: 60
        });
        var ScrollWheelZoom = Handler.extend({
          addHooks: function() {
            on(this._map._container, "wheel", this._onWheelScroll, this);
            this._delta = 0;
          },
          removeHooks: function() {
            off(this._map._container, "wheel", this._onWheelScroll, this);
          },
          _onWheelScroll: function(e) {
            var delta = getWheelDelta(e);
            var debounce = this._map.options.wheelDebounceTime;
            this._delta += delta;
            this._lastMousePos = this._map.mouseEventToContainerPoint(e);
            if (!this._startTime) {
              this._startTime = +/* @__PURE__ */ new Date();
            }
            var left = Math.max(debounce - (+/* @__PURE__ */ new Date() - this._startTime), 0);
            clearTimeout(this._timer);
            this._timer = setTimeout(bind(this._performZoom, this), left);
            stop(e);
          },
          _performZoom: function() {
            var map = this._map, zoom2 = map.getZoom(), snap = this._map.options.zoomSnap || 0;
            map._stop();
            var d2 = this._delta / (this._map.options.wheelPxPerZoomLevel * 4), d3 = 4 * Math.log(2 / (1 + Math.exp(-Math.abs(d2)))) / Math.LN2, d4 = snap ? Math.ceil(d3 / snap) * snap : d3, delta = map._limitZoom(zoom2 + (this._delta > 0 ? d4 : -d4)) - zoom2;
            this._delta = 0;
            this._startTime = null;
            if (!delta) {
              return;
            }
            if (map.options.scrollWheelZoom === "center") {
              map.setZoom(zoom2 + delta);
            } else {
              map.setZoomAround(this._lastMousePos, zoom2 + delta);
            }
          }
        });
        Map2.addInitHook("addHandler", "scrollWheelZoom", ScrollWheelZoom);
        var tapHoldDelay = 600;
        Map2.mergeOptions({
          // @section Touch interaction options
          // @option tapHold: Boolean
          // Enables simulation of `contextmenu` event, default is `true` for mobile Safari.
          tapHold: Browser.touchNative && Browser.safari && Browser.mobile,
          // @option tapTolerance: Number = 15
          // The max number of pixels a user can shift his finger during touch
          // for it to be considered a valid tap.
          tapTolerance: 15
        });
        var TapHold = Handler.extend({
          addHooks: function() {
            on(this._map._container, "touchstart", this._onDown, this);
          },
          removeHooks: function() {
            off(this._map._container, "touchstart", this._onDown, this);
          },
          _onDown: function(e) {
            clearTimeout(this._holdTimeout);
            if (e.touches.length !== 1) {
              return;
            }
            var first = e.touches[0];
            this._startPos = this._newPos = new Point(first.clientX, first.clientY);
            this._holdTimeout = setTimeout(bind(function() {
              this._cancel();
              if (!this._isTapValid()) {
                return;
              }
              on(document, "touchend", preventDefault);
              on(document, "touchend touchcancel", this._cancelClickPrevent);
              this._simulateEvent("contextmenu", first);
            }, this), tapHoldDelay);
            on(document, "touchend touchcancel contextmenu", this._cancel, this);
            on(document, "touchmove", this._onMove, this);
          },
          _cancelClickPrevent: function cancelClickPrevent() {
            off(document, "touchend", preventDefault);
            off(document, "touchend touchcancel", cancelClickPrevent);
          },
          _cancel: function() {
            clearTimeout(this._holdTimeout);
            off(document, "touchend touchcancel contextmenu", this._cancel, this);
            off(document, "touchmove", this._onMove, this);
          },
          _onMove: function(e) {
            var first = e.touches[0];
            this._newPos = new Point(first.clientX, first.clientY);
          },
          _isTapValid: function() {
            return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
          },
          _simulateEvent: function(type, e) {
            var simulatedEvent = new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              // detail: 1,
              screenX: e.screenX,
              screenY: e.screenY,
              clientX: e.clientX,
              clientY: e.clientY
              // button: 2,
              // buttons: 2
            });
            simulatedEvent._simulated = true;
            e.target.dispatchEvent(simulatedEvent);
          }
        });
        Map2.addInitHook("addHandler", "tapHold", TapHold);
        Map2.mergeOptions({
          // @section Touch interaction options
          // @option touchZoom: Boolean|String = *
          // Whether the map can be zoomed by touch-dragging with two fingers. If
          // passed `'center'`, it will zoom to the center of the view regardless of
          // where the touch events (fingers) were. Enabled for touch-capable web
          // browsers.
          touchZoom: Browser.touch,
          // @option bounceAtZoomLimits: Boolean = true
          // Set it to false if you don't want the map to zoom beyond min/max zoom
          // and then bounce back when pinch-zooming.
          bounceAtZoomLimits: true
        });
        var TouchZoom = Handler.extend({
          addHooks: function() {
            addClass(this._map._container, "leaflet-touch-zoom");
            on(this._map._container, "touchstart", this._onTouchStart, this);
          },
          removeHooks: function() {
            removeClass(this._map._container, "leaflet-touch-zoom");
            off(this._map._container, "touchstart", this._onTouchStart, this);
          },
          _onTouchStart: function(e) {
            var map = this._map;
            if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) {
              return;
            }
            var p1 = map.mouseEventToContainerPoint(e.touches[0]), p2 = map.mouseEventToContainerPoint(e.touches[1]);
            this._centerPoint = map.getSize()._divideBy(2);
            this._startLatLng = map.containerPointToLatLng(this._centerPoint);
            if (map.options.touchZoom !== "center") {
              this._pinchStartLatLng = map.containerPointToLatLng(p1.add(p2)._divideBy(2));
            }
            this._startDist = p1.distanceTo(p2);
            this._startZoom = map.getZoom();
            this._moved = false;
            this._zooming = true;
            map._stop();
            on(document, "touchmove", this._onTouchMove, this);
            on(document, "touchend touchcancel", this._onTouchEnd, this);
            preventDefault(e);
          },
          _onTouchMove: function(e) {
            if (!e.touches || e.touches.length !== 2 || !this._zooming) {
              return;
            }
            var map = this._map, p1 = map.mouseEventToContainerPoint(e.touches[0]), p2 = map.mouseEventToContainerPoint(e.touches[1]), scale2 = p1.distanceTo(p2) / this._startDist;
            this._zoom = map.getScaleZoom(scale2, this._startZoom);
            if (!map.options.bounceAtZoomLimits && (this._zoom < map.getMinZoom() && scale2 < 1 || this._zoom > map.getMaxZoom() && scale2 > 1)) {
              this._zoom = map._limitZoom(this._zoom);
            }
            if (map.options.touchZoom === "center") {
              this._center = this._startLatLng;
              if (scale2 === 1) {
                return;
              }
            } else {
              var delta = p1._add(p2)._divideBy(2)._subtract(this._centerPoint);
              if (scale2 === 1 && delta.x === 0 && delta.y === 0) {
                return;
              }
              this._center = map.unproject(map.project(this._pinchStartLatLng, this._zoom).subtract(delta), this._zoom);
            }
            if (!this._moved) {
              map._moveStart(true, false);
              this._moved = true;
            }
            cancelAnimFrame(this._animRequest);
            var moveFn = bind(map._move, map, this._center, this._zoom, { pinch: true, round: false }, void 0);
            this._animRequest = requestAnimFrame(moveFn, this, true);
            preventDefault(e);
          },
          _onTouchEnd: function() {
            if (!this._moved || !this._zooming) {
              this._zooming = false;
              return;
            }
            this._zooming = false;
            cancelAnimFrame(this._animRequest);
            off(document, "touchmove", this._onTouchMove, this);
            off(document, "touchend touchcancel", this._onTouchEnd, this);
            if (this._map.options.zoomAnimation) {
              this._map._animateZoom(this._center, this._map._limitZoom(this._zoom), true, this._map.options.zoomSnap);
            } else {
              this._map._resetView(this._center, this._map._limitZoom(this._zoom));
            }
          }
        });
        Map2.addInitHook("addHandler", "touchZoom", TouchZoom);
        Map2.BoxZoom = BoxZoom;
        Map2.DoubleClickZoom = DoubleClickZoom;
        Map2.Drag = Drag;
        Map2.Keyboard = Keyboard;
        Map2.ScrollWheelZoom = ScrollWheelZoom;
        Map2.TapHold = TapHold;
        Map2.TouchZoom = TouchZoom;
        exports2.Bounds = Bounds;
        exports2.Browser = Browser;
        exports2.CRS = CRS;
        exports2.Canvas = Canvas;
        exports2.Circle = Circle;
        exports2.CircleMarker = CircleMarker;
        exports2.Class = Class;
        exports2.Control = Control;
        exports2.DivIcon = DivIcon;
        exports2.DivOverlay = DivOverlay;
        exports2.DomEvent = DomEvent;
        exports2.DomUtil = DomUtil;
        exports2.Draggable = Draggable;
        exports2.Evented = Evented;
        exports2.FeatureGroup = FeatureGroup;
        exports2.GeoJSON = GeoJSON;
        exports2.GridLayer = GridLayer;
        exports2.Handler = Handler;
        exports2.Icon = Icon;
        exports2.ImageOverlay = ImageOverlay;
        exports2.LatLng = LatLng;
        exports2.LatLngBounds = LatLngBounds;
        exports2.Layer = Layer;
        exports2.LayerGroup = LayerGroup;
        exports2.LineUtil = LineUtil;
        exports2.Map = Map2;
        exports2.Marker = Marker;
        exports2.Mixin = Mixin;
        exports2.Path = Path;
        exports2.Point = Point;
        exports2.PolyUtil = PolyUtil;
        exports2.Polygon = Polygon;
        exports2.Polyline = Polyline;
        exports2.Popup = Popup;
        exports2.PosAnimation = PosAnimation;
        exports2.Projection = index2;
        exports2.Rectangle = Rectangle;
        exports2.Renderer = Renderer;
        exports2.SVG = SVG;
        exports2.SVGOverlay = SVGOverlay;
        exports2.TileLayer = TileLayer;
        exports2.Tooltip = Tooltip;
        exports2.Transformation = Transformation;
        exports2.Util = Util;
        exports2.VideoOverlay = VideoOverlay;
        exports2.bind = bind;
        exports2.bounds = toBounds;
        exports2.canvas = canvas;
        exports2.circle = circle;
        exports2.circleMarker = circleMarker;
        exports2.control = control;
        exports2.divIcon = divIcon;
        exports2.extend = extend;
        exports2.featureGroup = featureGroup;
        exports2.geoJSON = geoJSON;
        exports2.geoJson = geoJson;
        exports2.gridLayer = gridLayer;
        exports2.icon = icon;
        exports2.imageOverlay = imageOverlay;
        exports2.latLng = toLatLng;
        exports2.latLngBounds = toLatLngBounds;
        exports2.layerGroup = layerGroup;
        exports2.map = createMap;
        exports2.marker = marker;
        exports2.point = toPoint;
        exports2.polygon = polygon;
        exports2.polyline = polyline;
        exports2.popup = popup;
        exports2.rectangle = rectangle;
        exports2.setOptions = setOptions;
        exports2.stamp = stamp;
        exports2.svg = svg;
        exports2.svgOverlay = svgOverlay;
        exports2.tileLayer = tileLayer;
        exports2.tooltip = tooltip;
        exports2.transformation = toTransformation;
        exports2.version = version;
        exports2.videoOverlay = videoOverlay;
        var oldL = window.L;
        exports2.noConflict = function() {
          window.L = oldL;
          return this;
        };
        window.L = exports2;
      }));
    }
  });

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    audioSync: () => audioSync,
    boot: () => boot,
    pauseMusic: () => pauseMusic,
    playMusic: () => playMusic,
    playSound: () => playSound,
    registerMusic: () => registerMusic,
    registerSounds: () => registerSounds,
    requestDataSource: () => requestDataSource,
    resumeMusic: () => resumeMusic,
    setDataSourceToken: () => setDataSourceToken,
    setMusicTempo: () => setMusicTempo,
    setMusicVolume: () => setMusicVolume,
    stopMusic: () => stopMusic
  });

  // src/context.ts
  var _ctx = null;
  function initContext(context) {
    _ctx = context;
  }
  function currentContext() {
    return _ctx;
  }
  function ctx() {
    if (!_ctx) throw new Error("RuneWeb context not initialized \u2014 call boot() first");
    return _ctx;
  }
  function withContext(context, run) {
    const previous = _ctx;
    _ctx = context;
    try {
      return run();
    } finally {
      _ctx = previous;
    }
  }

  // src/ownership.ts
  var ownedValues = /* @__PURE__ */ new WeakSet();
  var reactiveTargets = /* @__PURE__ */ new WeakMap();
  function ownValue(value) {
    ownedValues.add(value);
    return value;
  }
  function isOwnedValue(value) {
    return ownedValues.has(value);
  }
  function registerReactive(proxy, target) {
    reactiveTargets.set(proxy, target);
  }
  function rawValue(value) {
    if (value && typeof value === "object") return reactiveTargets.get(value) ?? value;
    return value;
  }

  // src/pixel3d/entities.ts
  var active;
  var groups = /* @__PURE__ */ new WeakMap();
  var ownedEntities = /* @__PURE__ */ new WeakSet();
  var movementSequence = 0;
  var movementLog = Array(4096);
  function ownEntity(value, importedEntities) {
    value = rawValue(value);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("entity_group expects entity objects");
    if (ownedEntities.has(value)) return value;
    const known = importedEntities.get(value);
    if (known) return known;
    const raw = { ...value };
    const proxy = new Proxy(raw, {
      set: (target, key2, next2) => {
        Reflect.set(target, key2, next2);
        if (["x", "y", "z", "visible", "scale"].includes(String(key2))) entityMoved(proxy);
        return true;
      },
      deleteProperty: (target, key2) => {
        Reflect.deleteProperty(target, key2);
        entityMoved(proxy);
        return true;
      },
      defineProperty: () => {
        throw new Error("Entity descriptors cannot be redefined");
      }
    });
    ownValue(proxy);
    ownedEntities.add(proxy);
    importedEntities.set(value, proxy);
    return proxy;
  }
  function entityGroup(values = []) {
    values = rawValue(values);
    if (!Array.isArray(values) || values.length > 1e6) throw new Error("entity_group needs an array");
    if (groups.has(values)) return values;
    const importedEntities = /* @__PURE__ */ new WeakMap();
    const target = values.map((value) => ownEntity(value, importedEntities));
    const proxy = new Proxy(target, {
      set: (array, key2, value) => {
        if (key2 === "length") {
          if (!Number.isInteger(value) || value < 0 || value > array.length) throw new Error("Grow entity groups with push or indexed writes");
          Reflect.set(array, key2, value);
        } else if (typeof key2 === "string" && /^\d+$/.test(key2)) {
          const i = Number(key2);
          if (i > array.length || i >= 1e6) throw new Error("Entity group indices must be contiguous");
          Reflect.set(array, key2, ownEntity(value, importedEntities));
        } else throw new Error("Invalid entity group property");
        entitiesChanged(proxy);
        return true;
      },
      deleteProperty: (array, key2) => {
        Reflect.deleteProperty(array, key2);
        entitiesChanged(proxy);
        return true;
      },
      defineProperty: () => {
        throw new Error("Entity group descriptors cannot be redefined");
      }
    });
    ownValue(proxy);
    groups.set(proxy, { version: 0, indices: /* @__PURE__ */ new Map() });
    return proxy;
  }
  var EntityIndex = class {
    constructor(source, dimensions, owner) {
      this.source = source;
      this.dimensions = dimensions;
      this.owner = owner;
      this.buckets = /* @__PURE__ */ new Map();
      this.rows = /* @__PURE__ */ new Map();
      this.positions = /* @__PURE__ */ new Map();
      this.scales = /* @__PURE__ */ new Map();
      this.maxScale = 1;
      this.dirty = false;
      this.revision = 0;
      this.rebuild();
    }
    key(x, y, z) {
      return `${Math.floor(x / 16)},${Math.floor(y / 16)},${this.dimensions === 3 ? Math.floor(z / 16) : 0}`;
    }
    rebuild() {
      this.buckets.clear();
      this.rows.clear();
      this.positions.clear();
      this.scales.clear();
      this.maxScale = 1;
      this.dirty = false;
      this.source.forEach((entity, i) => {
        if (!entity || typeof entity !== "object") throw new Error("nearby expects entity objects");
        const positions = this.positions.get(entity) ?? [];
        positions.push(i);
        this.positions.set(entity, positions);
        if (this.owner) {
          const memberships = this.owner.members.get(entity) ?? /* @__PURE__ */ new Set();
          memberships.add(this);
          this.owner.members.set(entity, memberships);
        }
        this.place(i, entity);
      });
      this.revision = movementSequence;
    }
    place(i, entity) {
      if (entity.visible === false) return;
      const x = entity.x, y = entity.y, z = this.dimensions === 3 ? entity.z ?? 0 : 0;
      if (![x, y, z].every(Number.isFinite)) throw new Error("nearby entity coordinates must be finite");
      const key2 = this.key(x, y, z), bucket = this.buckets.get(key2) ?? /* @__PURE__ */ new Set();
      bucket.add(i);
      this.buckets.set(key2, bucket);
      const scale = Number.isFinite(entity.scale) && entity.scale > 0 ? entity.scale : 1;
      this.scales.set(scale, (this.scales.get(scale) ?? 0) + 1);
      this.maxScale = Math.max(this.maxScale, scale);
      this.rows.set(i, { entity, key: key2, x, y, z, scale });
    }
    move(entity) {
      if (this.dirty) return;
      for (const i of this.positions.get(entity) ?? []) {
        const row = this.rows.get(i);
        if (row) {
          const bucket = this.buckets.get(row.key);
          bucket.delete(i);
          if (!bucket.size) this.buckets.delete(row.key);
          this.rows.delete(i);
          const count = this.scales.get(row.scale) - 1;
          if (count) this.scales.set(row.scale, count);
          else this.scales.delete(row.scale);
          if (row.scale === this.maxScale && !count) {
            this.maxScale = 1;
            for (const scale of this.scales.keys()) this.maxScale = Math.max(this.maxScale, scale);
          }
        }
        this.place(i, entity);
      }
    }
    query(origin, radius, padding = 0) {
      if (this.dirty) this.rebuild();
      if (!this.owner && this.revision !== movementSequence) {
        if (movementSequence - this.revision > movementLog.length) this.rebuild();
        else {
          const changed = /* @__PURE__ */ new Set();
          for (let version = this.revision + 1; version <= movementSequence; version++) changed.add(movementLog[version % movementLog.length].entity);
          for (const entity of changed) if (this.positions.has(entity)) this.move(entity);
          this.revision = movementSequence;
        }
      }
      radius += padding * this.maxScale;
      const minX = Math.floor((origin.x - radius) / 16), maxX = Math.floor((origin.x + radius) / 16);
      const minY = Math.floor((origin.y - radius) / 16), maxY = Math.floor((origin.y + radius) / 16);
      const minZ = this.dimensions === 3 ? Math.floor((origin.z - radius) / 16) : 0, maxZ = this.dimensions === 3 ? Math.floor((origin.z + radius) / 16) : 0;
      const matches = [];
      const inside = (row) => Math.hypot(row.x - origin.x, row.y - origin.y, this.dimensions === 3 ? row.z - origin.z : 0) <= radius;
      if ((maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1) > this.rows.size * 2) {
        for (const [i, row] of this.rows) if (inside(row)) matches.push(i);
      } else for (let z = minZ; z <= maxZ; z++) for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        for (const i of this.buckets.get(`${x},${y},${z}`) ?? []) if (inside(this.rows.get(i))) matches.push(i);
      }
      matches.sort((a, b) => a - b);
      return matches.map((i) => this.source[i]);
    }
  };
  function nearby(source, origin, radius) {
    return query(source, origin, radius);
  }
  function query(source, origin, radius, padding = 0) {
    source = rawValue(source);
    if (!Array.isArray(source) || source.length > 1e6 || !origin || typeof origin !== "object" || typeof radius !== "number" || !Number.isFinite(radius) || radius < 0) throw new Error("nearby needs a collection, position and finite nonnegative radius");
    const point = origin, dimensions = point.z === void 0 ? 2 : 3;
    if (![point.x, point.y, ...dimensions === 3 ? [point.z] : []].every(Number.isFinite)) throw new Error("nearby origin must have finite coordinates");
    const group = groups.get(source);
    if (group) {
      let indexed = group.indices.get(dimensions);
      if (!indexed || indexed.version !== group.version) {
        indexed = { version: group.version, index: new EntityIndex(source, dimensions) };
        group.indices.set(dimensions, indexed);
      }
      return indexed.index.query(point, radius, padding);
    }
    const owner = active;
    if (!owner) return new EntityIndex(source, dimensions).query(point, radius, padding);
    const indices = owner.indices.get(source) ?? /* @__PURE__ */ new Map();
    let index2 = indices.get(dimensions);
    if (!index2) {
      index2 = new EntityIndex(source, dimensions, owner);
      indices.set(dimensions, index2);
      owner.indices.set(source, indices);
    }
    return index2.query(point, radius, padding);
  }
  function entityMoved(value) {
    if (value && typeof value === "object" && ownedEntities.has(value)) {
      movementSequence++;
      movementLog[movementSequence % movementLog.length] = { version: movementSequence, entity: value };
    }
    if (value && typeof value === "object") for (const index2 of active?.members.get(value) ?? []) index2.move(value);
  }
  function entitiesChanged(value) {
    if (value && typeof value === "object") {
      const group = groups.get(value);
      if (group) group.version++;
    }
    if (Array.isArray(value)) for (const index2 of active?.indices.get(value)?.values() ?? []) index2.dirty = true;
  }

  // src/core_expression.ts
  var precedence = {
    "??": 1,
    or: 2,
    "||": 2,
    and: 3,
    "&&": 3,
    "==": 4,
    "!=": 4,
    contains: 4,
    "<": 5,
    ">": 5,
    "<=": 5,
    ">=": 5,
    "+": 6,
    "-": 6,
    "*": 7,
    "/": 7,
    "%": 7
  };
  var coreFunctions = {
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    min: Math.min,
    max: Math.max,
    sqrt: Math.sqrt,
    pow: Math.pow,
    sin: (x) => Math.sin(x * Math.PI / 180),
    cos: (x) => Math.cos(x * Math.PI / 180),
    clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
    range: (start, end, step = 1) => {
      if (end === void 0) {
        end = start;
        start = 0;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0)
        throw new Error("range requires finite bounds and a nonzero step");
      const n = Math.max(0, Math.ceil((end - start) / step));
      if (n > 1e6) throw new Error("range exceeds 1000000 items");
      return Array.from({ length: n }, (_, i) => start + i * step);
    },
    len: (x) => x.length,
    keys: Object.keys,
    values: Object.values,
    repeat: (value, n) => {
      if (!Number.isInteger(n) || n < 0 || n > 1e6) throw new Error("invalid repeat count");
      return Array.from({ length: n }, () => value);
    },
    hex: (n, width = 0) => Math.trunc(n).toString(16).padStart(width, "0"),
    "json.stringify": JSON.stringify,
    "json.parse": JSON.parse
  };
  var forbidden = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  function safeKey(key2) {
    key2 = String(key2);
    if (forbidden.has(key2)) throw new Error(`Invalid member: ${key2}`);
    return key2;
  }
  function tokenize(source) {
    const out = [];
    let i = 0;
    while (i < source.length) {
      if (/\s/.test(source[i])) {
        i++;
        continue;
      }
      const tail = source.slice(i);
      const number = tail.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (number) {
        out.push({ kind: "number", value: number[0] });
        i += number[0].length;
        continue;
      }
      if (source[i] === '"' || source[i] === "'") {
        const quote = source[i++];
        let value = "";
        let closed = false;
        while (i < source.length) {
          const c = source[i++];
          if (c === quote) {
            closed = true;
            break;
          }
          if (c === "\\") {
            const e = source[i++];
            const escapes = { n: "\n", r: "\r", t: "	", b: "\b", f: "\f", "/": "/", "\\": "\\", '"': '"', "'": "'" };
            if (e === "u") {
              const hex = source.slice(i, i + 4);
              if (!/^[\da-fA-F]{4}$/.test(hex)) throw new Error("Invalid Unicode escape");
              value += String.fromCharCode(parseInt(hex, 16));
              i += 4;
              continue;
            }
            if (!(e in escapes)) throw new Error("Invalid string escape");
            value += escapes[e];
          } else value += c;
        }
        if (!closed) throw new Error("Unclosed string");
        out.push({ kind: "string", value });
        continue;
      }
      const id = tail.match(/^[A-Za-z_$][\w$]*/);
      if (id) {
        out.push({ kind: "id", value: id[0] });
        i += id[0].length;
        continue;
      }
      const op = tail.match(/^(?:\?\?|&&|\|\||==|!=|<=|>=|=>|[+*/%<>()\[\]{},.:?!-])/);
      if (!op) throw new Error(`Unexpected token: ${tail.slice(0, 20)}`);
      out.push({ kind: "op", value: op[0] });
      i += op[0].length;
    }
    out.push({ kind: "eof", value: "" });
    return out;
  }
  function parseCoreExpression(source) {
    const tokens2 = tokenize(source);
    let pos = 0, depth = 0;
    const peek = () => tokens2[pos].value;
    const take = () => tokens2[pos++];
    const expect = (s) => {
      if (take().value !== s) throw new Error(`Expected ${s}`);
    };
    function expression(min = 0) {
      if (++depth > 128) throw new Error("Expression nesting exceeds 128");
      const t = take();
      let left;
      if (t.kind === "number") left = { kind: "literal", value: Number(t.value) };
      else if (t.kind === "string") left = { kind: "literal", value: t.value };
      else if (["true", "false", "null"].includes(t.value)) left = { kind: "literal", value: JSON.parse(t.value) };
      else if (["-", "+", "!", "not"].includes(t.value)) left = { kind: "unary", value: t.value, items: [expression(8)] };
      else if (t.value === "(") {
        left = expression();
        expect(")");
      } else if (t.value === "grid" && !["", ".", "["].includes(peek())) {
        const cols = expression(8);
        expect("x");
        const rows = expression(8);
        if (!["at", "from"].includes(take().value)) throw new Error("Expected at or from");
        expect("(");
        const x = expression();
        expect(",");
        const y = expression();
        expect(")");
        expect("step");
        expect("(");
        const dx = expression();
        expect(",");
        const dy = expression();
        expect(")");
        let overrides = { kind: "object", items: [] };
        if (peek() === "with") {
          take();
          overrides = expression(8);
        }
        left = { kind: "grid", items: [cols, rows, x, y, dx, dy, overrides] };
      } else if (t.value === "[") {
        const items = [];
        while (peek() !== "]") {
          items.push(expression());
          if (peek() !== ",") break;
          take();
        }
        expect("]");
        left = { kind: "array", items };
      } else if (t.value === "{") {
        const items = [];
        while (peek() !== "}") {
          const key2 = take();
          if (!["id", "string"].includes(key2.kind)) throw new Error("Invalid object key");
          let value;
          if (peek() === ":") {
            take();
            value = expression();
          } else if (key2.kind === "id" && [",", "}"].includes(peek())) value = { kind: "id", value: key2.value };
          else throw new Error("Expected : after object key");
          items.push([safeKey(key2.value), value]);
          if (peek() !== ",") break;
          take();
        }
        expect("}");
        left = { kind: "object", items };
      } else if (t.kind === "id") {
        if (peek() === "=>") {
          take();
          left = { kind: "lambda", value: t.value, items: [expression()] };
        } else left = { kind: "id", value: t.value };
      } else throw new Error(`Expected expression, got ${t.value || "end of input"}`);
      while (true) {
        if (peek() === ".") {
          take();
          const key2 = take();
          if (key2.kind !== "id") throw new Error("Expected member name");
          left = { kind: "member", items: [left, { kind: "literal", value: safeKey(key2.value) }] };
          continue;
        }
        if (peek() === "[") {
          take();
          if (peek() === "]") {
            take();
            const key2 = take();
            if (key2.kind !== "id") throw new Error("Expected lookup property after []");
            left = { kind: "lookup", value: safeKey(key2.value), items: [left] };
          } else {
            const key2 = expression();
            expect("]");
            left = { kind: "member", items: [left, key2] };
          }
          continue;
        }
        if (peek() === "(") {
          take();
          const args = [];
          while (peek() !== ")") {
            args.push(expression());
            if (peek() !== ",") break;
            take();
          }
          expect(")");
          left = { kind: "call", items: [left, ...args] };
          continue;
        }
        if (min <= 0 && ["with", "all"].includes(peek())) {
          take();
          left = { kind: "overlay", items: [left, expression(8)] };
          continue;
        }
        if (peek() === "*" && min <= 7 && left.kind === "object") {
          take();
          const count = expression(8);
          const props = [];
          let step = { kind: "literal", value: 0 };
          if (peek() === "inc") {
            take();
            const parens = peek() === "(";
            if (parens) take();
            do {
              const key2 = take();
              if (!["id", "string"].includes(key2.kind)) throw new Error("Expected increment property");
              props.push(safeKey(key2.value));
              if (peek() !== ",") break;
              take();
            } while (true);
            if (parens) expect(")");
            expect("by");
            step = expression(8);
          }
          let overrides = { kind: "object", items: [] };
          if (peek() === "with") {
            take();
            overrides = expression(8);
          }
          left = { kind: "generate", props, items: [left, count, step, overrides] };
          continue;
        }
        const op = peek(), rank = precedence[op];
        if (rank === void 0 || rank < min) break;
        take();
        left = { kind: "binary", value: op, items: [left, expression(rank + 1)] };
      }
      if (min === 0 && peek() === "?") {
        take();
        const yes = expression();
        expect(":");
        left = { kind: "ternary", items: [left, yes, expression()] };
      }
      depth--;
      return left;
    }
    const ast = expression();
    if (tokens2[pos].kind !== "eof") throw new Error(`Unexpected token: ${peek()}`);
    return ast;
  }
  function callName(e) {
    if (e.kind === "id") return e.value;
    if (e.kind === "member" && e.items[1].kind === "literal") {
      const parent = callName(e.items[0]);
      if (parent) return parent + "." + e.items[1].value;
    }
    return void 0;
  }
  function evaluateCoreExpression(e, scope, functions = coreFunctions) {
    const ev = (n) => evaluateCoreExpression(n, scope, functions);
    switch (e.kind) {
      case "literal":
        return e.value;
      case "id":
        return scope[e.value];
      case "array":
        return e.items.flatMap((item) => {
          const value = ev(item);
          return expandsCollection(item) && Array.isArray(value) ? value : [value];
        });
      case "object":
        return Object.fromEntries(e.items.map(([k, v]) => [k, ev(v)]));
      case "member":
        return ev(e.items[0])?.[safeKey(ev(e.items[1]))];
      case "lookup": {
        const source = ev(e.items[0]);
        if (scope[e.value] === void 0) return void 0;
        return Array.isArray(source) ? source.find((item) => String(item?.[e.value]) === String(scope[e.value])) : void 0;
      }
      case "overlay": {
        const [source, overrides] = e.items;
        const value = source.kind === "id" && !Object.prototype.hasOwnProperty.call(scope, source.value) ? scope[`${source.value}_batch`] : ev(source);
        return overlay(value, ev(overrides));
      }
      case "generate": {
        const count = collectionCount(ev(e.items[1]));
        const step = finiteNumber(ev(e.items[2]));
        return Array.from({ length: count }, (_, i) => {
          const local2 = { ...scope, i };
          const item = cloneData(evaluateCoreExpression(e.items[0], local2, functions));
          for (const prop of e.props) if (typeof item[prop] === "number") item[prop] += i * step;
          return overlay(item, evaluateCoreExpression(e.items[3], local2, functions));
        });
      }
      case "grid": {
        const [cols, rows] = e.items.slice(0, 2).map((item) => collectionCount(ev(item)));
        const count = collectionCount(cols * rows);
        const [x, y, dx, dy] = e.items.slice(2, 6).map((item) => finiteNumber(ev(item)));
        return Array.from({ length: count }, (_, i) => {
          const col = i % cols, row = Math.floor(i / cols);
          const item = { x: x + col * dx, y: y + row * dy, start_x: x + col * dx, start_y: y + row * dy, col, row };
          return overlay(item, evaluateCoreExpression(e.items[6], { ...scope, i, col, row, c: col, r: row }, functions));
        });
      }
      case "unary": {
        const v = ev(e.items[0]);
        return e.value === "-" ? -v : e.value === "+" ? +v : !v;
      }
      case "ternary":
        return ev(e.items[0]) ? ev(e.items[1]) : ev(e.items[2]);
      case "lambda":
        return (value) => evaluateCoreExpression(e.items[0], { ...scope, [e.value]: value }, functions);
      case "call": {
        const a = e.items[0];
        const name2 = callName(a);
        const args = e.items.slice(1).map(ev);
        if (name2 && Object.prototype.hasOwnProperty.call(functions, name2)) return functions[name2](...args);
        if (a.kind === "member") {
          const receiver = ev(a.items[0]), key2 = safeKey(ev(a.items[1]));
          const arrays = ["push", "pop", "join", "slice", "map", "filter", "find", "some", "every", "includes", "indexOf"];
          const strings = ["join", "slice", "includes", "indexOf", "split", "toLowerCase", "toUpperCase", "padStart"];
          if (Array.isArray(receiver) && arrays.includes(key2) || typeof receiver === "string" && strings.includes(key2)) {
            const result = receiver[key2](...args);
            if (key2 === "push" || key2 === "pop") entitiesChanged(receiver);
            return result;
          }
        }
        throw new Error(`Unknown function: ${name2 || "expression"}`);
      }
      case "binary": {
        const [a, b] = e.items;
        const x = ev(a);
        if (e.value === "??") return x === null || x === void 0 || x === "" ? ev(b) : x;
        if (["and", "&&"].includes(e.value)) return Boolean(x) && Boolean(ev(b));
        if (["or", "||"].includes(e.value)) return Boolean(x) || Boolean(ev(b));
        const y = ev(b);
        switch (e.value) {
          case "+":
            return x + y;
          case "-":
            return x - y;
          case "*":
            return x * y;
          case "/":
            return x / y;
          case "%":
            return x % y;
          case "==":
            return String(x) === String(y);
          case "!=":
            return String(x) !== String(y);
          case "<":
            return x < y;
          case ">":
            return x > y;
          case "<=":
            return x <= y;
          case ">=":
            return x >= y;
          case "contains":
            return String(x).toLowerCase().includes(String(y).toLowerCase());
        }
      }
    }
    throw new Error("Unknown expression");
  }
  function expandsCollection(e) {
    return e.kind === "generate" || e.kind === "grid" || e.kind === "overlay";
  }
  function collectionCount(value) {
    if (!Number.isInteger(value) || value < 0 || value > 1e6) throw new Error("Invalid generator count (0..1000000)");
    return value;
  }
  function finiteNumber(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Generator coordinates and steps must be finite numbers");
    return value;
  }
  function cloneData(value) {
    if (Array.isArray(value)) return value.map(cloneData);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [safeKey(k), cloneData(v)]));
    return value;
  }
  function overlay(source, overrides) {
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) throw new Error("with/all requires an object");
    const copy = (item) => item && typeof item === "object" && !Array.isArray(item) ? { ...cloneData(item), ...cloneData(overrides) } : item;
    if (Array.isArray(source)) return source.map(copy);
    if (!source || typeof source !== "object") throw new Error("with/all requires an object or array");
    return copy(source);
  }
  function compileCoreExpression(source) {
    try {
      let supported2 = function(e) {
        if (e.kind === "call" && !Object.prototype.hasOwnProperty.call(coreFunctions, callName(e.items[0]) || "")) {
          const callee = e.items[0];
          if (callee.kind !== "member" || callee.items[1].kind !== "literal") return false;
          const method = String(callee.items[1].value);
          if (!["join", "slice", "map", "filter", "find", "some", "every", "includes", "indexOf", "split", "toLowerCase", "toUpperCase", "padStart"].includes(method)) return false;
          if (["map", "filter", "find", "some", "every"].includes(method) && e.items[1]?.kind !== "lambda") return false;
        }
        if (e.kind === "object") return e.items.every(([, value]) => supported2(value));
        return !("items" in e) || e.items.every(supported2);
      };
      var supported = supported2;
      const ast = parseCoreExpression(source);
      if (!supported2(ast)) return null;
      return (scope) => evaluateCoreExpression(ast, scope);
    } catch {
      return null;
    }
  }

  // src/random.ts
  function seededRandom(seed) {
    if (!Number.isFinite(seed)) throw new Error("Random seed must be finite");
    let n = Math.trunc(seed) + 1831565813 | 0;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  }
  function randomInt(min, max, seed) {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) throw new Error("Invalid random integer range");
    return min + Math.floor((seed === void 0 ? Math.random() : seededRandom(seed)) * (max - min + 1));
  }
  function shuffled(values, seed) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = randomInt(0, i, seed + i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // src/globals.ts
  function getWindowProp(key2) {
    return window[key2];
  }
  function setWindowProp(key2, value) {
    window[key2] = value;
  }

  // src/utils.ts
  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function hostingPrefix() {
    if (typeof document === "undefined") return "";
    return (document.querySelector('meta[name="rune-base-path"]')?.getAttribute("content") || "").replace(/\/$/, "");
  }
  function hostedUrl(value) {
    const prefix = hostingPrefix();
    if (!prefix || !value.startsWith("/") || value.startsWith("//") || value === prefix || value.startsWith(prefix + "/")) return value;
    return prefix + value;
  }
  var operatorCache = /* @__PURE__ */ new Map();
  function includesTopLevel(input, delimiter) {
    const key2 = delimiter + "\0" + input;
    if (operatorCache.has(key2)) return operatorCache.get(key2);
    const result = scanTopLevel(input, delimiter);
    if (input.length <= 2048) {
      if (operatorCache.size >= 8192) operatorCache.delete(operatorCache.keys().next().value);
      operatorCache.set(key2, result);
    }
    return result;
  }
  function scanTopLevel(input, delimiter) {
    let depth = 0;
    let inQuotes = false;
    let quoteChar = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if ((ch === '"' || ch === "'") && input[i - 1] !== "\\") {
        if (inQuotes && ch === quoteChar) {
          inQuotes = false;
          quoteChar = "";
        } else if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        }
        continue;
      }
      if (!inQuotes) {
        if (ch === "(" || ch === "[" || ch === "{") depth += 1;
        if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
        if (depth === 0 && input.slice(i, i + delimiter.length) === delimiter) return true;
      }
    }
    return false;
  }
  function splitTopLevel(input, delimiter) {
    const parts = [];
    let current = "";
    let depth = 0;
    let inQuotes = false;
    let quoteChar = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if ((ch === '"' || ch === "'") && input[i - 1] !== "\\") {
        if (inQuotes && ch === quoteChar) {
          inQuotes = false;
          quoteChar = "";
        } else if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        }
        current += ch;
        continue;
      }
      if (!inQuotes) {
        if (ch === "[" || ch === "{" || ch === "(") depth += 1;
        if (ch === "]" || ch === "}" || ch === ")") depth -= 1;
        if (depth === 0 && input.slice(i, i + delimiter.length) === delimiter) {
          parts.push(current.trim());
          current = "";
          i += delimiter.length - 1;
          continue;
        }
      }
      current += ch;
    }
    if (current.trim().length > 0) {
      parts.push(current.trim());
    }
    return parts;
  }
  function normalizeLiteral(value) {
    const trimmed = String(value || "").trim();
    if (trimmed.length >= 2 && (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
  function valueToString(value) {
    if (value === null || value === void 0) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch (_err) {
      return "";
    }
  }
  function decodeEscapes(value) {
    const OPEN = "\uE000";
    const CLOSE = "\uE001";
    const input = String(value || "");
    let output = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (ch === "\\" && i + 1 < input.length) {
        i += 1;
        const next2 = input[i];
        if (next2 === "n") output += "\n";
        else if (next2 === "r") output += "\r";
        else if (next2 === "t") output += "	";
        else if (next2 === '"') output += '"';
        else if (next2 === "'") output += "'";
        else if (next2 === "\\") output += "\\";
        else if (next2 === "{") output += OPEN;
        else if (next2 === "}") output += CLOSE;
        else output += next2;
        continue;
      }
      output += ch;
    }
    return output;
  }
  function expandPercentI18n(value) {
    const input = String(value || "");
    let output = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (ch !== "%") {
        output += ch;
        continue;
      }
      let inner = "";
      let closed = false;
      for (i += 1; i < input.length; i += 1) {
        if (input[i] === "%") {
          closed = true;
          break;
        }
        inner += input[i];
      }
      if (closed && inner.startsWith("i18n.")) {
        output += `{${inner}}`;
      } else {
        output += `%${inner}`;
        if (closed) output += "%";
      }
    }
    return output;
  }

  // src/interpolation.ts
  function interpolate(template, scope) {
    const OPEN = "\uE000";
    const CLOSE = "\uE001";
    return expandPercentI18n(decodeEscapes(String(template || ""))).replace(/\{([^}]+)\}/g, function(_match, expr) {
      const path = expr.trim();
      const i18nValue = /^i18n(?:\.[A-Za-z0-9_$-]+)+$/.test(path) ? resolvePath(path, scope) : void 0;
      const resolved = valueToString(i18nValue === void 0 ? evaluateExpression(expr, scope) : i18nValue);
      return resolved.includes("{") && resolved.includes("}") ? interpolate(resolved, scope) : resolved;
    }).replace(new RegExp(OPEN, "g"), "{").replace(new RegExp(CLOSE, "g"), "}");
  }

  // src/navigator.ts
  var isNavigatingFromUrl = false;
  var lastKnownRoute = null;
  var pendingUrlUpdates = /* @__PURE__ */ new WeakSet();
  function readFragment() {
    const fragment = window.location.hash.slice(1);
    try {
      return decodeURIComponent(fragment);
    } catch {
      return fragment;
    }
  }
  function updateFragment(url, config, state) {
    if (config.fragment) {
      url.hash = encodeURIComponent(String(state[config.fragment] ?? ""));
    } else if (url.hash && !url.hash.startsWith("#/")) {
      url.hash = "";
    }
  }
  function readNavigatorUrl(config) {
    if (typeof window === "undefined" || !window.location) return null;
    const param = config.param || "page";
    const mode = config.mode || "auto";
    if (mode === "path" || mode === "auto") {
      try {
        const url = new URL(window.location.href);
        const prefix = hostingPrefix();
        const pathname = prefix && (url.pathname === prefix || url.pathname.startsWith(prefix + "/")) ? url.pathname.slice(prefix.length) : url.pathname;
        const cleanPath = pathname.replace(/^\/+|\/+$/g, "");
        const parts = cleanPath.split("/").filter(Boolean);
        if (parts[0] === "es" || parts[0] === "fr") parts.shift();
        if (parts.length > 0) {
          const route = decodeURIComponent(parts.join("/"));
          if (route && route !== "index.html") {
            return route;
          }
        }
      } catch (_err) {
      }
    }
    if (mode === "query" || mode === "auto" || mode === "path") {
      try {
        const url = new URL(window.location.href);
        const val = url.searchParams.get(param) || url.searchParams.get("p") || url.searchParams.get(config.bind);
        if (val && val.trim()) {
          return val.trim();
        }
      } catch (_err) {
      }
    }
    if (mode === "hash" || mode === "auto") {
      const rawHash = window.location.hash || "";
      if (rawHash) {
        let slug = "";
        if (rawHash.startsWith("#/")) {
          slug = rawHash.slice(2);
        } else if (rawHash.startsWith("#!/")) {
          slug = rawHash.slice(3);
        } else if (rawHash.startsWith("#!") || rawHash.startsWith("#?")) {
          slug = rawHash.slice(2);
        } else if (mode === "hash" && rawHash.startsWith("#") && rawHash !== "#app" && rawHash !== "#") {
          slug = rawHash.slice(1);
        }
        slug = decodeURIComponent(slug.trim());
        if (slug && slug !== "app") {
          return slug;
        }
      }
    }
    return null;
  }
  function setMetaTag(attr, key2, content) {
    if (typeof document === "undefined") return;
    let el = document.querySelector(`meta[${attr}="${key2}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key2);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }
  function updateSeoMetadata(route) {
    if (typeof document === "undefined") return;
    let context;
    try {
      context = ctx();
    } catch (_err) {
      return;
    }
    const seo = context.seo;
    if (!seo) return;
    const rawRoute = (route || "").trim();
    const cleanRoute = rawRoute.toLowerCase();
    const routeConfig = seo.routes?.[rawRoute] || seo.routes?.[cleanRoute] || seo.routes?.[cleanRoute.replace(/[-_]/g, "")];
    const rawTitle = routeConfig?.title || (cleanRoute && cleanRoute !== "home" ? `${rawRoute.charAt(0).toUpperCase() + rawRoute.slice(1)} \u2014 ${seo.title || "Vectrune"}` : seo.title);
    const rawDescription = routeConfig?.description || seo.description;
    const rawImage = routeConfig?.image || seo.image;
    const scope = { i18n: context.i18nData || {} };
    if (rawTitle) {
      const title = interpolate(rawTitle, scope);
      document.title = title;
      setMetaTag("property", "og:title", title);
      setMetaTag("name", "twitter:title", title);
    }
    if (rawDescription) {
      const description = interpolate(rawDescription, scope);
      setMetaTag("name", "description", description);
      setMetaTag("property", "og:description", description);
      setMetaTag("name", "twitter:description", description);
    }
    if (rawImage) {
      const image = hostedUrl(interpolate(rawImage, scope));
      setMetaTag("property", "og:image", image);
      setMetaTag("name", "twitter:image", image);
    }
    if (typeof window !== "undefined" && window.location) {
      setMetaTag("property", "og:url", window.location.href);
    }
  }
  function updateNavigatorUrl(route, replace = false) {
    if (typeof window === "undefined" || isNavigatingFromUrl) return;
    const context = ctx();
    const config = context.navigator;
    if (!config) {
      updateSeoMetadata(route);
      return;
    }
    const cleanRoute = String(route || "").trim();
    if (cleanRoute === lastKnownRoute) return;
    lastKnownRoute = cleanRoute;
    const mode = config.mode || "auto";
    const param = config.param || "page";
    if (mode === "hash") {
      const targetHash = cleanRoute ? "#/" + encodeURIComponent(cleanRoute) : "";
      if (window.location.hash !== targetHash) {
        if (replace) {
          window.location.replace(targetHash || "#/");
        } else {
          window.location.hash = targetHash || "#/";
        }
      }
      updateSeoMetadata(cleanRoute);
      return;
    }
    if (mode === "path") {
      try {
        const url = new URL(window.location.href);
        const base = hostingPrefix();
        const pathname = url.pathname.slice(base.length);
        let prefix = base;
        if (pathname.startsWith("/es/") || pathname === "/es") prefix += "/es";
        if (pathname.startsWith("/fr/") || pathname === "/fr") prefix += "/fr";
        let newPath = "";
        if (!cleanRoute || cleanRoute === "home") {
          newPath = prefix ? `${prefix}/` : "/";
        } else {
          newPath = prefix ? `${prefix}/${encodeURIComponent(cleanRoute)}` : `/${encodeURIComponent(cleanRoute)}`;
        }
        url.searchParams.delete(param);
        url.searchParams.delete("p");
        url.searchParams.delete(config.bind);
        updateFragment(url, config, context.app.state);
        const finalUrl = newPath + (url.search ? url.search : "") + (url.hash ? url.hash : "");
        const stateObj = { [config.bind]: cleanRoute };
        if (replace) {
          window.history.replaceState(stateObj, "", finalUrl);
        } else {
          window.history.pushState(stateObj, "", finalUrl);
        }
      } catch (_err) {
      }
      updateSeoMetadata(cleanRoute);
      return;
    }
    try {
      const url = new URL(window.location.href);
      if (!cleanRoute || cleanRoute === "home") {
        url.searchParams.delete(param);
      } else {
        url.searchParams.set(param, cleanRoute);
      }
      updateFragment(url, config, context.app.state);
      const newUrl = url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");
      const stateObj = { [config.bind]: cleanRoute };
      if (replace) {
        window.history.replaceState(stateObj, "", newUrl);
      } else {
        window.history.pushState(stateObj, "", newUrl);
      }
    } catch (_err) {
    }
    updateSeoMetadata(cleanRoute);
  }
  function handleNavigatorStateChange(prop, value) {
    if (isNavigatingFromUrl) return;
    const context = ctx();
    const config = context.navigator;
    if (!config) return;
    if (!config.fragment) {
      if (prop === config.bind) updateNavigatorUrl(String(value ?? ""));
      return;
    }
    const app = context.app;
    if (pendingUrlUpdates.has(app) || typeof window === "undefined") return;
    pendingUrlUpdates.add(app);
    queueMicrotask(() => {
      pendingUrlUpdates.delete(app);
      const route = String(app.state[config.bind] ?? "").trim();
      if (route !== lastKnownRoute) {
        withContext(context, () => updateNavigatorUrl(route));
        return;
      }
      const url = new URL(window.location.href);
      const previousHash = url.hash;
      updateFragment(url, config, app.state);
      if (url.hash !== previousHash) {
        window.history.pushState({ [config.bind]: route }, "", url.pathname + url.search + url.hash);
      }
    });
  }
  function setupNavigator(config, app) {
    if (typeof window === "undefined") return;
    const boundVar = config.bind;
    if (!boundVar) return;
    const fragmentVar = config.fragment;
    const initialUrlRoute = readNavigatorUrl(config);
    isNavigatingFromUrl = true;
    try {
      if (initialUrlRoute) app.state[boundVar] = initialUrlRoute;
      if (fragmentVar) app.state[fragmentVar] = readFragment();
    } finally {
      isNavigatingFromUrl = false;
    }
    lastKnownRoute = String(app.state[boundVar] || "home");
    updateSeoMetadata(lastKnownRoute);
    window.navigate = function(target) {
      if (typeof app.state[boundVar] !== "undefined") {
        app.state[boundVar] = target;
        if (app.render) app.render();
        updateSeoMetadata(target);
      }
    };
    function syncFromUrl(routeFallback) {
      const currentRoute = readNavigatorUrl(config) || routeFallback;
      const routeChanged = currentRoute !== null && currentRoute !== app.state[boundVar];
      const fragment = fragmentVar ? readFragment() : "";
      if (!routeChanged && (!fragmentVar || fragment === app.state[fragmentVar])) return;
      isNavigatingFromUrl = true;
      try {
        if (routeChanged) {
          lastKnownRoute = currentRoute;
          app.state[boundVar] = currentRoute;
          updateSeoMetadata(currentRoute);
        }
        if (fragmentVar) app.state[fragmentVar] = fragment;
        if (!fragmentVar && app.render) app.render();
      } finally {
        isNavigatingFromUrl = false;
      }
    }
    window.addEventListener("popstate", () => syncFromUrl("home"));
    window.addEventListener("hashchange", () => syncFromUrl(null));
  }

  // src/modular.ts
  function callableName(name2, kind) {
    const c = ctx();
    if (!c.logicOwner) return name2;
    const definitions2 = kind === "action" ? c.actionDefinitions : c.helperDefinitions;
    const qualified = `${c.logicOwner.replace(/^@/, "")}.${name2}`;
    return Object.prototype.hasOwnProperty.call(definitions2, qualified) ? qualified : name2;
  }
  function inLogicScope(name2, definition, receiver, run) {
    const c = ctx(), owner = definition.scope;
    if (c.logicOwner && !owner) throw new Error(`Scoped logic cannot call unscoped member: ${name2}`);
    if (definition.private && c.logicOwner !== owner) throw new Error(`Private Rune-Web member: ${name2}`);
    if (!owner && !c.logicState) return run();
    if (!owner) return withContext({ ...c, logicState: void 0, logicOwner: void 0 }, run);
    const state = owner.startsWith("@") ? receiver : c.app.state[owner];
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new Error(`Rune-Web ${name2} requires ${owner.startsWith("@") ? "an entity receiver" : "module state"}`);
    }
    return withContext({ ...c, logicState: state, logicOwner: owner }, run);
  }
  var moduleNames = /* @__PURE__ */ new WeakMap();
  var readonlyValues = /* @__PURE__ */ new WeakMap();
  function readonlyModuleValue(value, owner) {
    if (!value || typeof value !== "object") return value;
    let owners = readonlyValues.get(value);
    if (!owners) {
      owners = /* @__PURE__ */ new Map();
      readonlyValues.set(value, owners);
    }
    let wrapped = owners.get(owner);
    if (!wrapped) {
      const app = ctx().app;
      const guard = () => {
        const context = currentContext();
        if (context?.app !== app || context.logicOwner !== owner) throw new Error("Module state is read-only outside its actions");
      };
      wrapped = new Proxy(value, {
        get: (target, key2) => readonlyModuleValue(Reflect.get(target, key2), owner),
        set: (target, key2, next2) => {
          guard();
          return Reflect.set(target, key2, next2);
        },
        deleteProperty: (target, key2) => {
          guard();
          return Reflect.deleteProperty(target, key2);
        },
        defineProperty: (target, key2, property) => {
          guard();
          return Reflect.defineProperty(target, key2, property);
        },
        setPrototypeOf: (target, prototype) => {
          guard();
          return Reflect.setPrototypeOf(target, prototype);
        }
      });
      owners.set(owner, wrapped);
    }
    return wrapped;
  }
  function moduleStateNames() {
    const c = ctx();
    let names = moduleNames.get(c.actionDefinitions);
    if (!names) {
      names = new Set([...Object.values(c.actionDefinitions), ...Object.values(c.helperDefinitions)].map((def) => def.scope).filter((owner) => Boolean(owner && !owner.startsWith("@"))));
      moduleNames.set(c.actionDefinitions, names);
    }
    return names;
  }
  function moduleState(name2) {
    return moduleStateNames().has(name2);
  }

  // src/scope.ts
  function splitPathSegments(expr) {
    const str = String(expr || "").replace(/\[\]([a-zA-Z_$][\w$]*)/g, "[].(it.$1 == $1)");
    const segments = [];
    let current = "";
    let inBrackets = false;
    let inParens = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === "(") inParens++;
      if (ch === ")") inParens = Math.max(0, inParens - 1);
      if (inParens > 0 && !(ch === "(" && str.slice(i - 3, i + 1) === "[].(")) {
        current += ch;
        continue;
      }
      if (ch === "." && !inBrackets) {
        if (current.trim()) segments.push(current.trim());
        current = "";
        continue;
      }
      if (ch === "[") {
        if (str.slice(i, i + 4) === "[].(") {
          if (current.trim()) segments.push(current.trim());
          current = "[].(";
          i += 3;
          inParens++;
          continue;
        }
        if (current.trim()) segments.push(current.trim());
        current = "[";
        inBrackets = true;
        continue;
      }
      if (ch === "]") {
        if (inBrackets) {
          current += "]";
          segments.push(current.trim());
          current = "";
          inBrackets = false;
          continue;
        }
      }
      current += ch;
    }
    if (current.trim()) segments.push(current.trim());
    return segments;
  }
  var expressionNames = /* @__PURE__ */ new Map();
  var isolatedHelpers = /* @__PURE__ */ new WeakMap();
  function buildScope(locals, expression) {
    const c = ctx();
    if (c.logicState) return Object.assign({}, c.logicState, locals);
    let isolated = isolatedHelpers.get(c.helperDefinitions);
    if (isolated === void 0) {
      isolated = Object.values(c.helperDefinitions).every((def) => Boolean(def.scope || def.entity));
      isolatedHelpers.set(c.helperDefinitions, isolated);
    }
    if (c.compactScopes && expression !== void 0 && isolated) {
      let names = expressionNames.get(expression);
      if (!names) {
        const bindings = new Set(expression.match(/[A-Za-z_$][\w$]*/g) || []);
        names = [...bindings];
        if (bindings.has("with") || bindings.has("all")) {
          names = [.../* @__PURE__ */ new Set([...names, ...names.map((name2) => `${name2}_batch`)])];
        }
        if (expressionNames.size >= 4096) expressionNames.clear();
        expressionNames.set(expression, names);
      }
      const scope2 = {};
      for (const name2 of names) {
        for (const source of [locals, c.app.derived, c.app.state]) {
          if (source && Object.prototype.propertyIsEnumerable.call(source, name2)) {
            scope2[name2] = source === c.app.state && moduleState(name2) ? readonlyModuleValue(source[name2], name2) : source[name2];
            break;
          }
        }
      }
      return scope2;
    }
    const scope = Object.assign({}, c.app.state, c.app.derived, locals || {});
    for (const name2 of moduleStateNames()) {
      if (scope[name2] === c.app.state[name2]) scope[name2] = readonlyModuleValue(scope[name2], name2);
    }
    return scope;
  }
  var proxyCache = /* @__PURE__ */ new WeakMap();
  var renderQueued = false;
  function scheduleRender() {
    const context = ctx();
    if (context.isRendering || !context.app.render || renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      const currentCtx = ctx();
      if (!currentCtx.isRendering && currentCtx.app.render) {
        currentCtx.app.render();
      }
    });
  }
  function makeReactive(obj) {
    if (obj === null || typeof obj !== "object" || isOwnedValue(obj)) return obj;
    if (obj.__isProxy) return obj;
    const cached = proxyCache.get(obj);
    if (cached) return cached;
    const context = ctx();
    const proxy = new Proxy(obj, {
      get(target, prop) {
        if (prop === "__isProxy") return true;
        if (prop === "__raw") return target;
        if (getWindowProp("__renderingComponent") && typeof prop === "string" && !prop.startsWith("__")) {
          if (!(context.memorySubscriptions[prop] instanceof Set)) {
            context.memorySubscriptions[prop] = /* @__PURE__ */ new Set();
          }
          context.memorySubscriptions[prop].add(
            getWindowProp("__renderingComponent")
          );
        }
        const val = target[prop];
        if (val !== null && typeof val === "object" && !val.__isProxy) {
          return makeReactive(val);
        }
        return val;
      },
      set(target, prop, value) {
        const rawValue2 = value !== null && typeof value === "object" && value.__raw ? value.__raw : value;
        if (target[prop] === rawValue2) return true;
        target[prop] = rawValue2;
        const navigator2 = context.navigator;
        if (typeof prop === "string" && navigator2 && (prop === navigator2.bind || prop === navigator2.fragment)) {
          handleNavigatorStateChange(prop, rawValue2);
        }
        scheduleRender();
        return true;
      },
      deleteProperty(target, prop) {
        delete target[prop];
        scheduleRender();
        return true;
      }
    });
    registerReactive(proxy, obj);
    proxyCache.set(obj, proxy);
    return proxy;
  }

  // src/storage.ts
  var persistent = false;
  var native = () => globalThis;
  var memoryStorage = {};
  function browserStorage() {
    try {
      return typeof window !== "undefined" ? window.localStorage : null;
    } catch {
      return null;
    }
  }
  function getStorageItem(key2) {
    try {
      const store = browserStorage();
      const val = native().__runeStoreGet ? native().__runeStoreGet(key2) : store?.getItem(key2);
      persistent = !!native().__runeStoreGet || !!store;
      if (val != null) return val;
    } catch {
    }
    return Object.prototype.hasOwnProperty.call(memoryStorage, key2) ? memoryStorage[key2] : null;
  }
  function setStorageItem(key2, val) {
    memoryStorage[key2] = val;
    try {
      const store = browserStorage();
      if (native().__runeStoreSet) native().__runeStoreSet(key2, val);
      else store?.setItem(key2, val);
      persistent = !!native().__runeStoreSet || !!store;
    } catch {
      persistent = false;
    }
  }
  function removeStorageItem(key2) {
    delete memoryStorage[key2];
    try {
      if (native().__runeStoreRemove) native().__runeStoreRemove(key2);
      else browserStorage()?.removeItem(key2);
    } catch {
    }
  }
  function clearStorage() {
    for (const k of Object.keys(memoryStorage)) {
      delete memoryStorage[k];
    }
    try {
      browserStorage()?.clear();
    } catch {
    }
  }
  function hasStorageItem(key2) {
    return getStorageItem(key2) !== null;
  }

  // src/pixel3d/math.ts
  var ANGLE_UNITS = 4096;
  var DEG_TO_INDEX = ANGLE_UNITS / 360;
  var RAD_TO_INDEX = ANGLE_UNITS / (Math.PI * 2);
  var SIN_TABLE = new Float64Array(ANGLE_UNITS);
  var COS_TABLE = new Float64Array(ANGLE_UNITS);
  for (let i = 0; i < ANGLE_UNITS; i++) {
    const rad = i * 2 * Math.PI / ANGLE_UNITS;
    SIN_TABLE[i] = Math.sin(rad);
    COS_TABLE[i] = Math.cos(rad);
  }

  // src/pixel3d/spatial.ts
  var activeMap = null;
  function getActiveMap() {
    return activeMap || (typeof globalThis !== "undefined" ? globalThis.__RuneSpatialMap : null) || null;
  }
  function isWallAt(x, y, map = getActiveMap()) {
    const m = map || getActiveMap();
    if (!m) return false;
    const mx = Math.floor(x);
    const my = Math.floor(y);
    if (mx < 0 || mx >= m.width || my < 0 || my >= m.height) return true;
    const cell = m.grid[my * m.width + mx];
    if (cell === 0) return false;
    if (m.doors && m.doors[cell]) {
      return m.doors[cell].open < 0.8;
    }
    return true;
  }
  function collidesWithWall(x, y, radius, map) {
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.floor(y - radius);
    const maxY = Math.floor(y + radius);
    for (let my = minY; my <= maxY; my++) {
      for (let mx = minX; mx <= maxX; mx++) {
        if (mx < 0 || mx >= map.width || my < 0 || my >= map.height) {
          return true;
        }
        const cell = map.grid[my * map.width + mx];
        let isWall = cell !== 0;
        if (cell !== 0 && map.doors && map.doors[cell]) {
          isWall = map.doors[cell].open < 0.8;
        }
        if (isWall) {
          const cx = Math.max(mx, Math.min(mx + 1, x));
          const cy = Math.max(my, Math.min(my + 1, y));
          const distX = x - cx;
          const distY = y - cy;
          const r = radius - 1e-3;
          if (distX * distX + distY * distY < r * r) {
            return true;
          }
        }
      }
    }
    return false;
  }
  function slide(px, py, dx, dy, radius = 0.25, map = getActiveMap()) {
    if (Number.isNaN(px) || Number.isNaN(py) || Number.isNaN(dx) || Number.isNaN(dy)) {
      return { x: px, y: py };
    }
    const effectiveMap = map || getActiveMap();
    if (!effectiveMap) return { x: px + dx, y: py + dy };
    let newX = px;
    let newY = py;
    if (dx !== 0) {
      const tryX = px + dx;
      if (!collidesWithWall(tryX, py, radius, effectiveMap)) {
        newX = tryX;
      }
    }
    if (dy !== 0) {
      const tryY = py + dy;
      if (!collidesWithWall(newX, tryY, radius, effectiveMap)) {
        newY = tryY;
      } else if (newX !== px && !collidesWithWall(px, tryY, radius, effectiveMap)) {
        newY = tryY;
        newX = px;
      }
    }
    return { x: newX, y: newY };
  }
  function sees(ax, ay, bx, by, map = getActiveMap()) {
    const m = map || getActiveMap();
    if (!m) return true;
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-3) return true;
    const steps = Math.max(2, Math.ceil(dist * 8));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + dx * t;
      const y = ay + dy * t;
      if (isWallAt(x, y, m)) return false;
    }
    return true;
  }
  function mapSpawn(name2) {
    const map = globalThis.__RuneSpatialMaps?.[name2];
    if (!map?.spawn) throw new Error(`Map ${name2} has no spawn`);
    return { ...map.spawn };
  }

  // src/pixel3d/chunks.ts
  var MAX_WORLD_AXIS = 4096;
  var MAX_WORLD_DEPTH = 256;
  var MAX_RESIDENT_CHUNKS = 16384;
  var MAX_RENDER_MIRROR_CELLS = 131072;
  var ChunkStore = class {
    constructor(world, imported = {}) {
      this.world = world;
      this.raw = /* @__PURE__ */ new Map();
      this.populations = /* @__PURE__ */ new Map();
      this.revision = 0;
      this.proxies = /* @__PURE__ */ new Map();
      this.dimensions = [world.width, world.height, world.depth];
      this.cw = Math.ceil(world.width / 4);
      this.ch = Math.ceil(world.height / 4);
      this.cd = Math.ceil(world.depth / 4);
      this.occupied = this.cw * this.ch * this.cd <= 65536 ? new Uint8Array(this.cw * this.ch * this.cd) : /* @__PURE__ */ Object.create(null);
      this.materialCount = world.materials.length;
      this.publicChunks = new Proxy(/* @__PURE__ */ Object.create(null), {
        get: (_t, key2) => typeof key2 === "string" && /^\d+$/.test(key2) ? this.proxies.get(Number(key2)) : void 0,
        ownKeys: () => [...this.raw.keys()].map(String),
        getOwnPropertyDescriptor: (_t, key2) => this.raw.has(Number(key2)) ? { enumerable: true, configurable: true } : void 0,
        set: (_t, key2, value) => {
          this.replace(Number(key2), value);
          return true;
        },
        deleteProperty: (_t, key2) => {
          this.remove(Number(key2));
          return true;
        },
        defineProperty: () => {
          throw new Error("Chunk descriptors cannot be redefined");
        }
      });
      const volume = world.width * world.height * world.depth;
      const target = [];
      target.length = volume;
      this.cells = new Proxy(target, {
        get: (t, key2, receiver) => key2 === "length" ? volume : typeof key2 === "string" && /^\d+$/.test(key2) ? this.readFlat(Number(key2)) : Reflect.get(t, key2, receiver),
        set: (_t, key2, value) => {
          if (typeof key2 !== "string" || !/^\d+$/.test(key2)) throw new Error("Chunked cells have a fixed length; write a cell index");
          this.writeFlat(Number(key2), value);
          return true;
        },
        has: (t, key2) => typeof key2 === "string" && /^\d+$/.test(key2) ? Number(key2) < volume : Reflect.has(t, key2),
        deleteProperty: (_t, key2) => {
          this.writeFlat(Number(key2), 0);
          return true;
        },
        defineProperty: () => {
          throw new Error("Chunked cells cannot be redefined");
        }
      });
      const entries = Object.entries(imported);
      if (entries.length > MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
      for (const [key2, values] of entries) this.replace(Number(key2), values);
    }
    /** Bounded render accelerator; large worlds retain sparse lookup. */
    prepareRenderCells() {
      const volume = this.world.width * this.world.height * this.world.depth;
      if (this.renderCells || volume > MAX_RENDER_MIRROR_CELLS) return;
      this.renderCells = new Uint16Array(volume);
      for (const [id, values] of this.raw) this.mirror(id, values);
    }
    mirror(id, values) {
      if (!this.renderCells) return;
      const bx = id % this.cw * 4, by = Math.floor(id / this.cw) % this.ch * 4, bz = Math.floor(id / (this.cw * this.ch)) * 4;
      for (let i = 0; i < 64; i++) {
        const x = bx + (i & 3), y = by + (i >> 2 & 3), z = bz + (i >> 4);
        if (x < this.world.width && y < this.world.height && z < this.world.depth) this.renderCells[(z * this.world.height + y) * this.world.width + x] = values?.[i] ?? 0;
      }
    }
    id(value) {
      if (!Number.isInteger(value) || value < 0 || value >= this.cw * this.ch * this.cd) throw new Error("Invalid voxel chunk index");
    }
    block(value) {
      if (!Number.isInteger(value) || value < 0 || value > this.world.materials.length) throw new Error("Invalid voxel block ID");
    }
    cell(id, cell, value) {
      this.block(value);
      if (value && (id % this.cw * 4 + (cell & 3) >= this.world.width || Math.floor(id / this.cw) % this.ch * 4 + (cell >> 2 & 3) >= this.world.height || Math.floor(id / (this.cw * this.ch)) * 4 + (cell >> 4) >= this.world.depth)) throw new Error("Solid chunk cell outside world");
    }
    replace(id, values) {
      this.id(id);
      if (!Array.isArray(values) || values.length !== 64) throw new Error("Voxel chunks need exactly 64 block IDs");
      for (let cell = 0; cell < 64; cell++) this.cell(id, cell, values[cell]);
      const count = values.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0);
      if (!count) {
        this.remove(id);
        return;
      }
      if (!this.raw.has(id) && this.raw.size >= MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
      const raw = values.slice();
      this.raw.set(id, raw);
      this.populations.set(id, count);
      this.occupied[id] = 1;
      this.mirror(id, raw);
      this.proxies.set(id, new Proxy(raw, {
        get: (t, key2, receiver) => typeof key2 === "string" && /^\d+$/.test(key2) ? this.raw.get(id)?.[Number(key2)] ?? 0 : Reflect.get(t, key2, receiver),
        set: (_t, key2, value) => {
          if (typeof key2 !== "string" || !/^\d+$/.test(key2) || Number(key2) >= 64) throw new Error("Voxel chunks have fixed length");
          this.writeChunk(id, Number(key2), value);
          return true;
        },
        deleteProperty: (_t, key2) => {
          const cell = Number(key2);
          if (!Number.isInteger(cell) || cell < 0 || cell >= 64) throw new Error("Invalid chunk cell");
          this.writeChunk(id, cell, 0);
          return true;
        },
        defineProperty: () => {
          throw new Error("Chunk cells cannot be redefined");
        }
      }));
      this.revision++;
    }
    remove(id) {
      this.id(id);
      if (this.raw.delete(id)) {
        this.mirror(id);
        this.proxies.delete(id);
        this.populations.delete(id);
        if (this.occupied instanceof Uint8Array) this.occupied[id] = 0;
        else delete this.occupied[id];
        this.revision++;
      }
    }
    writeChunk(id, cell, value) {
      this.cell(id, cell, value);
      let raw = this.raw.get(id);
      if (!raw) {
        if (!value) return;
        this.replace(id, Array(64).fill(0).map((_, i) => i === cell ? value : 0));
        return;
      }
      const previous = raw[cell];
      if (previous === value) return;
      raw[cell] = value;
      if (this.renderCells) {
        const x = id % this.cw * 4 + (cell & 3), y = Math.floor(id / this.cw) % this.ch * 4 + (cell >> 2 & 3), z = Math.floor(id / (this.cw * this.ch)) * 4 + (cell >> 4);
        this.renderCells[(z * this.world.height + y) * this.world.width + x] = value;
      }
      const count = this.populations.get(id) + (value ? 1 : 0) - (previous ? 1 : 0);
      if (!count) this.remove(id);
      else {
        this.populations.set(id, count);
        this.revision++;
      }
    }
    /** Fill only intersecting chunks; preflight capacity before changing terrain. */
    fill(from, size, block) {
      const end = from.map((v, i) => v + size[i]), lo = from.map((v) => v >> 2), hi = end.map((v) => v - 1 >> 2);
      let ids;
      if (block === 0) ids = [...this.raw.keys()];
      else {
        if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
        ids = [];
        let count = this.raw.size;
        for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
          const id = (z * this.ch + y) * this.cw + x;
          ids.push(id);
          if (!this.raw.has(id) && ++count > MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
        }
      }
      for (const id of ids) {
        const bx = id % this.cw * 4, by = Math.floor(id / this.cw) % this.ch * 4, bz = Math.floor(id / (this.cw * this.ch)) * 4;
        for (let z = Math.max(from[2], bz); z < Math.min(end[2], bz + 4); z++)
          for (let y = Math.max(from[1], by); y < Math.min(end[1], by + 4); y++)
            for (let x = Math.max(from[0], bx); x < Math.min(end[0], bx + 4); x++) this.writeChunk(id, ((z & 3) * 4 + (y & 3)) * 4 + (x & 3), block);
      }
    }
    readFlat(i) {
      const { width, height, depth } = this.world;
      if (!Number.isInteger(i) || i < 0 || i >= width * height * depth) return void 0;
      const x = i % width, yz = Math.floor(i / width), y = yz % height, z = Math.floor(yz / height);
      return this.raw.get(((z >> 2) * this.ch + (y >> 2)) * this.cw + (x >> 2))?.[((z & 3) * 4 + (y & 3)) * 4 + (x & 3)] ?? 0;
    }
    writeFlat(i, value) {
      const { width, height, depth } = this.world;
      if (!Number.isInteger(i) || i < 0 || i >= width * height * depth) throw new Error("Voxel cell index outside world");
      const x = i % width, yz = Math.floor(i / width), y = yz % height, z = Math.floor(yz / height);
      this.writeChunk(((z >> 2) * this.ch + (y >> 2)) * this.cw + (x >> 2), ((z & 3) * 4 + (y & 3)) * 4 + (x & 3), value);
    }
    validate() {
      if (this.world.width !== this.dimensions[0] || this.world.height !== this.dimensions[1] || this.world.depth !== this.dimensions[2]) throw new Error("Recreate chunked worlds to resize them");
      if (this.materialCount !== this.world.materials.length) {
        for (const raw of this.raw.values()) for (const block of raw) this.block(block);
        this.materialCount = this.world.materials.length;
      }
      if (this.world.cells !== this.cells || this.world.chunks !== this.publicChunks) throw new Error("Use cell writes or recreate a chunked world to replace its storage");
    }
  };
  var stores = /* @__PURE__ */ new WeakMap();
  function chunkStore(world) {
    return stores.get(world) ?? stores.get(rawValue(world));
  }
  function ownChunks(world) {
    world = rawValue(world);
    let store = stores.get(world);
    if (store) return store;
    store = new ChunkStore(world, world.chunks);
    stores.set(world, store);
    ownValue(world);
    ownValue(store.publicChunks);
    ownValue(store.cells);
    world.chunks = store.publicChunks;
    Object.defineProperty(world, "cells", { value: store.cells, writable: true, configurable: true, enumerable: false });
    return store;
  }

  // src/pixel3d/voxel.ts
  var worldSnapshots = /* @__PURE__ */ new WeakMap();
  function inspectWorld(world) {
    let snapshot = worldSnapshots.get(world);
    const width = Math.ceil(world.width / 4), height = Math.ceil(world.height / 4);
    const length = width * height * Math.ceil(world.depth / 4);
    if (!snapshot || snapshot.width !== world.width || snapshot.height !== world.height || snapshot.depth !== world.depth) {
      snapshot = {
        width: world.width,
        height: world.height,
        depth: world.depth,
        materialCount: -1,
        cells: new Uint16Array(world.cells.length),
        populations: new Uint8Array(length),
        chunks: { width, height, depth: Math.ceil(world.depth / 4), occupied: new Uint8Array(length), count: 0 }
      };
      worldSnapshots.set(world, snapshot);
    }
    const { cells, populations, chunks } = snapshot, limit = world.materials.length;
    const validateAll = snapshot.materialCount !== limit;
    for (let i = 0; i < world.cells.length; i++) {
      const block = world.cells[i], previous = cells[i];
      if (block === previous && !validateAll) continue;
      if (!Number.isInteger(block) || block < 0 || block > limit) {
        worldSnapshots.delete(world);
        throw new Error("Voxel world needs material names and an exactly sized array of valid block IDs");
      }
      if (!!block !== !!previous) {
        const x = i % world.width, yz = Math.floor(i / world.width);
        const y = yz % world.height, z = Math.floor(yz / world.height);
        const chunk = ((z >> 2) * height + (y >> 2)) * width + (x >> 2);
        populations[chunk] += block ? 1 : -1;
        if (populations[chunk] === 1 && block) {
          chunks.occupied[chunk] = 1;
          chunks.count++;
        }
        if (populations[chunk] === 0 && !block) {
          chunks.occupied[chunk] = 0;
          chunks.count--;
        }
      }
      cells[i] = block;
    }
    snapshot.materialCount = limit;
    return chunks;
  }
  function integer(value, min, max, label) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${label} must be an integer from ${min} to ${max}`);
    }
    return value;
  }
  function validateWorld(value) {
    if (!value || typeof value !== "object") throw new Error("Voxel world must be an object");
    const world = rawValue(value);
    if (chunkStore(world) && world.storage !== "chunked") throw new Error("Chunked world storage cannot be changed");
    integer(world.width, 1, MAX_WORLD_AXIS, "Voxel width");
    integer(world.height, 1, MAX_WORLD_AXIS, "Voxel height");
    integer(world.depth, 1, world.storage === "chunked" ? MAX_WORLD_DEPTH : 24, "Voxel depth");
    if (world.renderDistance !== void 0 && (!Number.isFinite(world.renderDistance) || world.renderDistance <= 0 || world.renderDistance > 4096)) throw new Error("Voxel renderDistance must be in (0, 4096]");
    if (world.storage !== "chunked" && world.width * world.height * world.depth > 48 * 48 * 24) {
      throw new Error("Voxel world must contain at most 55296 cells");
    }
    if (!Array.isArray(world.materials) || world.materials.length < 1 || world.materials.length > 256 || !world.materials.every((name2) => typeof name2 === "string" && name2.length > 0)) {
      throw new Error("Voxel world needs material names and an exactly sized array of valid block IDs");
    }
    if (world.storage === "chunked") {
      if (world.width * world.height * world.depth > 2147483647) throw new Error("Chunked world exceeds logical cell limit");
      if (world.chunks !== void 0 && (!world.chunks || typeof world.chunks !== "object" || Array.isArray(world.chunks))) throw new Error("Chunked world chunks must be a record");
      (chunkStore(world) ?? ownChunks(world)).validate();
      return world;
    }
    if (world.storage !== void 0) throw new Error("Unknown voxel storage");
    if (!Array.isArray(world.cells) || world.cells.length !== world.width * world.height * world.depth) throw new Error("Voxel world needs material names and an exactly sized array of valid block IDs");
    inspectWorld(world);
    return world;
  }
  function voxelWorld(width, height, depth, materials, options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Voxel world options must be an object");
    const opts = options;
    if (Object.keys(opts).some((k) => !["seed", "biome", "spawn", "renderDistance"].includes(k))) throw new Error("Unknown voxel world option");
    const world = {
      width,
      height,
      depth,
      materials: Array.isArray(materials) ? materials.slice() : materials,
      seed: opts.seed ?? 0,
      biome: opts.biome ?? "meadow",
      spawn: opts.spawn ?? { x: 0.5, y: 0.5, z: 1, angle: 0, pitch: 0, vz: 0 },
      storage: "chunked",
      chunks: {},
      renderDistance: opts.renderDistance ?? 128
    };
    return validateWorld(world);
  }
  function index(world, x, y, z) {
    return (z * world.height + y) * world.width + x;
  }
  function voxelGet(world, x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= world.width || y >= world.height || z >= world.depth) return 0;
    const store = chunkStore(world);
    return store ? store.readFlat(index(world, x, y, z)) : world.cells[index(world, x, y, z)];
  }
  function voxelRead(worldValue, xValue, yValue, zValue) {
    const world = validateWorld(worldValue);
    const x = integer(xValue, 0, world.width - 1, "Voxel x");
    const y = integer(yValue, 0, world.height - 1, "Voxel y");
    const z = integer(zValue, 0, world.depth - 1, "Voxel z");
    return voxelGet(world, x, y, z);
  }
  function voxelFill(worldValue, fromValue, sizeValue, blockValue) {
    const world = validateWorld(worldValue);
    if (!Array.isArray(fromValue) || !Array.isArray(sizeValue) || fromValue.length !== 3 || sizeValue.length !== 3) {
      throw new Error("Voxel fill needs from and size arrays with three integers");
    }
    const limits = [world.width, world.height, world.depth];
    const from = fromValue.map((v, i) => integer(v, 0, limits[i] - 1, "Voxel fill origin"));
    const size = sizeValue.map((v, i) => integer(v, 1, limits[i] - from[i], "Voxel fill size"));
    const block = integer(blockValue, 0, world.materials.length, "Voxel fill block");
    const store = chunkStore(world);
    if (store) {
      store.fill(from, size, block);
      return world;
    }
    for (let z = from[2]; z < from[2] + size[2]; z++) for (let y = from[1]; y < from[1] + size[1]; y++) {
      for (let x = from[0]; x < from[0] + size[0]; x++) world.cells[index(world, x, y, z)] = block;
    }
    return world;
  }
  function noise(x, y, seed) {
    let hash = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ seed;
    hash = Math.imul(hash ^ hash >>> 13, 1274126177);
    return (hash >>> 0) / 4294967296;
  }
  function voxelGenerate(seedValue, biomeValue = "meadow") {
    const seed = integer(seedValue, 0, 4294967295, "Voxel seed");
    if (biomeValue !== "meadow" && biomeValue !== "ember") throw new Error("Voxel biome must be meadow or ember");
    const world = {
      width: 20,
      height: 20,
      depth: 10,
      seed,
      biome: biomeValue,
      materials: [
        "miners/bedrock",
        "miners/stone",
        biomeValue === "ember" ? "miners/ash" : "miners/grass",
        "miners/wood",
        "miners/copper",
        biomeValue === "ember" ? "miners/ember" : "miners/leaves"
      ],
      cells: Array(4e3).fill(0),
      spawn: { x: 4.5, y: 4.5, z: 3, angle: 0, pitch: 0, vz: 0 }
    };
    const set = (x, y, z, block) => {
      world.cells[index(world, x, y, z)] = block;
    };
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const camp = x < 9 && y < 9;
      const top = camp ? 3 : 3 + Math.floor(noise(Math.floor(x / 3), Math.floor(y / 3), seed + (biomeValue === "ember" ? 137 : 0)) * 3);
      for (let z = 0; z < top; z++) set(x, y, z, z === 0 ? 1 : z === top - 1 ? 3 : noise(x + z * 13, y, seed) > 0.87 ? 5 : 2);
      if (!camp && x > 1 && y > 1 && x < 18 && y < 18 && noise(x, y, seed + 1) > 0.94) {
        for (let z = top; z < top + 2; z++) set(x, y, z, 4);
        set(x, y, top + 2, 6);
      }
    }
    for (let x = 8; x < 19; x++) for (let y = 9; y <= 14; y++) {
      const floor = x < 10 ? 3 : x < 12 ? 2 : 1;
      for (let z = floor; z <= (x < 12 ? 8 : 3); z++) set(x, y, z, 0);
      if (x >= 12) set(x, y, 4, 2);
    }
    for (let x = 12; x < 19; x++) {
      set(x, 8, 2, noise(x, 8, seed) > 0.4 ? 5 : 2);
      set(x, 15, 2, noise(x, 15, seed) > 0.4 ? 5 : 2);
    }
    for (let y = 9; y <= 14; y++) for (let z = 1; z <= 4; z++) set(19, y, z, 2);
    for (let x = 3; x <= 5; x++) for (let y = 3; y <= 5; y++) set(x, y, 2, 1);
    for (const [x, y, z, block] of [
      [7, 4, 3, 4],
      [7, 4, 4, 4],
      [7, 5, 3, 4],
      [8, 6, 3, 2],
      [8, 6, 4, 2],
      [8, 7, 3, 2],
      [9, 6, 3, 5],
      [9, 7, 3, 5]
    ]) set(x, y, z, block);
    return world;
  }
  function chunkEntry(chunks, x, y, z, tx, ty, tz, dx, dy, dz, sx, sy, sz, maxDistance) {
    let ex = Number.isFinite(tx) ? tx + (sx > 0 ? 3 - (x & 3) : x & 3) * dx : Infinity;
    let ey = Number.isFinite(ty) ? ty + (sy > 0 ? 3 - (y & 3) : y & 3) * dy : Infinity;
    let ez = Number.isFinite(tz) ? tz + (sz > 0 ? 3 - (z & 3) : z & 3) * dz : Infinity;
    x >>= 2;
    y >>= 2;
    z >>= 2;
    const width = chunks.width, height = chunks.height, depth = chunks.depth;
    const stepX = dx * 4, stepY = dy * 4, stepZ = dz * 4;
    const exitX = sx > 0 ? width : -1, exitY = sy > 0 ? height : -1, exitZ = sz > 0 ? depth : -1;
    let cellIndex = (z * height + y) * width + x;
    let entry = 0;
    while (true) {
      if (chunks.occupied[cellIndex]) return entry;
      const axis = ex < ey && ex < ez ? 0 : ey < ez ? 1 : 2;
      const next2 = axis === 0 ? ex : axis === 1 ? ey : ez;
      if (!Number.isFinite(next2) || next2 > maxDistance) return Infinity;
      const tolerance = 1e-9 * Math.max(1, next2);
      if (axis === 0 ? ey - next2 <= tolerance || ez - next2 <= tolerance : axis === 1 ? ex - next2 <= tolerance || ez - next2 <= tolerance : ex - next2 <= tolerance || ey - next2 <= tolerance) return entry;
      entry = next2;
      if (axis === 0) {
        x += sx;
        ex += stepX;
        cellIndex += sx;
        if (x === exitX) return Infinity;
      } else if (axis === 1) {
        y += sy;
        ey += stepY;
        cellIndex += sy * width;
        if (y === exitY) return Infinity;
      } else {
        z += sz;
        ez += stepZ;
        cellIndex += sz * width * height;
        if (z === exitZ) return Infinity;
      }
    }
  }
  function voxelRay(world, origin, ray, maxDistance, output, chunks) {
    const store = chunkStore(world);
    return traceVoxelRay(
      world,
      store?.renderCells ?? world.cells,
      store?.renderCells ? void 0 : store,
      origin.x,
      origin.y,
      origin.z,
      ray[0],
      ray[1],
      ray[2],
      Math.abs(1 / ray[0]),
      Math.abs(1 / ray[1]),
      Math.abs(1 / ray[2]),
      maxDistance,
      output,
      chunks
    );
  }
  function traceVoxelRay(world, cells, store, ox, oy, oz, rx, ry, rz, dx, dy, dz, maxDistance, output, chunks, crossings, column = 0, row = 0, entryFace = 2) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const width = world.width, height = world.height, depth = world.depth;
    let lastChunk = -1, blocks;
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return null;
    const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1, sz = rz < 0 ? -1 : 1;
    const stepY = sy * width, stepZ = sz * width * height;
    let cellIndex = (z * height + y) * width + x;
    let tx = rx === 0 ? Infinity : (sx < 0 ? ox - x : x + 1 - ox) * dx;
    let ty = ry === 0 ? Infinity : (sy < 0 ? oy - y : y + 1 - oy) * dy;
    let tz = rz === 0 ? Infinity : (sz < 0 ? oz - z : z + 1 - oz) * dz;
    if (chunks && (rx !== 0 || ry !== 0 || rz !== 0)) {
      const entry = chunkEntry(chunks, x, y, z, tx, ty, tz, dx, dy, dz, sx, sy, sz, maxDistance);
      if (!Number.isFinite(entry)) return null;
      const beforeEntry = entry - 1e-9 * Math.max(1, entry);
      if (crossings) {
        if (tx < beforeEntry) {
          const offset = column * crossings.strideX;
          const count = crossingBefore(crossings.x, offset, crossings.strideX, beforeEntry, dx);
          x += sx * count;
          tx = crossings.x[offset + count];
        }
        if (ty < beforeEntry) {
          const offset = column * crossings.strideY;
          const count = crossingBefore(crossings.y, offset, crossings.strideY, beforeEntry, dy);
          y += sy * count;
          ty = crossings.y[offset + count];
        }
        if (tz < beforeEntry) {
          const offset = row * crossings.strideZ;
          const count = crossingBefore(crossings.z, offset, crossings.strideZ, beforeEntry, dz);
          z += sz * count;
          tz = crossings.z[offset + count];
        }
      } else {
        while (tx < beforeEntry) {
          x += sx;
          tx += dx;
        }
        while (ty < beforeEntry) {
          y += sy;
          ty += dy;
        }
        while (tz < beforeEntry) {
          z += sz;
          tz += dz;
        }
      }
      cellIndex = (z * height + y) * width + x;
    }
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return null;
    const exitX = sx > 0 ? width : -1, exitY = sy > 0 ? height : -1, exitZ = sz > 0 ? depth : -1;
    let distance = 0, face = entryFace;
    while (distance <= maxDistance) {
      let block;
      if (store) {
        const chunk = ((z >> 2) * store.ch + (y >> 2)) * store.cw + (x >> 2);
        if (chunk !== lastChunk) {
          blocks = store.raw.get(chunk);
          lastChunk = chunk;
        }
        block = blocks?.[((z & 3) * 4 + (y & 3)) * 4 + (x & 3)] ?? 0;
      } else block = cells[cellIndex];
      if (block) {
        if (!output) return { x, y, z, block, distance, face };
        output.x = x;
        output.y = y;
        output.z = z;
        output.block = block;
        output.distance = distance;
        output.face = face;
        return output;
      }
      if (tx < ty && tx < tz) {
        face = 0;
        distance = tx;
        tx += dx;
        x += sx;
        cellIndex += sx;
        if (x === exitX) break;
      } else if (ty < tz) {
        face = 1;
        distance = ty;
        ty += dy;
        y += sy;
        cellIndex += stepY;
        if (y === exitY) break;
      } else {
        face = 2;
        distance = tz;
        tz += dz;
        z += sz;
        cellIndex += stepZ;
        if (z === exitZ) break;
      }
    }
    return null;
  }
  var sideShade = Uint8Array.from({ length: 256 }, (_, channel) => Math.floor(channel * 0.8));
  var frontShade = Uint8Array.from({ length: 256 }, (_, channel) => Math.floor(channel * 0.65));
  function voxelTarget(worldValue, playerValue) {
    const world = validateWorld(worldValue), player = validatePlayer(playerValue, world);
    const a = player.angle * Math.PI / 180, p = player.pitch * Math.PI / 180;
    return voxelRay(
      world,
      { x: player.x, y: player.y, z: player.z + 1.25 },
      [Math.cos(a) * Math.cos(p), Math.sin(a) * Math.cos(p), Math.sin(p)],
      3
    );
  }
  function validatePlayer(value, world) {
    if (!value || typeof value !== "object") throw new Error("Voxel player must be an object");
    const player = value;
    if (![player.x, player.y, player.z, player.angle, player.pitch, player.vz].every(Number.isFinite)) {
      throw new Error("Voxel player needs finite x, y, z, angle, pitch and vz");
    }
    if (player.x < 0.25 || player.y < 0.25 || player.x > world.width - 0.25 || player.y > world.height - 0.25 || player.z < 1 || player.z + 1.6 > world.depth || Math.abs(player.vz) > 1 || Math.abs(player.pitch) > 90) {
      throw new Error("Voxel player must be inside movement bounds, with pitch within 90 degrees and vz within 1");
    }
    return player;
  }
  function voxelMine(worldValue, playerValue) {
    const world = validateWorld(worldValue);
    const hit = voxelTarget(world, playerValue);
    if (!hit || hit.block === 1) return { block: 0, hit };
    world.cells[index(world, hit.x, hit.y, hit.z)] = 0;
    return { block: hit.block, hit };
  }
  function clearBody(world, x, y, z) {
    if (x < 0.25 || y < 0.25 || x > world.width - 0.25 || y > world.height - 0.25 || z < 1 || z + 1.6 > world.depth) return false;
    for (const dx of [-0.24, 0.24]) for (const dy of [-0.24, 0.24]) {
      for (let bz = Math.floor(z + 1e-3); bz <= Math.floor(z + 1.599); bz++) {
        if (voxelGet(world, Math.floor(x + dx), Math.floor(y + dy), bz)) return false;
      }
    }
    return true;
  }
  function voxelMove(worldValue, playerValue, dxValue, dyValue, jumpValue = false, movementValue = {}) {
    const world = validateWorld(worldValue), p = { ...validatePlayer(playerValue, world) };
    if (!movementValue || typeof movementValue !== "object" || Array.isArray(movementValue) || Object.keys(movementValue).some((key2) => !["jumpSpeed", "gravity", "autoStep"].includes(key2))) {
      throw new Error("Voxel movement options accept jumpSpeed, gravity and autoStep");
    }
    const { jumpSpeed = 0.28, gravity = 0.035, autoStep = true } = movementValue;
    if (!Number.isFinite(jumpSpeed) || jumpSpeed <= 0 || jumpSpeed > 1 || !Number.isFinite(gravity) || gravity <= 0 || gravity > 0.3 || typeof autoStep !== "boolean") {
      throw new Error("Voxel movement needs jumpSpeed in (0, 1], gravity in (0, 0.3] and boolean autoStep");
    }
    if (typeof dxValue !== "number" || typeof dyValue !== "number" || !Number.isFinite(dxValue) || !Number.isFinite(dyValue) || Math.hypot(dxValue, dyValue) > 1 || typeof jumpValue !== "boolean") {
      throw new Error("Voxel movement needs finite deltas of at most one tile and a boolean jump");
    }
    const grounded = !clearBody(world, p.x, p.y, p.z - 0.05);
    if (jumpValue && grounded) p.vz = jumpSpeed;
    p.vz = Math.max(-0.3, p.vz - gravity);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dxValue), Math.abs(dyValue), Math.abs(p.vz)) / 0.05));
    for (let i = 0; i < steps; i++) {
      for (const [axis, delta] of [["x", dxValue / steps], ["y", dyValue / steps]]) {
        const x = p.x + (axis === "x" ? delta : 0), y = p.y + (axis === "y" ? delta : 0);
        if (clearBody(world, x, y, p.z)) p[axis] += delta;
        else if (autoStep && grounded && delta !== 0 && clearBody(world, x, y, Math.floor(p.z) + 1)) {
          p.z = Math.floor(p.z) + 1;
          p[axis] += delta;
          p.vz = 0;
        }
      }
      if (clearBody(world, p.x, p.y, p.z + p.vz / steps)) p.z += p.vz / steps;
      else {
        if (p.vz < 0) p.z = Math.round(p.z);
        p.vz = 0;
      }
    }
    return p;
  }
  function crossingBefore(values, offset, stride, before, delta) {
    let count = Math.max(0, Math.min(stride - 1, Math.ceil((before - values[offset]) / delta)));
    while (count < stride - 1 && values[offset + count] < before) count++;
    while (count > 0 && values[offset + count - 1] >= before) count--;
    return count;
  }

  // src/pixel3d/sidemap.ts
  function getSideMap(name2) {
    const maps = globalThis.__RuneSideMaps;
    const map = maps?.[name2];
    if (!map) throw new Error(`Unknown @SideMap/${name2}`);
    return map;
  }
  function sideLevel(fgNameValue, bgNameValue, optionsValue) {
    if (typeof fgNameValue !== "string" || !fgNameValue) {
      throw new Error("side_level requires a foreground @SideMap name");
    }
    const fg = getSideMap(fgNameValue);
    const bg = typeof bgNameValue === "string" && bgNameValue.length > 0 ? getSideMap(bgNameValue) : void 0;
    const opts = optionsValue && typeof optionsValue === "object" && !Array.isArray(optionsValue) ? optionsValue : {};
    const width = fg.width;
    const height = fg.height;
    const planeY = opts.plane_y ?? fg.planeY ?? 7;
    const depthY = opts.depth_y ?? fg.depthY ?? 20;
    const marginZ = opts.margin_z ?? 4;
    const materials = opts.materials ?? fg.materials;
    if (!Array.isArray(materials) || materials.length === 0) {
      throw new Error(`@SideMap/${fgNameValue} needs materials = [...]`);
    }
    for (const [symbol, entry] of Object.entries(fg.legend)) {
      const center = entry?.center_voxel;
      if (center === void 0) continue;
      if (!Number.isInteger(center) || center < 1 || center > materials.length || !(entry.voxel && entry.voxel > 0) || (entry.depth?.[1] ?? 4) < 2 || entry.boss_door || entry.barrier || entry.hazard) {
        throw new Error(`@SideMap/${fgNameValue} legend ${symbol}: center_voxel needs a valid material and a solid span of at least two tiles`);
      }
    }
    let spawn = { x: 4.5, y: planeY, z: 3, angle: 0, pitch: 0, vz: 0 };
    const world = voxelWorld(width, depthY, height + marginZ, materials, {
      seed: opts.seed ?? 701,
      biome: opts.biome ?? "meadow",
      spawn,
      renderDistance: opts.render_distance ?? 128
    });
    const sceneryRaw = [];
    const entities = [];
    const barriers = [];
    const hazards = [];
    const ladders = [];
    const bossDoors = [];
    const checkpoints = [];
    const pickups = [];
    let boss = null;
    for (let row = 0; row < height; row++) {
      const z = height - 1 - row;
      const line = fg.rows[row];
      let runVoxel = 0;
      let runCenter = 0;
      let runY0 = 0;
      let runYSpan = 0;
      let runStart = 0;
      const flushRun = (endX) => {
        if (runVoxel > 0 && endX > runStart) {
          voxelFill(world, [runStart, runY0, z], [endX - runStart, runYSpan, 1], runVoxel);
          if (runCenter) {
            const centerY = runY0 + Math.floor((runYSpan - 2) / 2);
            voxelFill(world, [runStart, centerY, z], [endX - runStart, 2, 1], runCenter);
          }
        }
        runVoxel = 0;
      };
      for (let x = 0; x < width; x++) {
        const ch = line[x];
        const entry = fg.legend[ch];
        if (!entry) {
          flushRun(x);
          continue;
        }
        if (entry.voxel && entry.voxel > 0 && !entry.boss_door) {
          const y0 = entry.depth ? entry.depth[0] : Math.max(0, Math.floor(planeY) - 2);
          const ySpan = entry.depth ? entry.depth[1] : 4;
          const center = entry.center_voxel ?? 0;
          if (runVoxel === entry.voxel && runY0 === y0 && runYSpan === ySpan && runCenter === center) {
          } else {
            flushRun(x);
            runVoxel = entry.voxel;
            runCenter = center;
            runY0 = y0;
            runYSpan = ySpan;
            runStart = x;
          }
        } else {
          flushRun(x);
        }
        if (entry.spawn) {
          spawn = { x: x + 0.5, y: planeY, z, angle: 0, pitch: 0, vz: 0 };
          world.spawn = spawn;
        }
        if (entry.barrier) {
          const y0 = entry.depth ? entry.depth[0] : Math.max(0, Math.floor(planeY) - 2);
          const ySpan = entry.depth ? entry.depth[1] : 4;
          barriers.push({
            x,
            z,
            y_start: y0,
            y_span: ySpan,
            kind: entry.barrier,
            voxel: entry.voxel ?? 0,
            open: false,
            model: entry.model ?? "",
            tag: entry.tag ?? entry.barrier
          });
        }
        if (entry.hazard) {
          hazards.push({
            x,
            z,
            kind: entry.hazard,
            frozen: false,
            model: entry.model ?? ""
          });
        }
        if (entry.ladder) {
          ladders.push({
            x: x + 0.5,
            y: entry.y ?? planeY,
            z
          });
          if (entry.model) {
            sceneryRaw.push({
              x: x + 0.5,
              y: entry.y ?? planeY,
              z: z + (entry.zOffset ?? 0),
              model: entry.model,
              scale: entry.scale ?? 1,
              angle: entry.angle ?? 0
            });
          }
        }
        if (entry.boss_door) {
          const y0 = entry.depth ? entry.depth[0] : Math.max(0, Math.floor(planeY) - 2);
          const ySpan = entry.depth ? entry.depth[1] : 4;
          bossDoors.push({
            x,
            z,
            y_start: y0,
            y_span: ySpan,
            voxel: entry.voxel ?? 4
          });
          if (entry.model) {
            sceneryRaw.push({
              x: x + 0.5,
              y: entry.y ?? planeY,
              z: z + (entry.zOffset ?? 0),
              model: entry.model,
              scale: entry.scale ?? 1,
              angle: entry.angle ?? 0
            });
          }
        }
        if (entry.checkpoint) {
          checkpoints.push({
            x: x + 0.5,
            y: entry.y ?? planeY,
            z: z + (entry.zOffset ?? 0),
            active: false,
            model: entry.model ?? ""
          });
        }
        if (entry.pickup) {
          pickups.push({
            x: x + 0.5,
            y: entry.y ?? planeY,
            z: z + (entry.zOffset ?? 0.35),
            base: z + (entry.zOffset ?? 0.35),
            kind: entry.pickup,
            model: entry.model ?? "",
            visible: true
          });
        }
        if (entry.entity) {
          const item = {
            x: x + 0.5,
            y: entry.y ?? planeY,
            z: z + (entry.zOffset ?? 0),
            home_x: x + 0.5,
            home_z: z + (entry.zOffset ?? 0),
            kind: entry.entity,
            model: entry.model ?? "",
            hp: entry.hp ?? 3,
            max_hp: entry.hp ?? 3,
            dir: -1,
            cd: 20,
            alive: true,
            visible: true
          };
          if (entry.role === "boss" || entry.entity === "boss") {
            boss = item;
          } else {
            entities.push(item);
          }
        } else if (entry.model && !entry.barrier && !entry.hazard && !entry.ladder && !entry.boss_door && !entry.checkpoint && !entry.pickup) {
          sceneryRaw.push({
            x: x + 0.5,
            y: entry.y ?? planeY,
            z: z + (entry.zOffset ?? 0),
            model: entry.model,
            scale: entry.scale ?? 1,
            angle: entry.angle ?? 0
          });
        }
      }
      flushRun(width);
    }
    if (bg) {
      const xScale = width / Math.max(1, bg.width);
      for (let row = 0; row < bg.height; row++) {
        const z = bg.height - 1 - row;
        const line = bg.rows[row];
        for (let bx = 0; bx < bg.width; bx++) {
          const ch = line[bx];
          const entry = bg.legend[ch];
          if (!entry) continue;
          const wx = Math.floor(bx * xScale);
          if (entry.voxel && entry.voxel > 0 && !entry.boss_door) {
            const y0 = entry.depth ? entry.depth[0] : 0;
            const ySpan = entry.depth ? entry.depth[1] : 2;
            if (wx >= 0 && wx < width && z >= 0 && z < height + marginZ) {
              voxelFill(world, [wx, y0, z], [Math.max(1, Math.min(width - wx, Math.round(xScale))), ySpan, 1], entry.voxel);
            }
          }
          if (entry.model) {
            sceneryRaw.push({
              x: (bx + 0.5) * xScale,
              y: entry.y ?? bg.planeY ?? 2.5,
              z: z + (entry.zOffset ?? 0),
              model: entry.model,
              scale: entry.scale ?? 1,
              angle: entry.angle ?? 0
            });
          }
        }
      }
    }
    return {
      world,
      width,
      height,
      plane_y: planeY,
      spawn,
      scenery: entityGroup(sceneryRaw),
      entities,
      barriers,
      hazards,
      ladders,
      boss_doors: bossDoors,
      checkpoints,
      pickups,
      boss
    };
  }

  // src/expression.ts
  var MAX_DEPTH = 64;
  var voxelFunctions = {
    voxel_world: (width, height, depth, materials, options) => voxelWorld(width, height, depth, materials, options),
    side_level: (fg, bg, options) => sideLevel(fg, bg, options),
    nearby: (entities, position2, radius) => nearby(entities, position2, radius),
    entity_group: (entities) => entityGroup(entities),
    voxel_generate: (seed, biome) => voxelGenerate(seed, biome),
    voxel_move: (world, player, dx, dy, jump, movement) => voxelMove(world, player, dx, dy, jump, movement),
    voxel_target: (world, player) => voxelTarget(world, player),
    voxel_mine: (world, player) => voxelMine(world, player),
    voxel_get: (world, x, y, z) => voxelRead(world, x, y, z),
    voxel_fill: (world, from, size, block) => voxelFill(world, from, size, block)
  };
  var voxelArity = {
    voxel_world: [4, 5],
    side_level: [1, 3],
    nearby: [3, 3],
    entity_group: [0, 1],
    voxel_generate: [1, 2],
    voxel_move: [4, 6],
    voxel_target: [2, 2],
    voxel_mine: [2, 2],
    voxel_get: [4, 4],
    voxel_fill: [4, 4]
  };
  function tryParseLiteral(expr, scope) {
    const trimmed = String(expr || "").trim();
    if (trimmed === "") return void 0;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (!Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed))
      return Number(trimmed);
    if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
      if (trimmed.startsWith('"')) {
        try {
          return JSON.parse(trimmed);
        } catch (_) {
        }
      }
      return normalizeLiteral(trimmed);
    }
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const keys = scope ? Object.keys(scope).filter(
          (k) => k !== "this" && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(k)
        ) : [];
        const vals = keys.map((k) => scope[k]);
        return new Function(...keys, `return (${trimmed});`)(...vals);
      } catch (_err) {
        return void 0;
      }
    }
    return void 0;
  }
  function resolvePath(expr, scope) {
    const segments = splitPathSegments(expr);
    if (!segments.length) return void 0;
    let current = scope[segments[0]];
    if (current === void 0) return void 0;
    for (let i = 1; i < segments.length; i += 1) {
      const segment = segments[i];
      if (current === null || current === void 0) return void 0;
      if (Array.isArray(current) && segment === "length") {
        current = current.length;
      } else if (Array.isArray(current) && segment.startsWith("[].(") && segment.endsWith(")")) {
        const condition = segment.slice(4, -1);
        const match = current.find((item) => {
          const innerScope = Object.assign({}, scope, { it: item });
          return Boolean(evaluateExpression(condition, innerScope, 0));
        });
        if (match !== void 0) current = match;
        else return void 0;
      } else if (segment.startsWith("[") && segment.endsWith("]")) {
        const innerExpr = segment.slice(1, -1);
        const lookup = evaluateExpression(innerExpr, scope, 0);
        current = current[valueToString(lookup)];
      } else {
        current = current[segment];
      }
    }
    return current;
  }
  function resolveValue(expr, scope) {
    const literal = tryParseLiteral(expr, scope);
    if (literal !== void 0) return literal;
    const pathValue = resolvePath(expr, scope);
    if (pathValue !== void 0) return pathValue;
    if (expr.includes(".") || expr.includes("[")) return void 0;
    return normalizeLiteral(expr);
  }
  var entityConstructionDepth = 0;
  function parseHelperCall(expr) {
    const trimmed = String(expr || "").trim();
    if (!trimmed) return null;
    const context = currentContext();
    if (!context) return null;
    const { helperDefinitions } = context;
    const parenMatch = trimmed.match(/^([A-Za-z_][\w.-]*)\((.*)?\)$/);
    if (parenMatch && helperDefinitions[callableName(parenMatch[1], "helper")]) {
      return {
        name: callableName(parenMatch[1], "helper"),
        args: parenMatch[2] ? splitTopLevel(parenMatch[2], ",") : []
      };
    }
    const firstSpace = trimmed.indexOf(" ");
    if (firstSpace > 0) {
      const name2 = trimmed.slice(0, firstSpace);
      if (helperDefinitions[callableName(name2, "helper")]) {
        return {
          name: callableName(name2, "helper"),
          args: trimmed.slice(firstSpace + 1).split(/\s+/).filter(Boolean)
        };
      }
    }
    if (helperDefinitions[callableName(trimmed, "helper")]) {
      return { name: callableName(trimmed, "helper"), args: [] };
    }
    return null;
  }
  function callHelper(name2, args, scope, depth) {
    const { helperDefinitions } = ctx();
    const helper = helperDefinitions[name2];
    if (!helper) return void 0;
    if (helper.entity) {
      if (args.length > 2) throw new Error(`${name2} accepts id and optional fields`);
      if (typeof args[0] !== "string" || !args[0]) throw new Error(`${name2} requires a nonempty stable string id`);
      const fields = args[1] === void 0 ? {} : args[1];
      if (!fields || typeof fields !== "object" || Array.isArray(fields)) throw new Error(`${name2} fields must be a record`);
      for (const key2 of Object.keys(fields)) {
        if (!Object.prototype.hasOwnProperty.call(helper.entity, key2)) throw new Error(`Unknown ${name2} field: ${key2}`);
      }
      if (entityConstructionDepth >= MAX_DEPTH) throw new Error(`Entity composition is too deep or cyclic: ${name2}`);
      entityConstructionDepth++;
      try {
        const value = { id: args[0], __type: name2 };
        for (const [key2, expression] of Object.entries(helper.entity)) {
          value[key2] = Object.prototype.hasOwnProperty.call(fields, key2) ? Reflect.get(fields, key2) : evaluateExpression(expression, { id: args[0] }, depth + 1);
        }
        return value;
      } finally {
        entityConstructionDepth--;
      }
    }
    const helperLocals = helper.scope ? {} : Object.assign({}, scope);
    (helper.params || []).forEach((param, index2) => {
      helperLocals[param] = args[index2];
    });
    const result = inLogicScope(name2, helper, void 0, () => {
      for (const line of helper.body || []) {
        const trimmed = String(line || "").trim();
        if (trimmed.startsWith("return ")) {
          return evaluateExpression(
            trimmed.slice(7),
            buildScope(helperLocals),
            depth
          );
        }
      }
      return void 0;
    });
    return helper.scope && ctx().logicOwner !== helper.scope ? readonlyModuleValue(result, helper.scope) : result;
  }
  var exprCache = /* @__PURE__ */ new Map();
  var helperContextIds = /* @__PURE__ */ new WeakMap();
  var nextHelperContextId = 1;
  var MAX_CACHE_SIZE = 8192;
  function compilePath(expr) {
    const segments = splitPathSegments(expr);
    if (!segments.length) return () => void 0;
    if (segments.length === 1 && !segments[0].includes("[")) {
      const key2 = segments[0];
      return (scope) => scope?.[key2];
    }
    if (segments.length === 2 && !segments[0].includes("[") && !segments[1].includes("[")) {
      const k0 = segments[0];
      const k1 = segments[1];
      if (k1 === "length") {
        return (scope) => {
          const obj = scope?.[k0];
          return Array.isArray(obj) ? obj.length : obj?.length;
        };
      }
      return (scope) => {
        const obj = scope?.[k0];
        return obj?.[k1];
      };
    }
    if (segments.length === 3 && !segments[0].includes("[") && !segments[1].includes("[") && !segments[2].includes("[")) {
      const k0 = segments[0];
      const k1 = segments[1];
      const k2 = segments[2];
      if (k2 === "length") {
        return (scope) => {
          const o0 = scope?.[k0];
          const obj = o0?.[k1];
          return Array.isArray(obj) ? obj.length : obj?.length;
        };
      }
      return (scope) => {
        const o0 = scope?.[k0];
        const o1 = o0?.[k1];
        return o1?.[k2];
      };
    }
    const compiledSteps = segments.map((segment) => {
      if (segment === "length") {
        return (current) => Array.isArray(current) ? current.length : current?.length;
      }
      if (segment.startsWith("[].(") && segment.endsWith(")")) {
        const cond = compileExpression(segment.slice(4, -1));
        return (current, scope) => {
          if (!Array.isArray(current)) return void 0;
          return current.find((item) => {
            const innerScope = Object.assign({}, scope, { it: item });
            return Boolean(cond(innerScope));
          });
        };
      }
      if (segment.startsWith("[") && segment.endsWith("]")) {
        const inner = compileExpression(segment.slice(1, -1));
        return (current, scope) => {
          if (current === null || current === void 0) return void 0;
          const lookup = inner(scope);
          return current[valueToString(lookup)];
        };
      }
      return (current) => {
        if (current === null || current === void 0) return void 0;
        return current[segment];
      };
    });
    return (scope) => {
      let current = scope;
      for (let i = 0; i < compiledSteps.length; i++) {
        if (current === null || current === void 0) return void 0;
        current = compiledSteps[i](current, scope);
      }
      return current;
    };
  }
  function compileResolveValue(expr) {
    const trimmed = expr.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      return (scope) => resolveValue(trimmed, scope);
    }
    const literal = tryParseLiteral(trimmed);
    if (literal !== void 0) {
      return () => literal;
    }
    if (trimmed.includes(".") || trimmed.includes("[")) {
      const pathFn = compilePath(trimmed);
      return (scope) => pathFn(scope);
    }
    const fallback = normalizeLiteral(trimmed);
    return (scope) => {
      if (scope && scope[trimmed] !== void 0) {
        return scope[trimmed];
      }
      return fallback;
    };
  }
  function compileExpression(expr, depth = 0) {
    if (depth > MAX_DEPTH) return () => void 0;
    const nextDepth = depth + 1;
    let trimmed = String(expr || "").trim();
    if (!trimmed) return () => void 0;
    if (trimmed === "true") return () => true;
    if (trimmed === "false") return () => false;
    if (trimmed === "null") return () => null;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed);
      return () => n;
    }
    if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*$/.test(trimmed)) {
      const pathFn = compilePath(trimmed);
      if (!trimmed.includes(".") && !trimmed.includes("[")) {
        const fallback = normalizeLiteral(trimmed);
        return (scope) => {
          const val = pathFn(scope);
          return val !== void 0 ? val : fallback;
        };
      }
      return (scope) => pathFn(scope);
    }
    const core = compileCoreExpression(trimmed);
    if (core) return core;
    if (trimmed.startsWith('"')) {
      try {
        const literal = JSON.parse(trimmed);
        if (typeof literal === "string") return () => literal;
      } catch (_) {
      }
    }
    if (trimmed.startsWith("@")) {
      let selector = "";
      let rest = "";
      if (trimmed.startsWith("@[")) {
        const closeIdx = trimmed.indexOf("]");
        if (closeIdx > 1) {
          selector = trimmed.slice(2, closeIdx);
          rest = trimmed.slice(closeIdx + 1);
        }
      } else {
        const match = trimmed.match(/^@([\w-]+)(.*)$/);
        if (match) {
          selector = "." + match[1];
          rest = match[2];
        }
      }
      if (selector) {
        const cRest = rest ? compilePath(rest.startsWith(".") ? rest.slice(1) : rest) : null;
        return () => {
          if (typeof document !== "undefined") {
            const el = document.querySelector(selector);
            if (el) {
              if (!cRest) return el;
              return cRest(el);
            }
          }
          return void 0;
        };
      }
    }
    let parenStripped = false;
    while (trimmed.startsWith("(") && trimmed.endsWith(")")) {
      let d = 0;
      let matched = true;
      for (let i = 0; i < trimmed.length - 1; i += 1) {
        if (trimmed[i] === "(") d += 1;
        if (trimmed[i] === ")") d -= 1;
        if (d === 0) {
          matched = false;
          break;
        }
      }
      if (!matched) break;
      trimmed = trimmed.slice(1, -1).trim();
      parenStripped = true;
    }
    if (parenStripped) {
      return compileExpression(trimmed, nextDepth);
    }
    if (trimmed.startsWith("!")) {
      const inner = compileExpression(trimmed.slice(1).trim(), nextDepth);
      return (scope) => !Boolean(inner(scope));
    }
    for (const [name2, fn] of Object.entries(voxelFunctions)) {
      if (trimmed.startsWith(name2 + "(") && trimmed.endsWith(")")) {
        const parts = splitTopLevel(trimmed.slice(name2.length + 1, -1), ",");
        const [required, maximum] = voxelArity[name2];
        if (parts.length < required || parts.length > maximum) throw new Error(`${name2} needs ${required}-${maximum} arguments`);
        const args = parts.map((part) => compileExpression(part, nextDepth));
        return (scope) => fn(...args.map((arg) => arg(scope)));
      }
    }
    if (trimmed.startsWith("map_spawn(") && trimmed.endsWith(")")) {
      const name2 = compileExpression(trimmed.slice(10, -1), nextDepth);
      return (scope) => mapSpawn(String(name2(scope)));
    }
    if (trimmed.startsWith("collide(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(8, -1), ",");
      if (parts.length >= 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        const cW = parts.length >= 3 ? compileExpression(parts[2], nextDepth) : null;
        const cH = parts.length >= 4 ? compileExpression(parts[3], nextDepth) : null;
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          const w = cW ? Number(cW(scope)) : 20;
          const h = cH ? Number(cH(scope)) : w;
          if (a && b && typeof a === "object" && typeof b === "object" && a.x !== void 0 && a.y !== void 0 && b.x !== void 0 && b.y !== void 0) {
            return Math.abs(Number(a.x) - Number(b.x)) < w && Math.abs(Number(a.y) - Number(b.y)) < h;
          }
          return false;
        };
      }
    }
    if (trimmed.startsWith("clamp(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(6, -1), ",");
      if (parts.length === 3) {
        const cV = compileExpression(parts[0], nextDepth);
        const cMin = compileExpression(parts[1], nextDepth);
        const cMax = compileExpression(parts[2], nextDepth);
        return (scope) => {
          const v = Number(cV(scope));
          const min = Number(cMin(scope));
          const max = Number(cMax(scope));
          return Math.min(Math.max(v, min), max);
        };
      }
    }
    if (trimmed.startsWith("abs(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
      return (scope) => Math.abs(Number(cVal(scope)));
    }
    if (trimmed.startsWith("floor(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(6, -1), nextDepth);
      return (scope) => Math.floor(Number(cVal(scope)));
    }
    if (trimmed.startsWith("sqrt(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(5, -1), nextDepth);
      return (scope) => Math.sqrt(Number(cVal(scope)));
    }
    if (trimmed.startsWith("sin(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
      return (scope) => Math.sin(Number(cVal(scope)) * Math.PI / 180);
    }
    if (trimmed.startsWith("cos(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
      return (scope) => Math.cos(Number(cVal(scope)) * Math.PI / 180);
    }
    if (trimmed.startsWith("atan2(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(6, -1), ",");
      if (parts.length === 2) {
        const cDy = compileExpression(parts[0], nextDepth);
        const cDx = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const dy = Number(cDy(scope));
          const dx = Number(cDx(scope));
          let deg = Math.atan2(dy, dx) * 180 / Math.PI;
          if (deg < 0) deg += 360;
          return deg;
        };
      }
    }
    if (trimmed.startsWith("distance(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(9, -1), ",");
      if (parts.length === 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          if (a && b && typeof a === "object" && typeof b === "object" && a.x !== void 0 && a.y !== void 0 && b.x !== void 0 && b.y !== void 0) {
            const dx = Number(a.x) - Number(b.x);
            const dy = Number(a.y) - Number(b.y);
            return Math.sqrt(dx * dx + dy * dy);
          }
          return 0;
        };
      } else if (parts.length === 4) {
        const cAx = compileExpression(parts[0], nextDepth);
        const cAy = compileExpression(parts[1], nextDepth);
        const cBx = compileExpression(parts[2], nextDepth);
        const cBy = compileExpression(parts[3], nextDepth);
        return (scope) => {
          const dx = Number(cAx(scope)) - Number(cBx(scope));
          const dy = Number(cAy(scope)) - Number(cBy(scope));
          return Math.sqrt(dx * dx + dy * dy);
        };
      }
    }
    if (trimmed.startsWith("angle_to(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(9, -1), ",");
      if (parts.length === 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          if (a && b && typeof a === "object" && typeof b === "object" && a.x !== void 0 && a.y !== void 0 && b.x !== void 0 && b.y !== void 0) {
            let deg = Math.atan2(Number(b.y) - Number(a.y), Number(b.x) - Number(a.x)) * 180 / Math.PI;
            if (deg < 0) deg += 360;
            return deg;
          }
          return 0;
        };
      }
    }
    if (trimmed.startsWith("slide(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(6, -1), ",");
      if (parts.length >= 4) {
        const cPx = compileExpression(parts[0], nextDepth);
        const cPy = compileExpression(parts[1], nextDepth);
        const cDx = compileExpression(parts[2], nextDepth);
        const cDy = compileExpression(parts[3], nextDepth);
        const cR = parts.length >= 5 ? compileExpression(parts[4], nextDepth) : null;
        return (scope) => {
          const px = Number(cPx(scope));
          const py = Number(cPy(scope));
          const dx = Number(cDx(scope));
          const dy = Number(cDy(scope));
          const r = cR ? Number(cR(scope)) : 0.25;
          return slide(px, py, dx, dy, r);
        };
      }
    }
    if (trimmed.startsWith("sees(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(5, -1), ",");
      if (parts.length === 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          if (!a || !b) return false;
          return sees(Number(a.x), Number(a.y), Number(b.x), Number(b.y));
        };
      } else if (parts.length >= 4) {
        const cX1 = compileExpression(parts[0], nextDepth);
        const cY1 = compileExpression(parts[1], nextDepth);
        const cX2 = compileExpression(parts[2], nextDepth);
        const cY2 = compileExpression(parts[3], nextDepth);
        return (scope) => {
          return sees(
            Number(cX1(scope)),
            Number(cY1(scope)),
            Number(cX2(scope)),
            Number(cY2(scope))
          );
        };
      }
    }
    if (trimmed.startsWith("random(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(7, -1), ",");
      if (parts.length >= 2) {
        const cMin = compileExpression(parts[0], nextDepth);
        const cMax = compileExpression(parts[1], nextDepth);
        const cSeed = parts.length >= 3 ? compileExpression(parts[2], nextDepth) : null;
        return (scope) => {
          const min = Number(cMin(scope));
          const max = Number(cMax(scope));
          return randomInt(min, max, cSeed ? Number(cSeed(scope)) : void 0);
        };
      }
    }
    for (const name2 of ["shuffle", "pick"]) {
      if (trimmed.startsWith(name2 + "(") && trimmed.endsWith(")")) {
        const parts = splitTopLevel(trimmed.slice(name2.length + 1, -1), ",");
        const cValues = compileExpression(parts[0], nextDepth);
        const cSeed = parts.length > 1 ? compileExpression(parts[1], nextDepth) : null;
        return (scope) => {
          const values = cValues(scope);
          if (!Array.isArray(values)) return void 0;
          const seed = cSeed ? Number(cSeed(scope)) : randomInt(0, 2147483647);
          return name2 === "shuffle" ? shuffled(values, seed) : values.length ? values[randomInt(0, values.length - 1, seed)] : null;
        };
      }
    }
    if (trimmed.startsWith("url_encode(") && trimmed.endsWith(")")) {
      const value = compileExpression(trimmed.slice(11, -1), nextDepth);
      return (scope) => encodeURIComponent(String(value(scope) ?? ""));
    }
    if (trimmed.startsWith("min(") && trimmed.endsWith(")")) {
      const cParts = splitTopLevel(trimmed.slice(4, -1), ",").map((p) => compileExpression(p, nextDepth));
      return (scope) => Math.min(...cParts.map((fn) => Number(fn(scope))));
    }
    if (trimmed.startsWith("max(") && trimmed.endsWith(")")) {
      const cParts = splitTopLevel(trimmed.slice(4, -1), ",").map((p) => compileExpression(p, nextDepth));
      return (scope) => Math.max(...cParts.map((fn) => Number(fn(scope))));
    }
    if (trimmed.startsWith("storage.get(") || trimmed.startsWith("local_storage.get(") || trimmed.startsWith("localStorage.get(")) {
      const callEnd = trimmed.lastIndexOf(")");
      const callPart = trimmed.slice(0, callEnd + 1);
      const trailingProp = trimmed.slice(callEnd + 1).trim();
      const inner = callPart.slice(callPart.indexOf("(") + 1, -1);
      const parts = splitTopLevel(inner, ",");
      const cKey = compileExpression(parts[0], nextDepth);
      const cDef = parts.length > 1 ? compileExpression(parts[1], nextDepth) : null;
      return (scope) => {
        const key2 = String(cKey(scope));
        const defVal = cDef ? cDef(scope) : null;
        const item = getStorageItem(key2);
        let result = defVal;
        if (item !== null) {
          try {
            result = JSON.parse(item);
          } catch {
            result = item;
          }
        }
        if (trailingProp.startsWith(".") && result && typeof result === "object") {
          const prop = trailingProp.slice(1);
          return result[prop];
        }
        return result;
      };
    }
    if (trimmed.startsWith("storage.has(") || trimmed.startsWith("local_storage.has(") || trimmed.startsWith("localStorage.has(")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const cKey = compileExpression(inner, nextDepth);
      return (scope) => hasStorageItem(String(cKey(scope)));
    }
    const helperCall = parseHelperCall(trimmed);
    if (helperCall) {
      const cArgs = helperCall.args.map((arg) => compileExpression(arg, nextDepth));
      const name2 = helperCall.name;
      return (scope) => callHelper(name2, cArgs.map((fn) => fn(scope)), scope, nextDepth);
    }
    const methodMatch = trimmed.match(
      /^(.+?)\.(any|mask|filter|find|max)(?:\((.*)\)|\s+(.+?))(?:\.(length))?$/
    );
    if (methodMatch) {
      const [, receiver, method, parenArgs, spaceArgs, trailingProp] = methodMatch;
      const argsStr = (parenArgs !== void 0 ? parenArgs : spaceArgs).trim();
      const cReceiver = compileExpression(receiver, nextDepth);
      if (method === "mask") {
        const cArg = compileExpression(argsStr, nextDepth);
        return (scope) => {
          const collection = cReceiver(scope);
          if (!Array.isArray(collection)) return void 0;
          const player = valueToString(cArg(scope));
          return collection.reduce(
            (acc, cell, i) => {
              return valueToString(cell) === player ? acc | 1 << i : acc;
            },
            0
          );
        };
      }
      const arrowMatch = argsStr.match(/^(\w+)\s*=>\s*(.+)$/);
      const [paramName, predExpr] = arrowMatch ? [arrowMatch[1], arrowMatch[2]] : ["it", argsStr];
      const cPred = compileExpression(predExpr, nextDepth);
      return (scope) => {
        const collection = cReceiver(scope);
        if (!Array.isArray(collection)) return void 0;
        let result = void 0;
        if (method === "any") {
          result = collection.some((item) => {
            const innerScope = Object.assign({}, scope, { [paramName]: item });
            return Boolean(cPred(innerScope));
          });
        } else if (method === "filter") {
          result = collection.filter((item) => {
            const innerScope = Object.assign({}, scope, { [paramName]: item });
            return Boolean(cPred(innerScope));
          });
        } else if (method === "find") {
          result = collection.find((item) => {
            const innerScope = Object.assign({}, scope, { [paramName]: item });
            return Boolean(cPred(innerScope));
          });
        } else if (method === "max") {
          result = collection.reduce(
            (max, item) => {
              const innerScope = Object.assign({}, scope, { [paramName]: item });
              const val = cPred(innerScope);
              return max === void 0 || val > max ? val : max;
            },
            void 0
          );
        }
        if (trailingProp === "length" && result !== void 0 && result.length !== void 0) {
          return result.length;
        }
        return result;
      };
    }
    if (includesTopLevel(trimmed, " ? ")) {
      const parts = splitTopLevel(trimmed, " ? ");
      const condition = parts[0];
      const rest = parts.slice(1).join(" ? ");
      if (includesTopLevel(rest, " : ")) {
        const colonParts = splitTopLevel(rest, " : ");
        const cCond = compileExpression(condition, nextDepth);
        const cTrue = compileExpression(colonParts[0], nextDepth);
        const cFalse = compileExpression(colonParts.slice(1).join(" : "), nextDepth);
        return (scope) => Boolean(cCond(scope)) ? cTrue(scope) : cFalse(scope);
      }
    }
    if (includesTopLevel(trimmed, " ?? ")) {
      const parts = splitTopLevel(trimmed, " ?? ");
      const leftRaw = parts[0].trim();
      const cLeft = compileExpression(leftRaw, nextDepth);
      const cRight = compileExpression(parts.slice(1).join(" ?? "), nextDepth);
      return (scope) => {
        let left = cLeft(scope);
        if (typeof left === "string" && left === leftRaw && resolvePath(leftRaw, scope) === void 0 && tryParseLiteral(leftRaw, scope) === void 0) {
          left = void 0;
        }
        if (left !== void 0 && left !== null && left !== "") {
          return left;
        }
        return cRight(scope);
      };
    }
    if (includesTopLevel(trimmed, " or ")) {
      const cParts = splitTopLevel(trimmed, " or ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.some((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " || ")) {
      const cParts = splitTopLevel(trimmed, " || ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.some((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " and ")) {
      const cParts = splitTopLevel(trimmed, " and ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.every((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " && ")) {
      const cParts = splitTopLevel(trimmed, " && ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.every((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " != ")) {
      const [left, right] = splitTopLevel(trimmed, " != ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => valueToString(cL(scope)) !== valueToString(cR(scope));
    }
    if (includesTopLevel(trimmed, " == ")) {
      const [left, right] = splitTopLevel(trimmed, " == ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => valueToString(cL(scope)) === valueToString(cR(scope));
    }
    if (includesTopLevel(trimmed, " >= ")) {
      const [left, right] = splitTopLevel(trimmed, " >= ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) >= cR(scope);
    }
    if (includesTopLevel(trimmed, " <= ")) {
      const [left, right] = splitTopLevel(trimmed, " <= ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) <= cR(scope);
    }
    if (includesTopLevel(trimmed, " > ")) {
      const [left, right] = splitTopLevel(trimmed, " > ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) > cR(scope);
    }
    if (includesTopLevel(trimmed, " < ")) {
      const [left, right] = splitTopLevel(trimmed, " < ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) < cR(scope);
    }
    if (includesTopLevel(trimmed, " + ")) {
      const cParts = splitTopLevel(trimmed, " + ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.reduce((acc, fn, index2) => {
        const value = fn(scope);
        if (index2 === 0) return value;
        if (typeof acc === "number" && typeof value === "number") return acc + value;
        return `${valueToString(acc)}${valueToString(value)}`;
      }, void 0);
    }
    if (includesTopLevel(trimmed, " - ")) {
      const parts = splitTopLevel(trimmed, " - ");
      const cFirst = compileExpression(parts[0], nextDepth);
      const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
      return (scope) => {
        const first = Number(cFirst(scope));
        return cRest.reduce((acc, fn) => acc - Number(fn(scope)), first);
      };
    }
    if (includesTopLevel(trimmed, " * ")) {
      const cParts = splitTopLevel(trimmed, " * ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.reduce((acc, fn, idx) => {
        const val = Number(fn(scope));
        return idx === 0 ? val : acc * val;
      }, 1);
    }
    if (includesTopLevel(trimmed, " / ")) {
      const parts = splitTopLevel(trimmed, " / ");
      const cFirst = compileExpression(parts[0], nextDepth);
      const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
      return (scope) => {
        const first = Number(cFirst(scope));
        return cRest.reduce((acc, fn) => acc / Number(fn(scope)), first);
      };
    }
    if (includesTopLevel(trimmed, " % ")) {
      const parts = splitTopLevel(trimmed, " % ");
      const cFirst = compileExpression(parts[0], nextDepth);
      const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
      return (scope) => {
        const first = Number(cFirst(scope));
        return cRest.reduce((acc, fn) => acc % Number(fn(scope)), first);
      };
    }
    if (trimmed.startsWith("swap ")) {
      const tokens2 = trimmed.split(/\s+/);
      const cCurr = compileExpression(tokens2[1], nextDepth);
      const cL = compileExpression(tokens2[2], nextDepth);
      const cR = compileExpression(tokens2[3], nextDepth);
      return (scope) => {
        const current = valueToString(cCurr(scope));
        const left = valueToString(cL(scope));
        const right = valueToString(cR(scope));
        return current === left ? right : left;
      };
    }
    if (trimmed.startsWith("full ")) {
      const cColl = compileExpression(trimmed.slice(5), nextDepth);
      return (scope) => {
        const collection = cColl(scope);
        return Array.isArray(collection) && collection.every((item) => valueToString(item) !== "");
      };
    }
    if (includesTopLevel(trimmed, " & ")) {
      const [left, right] = splitTopLevel(trimmed, " & ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) & cR(scope);
    }
    if (trimmed.startsWith("-") && !trimmed.startsWith("--")) {
      const operand = trimmed.slice(1).trim();
      if (operand) {
        const cOp = compileExpression(operand, nextDepth);
        return (scope) => {
          const val = cOp(scope);
          if (typeof val === "number") return -val;
          const num = Number(val);
          if (!Number.isNaN(num)) return -num;
          return void 0;
        };
      }
    }
    return compileResolveValue(trimmed);
  }
  function evaluateExpression(expr, scope, depth) {
    if ((depth || 0) > MAX_DEPTH) return void 0;
    const trimmed = String(expr || "").trim();
    if (!trimmed) return void 0;
    const context = currentContext();
    let contextId = 0;
    if (context) {
      contextId = helperContextIds.get(context.helperDefinitions) ?? 0;
      if (!contextId) {
        contextId = nextHelperContextId++;
        helperContextIds.set(context.helperDefinitions, contextId);
      }
    }
    const cacheKey = `${contextId}:${context?.logicOwner ?? ""}\0${trimmed}`;
    let compiled = exprCache.get(cacheKey);
    if (!compiled) {
      compiled = compileExpression(trimmed, depth || 0);
      if (exprCache.size >= MAX_CACHE_SIZE) {
        exprCache.clear();
      }
      exprCache.set(cacheKey, compiled);
    }
    return compiled(scope);
  }

  // src/effects.ts
  function downloadText(filename, content) {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function copyText(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {
      });
    }
  }

  // src/datasource.ts
  var encode2;
  var decode2;
  var codec;
  function loadCodec() {
    return codec ?? (codec = Promise.resolve().then(() => (init_dist(), dist_exports)).then((module) => {
      encode2 = module.encode;
      decode2 = module.decode;
    }));
  }
  var MAX_PACKET = 8 * 1024 * 1024;
  var MAX_PAGE = 4 * 1024 * 1024;
  var MAX_VALUE = 1024 * 1024;
  var own = (value, key2) => Object.prototype.hasOwnProperty.call(value, key2);
  var CHANGES = "$changes";
  var MAX_SEQUENCE = 18446744073709551615n;
  var databases = /* @__PURE__ */ new Map();
  var listeners = /* @__PURE__ */ new Map();
  var channels = /* @__PURE__ */ new Map();
  var definitions = {};
  var tokens = /* @__PURE__ */ new Map();
  function configureDataSources(config = {}) {
    definitions = config;
    tokens.clear();
  }
  function setDataSourceToken(source, token) {
    tokens.set(source, token);
  }
  function check(ok, message) {
    if (!ok) throw new Error(message);
  }
  function jsonValue(value, depth = 0) {
    check(depth <= 100, "JSON nesting exceeds 100");
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
      check(Number.isFinite(value), "JSON values must be finite");
      check(!Number.isInteger(value) || Number.isSafeInteger(value), "integer exceeds portable browser precision");
      return;
    }
    check(value && typeof value === "object" && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null), "storage accepts JSON values only");
    for (const item of Object.values(value)) jsonValue(item, depth + 1);
  }
  function unpack(bytes) {
    const value = decode2(bytes);
    jsonValue(value);
    return value;
  }
  function utf8(value) {
    return new TextEncoder().encode(value).buffer;
  }
  function name(value) {
    check(typeof value === "string" && value.length > 0 && utf8(value).byteLength <= 256 && !value.includes("\0"), "invalid name (1..256 UTF-8 bytes required)");
  }
  function key(value) {
    check(typeof value === "string" && utf8(value).byteLength <= 4096, "key exceeds 4096 bytes");
  }
  function cursor(value) {
    check(typeof value === "string" && /^\d+$/.test(value), "invalid cursor");
    const n = BigInt(value);
    check(n <= MAX_SEQUENCE, "invalid cursor");
    return n;
  }
  function padded(value) {
    return cursor(value).toString().padStart(20, "0");
  }
  function next(value) {
    const n = cursor(value) + 1n;
    check(n <= MAX_SEQUENCE, "sequence counter exhausted");
    return n.toString();
  }
  function request(value) {
    return new Promise((resolve2, reject) => {
      value.onsuccess = () => resolve2(value.result);
      value.onerror = () => reject(value.error);
    });
  }
  function finished(tx) {
    return new Promise((resolve2, reject) => {
      tx.oncomplete = () => resolve2();
      tx.onabort = () => reject(tx.error ?? new Error("storage transaction aborted"));
      tx.onerror = () => {
      };
    });
  }
  function wake(database) {
    for (const listener of listeners.get(database) ?? []) listener();
  }
  function notify(database) {
    wake(database);
    channels.get(database)?.postMessage("commit");
  }
  function open(database) {
    name(database);
    let db = databases.get(database);
    if (!db) {
      check(typeof indexedDB !== "undefined", "IndexedDB is unavailable in this host");
      check(databases.size < 64, "host limit of 64 open databases reached");
      db = new Promise((resolve2, reject) => {
        const opening = indexedDB.open(`rune-db:${database}`, 1);
        opening.onupgradeneeded = () => {
          for (const table of ["records", "events", "meta"]) opening.result.createObjectStore(table);
        };
        opening.onerror = () => reject(opening.error);
        opening.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
        opening.onsuccess = () => {
          const db2 = opening.result;
          db2.onversionchange = () => {
            db2.close();
            databases.delete(database);
          };
          if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined" && !channels.has(database)) {
            const channel = new BroadcastChannel(`rune-db:${database}`);
            channel.onmessage = () => wake(database);
            channels.set(database, channel);
          }
          resolve2(db2);
        };
      });
      databases.set(database, db);
      db.catch(() => databases.delete(database));
    }
    return db;
  }
  function packedValue(value) {
    const bytes = encode2(value);
    check(bytes.length <= MAX_VALUE, "value exceeds 1 MiB");
    return bytes;
  }
  function numericAdd(a, b) {
    check(typeof a === "number" && typeof b === "number", "increment requires numeric operands");
    const value = a + b;
    check(Number.isFinite(value), "numeric overflow");
    check(!Number.isInteger(value) || Number.isSafeInteger(value), "integer exceeds portable browser precision");
    return value;
  }
  function increment(record, path, by) {
    check(Array.isArray(path) && path.length <= 32, "mutation path exceeds 32 segments");
    const box = { value: record };
    let parent = box, property = "value";
    for (const segment of path) {
      parent = parent[property];
      check(parent != null, "mutation target not found");
      if (typeof segment === "string") {
        check(!Array.isArray(parent) && own(parent, segment), "mutation target not found");
        property = segment;
      } else if (Number.isInteger(segment) && segment >= 0) {
        check(Array.isArray(parent) && segment < parent.length, "mutation target not found");
        property = segment;
      } else {
        check(segment && typeof segment.field === "string" && Array.isArray(parent), "invalid selector");
        property = parent.findIndex((v) => v && own(v, segment.field) && JSON.stringify(v[segment.field]) === JSON.stringify(segment.equals));
        check(property !== -1, "mutation target not found");
      }
    }
    parent[property] = numericAdd(parent[property], by);
    return { value: box.value, changed: parent[property] };
  }
  function validate(packet) {
    const fields = {
      get: ["collection", "key"],
      get_many: ["collection", "keys"],
      scan: ["collection", "prefix", "after", "limit"],
      put: ["collection", "key", "value", "expected"],
      delete: ["collection", "key", "expected"],
      increment: ["collection", "key", "path", "by", "expected"],
      append: ["stream", "kind", "value"],
      read: ["stream", "after", "limit", "wait_ms"],
      batch: ["operations"]
    };
    check(packet && typeof packet === "object" && own(fields, packet.op), "unknown storage operation");
    for (const field of Object.keys(packet)) check(field === "op" || fields[packet.op].includes(field), `unknown packet field: ${field}`);
    if (["get", "get_many", "scan", "put", "delete", "increment"].includes(packet.op)) name(packet.collection);
    if (["get", "put", "delete", "increment"].includes(packet.op)) key(packet.key);
    if (packet.op === "get_many") {
      check(Array.isArray(packet.keys) && packet.keys.length >= 1 && packet.keys.length <= 256, "get_many requires 1..256 keys");
      packet.keys.forEach(key);
    }
    if (["put", "append"].includes(packet.op)) {
      check(own(packet, "value"), "value required");
      packedValue(packet.value);
    }
    if (packet.op === "increment") check(typeof packet.by === "number" && Number.isFinite(packet.by), "increment must be numeric");
    if (packet.expected != null) cursor(packet.expected);
    if (["scan", "read"].includes(packet.op)) check(Number.isInteger(packet.limit ?? 100) && (packet.limit ?? 100) >= 1 && (packet.limit ?? 100) <= 1e3, "limit must be 1..1000");
    if (packet.op === "read") {
      name(packet.stream);
      cursor(packet.after ?? "0");
      check(Number.isInteger(packet.wait_ms ?? 0) && (packet.wait_ms ?? 0) >= 0 && (packet.wait_ms ?? 0) <= 3e4, "wait_ms exceeds 30000");
    }
    if (packet.op === "scan") {
      key(packet.prefix ?? "");
      if (packet.after != null) {
        key(packet.after);
        check(packet.after.startsWith(packet.prefix ?? ""), "scan cursor does not match prefix");
      }
    }
    if (packet.op === "append") {
      name(packet.stream);
      name(packet.kind);
      check(packet.stream !== CHANGES, "$changes is reserved");
    }
    if (packet.op === "batch") {
      check(Array.isArray(packet.operations) && packet.operations.length > 0 && packet.operations.length <= 256, "batch requires 1..256 mutations");
      for (const op of packet.operations) {
        check(["put", "delete", "increment", "append"].includes(op.op), "batch accepts only mutations");
        validate(op);
      }
    }
  }
  async function page(store, range, match, limit) {
    return new Promise((resolve2, reject) => {
      const values = [];
      let size = 0;
      const opening = store.openCursor(range);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const cursor2 = opening.result;
        if (!cursor2 || !match(cursor2.key)) {
          resolve2({ values, more: false });
          return;
        }
        const bytes = cursor2.value;
        if (values.length === limit || values.length > 0 && size + bytes.length > MAX_PAGE) {
          resolve2({ values, more: true });
          return;
        }
        values.push(unpack(bytes));
        size += bytes.length;
        cursor2.continue();
      };
    });
  }
  async function local(database, packet) {
    const db = await open(database);
    const read = ["get", "get_many", "scan", "read"].includes(packet.op);
    const tx = db.transaction(read ? [packet.op === "read" ? "events" : "records"] : ["records", "events", "meta"], read ? "readonly" : "readwrite", read ? void 0 : { durability: "strict" });
    const done = finished(tx);
    done.catch(() => {
    });
    const records = () => tx.objectStore("records");
    const events = () => tx.objectStore("events");
    const meta = () => tx.objectStore("meta");
    const recordKey = (op) => [op.collection, utf8(op.key)];
    try {
      let result;
      if (packet.op === "get") {
        const value = await request(records().get(recordKey(packet)));
        result = value == null ? null : unpack(value);
      } else if (packet.op === "get_many") {
        result = [];
        let size = 3;
        for (const key2 of packet.keys) {
          const value = await request(records().get([packet.collection, utf8(key2)]));
          size += value?.length ?? 1;
          check(size <= MAX_PAGE, "get_many response exceeds 4 MiB");
          result.push(value == null ? null : unpack(value));
        }
      } else if (packet.op === "scan") {
        const prefix = packet.prefix ?? "", start = packet.after ?? prefix;
        const resultPage = await page(records(), IDBKeyRange.lowerBound([packet.collection, utf8(start)], packet.after != null), (k) => {
          const [collection, key2] = k;
          return collection === packet.collection && new TextDecoder().decode(key2).startsWith(prefix);
        }, packet.limit ?? 100);
        result = { items: resultPage.values, next: resultPage.more ? resultPage.values[resultPage.values.length - 1]?.key ?? null : null };
      } else if (packet.op === "read") {
        const after = packet.after ?? "0";
        const resultPage = await page(events(), IDBKeyRange.lowerBound([packet.stream, padded(after)], true), (k) => k[0] === packet.stream, packet.limit ?? 100);
        result = { events: resultPage.values, next: resultPage.values[resultPage.values.length - 1]?.sequence ?? after };
      } else {
        const commit = next(await request(meta().get("commit")) ?? "0");
        const operations = packet.op === "batch" ? packet.operations : [packet];
        const results = [];
        const append = async (stream, kind, value) => {
          const sequence = next(await request(meta().get(`stream:${stream}`)) ?? "0");
          const event = { stream, sequence, commit, kind, value };
          await request(events().put(encode2(event), [stream, padded(sequence)]));
          await request(meta().put(sequence, `stream:${stream}`));
          return event;
        };
        for (const op of operations) {
          if (op.op === "append") {
            results.push(await append(op.stream, op.kind, op.value));
            continue;
          }
          const bytes = await request(records().get(recordKey(op)));
          const current = bytes == null ? null : unpack(bytes);
          if (op.expected != null) check((current?.revision ?? "0") === op.expected, `conflict: expected revision ${op.expected}, found ${current?.revision ?? "0"}`);
          let value = op.value, patch = null;
          if (op.op === "increment") {
            check(current, "mutation record not found");
            const changed = increment(current.value, op.path ?? [], op.by);
            value = changed.value;
            patch = { path: op.path ?? [], by: op.by, value: changed.changed };
          }
          let receipt;
          if (op.op === "delete") {
            await request(records().delete(recordKey(op)));
            receipt = { key: op.key, deleted: current != null, revision: commit };
          } else {
            packedValue(value);
            const record = { key: op.key, value, revision: commit };
            await request(records().put(encode2(record), recordKey(op)));
            receipt = op.op === "increment" ? { key: op.key, revision: commit, patch } : record;
          }
          const change = op.op === "increment" ? { collection: op.collection, key: op.key, revision: commit, patch } : { collection: op.collection, key: op.key, record: receipt };
          await append(CHANGES, op.op, change);
          results.push(receipt);
        }
        result = { commit, results };
        check(new TextEncoder().encode(JSON.stringify(result)).length <= MAX_PACKET - 256, "commit response exceeds 8 MiB");
        await request(meta().put(commit, "commit"));
      }
      await done;
      if (!read) notify(database);
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {
      }
      await done.catch(() => {
      });
      throw error;
    }
  }
  function resolve(source, seen = /* @__PURE__ */ new Set()) {
    check(!seen.has(source), "datasource cycle");
    seen.add(source);
    const config = definitions[source];
    check(config, `unknown datasource: ${source}`);
    check(["rune-db", "vect-event"].includes(config.type), "unsupported storage provider");
    if (config.type === "vect-event" && config.mode !== "remote") {
      check(config.store, "vect-event requires store");
      const parent = resolve(config.store, seen);
      check(!parent.eventsOnly, "vect-event store must be rune-db");
      return { config: parent.config, eventsOnly: true };
    }
    check(config.mode == null || ["embedded", "remote"].includes(config.mode), "invalid datasource mode");
    const database = config.database ?? source;
    if (config.mode !== "remote") check(/^[A-Za-z0-9_-]{1,128}$/.test(database), "database name must contain only letters, numbers, _ or -");
    return { config: { ...config, database }, eventsOnly: config.type === "vect-event" };
  }
  function eventsOnly(packet) {
    return ["append", "read"].includes(packet.op) || packet.op === "batch" && packet.operations.every(eventsOnly);
  }
  async function requestDataSource(source, packet, options = {}) {
    const { config, eventsOnly: restricted } = resolve(source);
    if (options.kind) check(restricted === (options.kind === "events"), "use db with rune-db and events with vect-event");
    check(config.mode === "remote" ? typeof fetch !== "undefined" : typeof indexedDB !== "undefined", "This host does not provide the requested datasource adapter");
    await loadCodec();
    jsonValue(packet);
    const bytes = encode2(packet);
    check(bytes.length <= MAX_PACKET, "packet exceeds 8 MiB");
    packet = decode2(bytes);
    validate(packet);
    check(!restricted || eventsOnly(packet), "vect-event accepts only event operations");
    if (config.mode === "remote") {
      check(config.endpoint, "remote datasource requires endpoint");
      const url = new URL(config.endpoint, typeof location !== "undefined" ? location.href : void 0);
      check(["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash, "invalid storage endpoint");
      const headers = { "content-type": "application/msgpack", accept: "application/msgpack" };
      const token = tokens.get(source);
      if (token) headers.authorization = `Bearer ${token}`;
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), 4e4);
      const abort = () => timeout.abort();
      options.signal?.addEventListener("abort", abort, { once: true });
      try {
        if (options.signal?.aborted) timeout.abort();
        const response = await fetch(url.href.replace(/\/$/, "") + "/v1/execute", { method: "POST", headers, body: bytes, signal: timeout.signal, redirect: "error" });
        const reader = response.body?.getReader();
        check(reader, "storage response has no body");
        const chunks = [];
        let length = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > MAX_PACKET) {
            await reader.cancel();
            throw new Error("storage response exceeds 8 MiB");
          }
          chunks.push(value);
        }
        const body = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          body.set(chunk, offset);
          offset += chunk.length;
        }
        const reply = response.headers.get("content-type")?.startsWith("application/msgpack") ? unpack(body) : JSON.parse(new TextDecoder().decode(body));
        check(response.ok && reply.ok, reply.error?.message ?? "storage request failed");
        return reply.data;
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
      }
    }
    const database = config.database;
    const deadline = Date.now() + (packet.op === "read" ? packet.wait_ms ?? 0 : 0);
    do {
      if (options.signal?.aborted) throw new Error("storage request aborted");
      let cleanup = () => {
      };
      const changed = new Promise((resolve2) => {
        const set = listeners.get(database) ?? /* @__PURE__ */ new Set();
        listeners.set(database, set);
        const wake2 = () => {
          cleanup();
          resolve2();
        };
        const timer = setTimeout(wake2, Math.max(0, Math.min(200, deadline - Date.now())));
        cleanup = () => {
          clearTimeout(timer);
          set.delete(wake2);
          options.signal?.removeEventListener("abort", wake2);
        };
        set.add(wake2);
        options.signal?.addEventListener("abort", wake2, { once: true });
      });
      const result = await local(database, packet).catch((error) => {
        cleanup();
        throw error;
      });
      if (packet.op !== "read" || result.events.length || Date.now() >= deadline) {
        cleanup();
        return result;
      }
      await changed;
    } while (true);
  }

  // src/builtins/command.ts
  var STOP = "stop";
  var NO_ACTION = "do_not_action";

  // src/builtins/log.ts
  function handleLog(statement, locals) {
    if (!statement.startsWith("log ")) return void 0;
    const msg = interpolate(statement.slice(4), buildScope(locals));
    console.log(msg);
    return msg;
  }
  var logCommand = {
    prefix: ["log"],
    signature: "log <expression>",
    description: "Logs the interpolated expression to the console",
    handler: handleLog
  };

  // src/builtins/delete.ts
  function handleDelete(statement, locals) {
    if (!statement.startsWith("delete ")) return void 0;
    const path = statement.slice(7).trim();
    deletePath(path, locals);
    return true;
  }
  var deleteCommand = {
    prefix: ["delete", "del", "rm", "remove", "rmv", "destroy"],
    signature: "delete <path>",
    description: "Deletes a value at the given path from locals",
    handler: handleDelete
  };

  // src/builtins/invert.ts
  function handleInvert(statement, locals) {
    if (!statement.startsWith("invert ")) return void 0;
    const path = statement.slice(7).trim();
    const current = Boolean(evaluateExpression(path, buildScope(locals)));
    assignPath(path, !current, locals);
    return !current;
  }
  var invertCommand = {
    prefix: ["invert"],
    signature: "invert <path>",
    description: "Inverts a boolean value at the given path",
    handler: handleInvert
  };

  // src/builtins/increment.ts
  function handleIncrement(statement, locals) {
    if (statement.startsWith("increment") || statement.startsWith("inc")) {
      const trimmed = statement.replace("increment ", "").replace("inc ", "");
      const tokens2 = trimmed.split(" ");
      if (tokens2.length != 3) return void 0;
      if (tokens2[1] != "by") return void 0;
      const path2 = tokens2[0];
      const valueExpression = tokens2[2];
      const value = evaluateExpression(valueExpression, buildScope(locals));
      return incrementBy(path2, Number(value), locals);
    }
    if (!statement.endsWith("++")) return void 0;
    const path = statement.slice(0, -2).trim();
    return incrementBy(path, 1, locals);
  }
  function incrementBy(path, value, locals) {
    let evaled = evaluateExpression(path, buildScope(locals));
    if (evaled === path) evaled = 0;
    let current = Number(evaled);
    if (isNaN(current)) current = 0;
    const newValue = current + value;
    assignPath(path, newValue, locals);
    return newValue;
  }
  var incrementCommand = {
    prefix: ["increment", "inc"],
    postfix: ["++"],
    signature: "<path>++ | increment <path> by <number> | inc <path> by <number>",
    description: "Increments a numeric value at the given path",
    handler: handleIncrement
  };

  // src/builtins/decrement.ts
  function handleDecrement(statement, locals) {
    if (statement.startsWith("decrement") || statement.startsWith("dec")) {
      const trimmed = statement.replace("decrement ", "").replace("dec ", "");
      const tokens2 = trimmed.split(" ");
      if (tokens2.length != 3) return void 0;
      if (tokens2[1] != "by") return void 0;
      const path2 = tokens2[0];
      const valueExpression = tokens2[2];
      const value = evaluateExpression(valueExpression, buildScope(locals));
      return decrementBy(path2, Number(value), locals);
    }
    if (!statement.endsWith("--")) return void 0;
    const path = statement.slice(0, -2).trim();
    return decrementBy(path, 1, locals);
  }
  function decrementBy(path, value, locals) {
    let evaled = evaluateExpression(path, buildScope(locals));
    if (evaled === path) evaled = 0;
    let current = Number(evaled);
    if (isNaN(current)) current = 0;
    const newValue = current - value;
    assignPath(path, newValue, locals);
    return newValue;
  }
  var decrementCommand = {
    postfix: ["--"],
    prefix: ["decrement", "dec"],
    signature: "<path>-- or decrement <path> by <value> or dec <path> by <value>",
    description: "Decrements a numeric value at the given path",
    handler: handleDecrement
  };

  // src/builtins/swap.ts
  function handleSwap(statement, locals) {
    if (!statement.startsWith("swap ")) return void 0;
    const tokens2 = statement.split(/\s+/);
    if (tokens2.length < 3) return void 0;
    const targetPath = tokens2[1];
    if (tokens2.length === 3) {
      const val = evaluateExpression(tokens2[2], buildScope(locals));
      assignPath(targetPath, val, locals);
      return true;
    }
    const aExpr = tokens2[2];
    const bExpr = tokens2[3];
    const aValue = evaluateExpression(aExpr, buildScope(locals));
    const bValue = evaluateExpression(bExpr, buildScope(locals));
    const current = evaluateExpression(targetPath, buildScope(locals));
    if (current === aValue) {
      assignPath(targetPath, bValue, locals);
    } else {
      assignPath(targetPath, aValue, locals);
    }
    return true;
  }
  var swapCommand = {
    prefix: ["swap"],
    signature: "swap <path> <A> <B>",
    description: "Swaps the values of A and B at path",
    handler: handleSwap
  };

  // src/builtins/stop.ts
  function handleStop(statement, locals) {
    if (statement.trim() !== STOP) return void 0;
    return STOP;
  }
  var stopCommand = {
    prefix: [STOP],
    signature: STOP,
    description: "Stops execution of the current script",
    handler: handleStop
  };

  // src/builtins/push.ts
  function handlePush(statement, locals) {
    if (!statement.startsWith("push ")) return void 0;
    const tokens2 = statement.split(/\s+/);
    if (tokens2.length < 3) return void 0;
    const targetPath = tokens2[1];
    const valueExpr = tokens2.slice(2).join(" ");
    const collection = evaluateExpression(targetPath, buildScope(locals));
    if (!Array.isArray(collection)) return void 0;
    const value = evaluateExpression(valueExpr, buildScope(locals));
    collection.push(value);
    assignPath(targetPath, collection, locals);
    return true;
  }
  var pushCommand = {
    prefix: ["push"],
    signature: "push <path> <valueExpression>",
    description: "Pushes a value onto the array at the given path",
    handler: handlePush
  };

  // src/builtins/max.ts
  function handleMax(statement, locals) {
    if (!statement.startsWith("max ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr) || arr.length === 0) return void 0;
    const maxVal = Math.max(...arr.map((v) => Number(v)));
    if (varPart) {
      assignPath(varPart, maxVal, locals);
    }
    return maxVal;
  }
  var maxCommand = {
    prefix: ["max"],
    signature: "max <arrayPath> as <var>",
    description: "Finds maximum numeric value in an array",
    handler: handleMax
  };

  // src/builtins/min.ts
  function handleMin(statement, locals) {
    if (!statement.startsWith("min ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr) || arr.length === 0) return void 0;
    const minVal = Math.min(...arr.map((v) => Number(v)));
    if (varPart) {
      assignPath(varPart, minVal, locals);
    }
    return minVal;
  }
  var minCommand = {
    prefix: ["min"],
    signature: "min <arrayPath> as <var>",
    description: "Finds minimum numeric value in an array",
    handler: handleMin
  };

  // src/builtins/delay.ts
  function handleDelay(statement, locals) {
    if (!statement.startsWith("delay ")) return void 0;
    const rest = statement.slice(6).trim();
    const msMatch = rest.match(/^([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
    if (!msMatch) return void 0;
    let ms = Number(msMatch[1]);
    const unit = msMatch[2] ? msMatch[2].toLowerCase() : "ms";
    if (unit === "s") ms *= 1e3;
    const start = Date.now();
    while (Date.now() - start < ms) {
    }
    return true;
  }
  var delayCommand = {
    prefix: ["delay"],
    signature: "delay <duration>ms",
    description: "Pauses execution for a given number of milliseconds",
    handler: handleDelay
  };

  // src/builtins/unique.ts
  function handleUnique(statement, locals) {
    if (!statement.startsWith("unique ")) return void 0;
    const rest = statement.slice(7).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr)) return void 0;
    const uniq = Array.from(new Set(arr));
    if (varPart) {
      assignPath(varPart, uniq, locals);
    }
    return uniq;
  }
  var uniqueCommand = {
    prefix: ["unique"],
    signature: "unique <arrayPath> as <var>",
    description: "Removes duplicate entries from an array",
    handler: handleUnique
  };

  // src/builtins/sum.ts
  function handleSum(statement, locals) {
    if (!statement.startsWith("sum ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr)) return void 0;
    const total = arr.reduce((acc, cur) => acc + Number(cur), 0);
    if (varPart) {
      assignPath(varPart, total, locals);
    }
    return total;
  }
  var sumCommand = {
    prefix: ["sum"],
    signature: "sum <arrayPath> as <var>",
    description: "Sums numeric values in an array and stores the result",
    handler: handleSum
  };

  // src/builtins/randomize.ts
  function handleRandomize(statement, locals) {
    if (!statement.startsWith("randomize ")) return void 0;
    const rest = statement.slice(9).trim();
    const parts = rest.split(/\s+/);
    if (parts.length >= 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
      const min = Number(parts[0]);
      const max = Number(parts[1]);
      let varName;
      if (parts.length > 3 && parts[2] === "as") {
        varName = parts[3];
      }
      const rand = Math.floor(Math.random() * (max - min + 1)) + min;
      if (varName) {
        assignPath(varName, rand, locals);
      }
      return rand;
    }
    const asIndex = parts.indexOf("as");
    if (parts.length >= 1) {
      const pathExpr = parts.slice(0, asIndex).join(" ");
      const varName = parts[asIndex + 1];
      const arr = evaluateExpression(pathExpr, buildScope(locals));
      if (!Array.isArray(arr)) return void 0;
      const shuffled2 = arr.slice();
      for (let i = shuffled2.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled2[i], shuffled2[j]] = [shuffled2[j], shuffled2[i]];
      }
      if (varName) {
        assignPath(varName, shuffled2, locals);
      }
      return shuffled2;
    }
    return void 0;
  }
  var randomizeCommand = {
    prefix: ["randomize"],
    signature: "randomize <min> <max> as <var> | randomize <arrayPath> as <var>",
    description: "Generates a random number in a range or shuffles an array",
    handler: handleRandomize
  };

  // src/builtins/count.ts
  function handleCount(statement, locals) {
    if (!statement.startsWith("count ")) return void 0;
    const rest = statement.slice(6).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const value = evaluateExpression(pathPart, buildScope(locals));
    let count;
    if (Array.isArray(value)) {
      count = value.length;
    } else if (value && typeof value === "object") {
      count = Object.keys(value).length;
    } else {
      count = 0;
    }
    if (varPart) {
      assignPath(varPart, count, locals);
    }
    return count;
  }
  var countCommand = {
    prefix: ["count"],
    signature: "count <path> as <var>",
    description: "Stores the length of an array or object keys count into a variable",
    handler: handleCount
  };

  // src/builtins/flatten.ts
  function handleFlatten(statement, locals) {
    if (!statement.startsWith("flatten ")) return void 0;
    const rest = statement.slice(8).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const value = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(value)) return void 0;
    const flatten = (arr) => {
      const out = [];
      for (const item of arr) {
        if (Array.isArray(item)) {
          out.push(...flatten(item));
        } else {
          out.push(item);
        }
      }
      return out;
    };
    const flat = flatten(value);
    if (varPart) {
      assignPath(varPart, flat, locals);
    }
    return flat;
  }
  var flattenCommand = {
    prefix: ["flatten"],
    signature: "flatten <arrayPath> as <var>",
    description: "Flattens a nested array into a one\u2011dimensional array",
    handler: handleFlatten
  };

  // src/builtins/avg.ts
  function handleAvg(statement, locals) {
    if (!statement.startsWith("avg ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr) || arr.length === 0) return void 0;
    const total = arr.reduce((acc, cur) => acc + Number(cur), 0);
    const avg = total / arr.length;
    if (varPart) {
      assignPath(varPart, avg, locals);
    }
    return avg;
  }
  var avgCommand = {
    prefix: ["avg"],
    signature: "avg <arrayPath> as <var>",
    description: "Computes average of numeric array values",
    handler: handleAvg
  };

  // src/builtins/clone.ts
  function handleClone(statement, locals) {
    if (!statement.startsWith("clone ")) return void 0;
    const rest = statement.slice(6).trim();
    const match = rest.match(/^(.*?)\s+to\s+(.*)$/);
    let src;
    let dest = null;
    if (!match) {
      src = rest;
    } else {
      src = match[1].trim();
      dest = match[2].trim();
    }
    if (!src) return void 0;
    const value = evaluateExpression(src, buildScope(locals));
    const copy = JSON.parse(JSON.stringify(value));
    if (dest) {
      assignPath(dest, copy, locals);
    }
    return copy;
  }
  var cloneCommand = {
    prefix: ["clone"],
    signature: "clone <srcPath> to <destPath>",
    description: "Deep\u2011copies a value from source to destination",
    handler: handleClone
  };

  // src/builtins/parse_json.ts
  function handleParseJson(statement, locals) {
    const match = statement.trim().match(/^parse-json\s+(.+)$/);
    if (!match) return void 0;
    const source = evaluateExpression(match[1], buildScope(locals, statement));
    if (typeof source !== "string") throw new Error("parse-json: expected a string");
    try {
      return JSON.parse(source);
    } catch {
      throw new Error("parse-json: invalid JSON");
    }
  }
  var parseJsonCommand = {
    prefix: ["parse-json"],
    signature: "x = parse-json <expr>",
    description: "Parses a JSON string and returns the value",
    handler: handleParseJson
  };

  // src/builtins/fetch.ts
  var DEFAULT_FETCH_LIMITS = { timeoutMs: 1e4, maxBodyBytes: 1024 * 1024 };
  var forbiddenHeaders = /* @__PURE__ */ new Set([
    "accept-charset",
    "accept-encoding",
    "access-control-request-headers",
    "access-control-request-method",
    "connection",
    "content-length",
    "cookie",
    "cookie2",
    "date",
    "dnt",
    "expect",
    "host",
    "keep-alive",
    "origin",
    "permissions-policy",
    "referer",
    "set-cookie",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "user-agent",
    "via",
    "x-http-method",
    "x-http-method-override",
    "x-method-override"
  ]);
  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function parseRequestOptions(value) {
    if (!isObject(value)) throw new FetchError("fetch: options must be an object");
    const options = { ...DEFAULT_FETCH_LIMITS };
    const boundedInteger = (item, field, max) => {
      if (typeof item === "number" && Number.isInteger(item) && item >= 1 && item <= max) return item;
      throw new FetchError(`fetch: ${field} must be an integer from 1 to ${max}`);
    };
    for (const [field, item] of Object.entries(value)) {
      switch (field) {
        case "timeout_ms":
          options.timeoutMs = boundedInteger(item, field, 6e4);
          break;
        case "max_body_bytes":
          options.maxBodyBytes = boundedInteger(item, field, 8 * 1024 * 1024);
          break;
        case "redirect":
          if (item !== "follow" && item !== "error") throw new FetchError("fetch: redirect must be follow or error");
          options.redirect = item;
          break;
        case "headers": {
          if (!isObject(item)) throw new FetchError("fetch: headers must be an object");
          const headers = new Headers();
          for (const [header, value2] of Object.entries(item)) {
            const name2 = header.toLowerCase();
            if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name2)) throw new FetchError("fetch: invalid header name");
            if (forbiddenHeaders.has(name2) || name2.startsWith("proxy-") || name2.startsWith("sec-")) {
              throw new FetchError(`fetch: request header ${name2} is not supported`);
            }
            if (typeof value2 !== "string") throw new FetchError("fetch: header values must be strings");
            if (/[^\t\x20-\x7e]/.test(value2)) throw new FetchError("fetch: invalid header value");
            if (headers.has(name2)) throw new FetchError("fetch: duplicate header name");
            headers.set(name2, value2);
          }
          if (Object.keys(item).length > 0) options.headers = headers;
          break;
        }
        default:
          throw new FetchError(`fetch: unknown option ${field}`);
      }
    }
    if (options.headers) {
      if (options.redirect === "follow") throw new FetchError("fetch: requests with custom headers cannot follow redirects");
      options.redirect = "error";
    }
    return options;
  }
  var FetchError = class extends Error {
    constructor(message, status = 0) {
      super(message);
      this.status = status;
    }
  };
  function redactUrl(url) {
    const safe = new URL(url.href);
    safe.username = "";
    safe.password = "";
    safe.search = "";
    safe.hash = "";
    return safe.href;
  }
  function parseUrl(value) {
    if (typeof value !== "string" || !value) throw new FetchError("fetch: URL must be a non-empty string");
    const base = typeof location !== "undefined" ? location.href : void 0;
    let url;
    try {
      url = new URL(value, base);
    } catch {
      throw new FetchError("fetch: not a valid URL");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new FetchError(`fetch: unsupported URL scheme '${url.protocol.slice(0, -1)}' (only http and https)`);
    }
    return url;
  }
  async function runFetch(target, limits = DEFAULT_FETCH_LIMITS) {
    const url = parseUrl(target);
    const shown = redactUrl(url);
    const tooLarge = () => new FetchError(`fetch: ${shown} response exceeded ${limits.maxBodyBytes} bytes`);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, limits.timeoutMs);
    try {
      const response = await fetch(url.href, {
        method: "GET",
        redirect: limits.redirect ?? "follow",
        headers: limits.headers,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
      const declared = Number(response.headers.get("content-length"));
      if (declared > limits.maxBodyBytes) throw tooLarge();
      const chunks = [];
      let total = 0;
      const reader = response.body?.getReader();
      if (reader) {
        for (; ; ) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > limits.maxBodyBytes) {
            await reader.cancel();
            throw tooLarge();
          }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return {
        status: response.status,
        ok: response.ok,
        url: response.url ? redactUrl(new URL(response.url)) : shown,
        content_type: response.headers.get("content-type") ?? "",
        body: new TextDecoder().decode(bytes)
      };
    } catch (error) {
      if (error instanceof FetchError) throw error;
      if (timedOut) throw new FetchError(`fetch: ${shown} timed out after ${limits.timeoutMs / 1e3}s`);
      const reason = limits.redirect === "error" ? "network error, redirect, or blocked by CORS" : "network error or blocked by CORS";
      throw new FetchError(`fetch: request to ${shown} failed (${reason})`);
    } finally {
      clearTimeout(timer);
    }
  }
  async function runFetchJson(target, limits) {
    const result = await runFetch(target, limits);
    const shown = redactUrl(new URL(result.url));
    if (!result.ok) throw new FetchError(`fetch-json: ${shown} returned HTTP ${result.status}`, result.status);
    try {
      return JSON.parse(result.body);
    } catch {
      throw new FetchError(`fetch-json: ${shown} did not return valid JSON`, result.status);
    }
  }
  function parseFetchAssignment(statement) {
    const match = statement.trim().match(/^([A-Za-z_][\w.[\]'"]*)\s*=\s*(fetch|fetch-json)\s+(.+?)(?:\s+catch\s+(\S+))?$/);
    if (!match) return null;
    return { target: match[1], kind: match[2], urlExpr: match[3], onError: match[4] };
  }
  function runFetchAssignment(pending, locals) {
    const context = ctx();
    return Promise.resolve().then(() => withContext(context, () => runRequest(pending.kind, pending.urlExpr, locals)));
  }
  function runRequest(kind, request2, locals) {
    const options = request2.match(/\s+options\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)$/);
    const url = options ? request2.slice(0, options.index) : request2;
    const scope = buildScope(locals, request2);
    const config = options ? parseRequestOptions(evaluateExpression(options[1], scope)) : void 0;
    return (kind === "fetch" ? runFetch : runFetchJson)(evaluateExpression(url, scope), config);
  }
  function reportFetchFailure(error, onError, locals) {
    const message = error instanceof Error ? error.message : String(error);
    if (onError) {
      if (locals && Object.keys(locals).length) {
        ctx().app.invokeAction(onError, [{ status: error instanceof FetchError ? error.status : 0, message }], locals);
        ctx().app.render();
      } else deliver(onError, { status: error instanceof FetchError ? error.status : 0, message });
    } else console.warn(message);
  }
  function deliver(action, payload) {
    const app = ctx().app;
    app.invokeAction(action, [payload]);
    app.render();
  }
  function makeHandler(name2) {
    return (statement, locals) => {
      const match = statement.trim().match(new RegExp(`^${name2}\\s+(.+?)\\s+then\\s+(\\S+)(?:\\s+catch\\s+(\\S+))?$`));
      if (!match) return void 0;
      const [, urlExpr, onSuccess, onError] = match;
      const context = ctx();
      Promise.resolve().then(() => withContext(context, () => runRequest(name2, urlExpr, locals))).then(
        (value) => withContext(context, () => deliver(onSuccess, value)),
        (error) => withContext(context, () => reportFetchFailure(error, onError))
      );
      return true;
    };
  }
  var fetchCommand = {
    prefix: ["fetch"],
    signature: "fetch <url> [options <binding>] then <action> [catch <action>]",
    description: "HTTP GET; calls the action with { status, ok, url, content_type, body }",
    handler: makeHandler("fetch")
  };
  var fetchJsonCommand = {
    prefix: ["fetch-json"],
    signature: "fetch-json <url> [options <binding>] then <action> [catch <action>]",
    description: "HTTP GET; calls the action with the parsed JSON, or the catch action on failure",
    handler: makeHandler("fetch-json")
  };

  // src/builtins/timer.ts
  function handleStartTimer(statement, _locals) {
    if (!statement.startsWith("start-timer ") && !statement.startsWith("interval ")) return void 0;
    const rest = statement.startsWith("start-timer ") ? statement.slice(12).trim() : statement.slice(9).trim();
    const match = rest.match(/^([A-Za-z_][\w-]*)\s*([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
    if (!match) return void 0;
    const action = match[1];
    let ms = Number(match[2]);
    if (match[3]?.toLowerCase() === "s") ms *= 1e3;
    const app = ctx().app;
    if (app.startTimer) {
      app.startTimer(action, ms);
    }
    return true;
  }
  function handleStopTimer(statement, _locals) {
    const trimmed = statement.trim();
    if (trimmed !== "stop-timer" && trimmed !== "clear-timer" && trimmed !== "clear-interval") return void 0;
    const app = ctx().app;
    if (app.stopTimer) {
      app.stopTimer();
    }
    return true;
  }
  var startTimerCommand = {
    prefix: ["start-timer", "interval"],
    signature: "start-timer <action> <duration>ms",
    description: "Starts a periodic timer calling the named action",
    handler: handleStartTimer
  };
  var stopTimerCommand = {
    prefix: ["stop-timer", "clear-timer", "clear-interval"],
    signature: "stop-timer",
    description: "Stops the active periodic timer",
    handler: handleStopTimer
  };

  // src/builtins/location.ts
  function failure(error) {
    switch (error.code) {
      case 1:
        return { code: "denied", message: "Location permission was denied." };
      case 2:
        return { code: "unavailable", message: "Location is unavailable." };
      case 3:
        return { code: "timeout", message: "Location request timed out." };
      default:
        return { code: "unavailable", message: "Location is unavailable." };
    }
  }
  function deliver2(action, value, locals) {
    const app = ctx().app;
    if (Object.keys(locals).length) app.invokeAction(action, [value], locals);
    else app.invokeAction(action, [value]);
    app.render();
  }
  function report(action, error, locals) {
    if (action) deliver2(action, error, locals);
    else console.warn(`location: ${error.message}`);
  }
  function requestLocation(onSuccess, onError, locals) {
    const context = ctx();
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      report(onError, { code: "unavailable", message: "Location is unavailable in this browser." }, locals);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position2) => withContext(context, () => deliver2(onSuccess, {
        latitude: position2.coords.latitude,
        longitude: position2.coords.longitude,
        accuracy: position2.coords.accuracy,
        timestamp: position2.timestamp
      }, locals)),
      (error) => withContext(context, () => report(onError, failure(error), locals)),
      { enableHighAccuracy: false, timeout: 1e4, maximumAge: 6e4 }
    );
  }
  function locationHandler(statement, actionLocals) {
    const locals = { ...actionLocals };
    const match = statement.trim().match(
      /^location\.(current|if-granted)\s+then\s+([A-Za-z_][\w.-]*)(?:\s+catch\s+([A-Za-z_][\w.-]*))?$/
    );
    if (!match) throw new Error("Use location.current then <action> [catch <action>] or location.if-granted then <action> [catch <action>]");
    const [, mode, success, onError] = match;
    if (mode === "current") {
      requestLocation(success, onError, locals);
    } else {
      const context = ctx();
      if (typeof navigator === "undefined" || !navigator.permissions) {
        report(onError, { code: "unavailable", message: "Location permission status is unavailable." }, locals);
        return true;
      }
      navigator.permissions.query({ name: "geolocation" }).then(
        (permission) => withContext(context, () => {
          if (permission.state === "granted") requestLocation(success, onError, locals);
          else report(onError, { code: permission.state, message: "Location permission has not been granted." }, locals);
        }),
        () => withContext(context, () => report(onError, {
          code: "unavailable",
          message: "Location permission status is unavailable."
        }, locals))
      );
    }
    return true;
  }
  var locationCommand = {
    prefix: ["location.current", "location.if-granted"],
    signature: "location.current then <action> [catch <action>]",
    description: "Request browser location or use it only if permission is already granted.",
    handler: locationHandler
  };

  // src/builtins/index.ts
  var postfixMap = {};
  var prefixMap = {};
  var infixMap = {};
  function registerCommand(cmd) {
    for (const name2 of cmd.prefix || []) {
      prefixMap[name2] = cmd;
    }
    for (const name2 of cmd.postfix || []) {
      postfixMap[name2] = cmd;
    }
    for (const name2 of cmd.infix || []) {
      infixMap[name2] = cmd;
    }
  }
  registerCommand(logCommand);
  registerCommand(deleteCommand);
  registerCommand(invertCommand);
  registerCommand(incrementCommand);
  registerCommand(decrementCommand);
  registerCommand(swapCommand);
  registerCommand(stopCommand);
  registerCommand(pushCommand);
  registerCommand(maxCommand);
  registerCommand(minCommand);
  registerCommand(delayCommand);
  registerCommand(uniqueCommand);
  registerCommand(sumCommand);
  registerCommand(randomizeCommand);
  registerCommand(countCommand);
  registerCommand(flattenCommand);
  registerCommand(avgCommand);
  registerCommand(cloneCommand);
  registerCommand(startTimerCommand);
  registerCommand(stopTimerCommand);
  registerCommand(parseJsonCommand);
  registerCommand(fetchCommand);
  registerCommand(fetchJsonCommand);
  registerCommand(locationCommand);
  function handleWhen(statement, locals) {
    const whenIndex = statement.lastIndexOf(" when ");
    if (whenIndex === -1) return statement;
    const conditionExpr = statement.slice(whenIndex + 6).trim();
    const commandPart = statement.slice(0, whenIndex).trim();
    const condResult = Boolean(evaluateExpression(conditionExpr, buildScope(locals)));
    return condResult ? commandPart : null;
  }
  function handleBuiltin(statement, locals) {
    const cmd = getPrefixCmd(statement, locals) || getInfixCmd(statement, locals) || getPostfixCmd(statement, locals);
    if (!cmd) return void 0;
    const processed = handleWhen(statement, locals);
    if (processed === null) return NO_ACTION;
    const result = cmd.handler(processed, locals);
    return result !== void 0 ? result : false;
  }
  function getPrefixCmd(statement, locals) {
    const trimmed = statement.trim();
    const firstSpace = trimmed.indexOf(" ");
    const cmdName = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
    return prefixMap[cmdName];
  }
  function getInfixCmd(statement, locals) {
    const whenIdx = statement.lastIndexOf(" when ");
    const everythingBeforeWhen = whenIdx !== -1 ? statement.slice(0, whenIdx) : statement;
    const parts = everythingBeforeWhen.split(" ");
    for (const part of parts) {
      if (infixMap[part]) {
        return infixMap[part];
      }
    }
    return void 0;
  }
  function getPostfixCmd(statement, locals) {
    const whenIdx = statement.lastIndexOf(" when ");
    const everythingBeforeWhen = whenIdx !== -1 ? statement.slice(0, whenIdx).trim() : statement.trim();
    for (const cmd of Object.values(postfixMap)) {
      if (cmd.postfix?.some((cmd2) => everythingBeforeWhen.endsWith(cmd2))) {
        return cmd;
      }
    }
    return void 0;
  }

  // src/music_clock.ts
  var MusicClock = class {
    constructor(time, bpm, beat = 0) {
      this.marks = [{ time, bpm, beat }];
    }
    at(position2, key2) {
      let i = this.marks.length - 1;
      while (i > 0 && this.marks[i][key2] > position2) i--;
      return this.marks[i];
    }
    beatAt(time) {
      const mark = this.at(time, "time");
      return mark.beat + (time - mark.time) / (60 / mark.bpm);
    }
    timeAt(beat) {
      const mark = this.at(beat, "beat");
      return mark.time + (beat - mark.beat) * (60 / mark.bpm);
    }
    tempoAt(time) {
      return this.at(time, "time").bpm;
    }
    changeAfter(bpm, scheduledUntil) {
      while (this.marks.length > 1 && this.marks[this.marks.length - 1].time > scheduledUntil) {
        this.marks.pop();
      }
      if (this.tempoAt(scheduledUntil) === bpm) return;
      const beat = Math.max(Math.floor(this.beatAt(scheduledUntil)) + 1, this.marks[0].beat);
      this.marks.push({ beat, time: this.timeAt(beat), bpm });
    }
  };

  // src/studio_sequencer.ts
  var TICKS_PER_WHOLE = 16;
  var STUDIO_TICK_WIDTH = 30;
  var STUDIO_STRIP_TICK_WIDTH = 48;
  function studioBarTicks(timeSignature) {
    return timeSignature === "3/4" ? 12 : 16;
  }
  function studioTokenTicks(token, barTicks) {
    const denominator = Number(token.match(/:([\d.]+)$/)?.[1]) || 8;
    return denominator === 1 ? barTicks : Math.max(1, Math.round(TICKS_PER_WHOLE / denominator));
  }
  function withTicks(token, ticks) {
    return token.replace(/:[\d.]+$/, "") + ":" + TICKS_PER_WHOLE / ticks;
  }
  function isStudioRest(token) {
    return /^(?:-|rest|r|_)(?::|$)/i.test(token);
  }
  function scoreMeasures(score, barTicks) {
    const clean = score.replace(/^\s*#.*$/gm, "").replace(/\s+#.*$/gm, "");
    const tokens2 = (part) => part.trim().match(/\[[^\]]*\](?::[^\s]+)?|\S+/g) ?? [];
    if (clean.includes("|")) return clean.split("|").map(tokens2);
    const measures = [[]];
    let tick = 0;
    for (const token of tokens2(clean)) {
      if (tick >= barTicks) {
        measures.push([]);
        tick = 0;
      }
      measures[measures.length - 1].push(token);
      tick += studioTokenTicks(token, barTicks);
    }
    return measures;
  }
  function measureSpans(tokens2, barTicks, clip) {
    const spans = [];
    let tick = 0;
    for (const token of tokens2) {
      if (clip && tick >= barTicks) break;
      const duration = studioTokenTicks(token, barTicks);
      const ticks = clip ? Math.min(duration, barTicks - tick) : duration;
      if (!isStudioRest(token)) spans.push({ token, tick, ticks });
      tick += ticks;
    }
    return spans;
  }
  function appendRests(tokens2, ticks) {
    for (const length of [16, 8, 4, 2, 1]) {
      while (ticks >= length) {
        tokens2.push(withTicks("-", length));
        ticks -= length;
      }
    }
  }
  function serializeMeasure(spans, barTicks, pad) {
    const tokens2 = [];
    let tick = 0;
    for (const span of spans) {
      appendRests(tokens2, span.tick - tick);
      tokens2.push(withTicks(span.token.replace(/\s+/g, ""), span.ticks));
      tick = span.tick + span.ticks;
    }
    if (pad) appendRests(tokens2, barTicks - tick);
    return tokens2.join(" ");
  }
  function studioTrackPattern(score, barTicks, bars) {
    const measures = scoreMeasures(score, barTicks);
    return Array.from(
      { length: bars },
      (_, index2) => serializeMeasure(measureSpans(measures[index2] ?? [], barTicks, true), barTicks, true)
    ).join(" | ");
  }
  function editStudioTrack(score, barTicks, bars, edit) {
    const measures = scoreMeasures(score, barTicks);
    while (measures.length < bars) measures.push([]);
    if (edit.kind === "addBar" || edit.kind === "duplicateBar" || edit.kind === "deleteBar") {
      if (edit.kind === "deleteBar") measures.splice(edit.bar - 1, 1);
      else measures.splice(bars, 0, edit.kind === "duplicateBar" ? measures[edit.bar - 1] : []);
      return { score: measures.map((tokens2) => tokens2.join(" ")).join(" | "), bar: 0, tick: -1 };
    }
    if (edit.kind === "delete" && edit.tick !== void 0) {
      const spans = measureSpans(measures[edit.bar - 1] ?? [], barTicks, false);
      const index2 = spans.findIndex((span) => span.tick === edit.tick);
      if (index2 < 0) return;
      spans.splice(index2, 1);
      measures[edit.bar - 1] = [serializeMeasure(spans, barTicks, false)];
      return { score: measures.map((tokens2) => tokens2.join(" ")).join(" | ").trim(), bar: edit.bar, tick: edit.tick };
    }
  }
  function studioStretchTicks(ticks, delta, limit) {
    const lengths = [.../* @__PURE__ */ new Set([1, 2, 4, 8, limit])].filter((length) => length > 0 && length <= limit).sort((a, b) => a - b);
    if (delta > 0) return lengths.find((length) => length > ticks) ?? ticks;
    return lengths.filter((length) => length < ticks).pop() ?? ticks;
  }
  var STUDIO_STEP_IDS_PER_VOICE = 1e3;
  function tokenPitches(token) {
    return token.replace(/:[\d.]+$/, "").replace(/[\[\]]/g, "").split(/[,+]/);
  }
  function studioScoreLanes(score, barTicks) {
    return score.split("\n").flatMap((line) => {
      if (!/[\[+,]/.test(line)) return [line];
      const measures = scoreMeasures(line, barTicks).map((tokens2) => measureSpans(tokens2, barTicks, false));
      const count = Math.max(1, ...measures.flatMap((spans) => spans.map((span) => tokenPitches(span.token).length)));
      return Array.from({ length: count }, (_, index2) => measures.map((spans) => {
        const part = [];
        for (const span of spans) {
          const pitch2 = tokenPitches(span.token)[index2];
          if (pitch2) part.push({ ...span, token: pitch2 });
        }
        return serializeMeasure(part, barTicks, false);
      }).join(" | "));
    });
  }
  function studioTrackPatterns(score, barTicks, bars) {
    return studioScoreLanes(score, barTicks).map((lane) => studioTrackPattern(lane, barTicks, bars));
  }
  function pitchKey(pitch2) {
    const match = /^([A-G])([#b]?)(\d+)$/i.exec(pitch2);
    if (!match) return pitch2.toLowerCase();
    const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const accidental = match[2] === "#" ? 1 : match[2] ? -1 : 0;
    return String(Number(match[3]) * 12 + semitones[match[1].toUpperCase()] + accidental);
  }
  function placeStudioNote(score, barTicks, bars, edit) {
    const { bar, tick, source, resizeBy } = edit;
    if (bar < 1 || bar > bars || tick < 0 || tick >= barTicks) return;
    const lanes = studioScoreLanes(score, barTicks).map((lane2) => scoreMeasures(lane2, barTicks));
    for (const lane2 of lanes) while (lane2.length < bars) lane2.push([]);
    const sourceSpans = source ? measureSpans(lanes[source.lane]?.[source.bar - 1] ?? [], barTicks, false) : void 0;
    const original = sourceSpans?.find((span) => span.tick === source?.tick);
    if (source && !original) return;
    const originalTicks = original && source ? Math.min(original.ticks, barTicks - source.tick) : 0;
    const targetSpans = lanes.map((lane2, index2) => {
      const spans = measureSpans(lane2[bar - 1] ?? [], barTicks, false);
      return source?.bar === bar && source.lane === index2 ? spans.filter((span) => span.tick !== source.tick) : spans;
    });
    const samePitch = targetSpans.flat().filter((span) => pitchKey(tokenPitches(span.token)[0]) === pitchKey(edit.pitch));
    const next2 = Math.min(barTicks, ...samePitch.filter((span) => span.tick > tick).map((span) => span.tick));
    const requested = source ? originalTicks + (resizeBy ?? 0) : edit.ticks ?? 1;
    const ticks = !source || resizeBy !== void 0 ? Math.max(1, Math.min(next2 - tick, requested)) : requested;
    const overlaps = (span) => tick < span.tick + span.ticks && span.tick < tick + ticks;
    if (tick + ticks > barTicks || samePitch.some(overlaps)) return { ticks, valid: false };
    if (source && source.bar === bar && source.tick === tick && original && tokenPitches(original.token)[0] === edit.pitch && ticks === originalTicks) return { ticks, valid: true, lane: source.lane };
    const preferred = source?.lane ?? 0;
    let lane = targetSpans[preferred] && !targetSpans[preferred].some(overlaps) ? preferred : targetSpans.findIndex((spans) => !spans.some(overlaps));
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(Array.from({ length: bars }, () => []));
      targetSpans.push([]);
    }
    if (source && sourceSpans) {
      const remaining = sourceSpans.filter((span) => span.tick !== source.tick);
      lanes[source.lane][source.bar - 1] = [serializeMeasure(remaining, barTicks, false)];
    }
    const target = targetSpans[lane];
    target.push({ token: edit.pitch, tick, ticks });
    target.sort((a, b) => a.tick - b.tick);
    lanes[lane][bar - 1] = [serializeMeasure(target, barTicks, false)];
    const joined = lanes.map((measures) => Array.from(measures, (tokens2) => tokens2?.join(" ") || "").join(" | ").trim());
    while (joined.length > 1 && !/[^|\s]/.test(joined[joined.length - 1])) joined.pop();
    return { ticks, valid: true, lane, score: joined.join("\n") };
  }
  function pasteStudioNotes(score, barTicks, bars, start, notes) {
    const lanes = studioScoreLanes(score, barTicks).map((lane) => scoreMeasures(lane, barTicks));
    const measures = /* @__PURE__ */ new Map();
    for (const note of notes) {
      const column = start + note.offset;
      const bar = Math.floor(column / barTicks);
      const tick = column % barTicks;
      if (bar < 0 || bar >= bars || tick + note.ticks > barTicks) return { error: "bars" };
      let spans = measures.get(bar);
      if (!spans) {
        spans = lanes.map((lane2) => measureSpans(lane2[bar] ?? [], barTicks, false));
        measures.set(bar, spans);
      }
      const pitch2 = pitchKey(note.pitch);
      const overlaps = (span) => tick < span.tick + span.ticks && span.tick < tick + note.ticks;
      if (spans.some((lane2) => lane2.some((span) => overlaps(span) && pitchKey(tokenPitches(span.token)[0]) === pitch2))) {
        return { error: "overlap" };
      }
      let lane = spans.findIndex((part) => !part.some(overlaps));
      if (lane === -1) {
        lane = spans.length;
        lanes.push([]);
        for (const measure of measures.values()) measure.push([]);
      }
      spans[lane].push({ token: note.pitch, tick, ticks: note.ticks });
    }
    for (const [bar, spans] of measures) {
      for (const [index2, lane] of spans.entries()) {
        lane.sort((a, b) => a.tick - b.tick);
        lanes[index2][bar] = [serializeMeasure(lane, barTicks, false)];
      }
    }
    for (const lane of lanes) while (lane.length < bars) lane.push([]);
    return { score: lanes.map((lane) => Array.from(lane, (tokens2) => tokens2?.join(" ") ?? "").join(" | ").trim()).join("\n") };
  }

  // src/audio_sync.ts
  var AudioSyncEngine = class {
    constructor() {
      this.scheduledNotes = [];
      this.listeners = /* @__PURE__ */ new Set();
      this.animFrameId = null;
      this.isPlaying = false;
      this.isPaused = false;
      this.activeTrackName = null;
      this.tempoBpm = 128;
      this.timeSignature = "4/4";
      this.totalBars = 4;
      this.totalBeats = 16;
      this.clock = new MusicClock(0, 128);
      this.parkedBeat = 0;
      this.syncPage = true;
      this.getAudioCtx = null;
      this.lastActiveStepId = -1;
      this.lastActiveStepIds = [];
      this.lastActiveBar = -1;
      this.channelStepIds = {};
    }
    /**
     * Configure the audio context provider and track metadata.
     */
    configure(options) {
      this.getAudioCtx = options.getAudioContext;
      this.syncPage = options.syncPage ?? true;
    }
    /**
     * Subscribe a callback to audio sync updates.
     */
    subscribe(listener) {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }
    /**
     * Record a scheduled note with its precise Web Audio hardware timestamp.
     */
    enqueueNote(note) {
      this.scheduledNotes.push(note);
    }
    /**
     * Notify sync engine that playback has started or resumed.
     */
    onPlay(params) {
      this.isPlaying = true;
      this.isPaused = false;
      this.activeTrackName = params.track;
      this.tempoBpm = params.tempo;
      this.timeSignature = params.timeSignature;
      this.totalBars = params.totalBars;
      this.totalBeats = params.totalBeats;
      this.clock = params.clock ?? new MusicClock(params.startTime, params.tempo);
      this.parkedBeat = params.startBeat ?? 0;
      this.scheduledNotes = [];
      this.lastActiveStepId = -1;
      this.lastActiveStepIds = [];
      this.lastActiveBar = -1;
      this.channelStepIds = {};
      this.startLoop();
    }
    /**
     * Notify sync engine that playback has paused.
     */
    onPause(beat = this.getSnapshot().currentBeat) {
      this.tempoBpm = this.getSnapshot().tempo;
      this.parkedBeat = beat;
      this.isPaused = true;
      this.stopLoop();
      const snapshot = this.getSnapshot();
      this.updatePageState(snapshot.currentBeat, snapshot.currentBar, snapshot.progressPercent, snapshot.activeStepId);
      this.broadcastSnapshot();
    }
    /**
     * Notify sync engine that playback has stopped.
     */
    onStop() {
      this.isPlaying = false;
      this.isPaused = false;
      this.activeTrackName = null;
      this.parkedBeat = 0;
      this.scheduledNotes = [];
      this.channelStepIds = {};
      this.lastActiveStepId = -1;
      this.lastActiveStepIds = [];
      this.lastActiveBar = -1;
      this.stopLoop();
      this.clearVisuals();
      this.broadcastSnapshot();
    }
    /**
     * Get current snapshot of the audio sync state.
     */
    getSnapshot() {
      const ctx2 = this.getAudioCtx ? this.getAudioCtx() : null;
      const outputLatency = ctx2 ? (ctx2.outputLatency || 0) + (ctx2.baseLatency || 0) : 0;
      const visualTime = ctx2 ? Math.max(0, ctx2.currentTime - outputLatency) : 0;
      const beat = this.isPlaying && !this.isPaused && this.totalBeats > 0 ? Math.max(this.parkedBeat, this.clock.beatAt(visualTime)) % this.totalBeats : this.parkedBeat;
      const beatsPerBar = this.timeSignature.startsWith("3/") ? 3 : 4;
      const currentBeat = beat;
      const currentBar = Math.min(this.totalBars, Math.floor(currentBeat / beatsPerBar) + 1);
      const progressPercent = this.totalBeats > 0 ? currentBeat / this.totalBeats * 100 : 0;
      return {
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        track: this.activeTrackName,
        tempo: this.isPlaying && !this.isPaused ? this.clock.tempoAt(visualTime) : this.tempoBpm,
        timeSignature: this.timeSignature,
        currentBeat,
        currentBar,
        totalBars: this.totalBars,
        totalBeats: this.totalBeats,
        progressPercent,
        activeStepId: this.lastActiveStepId,
        activeBar: currentBar,
        channelStepIds: { ...this.channelStepIds }
      };
    }
    startLoop() {
      if (typeof window === "undefined") return;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      const tick = () => {
        if (!this.isPlaying || this.isPaused) {
          return;
        }
        this.updateFrame();
        this.animFrameId = requestAnimationFrame(tick);
      };
      this.animFrameId = requestAnimationFrame(tick);
    }
    stopLoop() {
      if (typeof window === "undefined") return;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }
    updateFrame() {
      const ctx2 = this.getAudioCtx ? this.getAudioCtx() : null;
      if (!ctx2) return;
      const outputLatency = (ctx2.outputLatency || 0) + (ctx2.baseLatency || 0);
      const visualTime = ctx2.currentTime - outputLatency;
      this.scheduledNotes = this.scheduledNotes.filter((n) => n.endTime >= visualTime - 0.5);
      const activeVoice = this.getActiveVoice();
      const currentStepIds = [];
      this.channelStepIds = {};
      for (const note of this.scheduledNotes) {
        if (visualTime < note.startTime || visualTime >= note.endTime) continue;
        this.channelStepIds[note.channel] = note.stepId;
        if (note.channel === activeVoice) currentStepIds.push(note.stepId);
        else if (note.channel.startsWith(activeVoice + "_studio_")) {
          const lane = Number(note.channel.slice(activeVoice.length + "_studio_".length));
          if (Number.isInteger(lane) && lane > 0) currentStepIds.push(note.stepId + lane * STUDIO_STEP_IDS_PER_VOICE);
        }
      }
      const currentStepId = currentStepIds[0] ?? -1;
      const changedSteps = currentStepIds.length !== this.lastActiveStepIds.length || currentStepIds.some((id, index2) => id !== this.lastActiveStepIds[index2]);
      const elapsedBeat = Math.max(this.parkedBeat, this.clock.beatAt(visualTime));
      const beatsPerBar = this.timeSignature.startsWith("3/") ? 3 : 4;
      const currentBeat = this.totalBeats > 0 ? elapsedBeat % this.totalBeats : elapsedBeat;
      const currentBar = Math.min(this.totalBars, Math.floor(currentBeat / beatsPerBar) + 1);
      const progressPercent = this.totalBeats > 0 ? currentBeat / this.totalBeats * 100 : 0;
      if (this.syncPage && typeof document !== "undefined" && document.documentElement) {
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty("--music-beat", currentBeat.toFixed(3));
        rootStyle.setProperty("--music-bar", String(currentBar));
        rootStyle.setProperty("--music-progress", `${progressPercent.toFixed(2)}%`);
        rootStyle.setProperty("--music-seq-left", `${Math.round(currentBeat * 120)}px`);
        rootStyle.setProperty("--music-playing", this.isPlaying ? "1" : "0");
      }
      if (this.syncPage) this.updateDeclarativeDom(currentBeat, progressPercent, currentBar, currentStepIds, changedSteps);
      if (changedSteps || currentBar !== this.lastActiveBar) {
        this.lastActiveStepIds = currentStepIds;
        this.lastActiveStepId = currentStepId;
        this.lastActiveBar = currentBar;
        this.updatePageState(currentBeat, currentBar, progressPercent, currentStepId);
        this.broadcastSnapshot();
      }
    }
    updatePageState(beat, bar, progress, step) {
      if (!this.syncPage || typeof window === "undefined") return;
      try {
        const state = window?.__RuneWeb?.ctx?.()?.app?.state;
        if (state) {
          state.playback_step_id = step;
          state.playback_bar = bar;
          state.playback_beat = beat;
          state.playback_progress = progress;
          state.playback_playing = this.isPlaying && !this.isPaused;
        }
      } catch (_) {
      }
    }
    updateDeclarativeDom(currentBeat, progressPercent, currentBar, currentStepIds, changedSteps) {
      if (typeof document === "undefined") return;
      const progressPlayheads = document.querySelectorAll(
        '[data-sync-playhead="progress"], #ruler-playhead'
      );
      progressPlayheads.forEach((el) => {
        el.style.left = `${Math.min(100, Math.max(0, progressPercent))}%`;
        el.style.display = "block";
      });
      const beatPlayheads = document.querySelectorAll(
        '[data-sync-playhead="beat"], #seq-playhead'
      );
      const beatPosition = (el) => {
        const bar = Number(el.dataset.syncViewBar) || 0;
        if (bar && currentBar !== bar) return;
        const beatsPerBar = this.timeSignature.startsWith("3/") ? 3 : 4;
        const beat = bar ? currentBeat - (bar - 1) * beatsPerBar : currentBeat;
        return Math.round(beat * (Number(el.dataset.syncPixelsPerBeat) || 120));
      };
      beatPlayheads.forEach((el) => {
        const pxLeft = beatPosition(el.parentElement ?? el);
        el.style.display = pxLeft === void 0 ? "none" : "block";
        if (pxLeft !== void 0) el.style.left = `${pxLeft}px`;
      });
      const scrollContainers = document.querySelectorAll(
        '[data-sync-scroll="beat"], .matrix-timeline-scroll'
      );
      scrollContainers.forEach((container) => {
        const pxLeft = beatPosition(container);
        if (pxLeft === void 0) return;
        if (pxLeft > container.scrollLeft + container.clientWidth - 140) {
          container.scrollLeft = pxLeft - 60;
        } else if (pxLeft < container.scrollLeft) {
          container.scrollLeft = Math.max(0, pxLeft - 60);
        }
      });
      if (currentBar !== this.lastActiveBar) {
        document.querySelectorAll(".playing-bar, [data-sync-playing-bar]").forEach((el) => {
          el.classList.remove("playing-bar");
          el.removeAttribute("data-sync-playing-bar");
        });
        document.querySelectorAll(
          `[data-sync-bar="${currentBar}"], .ruler-bar-item[data-bar-num="${currentBar}"]`
        ).forEach((el) => {
          el.classList.add("playing-bar");
          el.setAttribute("data-sync-playing-bar", "true");
        });
      }
      if (changedSteps) {
        document.querySelectorAll(".playing-step-now, [data-sync-playing-step]").forEach((el) => {
          el.classList.remove("playing-step-now");
          el.removeAttribute("data-sync-playing-step");
        });
      }
      for (const id of currentStepIds) {
        document.querySelectorAll(`[data-sync-step="${id}"], [data-step-idx="${id}"]`).forEach((el) => {
          el.classList.add("playing-step-now");
          el.setAttribute("data-sync-playing-step", "true");
        });
      }
    }
    clearVisuals() {
      if (!this.syncPage || typeof document === "undefined") return;
      if (document.documentElement) {
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty("--music-beat", "0");
        rootStyle.setProperty("--music-bar", "1");
        rootStyle.setProperty("--music-progress", "0%");
        rootStyle.setProperty("--music-seq-left", "0px");
        rootStyle.setProperty("--music-playing", "0");
      }
      document.querySelectorAll(".playing-bar, [data-sync-playing-bar]").forEach((el) => {
        el.classList.remove("playing-bar");
        el.removeAttribute("data-sync-playing-bar");
      });
      document.querySelectorAll(".playing-step-now, [data-sync-playing-step]").forEach((el) => {
        el.classList.remove("playing-step-now");
        el.removeAttribute("data-sync-playing-step");
      });
      const rulerPlayhead = document.getElementById("ruler-playhead");
      if (rulerPlayhead) {
        rulerPlayhead.style.left = "0%";
      }
      const seqPlayhead = document.getElementById("seq-playhead");
      if (seqPlayhead) {
        seqPlayhead.style.left = "0px";
      }
      try {
        const appState = window?.__RuneWeb?.ctx?.()?.app?.state;
        if (appState) {
          appState.playback_step_id = -1;
          appState.playback_bar = 1;
          appState.playback_beat = 0;
          appState.playback_progress = 0;
          appState.playback_playing = false;
        }
      } catch (_) {
      }
    }
    broadcastSnapshot() {
      const snapshot = this.getSnapshot();
      for (const listener of this.listeners) {
        try {
          listener(snapshot);
        } catch (err) {
          console.error("[AudioSyncEngine] Listener error:", err);
        }
      }
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(new CustomEvent("rune:music-sync", { detail: snapshot }));
        } catch (_) {
        }
      }
    }
    getActiveVoice() {
      if (!this.syncPage) return "lead";
      try {
        const voice = window?.__RuneWeb?.ctx?.()?.app?.state?.active_voice;
        return String(voice || "lead");
      } catch {
        return "lead";
      }
    }
  };
  var audioSync = new AudioSyncEngine();

  // src/music_arrangement.ts
  function compileMusicArrangement(def, parse) {
    if (!Object.keys(def.sections ?? {}).length && !def.arrangement?.length) return null;
    const parts = def.sections ?? {}, form = def.arrangement ?? [];
    if (!Object.keys(parts).length || Object.keys(parts).length > 32 || !form.length || form.length > 128)
      throw new Error("Music needs 1-32 sections and 1-128 arrangement entries");
    if (def.lead || def.bass || def.drums || Object.keys(def.tracks ?? {}).length || def.bars != null)
      throw new Error("Arranged music declares bars and note tracks inside sections");
    if (!["4/4", "3/4"].includes(def.time_signature ?? "4/4")) throw new Error("Arranged music supports 4/4 or 3/4 time");
    const beatsPerBar = def.time_signature === "3/4" ? 3 : 4;
    const channels2 = /* @__PURE__ */ new Set();
    const parsed = /* @__PURE__ */ Object.create(null);
    for (const [name2, part] of Object.entries(parts)) {
      const tracks = Object.entries(part).filter(([key2]) => key2 !== "bars");
      if (!name2 || !Number.isInteger(part.bars) || part.bars < 1 || part.bars > 64 || !tracks.length || tracks.length > 16)
        throw new Error(`Music section ${name2} needs 1-64 integer bars and 1-16 tracks`);
      parsed[name2] = /* @__PURE__ */ Object.create(null);
      for (const [channel, notes] of tracks) {
        if (typeof notes !== "string") throw new Error(`Music section ${name2}/${channel} needs note text`);
        const events = parse(notes);
        const duration = events.reduce((sum, e) => sum + e.beats, 0);
        if (!Number.isFinite(duration) || duration > part.bars * beatsPerBar + 1e-8)
          throw new Error(`Music section ${name2}/${channel} exceeds its declared bars`);
        parsed[name2][channel] = events;
        channels2.add(channel);
      }
    }
    const result = { bars: 0, tracks: /* @__PURE__ */ Object.create(null), sections: [] };
    for (const channel of channels2) result.tracks[channel] = [];
    for (const cue of form) {
      const name2 = typeof cue === "string" ? cue : cue.section;
      const repeat = typeof cue === "string" ? 1 : cue.repeat;
      if (!Object.prototype.hasOwnProperty.call(parts, name2)) throw new Error(`Unknown music section: ${name2}`);
      if (!Number.isInteger(repeat) || repeat < 1 || repeat > 16) throw new Error("Music section repeat must be an integer from 1 to 16");
      for (let i = 0; i < repeat; i++) {
        const beats = parts[name2].bars * beatsPerBar;
        if (result.bars + parts[name2].bars > 512) throw new Error("Music arrangement exceeds 512 bars");
        result.sections.push({ name: name2, startBeat: result.bars * beatsPerBar, beats });
        result.bars += parts[name2].bars;
        for (const channel of channels2) {
          const events = parsed[name2][channel] ?? [];
          const duration = events.reduce((sum, e) => sum + e.beats, 0);
          const offset = result.tracks[channel].length;
          result.tracks[channel].push(...events.map((e, index2) => ({ ...e, stepId: offset + index2 })));
          if (duration < beats) result.tracks[channel].push({ stepId: -1, pitch: 0, beats: beats - duration, isRest: true, isDrum: false });
        }
      }
    }
    return result;
  }

  // src/audio.ts
  var audioCtx = null;
  var stepIndex = 0;
  var masterGain = null;
  var audioMuted = false;
  var syncPageAudio = true;
  var playbackUnlocked = true;
  var pendingMusic = null;
  var sfxMasterGain = null;
  function sfxOutput(ctx2) {
    if (!sfxMasterGain) {
      sfxMasterGain = ctx2.createGain();
      sfxMasterGain.gain.setValueAtTime(0.65, ctx2.currentTime);
      sfxMasterGain.connect(audioOutput(ctx2));
    }
    return sfxMasterGain;
  }
  function audioOutput(ctx2) {
    if (!masterGain) {
      masterGain = ctx2.createGain();
      masterGain.gain.setValueAtTime(audioMuted ? 0 : 1, ctx2.currentTime);
      masterGain.connect(ctx2.destination);
    }
    return masterGain;
  }
  var registeredSounds = {};
  var registeredMusic = {};
  var arrangements = /* @__PURE__ */ new Map();
  function registerSounds(definitions2) {
    if (!definitions2) return;
    for (const [key2, val] of Object.entries(definitions2)) {
      registeredSounds[key2.toLowerCase()] = val;
    }
  }
  function registerMusic(definitions2) {
    if (!definitions2) return;
    for (const [key2, val] of Object.entries(definitions2)) {
      const name2 = key2.toLowerCase();
      const arrangement = compileMusicArrangement(val, parseTrackPattern);
      if (arrangement) arrangements.set(name2, arrangement);
      else arrangements.delete(name2);
      registeredMusic[name2] = arrangement ? { ...val, bars: arrangement.bars } : val;
    }
  }
  function getAudioContext() {
    if (!playbackUnlocked || typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {
      });
    }
    return audioCtx;
  }
  var NOTE_OFFSETS = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  };
  function parseNoteToFreq(noteStr) {
    const trimmed = noteStr.trim();
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0) return num;
    const match = trimmed.toUpperCase().match(/^([A-G])([#B]?)([0-8])$/);
    if (!match) return 440;
    const [, letter, accidental, octaveStr] = match;
    let semitone = NOTE_OFFSETS[letter] || 0;
    if (accidental === "#") semitone += 1;
    else if (accidental === "B") semitone -= 1;
    const octave = parseInt(octaveStr, 10);
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function playSound(type, arg) {
    if (audioMuted) return;
    const ctx2 = getAudioContext();
    if (!ctx2) return;
    const now = ctx2.currentTime;
    const soundName = String(type || "").trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(registeredSounds, soundName)) {
      playCustomSound(ctx2, registeredSounds[soundName], now, arg);
      return;
    }
    switch (soundName) {
      case "laser":
      case "pew":
      case "fire": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(sfxOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.13);
        break;
      }
      case "hit":
      case "damage": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.09);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
        osc.connect(gain);
        gain.connect(sfxOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case "explosion":
      case "boom": {
        playNoiseBurst(ctx2, now, 0.35, 800, 60, 0.45);
        break;
      }
      case "step":
      case "move": {
        const steps = [110, 98, 87, 82];
        const freq = steps[stepIndex % steps.length];
        stepIndex += 1;
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(sfxOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }
      case "coin":
      case "powerup": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.connect(gain);
        gain.connect(sfxOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.29);
        break;
      }
      case "gameover": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.linearRampToValueAtTime(293, now + 0.15);
        osc.frequency.linearRampToValueAtTime(261, now + 0.3);
        osc.frequency.linearRampToValueAtTime(196, now + 0.55);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.connect(gain);
        gain.connect(sfxOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.62);
        break;
      }
      case "victory":
      case "win": {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const start = now + idx * 0.12;
          const osc = ctx2.createOscillator();
          const gain = ctx2.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.25, start);
          gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);
          osc.connect(gain);
          gain.connect(sfxOutput(ctx2));
          osc.start(start);
          osc.stop(start + 0.16);
        });
        break;
      }
      case "tone": {
        const freq = typeof arg === "number" ? arg : 440;
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(sfxOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }
      default:
        break;
    }
  }
  function playNoiseBurst(ctx2, now, duration, filterStart, filterEnd, volume, filterType = "lowpass", attack = 0) {
    const bufferSize = Math.max(1, Math.floor(ctx2.sampleRate * duration));
    const buffer = ctx2.createBuffer(1, bufferSize, ctx2.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise2 = ctx2.createBufferSource();
    noise2.buffer = buffer;
    const filter = ctx2.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, filterStart), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);
    const gain = ctx2.createGain();
    sweepEnvelope(gain.gain, now, duration, volume, attack);
    noise2.connect(filter);
    filter.connect(gain);
    gain.connect(sfxOutput(ctx2));
    noise2.start(now);
    noise2.stop(now + duration + 0.01);
  }
  function sweepEnvelope(gain, now, duration, volume, attack) {
    if (attack > 0 && duration > 0 && volume > 0) {
      gain.setValueAtTime(0, now);
      gain.linearRampToValueAtTime(volume, now + Math.min(attack, duration * 0.98));
    } else {
      gain.setValueAtTime(volume, now);
    }
    gain.exponentialRampToValueAtTime(1e-3, now + duration);
  }
  function playCustomSound(ctx2, def, now, arg) {
    const duration = def.duration || 0.12;
    const volume = def.volume !== void 0 ? def.volume : 0.25;
    const wave = (def.wave || "square").toLowerCase();
    if (wave === "noise") {
      const fStart = def.filter?.start_freq || 800;
      const fEnd = def.filter?.end_freq || 60;
      const fType = def.filter?.filter_type || "lowpass";
      playNoiseBurst(ctx2, now, duration, fStart, fEnd, volume, fType, def.attack);
      return;
    }
    if (def.sequence && def.sequence.length > 0) {
      let offset = 0;
      for (const [freq, noteDur] of def.sequence) {
        const start = now + offset;
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.type = wave || "square";
        osc2.frequency.setValueAtTime(freq, start);
        gain2.gain.setValueAtTime(volume, start);
        gain2.gain.exponentialRampToValueAtTime(0.01, start + noteDur);
        osc2.connect(gain2);
        gain2.connect(sfxOutput(ctx2));
        osc2.start(start);
        osc2.stop(start + noteDur + 0.01);
        offset += noteDur;
      }
      return;
    }
    let startFreq = def.freq_start || 440;
    if (def.notes && def.notes.length > 0) {
      startFreq = def.notes[stepIndex % def.notes.length];
      stepIndex += 1;
    } else if (typeof arg === "number") {
      startFreq = arg;
    }
    const endFreq = def.freq_end !== null && def.freq_end !== void 0 ? def.freq_end : startFreq;
    const osc = ctx2.createOscillator();
    const gain = ctx2.createGain();
    osc.type = wave || "square";
    osc.frequency.setValueAtTime(Math.max(1, startFreq), now);
    if (endFreq !== startFreq) {
      if (def.curve === "linear") {
        osc.frequency.linearRampToValueAtTime(Math.max(1, endFreq), now + duration);
      } else {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
      }
    }
    sweepEnvelope(gain.gain, now, duration, volume, def.attack ?? 0);
    osc.connect(gain);
    gain.connect(sfxOutput(ctx2));
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }
  var activeMusicTrackName = null;
  var musicSchedulerTimer = null;
  var musicMasterGain = null;
  var musicEffectsBus = null;
  var clearFadingMusic;
  var musicVolume = 0.2;
  var musicTempoBpm = 128;
  var musicLoop = true;
  var isMusicPaused = false;
  var MUSIC_LOOKAHEAD = 0.25;
  var musicClock = null;
  var musicPausedBeat = 0;
  var tracksState = {};
  function parseTrackPattern(patternStr) {
    const events = [];
    const clean = patternStr.replace(/^\s*#.*$/gm, "").replace(/\s+#.*$/gm, "");
    const tokens2 = clean.split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens2.length; i++) {
      const token = tokens2[i];
      if (token === "|") {
        continue;
      }
      let noteToken = token;
      let durationNum = 8;
      if (token.startsWith("[") && token.includes("]")) {
        const closeIdx = token.indexOf("]");
        noteToken = token.slice(1, closeIdx);
        const after = token.slice(closeIdx + 1);
        if (after.startsWith(":")) {
          durationNum = Number(after.slice(1)) || 8;
        }
      } else {
        const parts = token.split(":");
        noteToken = parts[0].trim();
        durationNum = parts.length > 1 ? Number(parts[1].trim()) : 8;
      }
      const beats = durationNum > 0 ? 4 / durationNum : 0.5;
      if (noteToken === "-" || noteToken.toUpperCase() === "R" || noteToken === "_") {
        events.push({ stepId: i, pitch: 0, beats, isRest: true, isDrum: false });
        continue;
      }
      const subNotes = noteToken.split(/[,+]/).map((s) => s.trim()).filter(Boolean);
      const drumNames = ["kick", "snare", "hihat", "crash", "tom"];
      if (subNotes.length > 1) {
        const isAnyDrum = subNotes.some((s) => drumNames.includes(s.toLowerCase()));
        const pitches = subNotes.map((s) => {
          if (drumNames.includes(s.toLowerCase())) return s.toLowerCase();
          return parseNoteToFreq(s);
        });
        events.push({
          stepId: i,
          pitch: pitches[0],
          pitches,
          beats,
          isRest: false,
          isDrum: isAnyDrum
        });
      } else {
        const s = subNotes[0] || noteToken;
        if (drumNames.includes(s.toLowerCase())) {
          events.push({ stepId: i, pitch: s.toLowerCase(), beats, isRest: false, isDrum: true });
        } else {
          events.push({ stepId: i, pitch: parseNoteToFreq(s), beats, isRest: false, isDrum: false });
        }
      }
    }
    return events;
  }
  function playMusic(trackName, startBeat = 0, fadeSeconds = 0) {
    if (!playbackUnlocked) {
      pendingMusic = { track: trackName, beat: startBeat };
      return;
    }
    const ctx2 = getAudioContext();
    if (!ctx2) return;
    const key2 = String(trackName || "").trim().toLowerCase();
    const def = registeredMusic[key2];
    if (!def) {
      return;
    }
    const fade = Number.isFinite(fadeSeconds) ? Math.min(5, Math.max(0, fadeSeconds)) : 0;
    const outgoing = fade > 0 && musicMasterGain ? { gain: musicMasterGain, effects: musicEffectsBus } : null;
    if (outgoing) {
      musicMasterGain = null;
      musicEffectsBus = null;
    }
    stopMusic();
    activeMusicTrackName = key2;
    musicTempoBpm = def.tempo || 128;
    musicLoop = def.loop_track !== false;
    musicVolume = def.volume !== void 0 ? def.volume : 0.2;
    isMusicPaused = false;
    tracksState = {};
    if (def.lead) {
      tracksState.lead = { events: parseTrackPattern(def.lead), index: 0, nextBeat: 0, instrument: "square" };
    }
    if (def.bass) {
      tracksState.bass = { events: parseTrackPattern(def.bass), index: 0, nextBeat: 0, instrument: "triangle" };
    }
    if (def.drums) {
      tracksState.drums = { events: parseTrackPattern(def.drums), index: 0, nextBeat: 0, instrument: "drums" };
    }
    if (def.tracks) {
      for (const [tName, tVal] of Object.entries(def.tracks)) {
        if (!tVal) continue;
        if (typeof tVal === "string") {
          tracksState[tName] = {
            events: parseTrackPattern(tVal),
            index: 0,
            nextBeat: 0,
            instrument: "sawtooth"
          };
        } else if (typeof tVal === "object" && tVal.notes) {
          tracksState[tName] = {
            events: parseTrackPattern(tVal.notes),
            index: 0,
            nextBeat: 0,
            instrument: tVal.instrument || "sawtooth",
            volume: tVal.volume,
            pan: tVal.pan,
            muted: tVal.muted
          };
        }
      }
    }
    const arrangement = arrangements.get(key2);
    if (arrangement) {
      tracksState = /* @__PURE__ */ Object.create(null);
      for (const [channel, events] of Object.entries(arrangement.tracks)) {
        tracksState[channel] = {
          events,
          index: 0,
          nextBeat: 0,
          instrument: channel === "drums" ? "drums" : channel === "bass" ? "triangle" : "square"
        };
      }
    }
    for (const [channel, instrument] of Object.entries(def.instruments ?? {})) {
      if (Object.prototype.hasOwnProperty.call(tracksState, channel)) tracksState[channel].instrument = instrument;
    }
    const startTime = ctx2.currentTime + 0.05;
    startMusicAtBeat(ctx2, key2, startBeat, startTime, outgoing ? fade : 0);
    if (outgoing) fadeOutMusic(ctx2, outgoing, startTime, fade);
  }
  function musicTiming(track) {
    const def = registeredMusic[track];
    const timeSignature = def?.time_signature || "4/4";
    const beatsPerBar = timeSignature.startsWith("3/") ? 3 : 4;
    const maxTrackBeats = Math.max(0, ...Object.values(tracksState).map(
      (state) => state.events.reduce((sum, event) => sum + event.beats, 0)
    ));
    const appBars = syncPageAudio ? Number(window?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
    const totalBars = appBars > 0 ? appBars : def?.bars || (maxTrackBeats ? Math.ceil(maxTrackBeats / beatsPerBar) : 4);
    return { timeSignature, totalBars, totalBeats: Math.max(maxTrackBeats, totalBars * beatsPerBar) };
  }
  function generateReverbImpulse(ctx2, decay = 1.5, preDelay = 0.01, reverse = false) {
    const sampleRate = ctx2.sampleRate || 44100;
    const length = Math.max(128, Math.floor(sampleRate * Math.max(0.05, Math.min(10, decay))));
    const buffer = ctx2.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const preDelaySamples = Math.floor(sampleRate * Math.max(0, preDelay));
    for (let i = 0; i < length; i++) {
      if (i < preDelaySamples) {
        left[i] = 0;
        right[i] = 0;
      } else {
        const idx = reverse ? length - 1 - i : i - preDelaySamples;
        const progress = idx / (length - preDelaySamples);
        const env = Math.exp(-3.5 * progress);
        left[i] = (Math.random() * 2 - 1) * env;
        right[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return buffer;
  }
  function generateBitcrushCurve(bits = 8, drive = 0) {
    const n = 4096;
    const curve = new Float32Array(n);
    const clampedBits = Math.max(2, Math.min(16, bits));
    const steps = Math.pow(2, clampedBits);
    const driveGain = 1 + Math.max(0, Math.min(5, drive * 4));
    for (let i = 0; i < n; i++) {
      let x = i * 2 / (n - 1) - 1;
      if (drive > 0) {
        x = Math.tanh(x * driveGain);
      }
      if (clampedBits < 16) {
        x = Math.round(x * (steps / 2)) / (steps / 2);
      }
      curve[i] = Math.max(-1, Math.min(1, x));
    }
    return curve;
  }
  function buildMusicEffectsBus(ctx2, def, channels2, destination) {
    const fx = def.effects || {};
    const reverbConfig = fx.reverb || def.reverb;
    const delayConfig = fx.delay || def.delay;
    const filterConfig = fx.filter || def.filter;
    const crushConfig = fx.crush || fx.drive || def.crush;
    const chorusConfig = fx.chorus || def.chorus;
    const trackFx = def.track_effects || fx.tracks || {};
    if (!reverbConfig && !delayConfig && !filterConfig && !crushConfig && !chorusConfig && !Object.keys(trackFx).length) {
      return null;
    }
    const nodesToClean = [];
    const lfoNodes = [];
    const dryBus = ctx2.createGain();
    dryBus.gain.setValueAtTime(1, ctx2.currentTime);
    nodesToClean.push(dryBus);
    let insertHead = dryBus;
    if (filterConfig && typeof ctx2.createBiquadFilter === "function") {
      const fNode = ctx2.createBiquadFilter();
      fNode.type = filterConfig.type || "lowpass";
      const cutoff = filterConfig.cutoff || filterConfig.frequency || 4e3;
      fNode.frequency.setValueAtTime(Math.max(20, Math.min(2e4, cutoff)), ctx2.currentTime);
      const q = filterConfig.q || filterConfig.resonance || 1;
      fNode.Q.setValueAtTime(Math.max(0.1, q), ctx2.currentTime);
      insertHead.connect(fNode);
      insertHead = fNode;
      nodesToClean.push(fNode);
    }
    if (crushConfig && typeof ctx2.createWaveShaper === "function") {
      const wsNode = ctx2.createWaveShaper();
      const bits = crushConfig.bits !== void 0 ? crushConfig.bits : 8;
      const drive = crushConfig.drive !== void 0 ? crushConfig.drive : 0;
      wsNode.curve = generateBitcrushCurve(bits, drive);
      wsNode.oversample = "none";
      insertHead.connect(wsNode);
      insertHead = wsNode;
      nodesToClean.push(wsNode);
    }
    insertHead.connect(destination);
    let delayInput = null;
    if (delayConfig && typeof ctx2.createDelay === "function") {
      delayInput = ctx2.createGain();
      delayInput.gain.setValueAtTime(1, ctx2.currentTime);
      nodesToClean.push(delayInput);
      const dNode = ctx2.createDelay(5);
      const dTime = Math.max(0.01, Math.min(4, delayConfig.time ?? 0.25));
      dNode.delayTime.setValueAtTime(dTime, ctx2.currentTime);
      const dampFilter = ctx2.createBiquadFilter();
      dampFilter.type = "lowpass";
      const dampFreq = delayConfig.damping || delayConfig.filter || 2800;
      dampFilter.frequency.setValueAtTime(dampFreq, ctx2.currentTime);
      const fbGain = ctx2.createGain();
      const fbVal = Math.max(0, Math.min(0.92, delayConfig.feedback ?? 0.35));
      fbGain.gain.setValueAtTime(fbVal, ctx2.currentTime);
      const delayWet = ctx2.createGain();
      const dWetVal = Math.max(0, Math.min(1, delayConfig.wet ?? 0.25));
      delayWet.gain.setValueAtTime(dWetVal, ctx2.currentTime);
      delayInput.connect(dNode);
      dNode.connect(dampFilter);
      dampFilter.connect(fbGain);
      fbGain.connect(dNode);
      dampFilter.connect(delayWet);
      delayWet.connect(destination);
      nodesToClean.push(dNode, dampFilter, fbGain, delayWet);
    }
    let revInput = null;
    if (reverbConfig && typeof ctx2.createConvolver === "function") {
      revInput = ctx2.createGain();
      revInput.gain.setValueAtTime(1, ctx2.currentTime);
      nodesToClean.push(revInput);
      const conv = ctx2.createConvolver();
      conv.buffer = generateReverbImpulse(
        ctx2,
        reverbConfig.decay ?? 1.5,
        reverbConfig.pre_delay ?? 0.01,
        reverbConfig.reverse ?? false
      );
      revInput.connect(conv);
      nodesToClean.push(conv);
      let revOut = conv;
      if (reverbConfig.filter) {
        const rf = ctx2.createBiquadFilter();
        rf.type = "lowpass";
        rf.frequency.setValueAtTime(reverbConfig.filter, ctx2.currentTime);
        conv.connect(rf);
        revOut = rf;
        nodesToClean.push(rf);
      }
      const revWet = ctx2.createGain();
      const wetVal = Math.max(0, Math.min(1, reverbConfig.wet ?? 0.25));
      revWet.gain.setValueAtTime(wetVal, ctx2.currentTime);
      revOut.connect(revWet);
      revWet.connect(destination);
      nodesToClean.push(revWet);
    }
    let chorusInput = null;
    if (chorusConfig && typeof ctx2.createDelay === "function" && typeof ctx2.createOscillator === "function") {
      chorusInput = ctx2.createGain();
      chorusInput.gain.setValueAtTime(1, ctx2.currentTime);
      nodesToClean.push(chorusInput);
      const cd = ctx2.createDelay(0.1);
      const baseDelay = chorusConfig.delay ?? 0.018;
      cd.delayTime.setValueAtTime(baseDelay, ctx2.currentTime);
      const lfo = ctx2.createOscillator();
      lfo.type = "sine";
      const rate = chorusConfig.rate ?? 1.2;
      lfo.frequency.setValueAtTime(rate, ctx2.currentTime);
      const lfoGain = ctx2.createGain();
      const depth = chorusConfig.depth ?? 25e-4;
      lfoGain.gain.setValueAtTime(depth, ctx2.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(cd.delayTime);
      lfo.start(ctx2.currentTime);
      lfoNodes.push(lfo);
      const chorusWet = ctx2.createGain();
      const cWetVal = Math.max(0, Math.min(1, chorusConfig.wet ?? 0.3));
      chorusWet.gain.setValueAtTime(cWetVal, ctx2.currentTime);
      chorusInput.connect(cd);
      cd.connect(chorusWet);
      chorusWet.connect(destination);
      nodesToClean.push(cd, lfoGain, chorusWet);
    }
    const masterInput = ctx2.createGain();
    masterInput.gain.setValueAtTime(1, ctx2.currentTime);
    masterInput.connect(dryBus);
    nodesToClean.push(masterInput);
    const channelGains = {};
    for (const ch of channels2) {
      const cg = ctx2.createGain();
      cg.gain.setValueAtTime(1, ctx2.currentTime);
      cg.connect(dryBus);
      nodesToClean.push(cg);
      const chFx = trackFx[ch] || {};
      if (delayInput) {
        let dSend = 0;
        if (chFx.delay !== void 0) {
          dSend = chFx.delay;
        } else if (delayConfig?.tracks) {
          dSend = delayConfig.tracks.includes(ch) ? 1 : 0;
        } else {
          dSend = ch === "drums" || ch === "bass" ? 0 : 1;
        }
        if (dSend > 0) {
          const sg = ctx2.createGain();
          sg.gain.setValueAtTime(dSend, ctx2.currentTime);
          cg.connect(sg);
          sg.connect(delayInput);
          nodesToClean.push(sg);
        }
      }
      if (revInput) {
        let rSend = 0;
        if (chFx.reverb !== void 0) {
          rSend = chFx.reverb;
        } else if (reverbConfig?.tracks) {
          rSend = reverbConfig.tracks.includes(ch) ? 1 : 0;
        } else {
          rSend = ch === "bass" ? 0.05 : ch === "drums" ? 0.25 : 1;
        }
        if (rSend > 0) {
          const sg = ctx2.createGain();
          sg.gain.setValueAtTime(rSend, ctx2.currentTime);
          cg.connect(sg);
          sg.connect(revInput);
          nodesToClean.push(sg);
        }
      }
      if (chorusInput) {
        let cSend = 0;
        if (chFx.chorus !== void 0) {
          cSend = chFx.chorus;
        } else {
          cSend = ch === "drums" || ch === "bass" ? 0 : 0.8;
        }
        if (cSend > 0) {
          const sg = ctx2.createGain();
          sg.gain.setValueAtTime(cSend, ctx2.currentTime);
          cg.connect(sg);
          sg.connect(chorusInput);
          nodesToClean.push(sg);
        }
      }
      channelGains[ch] = cg;
    }
    const cleanup = () => {
      for (const lfo of lfoNodes) {
        try {
          lfo.stop();
        } catch {
        }
        try {
          lfo.disconnect();
        } catch {
        }
      }
      for (const n of nodesToClean) {
        try {
          n.disconnect?.();
        } catch {
        }
      }
    };
    return {
      masterInput,
      channelGains,
      lfoNodes,
      cleanup
    };
  }
  function startMusicAtBeat(ctx2, trackName, startBeat, startTime = ctx2.currentTime + 0.05, fade = 0) {
    const timing = musicTiming(trackName);
    const beat = Math.max(0, Math.min(timing.totalBeats - 1e-6, Number.isFinite(startBeat) ? startBeat : 0));
    for (const track of Object.values(tracksState)) {
      let onset = 0;
      track.index = track.events.findIndex((event) => {
        if (onset + event.beats > beat) return true;
        onset += event.beats;
        return false;
      });
      if (track.index < 0) track.index = track.events.length;
      track.nextBeat = track.index === track.events.length ? onset : beat;
      track.elapsedInNote = track.index === track.events.length ? 0 : beat - onset;
    }
    musicMasterGain = ctx2.createGain();
    if (fade > 0) {
      musicMasterGain.gain.setValueAtTime(0, startTime);
      musicMasterGain.gain.linearRampToValueAtTime(musicVolume, startTime + fade);
    } else {
      musicMasterGain.gain.setValueAtTime(musicVolume, ctx2.currentTime);
    }
    musicMasterGain.connect(audioOutput(ctx2));
    const def = registeredMusic[trackName];
    musicEffectsBus = def ? buildMusicEffectsBus(ctx2, def, Object.keys(tracksState), musicMasterGain) : null;
    musicClock = new MusicClock(startTime, musicTempoBpm, beat);
    audioSync.configure({ getAudioContext: () => audioCtx, syncPage: syncPageAudio });
    audioSync.onPlay({ ...timing, track: trackName, tempo: musicTempoBpm, startTime, startBeat: beat, clock: musicClock });
    scheduleMusicTicks();
    musicSchedulerTimer = setInterval(scheduleMusicTicks, 25);
  }
  function stopMusic() {
    pendingMusic = null;
    audioSync.onStop();
    if (musicSchedulerTimer) {
      clearInterval(musicSchedulerTimer);
      musicSchedulerTimer = null;
    }
    activeMusicTrackName = null;
    musicPausedBeat = 0;
    isMusicPaused = false;
    tracksState = {};
    musicClock = null;
    clearFadingMusic?.();
    disconnectMusicGain();
  }
  function fadeOutMusic(ctx2, outgoing, startTime, fade) {
    const gain = outgoing.gain.gain;
    const volume = gain.value;
    gain.cancelScheduledValues(ctx2.currentTime);
    gain.setValueAtTime(volume, startTime);
    const endTime = startTime + fade;
    gain.linearRampToValueAtTime(0, endTime);
    let timer;
    function dispose() {
      clearTimeout(timer);
      outgoing.effects?.cleanup();
      outgoing.gain.disconnect();
      clearFadingMusic = void 0;
    }
    function checkTail() {
      if (ctx2.currentTime >= endTime) dispose();
      else timer = setTimeout(checkTail, Math.max(25, (endTime - ctx2.currentTime) * 1e3));
    }
    timer = setTimeout(checkTail, (endTime - ctx2.currentTime) * 1e3);
    clearFadingMusic = dispose;
  }
  function disconnectMusicGain() {
    if (musicEffectsBus) {
      musicEffectsBus.cleanup();
      musicEffectsBus = null;
    }
    if (!musicMasterGain) return;
    musicMasterGain.disconnect();
    musicMasterGain = null;
  }
  function pauseMusic() {
    if (isMusicPaused || !activeMusicTrackName) return;
    musicPausedBeat = audioSync.getSnapshot().currentBeat;
    isMusicPaused = true;
    if (musicSchedulerTimer) {
      clearInterval(musicSchedulerTimer);
      musicSchedulerTimer = null;
    }
    clearFadingMusic?.();
    disconnectMusicGain();
    audioSync.onPause(musicPausedBeat);
  }
  function resumeMusic() {
    const ctx2 = getAudioContext();
    if (!ctx2 || !isMusicPaused || !activeMusicTrackName) return;
    isMusicPaused = false;
    startMusicAtBeat(ctx2, activeMusicTrackName, musicPausedBeat);
  }
  function setMusicTempo(bpm) {
    if (!(bpm > 20 && bpm < 400) || bpm === musicTempoBpm) return;
    musicTempoBpm = bpm;
    if (audioCtx && activeMusicTrackName && !isMusicPaused) {
      musicClock?.changeAfter(bpm, audioCtx.currentTime + MUSIC_LOOKAHEAD);
    }
  }
  function setMusicVolume(vol) {
    musicVolume = Math.max(0, Math.min(1, vol));
    if (musicMasterGain && audioCtx) {
      musicMasterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      musicMasterGain.gain.setValueAtTime(musicVolume, audioCtx.currentTime);
    }
  }
  function setTrackInstrument(channel, instrument, includeStudioLayers = false) {
    for (const [name2, track] of Object.entries(tracksState)) {
      if (name2 === channel || includeStudioLayers && name2.startsWith(channel + "_studio_")) {
        track.instrument = instrument;
      }
    }
  }
  function scheduleMusicTicks() {
    const ctx2 = getAudioContext();
    const clock = musicClock;
    if (!ctx2 || !clock || !musicMasterGain || isMusicPaused || !activeMusicTrackName) return;
    const lookaheadWindow = ctx2.currentTime + MUSIC_LOOKAHEAD;
    const { totalBeats: songTotalBeats } = musicTiming(activeMusicTrackName);
    let allFinished = true;
    for (const [trackKey, track] of Object.entries(tracksState)) {
      if (!track || !track.events.length || track.muted) continue;
      while (true) {
        if (track.index >= track.events.length) {
          if (musicLoop) {
            if (songTotalBeats > 0) {
              const currentIteration = Math.floor((track.nextBeat - 1e-4) / songTotalBeats);
              track.nextBeat = (currentIteration + 1) * songTotalBeats;
            }
            track.index = 0;
          } else {
            break;
          }
        }
        const eventTime = clock.timeAt(track.nextBeat);
        if (eventTime >= lookaheadWindow) break;
        const event = track.events[track.index];
        const remainingBeats = event.beats - (track.elapsedInNote ?? 0);
        const eventDurationSec = clock.timeAt(track.nextBeat + remainingBeats) - eventTime;
        if (!event.isRest && eventTime >= ctx2.currentTime - 0.05) {
          const targetDest = musicEffectsBus ? musicEffectsBus.channelGains[trackKey] || musicEffectsBus.masterInput : musicMasterGain;
          scheduleTrackNote(ctx2, trackKey, event, eventTime, eventDurationSec, targetDest, track.instrument);
        }
        track.nextBeat += remainingBeats;
        track.elapsedInNote = 0;
        track.index += 1;
      }
      if (track.index < track.events.length || musicLoop) {
        allFinished = false;
      }
    }
    if (allFinished && !musicLoop && ctx2.currentTime >= clock.timeAt(songTotalBeats)) {
      stopMusic();
    }
  }
  function auditionMusicNote(note, instrument) {
    if (audioMuted) return;
    const event = parseTrackPattern(note)[0];
    if (!event || event.isRest) return;
    const ctx2 = getAudioContext();
    if (ctx2) playTrackNote(ctx2, "", event, ctx2.currentTime, 0.24, audioOutput(ctx2), instrument);
  }
  function scheduleTrackNote(ctx2, channel, event, time, durationSec, destination, instrumentOverride) {
    audioSync.enqueueNote({
      channel,
      stepId: event.stepId ?? -1,
      pitch: event.pitch,
      startTime: time,
      endTime: time + durationSec,
      beat: 0,
      bar: 1
    });
    playTrackNote(ctx2, channel, event, time, durationSec, destination, instrumentOverride);
  }
  function playTrackNote(ctx2, channel, event, time, durationSec, destination, instrumentOverride) {
    const isDrumChannel = channel === "drums" || instrumentOverride === "drums" || event.isDrum;
    const pitchesToPlay = event.pitches && event.pitches.length > 0 ? event.pitches : [event.pitch];
    const chordGainMultiplier = 1 / Math.sqrt(Math.max(1, pitchesToPlay.length));
    for (const p of pitchesToPlay) {
      if (isDrumChannel || typeof p === "string") {
        const drumType = String(p).toLowerCase();
        if (drumType === "kick") {
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(130, time);
          osc2.frequency.exponentialRampToValueAtTime(32, time + Math.min(durationSec, 0.08));
          gain2.gain.setValueAtTime(0.4 * chordGainMultiplier, time);
          gain2.gain.exponentialRampToValueAtTime(1e-3, time + Math.min(durationSec, 0.08));
          osc2.connect(gain2);
          gain2.connect(destination);
          osc2.start(time);
          osc2.stop(time + Math.min(durationSec, 0.09));
        } else if (drumType === "snare") {
          playNoiseBurstToDestination(ctx2, time, Math.min(durationSec, 0.09), 1600, 300, 0.3 * chordGainMultiplier, destination, "bandpass");
        } else if (drumType === "hihat") {
          playNoiseBurstToDestination(ctx2, time, Math.min(durationSec, 0.04), 7e3, 5e3, 0.15 * chordGainMultiplier, destination, "highpass");
        } else if (drumType === "crash") {
          playNoiseBurstToDestination(ctx2, time, Math.min(durationSec, 0.25), 5e3, 1e3, 0.2 * chordGainMultiplier, destination, "bandpass");
        } else if (drumType === "tom") {
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();
          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(220, time);
          osc2.frequency.exponentialRampToValueAtTime(70, time + Math.min(durationSec, 0.12));
          gain2.gain.setValueAtTime(0.35 * chordGainMultiplier, time);
          gain2.gain.exponentialRampToValueAtTime(1e-3, time + Math.min(durationSec, 0.12));
          osc2.connect(gain2);
          gain2.connect(destination);
          osc2.start(time);
          osc2.stop(time + Math.min(durationSec, 0.13));
        }
        continue;
      }
      const freq = typeof p === "number" ? p : parseNoteToFreq(p);
      if (freq <= 0) continue;
      const osc = ctx2.createOscillator();
      const gain = ctx2.createGain();
      const inst = instrumentOverride || (channel === "bass" ? "triangle" : "square");
      if (inst === "brass" || inst === "strings" || inst === "bell") {
        const isBell = inst === "bell";
        const isStrings = inst === "strings";
        const length = Math.max(0.06, durationSec * (isBell ? 1.25 : 1));
        const attack = Math.min(length * 0.25, isStrings ? 0.06 : 0.018);
        osc.type = inst === "brass" ? "sawtooth" : isStrings ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, time);
        const peak = (isStrings ? 0.13 : 0.23) * chordGainMultiplier;
        gain.gain.setValueAtTime(1e-3, time);
        gain.gain.linearRampToValueAtTime(peak, time + attack);
        if (isBell) {
          gain.gain.exponentialRampToValueAtTime(1e-3, time + length);
        } else {
          const sustainLevel = peak * 0.82;
          const releaseTime = Math.min(0.04, durationSec * 0.08);
          const sustainEnd = time + Math.max(attack, durationSec - releaseTime);
          gain.gain.linearRampToValueAtTime(sustainLevel, time + attack + 0.04);
          gain.gain.setValueAtTime(sustainLevel, sustainEnd);
          gain.gain.exponentialRampToValueAtTime(1e-3, time + durationSec);
        }
        const filter = ctx2.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(9e3, freq * (inst === "brass" ? 5 : 3)), time);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + (isBell ? length : durationSec) + 0.015);
      } else if (inst === "sawtooth" || inst === "synth") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);
        const releaseTime = Math.min(0.035, durationSec * 0.08);
        const sustainEnd = time + Math.max(0.02, durationSec - releaseTime);
        const peak = 0.18 * chordGainMultiplier;
        gain.gain.setValueAtTime(peak, time);
        if (sustainEnd > time + 0.04) {
          gain.gain.setValueAtTime(peak * 0.85, sustainEnd);
        }
        gain.gain.exponentialRampToValueAtTime(2e-3, time + durationSec);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + durationSec + 0.01);
      } else if (inst === "triangle" || inst === "bass") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = durationSec * 0.9;
        const peak = 0.28 * chordGainMultiplier;
        gain.gain.setValueAtTime(peak, time);
        const sustainEnd = time + durationSec * 0.82;
        if (sustainEnd > time + 0.04) {
          gain.gain.setValueAtTime(peak * 0.9, sustainEnd);
        }
        gain.gain.exponentialRampToValueAtTime(3e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else if (inst === "sine") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);
        const releaseTime = Math.min(0.03, durationSec * 0.08);
        const sustainEnd = time + Math.max(0.02, durationSec - releaseTime);
        const peak = 0.25 * chordGainMultiplier;
        gain.gain.setValueAtTime(peak, time);
        if (sustainEnd > time + 0.04) {
          gain.gain.setValueAtTime(peak * 0.9, sustainEnd);
        }
        gain.gain.exponentialRampToValueAtTime(2e-3, time + durationSec);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + durationSec + 0.01);
      } else if (inst === "pluck") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.85, 0.45);
        gain.gain.setValueAtTime(0.3 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(1e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else {
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, time);
        const releaseTime = Math.min(0.03, durationSec * 0.08);
        const sustainEnd = time + Math.max(0.02, durationSec - releaseTime);
        const peak = 0.2 * chordGainMultiplier;
        gain.gain.setValueAtTime(peak, time);
        if (sustainEnd > time + 0.04) {
          gain.gain.setValueAtTime(peak * 0.85, sustainEnd);
        }
        gain.gain.exponentialRampToValueAtTime(2e-3, time + durationSec);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + durationSec + 0.01);
      }
    }
  }
  function playNoiseBurstToDestination(ctx2, now, duration, filterStart, filterEnd, volume, destination, filterType = "lowpass") {
    const bufferSize = Math.max(1, Math.floor(ctx2.sampleRate * duration));
    const buffer = ctx2.createBuffer(1, bufferSize, ctx2.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise2 = ctx2.createBufferSource();
    noise2.buffer = buffer;
    const filter = ctx2.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, filterStart), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);
    const gain = ctx2.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
    noise2.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise2.start(now);
    noise2.stop(now + duration + 0.01);
  }

  // src/statement.ts
  function assignPath(pathExpr, value, locals) {
    const segments = splitPathSegments(pathExpr);
    if (!segments.length) return;
    const baseKey = segments[0];
    if (!ctx().logicState && moduleState(baseKey)) throw new Error(`Module state is read-only outside its actions: ${baseKey}`);
    let current;
    if (locals && Object.prototype.hasOwnProperty.call(locals, baseKey)) {
      current = locals[baseKey];
      if (segments.length === 1) {
        locals[baseKey] = value;
        entitiesChanged(value);
        return;
      }
    } else {
      const state = ctx().logicState ?? ctx().app.state;
      if (ctx().logicOwner?.startsWith("@") && (baseKey === "id" || baseKey === "__type")) {
        throw new Error(`Entity identity is immutable: ${baseKey}`);
      }
      if (ctx().logicState && !Object.prototype.hasOwnProperty.call(state, baseKey)) throw new Error(`Undeclared scoped state: ${baseKey}`);
      current = state[baseKey];
      if (segments.length === 1) {
        state[baseKey] = value;
        entitiesChanged(value);
        return;
      }
    }
    for (let i = 1; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const scopeValue2 = buildScope(locals, pathExpr);
      if (Array.isArray(current) && segment.startsWith("[].(") && segment.endsWith(")")) {
        const condition = segment.slice(4, -1);
        const match = current.find((item) => {
          const innerScope = Object.assign({}, scopeValue2, { it: item });
          return Boolean(evaluateExpression(condition, innerScope, 0));
        });
        if (match !== void 0) {
          current = match;
          continue;
        } else return;
      } else if (segment.startsWith("[") && segment.endsWith("]")) {
        const innerExpr = segment.slice(1, -1);
        const lookup = evaluateExpression(innerExpr, scopeValue2, 0);
        const key2 = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
        if (current[key2] === void 0) {
          current[key2] = {};
        }
        current = current[key2];
      } else {
        const key2 = segment;
        if (current[key2] === void 0) {
          current[key2] = {};
        }
        current = current[key2];
      }
    }
    const finalRawKey = segments[segments.length - 1];
    if (current && typeof current === "object" && "__type" in current && (finalRawKey === "id" || finalRawKey === "__type")) throw new Error(`Entity identity is immutable: ${finalRawKey}`);
    const scopeValue = buildScope(locals, pathExpr);
    if (Array.isArray(current) && finalRawKey.startsWith("[].(") && finalRawKey.endsWith(")")) {
      const condition = finalRawKey.slice(4, -1);
      const index2 = current.findIndex((item) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (index2 !== -1) {
        current[index2] = value;
        entitiesChanged(current);
      }
      return;
    } else if (finalRawKey.startsWith("[") && finalRawKey.endsWith("]")) {
      const innerExpr = finalRawKey.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const finalKey = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
      if (current && typeof current === "object" && "__type" in current && (finalKey === "id" || finalKey === "__type")) throw new Error(`Entity identity is immutable: ${finalKey}`);
      current[finalKey] = value;
      entitiesChanged(current);
      entityMoved(current);
    } else {
      current[finalRawKey] = value;
      if (["x", "y", "z", "visible", "scale"].includes(finalRawKey)) entityMoved(current);
    }
  }
  function deletePath(pathExpr, locals) {
    const segments = splitPathSegments(pathExpr);
    if (!segments.length) return;
    const baseKey = segments[0];
    if (!ctx().logicState && moduleState(baseKey)) throw new Error(`Module state is read-only outside its actions: ${baseKey}`);
    let current;
    if (locals && Object.prototype.hasOwnProperty.call(locals, baseKey)) {
      current = locals[baseKey];
      if (segments.length === 1) {
        delete locals[baseKey];
        return;
      }
    } else {
      if (ctx().logicOwner?.startsWith("@") && (baseKey === "id" || baseKey === "__type")) {
        throw new Error(`Entity identity is immutable: ${baseKey}`);
      }
      current = (ctx().logicState ?? ctx().app.state)[baseKey];
      if (segments.length === 1) {
        delete (ctx().logicState ?? ctx().app.state)[baseKey];
        return;
      }
    }
    for (let i = 1; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const scopeValue2 = buildScope(locals);
      if (Array.isArray(current) && segment.startsWith("[].(") && segment.endsWith(")")) {
        const condition = segment.slice(4, -1);
        const match = current.find((item) => {
          const innerScope = Object.assign({}, scopeValue2, { it: item });
          return Boolean(evaluateExpression(condition, innerScope, 0));
        });
        if (match !== void 0) {
          current = match;
          continue;
        } else return;
      } else if (segment.startsWith("[") && segment.endsWith("]")) {
        const innerExpr = segment.slice(1, -1);
        const lookup = evaluateExpression(innerExpr, scopeValue2, 0);
        const key2 = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
        if (current[key2] === void 0) return;
        current = current[key2];
      } else {
        const key2 = segment;
        if (current[key2] === void 0) return;
        current = current[key2];
      }
    }
    const finalRawKey = segments[segments.length - 1];
    if (current && typeof current === "object" && "__type" in current && (finalRawKey === "id" || finalRawKey === "__type")) throw new Error(`Entity identity is immutable: ${finalRawKey}`);
    const scopeValue = buildScope(locals);
    if (Array.isArray(current) && finalRawKey.startsWith("[].(") && finalRawKey.endsWith(")")) {
      const condition = finalRawKey.slice(4, -1);
      const index2 = current.findIndex((item) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (index2 !== -1) {
        current.splice(index2, 1);
        entitiesChanged(current);
      }
    } else if (finalRawKey.startsWith("[") && finalRawKey.endsWith("]")) {
      const innerExpr = finalRawKey.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const finalKey = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
      if (current && typeof current === "object" && "__type" in current && (finalKey === "id" || finalKey === "__type")) throw new Error(`Entity identity is immutable: ${finalKey}`);
      if (Array.isArray(current) && typeof finalKey === "number") {
        current.splice(finalKey, 1);
        entitiesChanged(current);
      } else {
        delete current[finalKey];
      }
    } else {
      if (Array.isArray(current) && !isNaN(Number(finalRawKey))) {
        current.splice(Number(finalRawKey), 1);
      } else {
        delete current[finalRawKey];
      }
    }
    entitiesChanged(current);
    entityMoved(current);
  }
  function executeStatement(statement, locals) {
    const trimmed = String(statement || "").trim();
    if (!trimmed) return true;
    if (storageAssignment(trimmed)) throw new Error("Storage I/O must be a top-level action step");
    if (parseFetchAssignment(trimmed)) {
      throw new Error(`'${trimmed}' is only supported as a top-level action step`);
    }
    if (trimmed.startsWith("call ")) {
      const rest = trimmed.slice(5).trim();
      const match = rest.match(/^([a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*)(?:\s+(.*))?$/);
      if (!match) {
        throw new Error(`Unknown Rune-Web action: ${rest}`);
      }
      if (!match[1].includes(".") && !Object.prototype.hasOwnProperty.call(ctx().actionDefinitions, callableName(match[1], "action"))) {
        throw new Error(`Unknown Rune-Web action: ${rest}`);
      }
      const args = match[2] ? splitTopLevel(match[2], ",").map((arg) => evaluateExpression(arg, buildScope(locals, trimmed))) : [];
      ctx().app.invokeAction(match[1], args, locals);
      return true;
    }
    if (trimmed.startsWith("sound ") || trimmed.startsWith("sound.") || trimmed.startsWith("play_sound(")) {
      let soundName = "";
      let argVal = void 0;
      if (trimmed.startsWith("sound.play(") && trimmed.endsWith(")")) {
        const inner = trimmed.slice(11, -1);
        const parts = splitTopLevel(inner, ",");
        soundName = String(evaluateExpression(parts[0], buildScope(locals, trimmed)) || "");
        if (parts.length > 1) {
          argVal = evaluateExpression(parts[1], buildScope(locals, trimmed));
        }
      } else if (trimmed.startsWith("play_sound(") && trimmed.endsWith(")")) {
        const inner = trimmed.slice(11, -1);
        const parts = splitTopLevel(inner, ",");
        soundName = String(evaluateExpression(parts[0], buildScope(locals, trimmed)) || "");
        if (parts.length > 1) {
          argVal = evaluateExpression(parts[1], buildScope(locals, trimmed));
        }
      } else if (trimmed.startsWith("sound.play ")) {
        soundName = String(evaluateExpression(trimmed.slice(11), buildScope(locals, trimmed)) || "");
      } else if (trimmed.startsWith("sound.")) {
        soundName = trimmed.slice(6).trim();
      } else {
        soundName = String(evaluateExpression(trimmed.slice(6), buildScope(locals, trimmed)) || "");
      }
      soundName = normalizeLiteral(soundName);
      playSound(soundName, argVal);
      return true;
    }
    if (trimmed.startsWith("music ") || trimmed.startsWith("music.") || trimmed.startsWith("play_music(")) {
      if (trimmed === "music.stop" || trimmed === "music.stop()" || trimmed === "stop_music()") {
        stopMusic();
        return true;
      }
      if (trimmed === "music.pause" || trimmed === "music.pause()" || trimmed === "pause_music()") {
        pauseMusic();
        return true;
      }
      if (trimmed === "music.resume" || trimmed === "music.resume()" || trimmed === "resume_music()") {
        resumeMusic();
        return true;
      }
      if (trimmed.startsWith("music.tempo =") || trimmed.startsWith("music.tempo=")) {
        const expr = trimmed.slice(trimmed.indexOf("=") + 1).trim();
        const val = Number(evaluateExpression(expr, buildScope(locals, trimmed)));
        if (!isNaN(val)) setMusicTempo(val);
        return true;
      }
      if (trimmed.startsWith("music.volume =") || trimmed.startsWith("music.volume=")) {
        const expr = trimmed.slice(trimmed.indexOf("=") + 1).trim();
        const val = Number(evaluateExpression(expr, buildScope(locals, trimmed)));
        if (!isNaN(val)) setMusicVolume(val);
        return true;
      }
      if (trimmed.startsWith("music.compose(") || trimmed.startsWith("music.register(")) {
        const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
        const parts = splitTopLevel(inner, ",");
        if (parts.length >= 4) {
          const name2 = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
          const tempo = Number(evaluateExpression(parts[1], buildScope(locals, trimmed))) || 128;
          const lead = String(evaluateExpression(parts[2], buildScope(locals, trimmed)));
          const bass = String(evaluateExpression(parts[3], buildScope(locals, trimmed)));
          const drums = parts.length > 4 ? String(evaluateExpression(parts[4], buildScope(locals, trimmed))) : "";
          const timeSig = parts.length > 5 ? String(evaluateExpression(parts[5], buildScope(locals, trimmed))) : "4/4";
          const state = ctx().app.state;
          const songBars = Number(state.bars) || 4;
          const locked = state.studio_fixed_bars === true;
          const studioParts = locked ? studioSongParts(state, studioBarTicks(timeSig), songBars) : void 0;
          registerMusic({
            [name2]: {
              music_type: "8bit",
              tempo,
              time_signature: timeSig,
              bars: songBars,
              loop_track: true,
              volume: 0.2,
              lead: studioParts?.lead[0] ?? lead,
              bass: studioParts?.bass[0] ?? bass,
              drums: studioParts?.drums[0] ?? drums,
              ...studioParts ? {
                tracks: { chords: studioParts.chords[0], ...studioParts.layers },
                instruments: studioParts.instruments
              } : {}
            }
          });
        }
        return true;
      }
      if (trimmed.startsWith("music.compose_song(") || trimmed.startsWith("music.register_song(")) {
        const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
        const parts = splitTopLevel(inner, ",");
        if (parts.length >= 2) {
          const name2 = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
          const songConfig = evaluateExpression(parts[1], buildScope(locals, trimmed));
          if (songConfig && typeof songConfig === "object") {
            registerMusic({
              [name2]: songConfig
            });
          }
        }
        return true;
      }
      if (trimmed === "music.play" || trimmed === "music.play()" || trimmed.startsWith("music.play(") || trimmed.startsWith("music.play ") || trimmed.startsWith("play_music(") || trimmed.startsWith("music ") && !trimmed.startsWith("music.tempo") && !trimmed.startsWith("music.volume")) {
        let trackName = "";
        let startBeat;
        let fadeSeconds;
        if ((trimmed.startsWith("music.play(") || trimmed.startsWith("play_music(")) && trimmed.endsWith(")")) {
          const [name2, beat, fade] = splitTopLevel(trimmed.slice(trimmed.indexOf("(") + 1, -1), ",");
          const scope = buildScope(locals, trimmed);
          trackName = String(evaluateExpression(name2, scope) || "");
          if (beat !== void 0) startBeat = Number(evaluateExpression(beat, scope));
          if (fade !== void 0) fadeSeconds = Number(evaluateExpression(fade, scope));
        } else if (trimmed.startsWith("music.play ")) {
          trackName = String(evaluateExpression(trimmed.slice(11), buildScope(locals, trimmed)) || "");
        } else if (trimmed.startsWith("music ")) {
          trackName = String(evaluateExpression(trimmed.slice(6), buildScope(locals, trimmed)) || "");
        }
        trackName = normalizeLiteral(trackName);
        if (trackName) {
          if (fadeSeconds !== void 0) playMusic(trackName, startBeat, fadeSeconds);
          else if (startBeat === void 0) playMusic(trackName);
          else playMusic(trackName, startBeat);
        }
        return true;
      }
    }
    if (trimmed === "music.sync_steps" || trimmed === "music.sync_steps()") {
      const state = ctx().app?.state;
      if (state) {
        syncSequencerState(state);
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.select_step(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(18, -1);
      const id = Number(evaluateExpression(inner, buildScope(locals, trimmed)));
      const state = ctx().app?.state;
      if (state) {
        state.selected_step_id = id;
        const voice = String(state.active_voice || "lead");
        syncSequencerState(state);
        const step = state.active_steps.find((s) => s.id === id);
        if (step && !step.is_bar && !step.is_rest) {
          state.selected_note = state.studio_fixed_bars === true ? step.chord_notes[0] : step.note;
          if (state.studio_fixed_bars === true) {
            auditionStudioNote(state, voice, String(state.selected_note));
          } else if (step.is_chord && step.chord_notes && step.chord_notes.length > 0) {
            for (const cn of step.chord_notes) {
              if (voice === "drums" || ["kick", "snare", "hihat"].includes(cn)) {
                playSound("drum_" + cn);
              } else if (voice === "bass") {
                playSound("key_bass");
              } else {
                playSound("key_lead");
              }
            }
          } else {
            if (voice === "drums") {
              playSound("drum_" + step.note);
            } else if (voice === "bass") {
              playSound("key_bass");
            } else {
              playSound("key_lead");
            }
          }
        }
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.edit_steps(") && trimmed.endsWith(")")) {
      const state = ctx().app.state;
      if (state.studio_fixed_bars === true) {
        const scope = buildScope(locals, trimmed);
        const args = splitTopLevel(trimmed.slice("music.edit_steps(".length, -1), ",");
        const [kind, first, second] = args.map((arg) => evaluateExpression(arg, scope));
        editStudioSequence(state, String(kind), first, second);
      }
      return true;
    }
    function syncMusicState(state) {
      if (!state || !state.selected_song) return;
      const name2 = String(state.selected_song);
      const tempo = Number(state.tempo) || 128;
      const timeSig = String(state.time_signature || "4/4");
      const bars = Number(state.bars) || 4;
      const lead = String(state.lead_track || "");
      const bass = String(state.bass_track || "");
      const drums = String(state.drums_track || "");
      registerMusic({
        [name2]: {
          music_type: "8bit",
          tempo,
          time_signature: timeSig,
          bars,
          loop_track: true,
          volume: 0.2,
          lead,
          bass,
          drums
        }
      });
    }
    if (trimmed.startsWith("music.delete_step(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(18, -1);
      const id = Number(evaluateExpression(inner, buildScope(locals, trimmed)));
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "");
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const tokens2 = score.trim().split(/\s+/).filter(Boolean);
        if (id >= 0 && id < tokens2.length) {
          tokens2.splice(id, 1);
          state[voice + "_track"] = tokens2.join(" ");
          state.selected_step_id = -1;
          state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
          syncMusicState(state);
          if (typeof ctx().app.render === "function") {
            ctx().app.render();
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.stretch_step(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(19, -1);
      const parts = splitTopLevel(inner, ",");
      const id = Number(evaluateExpression(parts[0], buildScope(locals, trimmed)));
      const delta = parts.length > 1 ? Number(evaluateExpression(parts[1], buildScope(locals, trimmed))) : 1;
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "");
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const tokens2 = score.trim().split(/\s+/).filter(Boolean);
        if (id >= 0 && id < tokens2.length) {
          const raw = tokens2[id];
          if (raw !== "|") {
            const DURS = [":16", ":8", ":4", ":2", ":1"];
            let currentDur = ":8";
            let prefix = raw;
            if (raw.startsWith("[") && raw.includes("]")) {
              const closeIdx = raw.indexOf("]");
              prefix = raw.slice(0, closeIdx + 1);
              currentDur = raw.slice(closeIdx + 1) || ":8";
            } else {
              const colonIdx = raw.indexOf(":");
              prefix = colonIdx !== -1 ? raw.slice(0, colonIdx) : raw;
              currentDur = colonIdx !== -1 ? raw.slice(colonIdx) : ":8";
            }
            let durIdx = DURS.indexOf(currentDur);
            if (durIdx === -1) durIdx = 1;
            const newDurIdx = Math.max(0, Math.min(DURS.length - 1, durIdx + delta));
            tokens2[id] = `${prefix}${DURS[newDurIdx]}`;
            state[voice + "_track"] = tokens2.join(" ");
            state.active_steps = parseTrackToSteps(state[voice + "_track"], id, timeSig, selectedBar);
            syncMusicState(state);
            if (typeof ctx().app.render === "function") {
              ctx().app.render();
            }
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.stack_chord_note(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(23, -1);
      const parts = splitTopLevel(inner, ",");
      const note = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
      const dur = parts[1] ? String(evaluateExpression(parts[1], buildScope(locals, trimmed))) : ":8";
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const tokens2 = score.length > 0 ? score.split(/\s+/).filter(Boolean) : [];
        if (tokens2.length > 0) {
          const lastToken = tokens2[tokens2.length - 1];
          if (lastToken.startsWith("[") && lastToken.includes("]")) {
            const closeIdx = lastToken.indexOf("]");
            const currentNotes = lastToken.slice(1, closeIdx).split(/[,+]/).map((s) => s.trim()).filter(Boolean);
            const currentDur = lastToken.slice(closeIdx + 1) || dur;
            if (!currentNotes.includes(note)) {
              currentNotes.push(note);
              tokens2[tokens2.length - 1] = `[${currentNotes.join(",")}]${currentDur}`;
            }
          } else {
            tokens2.push(`[${note}]${dur}`);
          }
        } else {
          tokens2.push(`[${note}]${dur}`);
        }
        state[voice + "_track"] = tokens2.join(" ");
        state.selected_note = note;
        state.active_steps = parseTrackToSteps(state[voice + "_track"], tokens2.length - 1, timeSig, selectedBar);
        syncMusicState(state);
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    if (trimmed === "music.add_bar" || trimmed === "music.add_bar()") {
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        state[voice + "_track"] = score.length > 0 ? `${score} |` : "|";
        state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
        syncMusicState(state);
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.duplicate_bar(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(20, -1);
      const barNum = Number(evaluateExpression(inner, buildScope(locals, trimmed))) || 1;
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const bars = score.split("|").map((b) => b.trim());
        const barIdx = Math.max(0, Math.min(bars.length - 1, barNum - 1));
        if (bars[barIdx] !== void 0) {
          bars.push(bars[barIdx]);
          state[voice + "_track"] = bars.join(" | ");
          state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
          syncMusicState(state);
          if (typeof ctx().app.render === "function") {
            ctx().app.render();
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.delete_bar(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(17, -1);
      const barNum = Number(evaluateExpression(inner, buildScope(locals, trimmed))) || 1;
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const bars = score.split("|").map((b) => b.trim());
        const barIdx = Math.max(0, Math.min(bars.length - 1, barNum - 1));
        if (bars.length > 1 && bars[barIdx] !== void 0) {
          bars.splice(barIdx, 1);
          state[voice + "_track"] = bars.join(" | ");
          state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
          syncMusicState(state);
          if (typeof ctx().app.render === "function") {
            ctx().app.render();
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("storage.set(") || trimmed.startsWith("storage.save(") || trimmed.startsWith("local_storage.set(") || trimmed.startsWith("localStorage.set(")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const parts = splitTopLevel(inner, ",");
      if (parts.length >= 2) {
        const key2 = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const val = evaluateExpression(parts[1], buildScope(locals, trimmed));
        const serialized = typeof val === "string" ? val : JSON.stringify(val);
        setStorageItem(key2, serialized);
      }
      return true;
    }
    if (trimmed.startsWith("storage.set ") || trimmed.startsWith("storage.save ")) {
      const rest = trimmed.slice(12).trim();
      const parts = splitTopLevel(rest, ",");
      if (parts.length >= 2) {
        const key2 = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const val = evaluateExpression(parts[1], buildScope(locals, trimmed));
        const serialized = typeof val === "string" ? val : JSON.stringify(val);
        setStorageItem(key2, serialized);
      }
      return true;
    }
    if (trimmed.startsWith("storage.remove(") || trimmed.startsWith("storage.delete(") || trimmed.startsWith("local_storage.remove(")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const key2 = String(evaluateExpression(inner, buildScope(locals, trimmed)));
      removeStorageItem(key2);
      return true;
    }
    if (trimmed === "storage.clear()" || trimmed === "storage.clear" || trimmed === "local_storage.clear()") {
      clearStorage();
      return true;
    }
    if (trimmed.startsWith("download(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(9, -1);
      const parts = splitTopLevel(inner, ",");
      if (parts.length >= 2) {
        const filename = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const content = String(evaluateExpression(parts[1], buildScope(locals, trimmed)));
        downloadText(filename, content);
      }
      return true;
    }
    if (trimmed.startsWith("download ")) {
      const rest = trimmed.slice(9).trim();
      const parts = splitTopLevel(rest, ",");
      if (parts.length >= 2) {
        const filename = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const content = String(evaluateExpression(parts[1], buildScope(locals, trimmed)));
        downloadText(filename, content);
      }
      return true;
    }
    if ((trimmed.startsWith("clipboard.copy(") || trimmed.startsWith("copy(")) && trimmed.endsWith(")")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const text = String(evaluateExpression(inner, buildScope(locals, trimmed)));
      copyText(text);
      return true;
    }
    if (trimmed === "fullscreen.toggle()" || trimmed === "fullscreen.toggle" || trimmed === "fullscreen()" || trimmed === "fullscreen" || trimmed === "toggle_fullscreen()" || trimmed === "fullscreen.enter()" || trimmed === "fullscreen.exit()") {
      if (typeof document !== "undefined") {
        const doc = document;
        const docEl = document.documentElement;
        const isFs = Boolean(
          doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement || doc.body.getAttribute("data-fullscreen") === "true" || doc.body.classList.contains("fullscreen")
        );
        const shouldEnter = trimmed === "fullscreen.enter()" ? true : trimmed === "fullscreen.exit()" ? false : !isFs;
        if (shouldEnter) {
          if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(() => {
            });
          } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
          } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen();
          }
          doc.body.setAttribute("data-fullscreen", "true");
          doc.body.classList.add("fullscreen");
        } else {
          if (doc.exitFullscreen) {
            doc.exitFullscreen().catch(() => {
            });
          } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
          } else if (doc.msExitFullscreen) {
            doc.msExitFullscreen();
          }
          doc.body.removeAttribute("data-fullscreen");
          doc.body.classList.remove("fullscreen");
        }
        if (typeof window !== "undefined" && window.parent && window.parent !== window) {
          try {
            window.parent.postMessage({ type: "toggle_fullscreen", is_fullscreen: shouldEnter }, "*");
          } catch (_) {
          }
        }
        const app = ctx().app;
        if (typeof app?.state !== "undefined") {
          app.state.is_fullscreen = shouldEnter;
          if (typeof app.render === "function") {
            app.render();
          }
        }
      }
      return true;
    }
    const emitterMatch = trimmed.match(/^([A-Za-z_][\w]*)\.(burst|step)\((.*)\)$/);
    if (emitterMatch && ctx().emitters && Object.prototype.hasOwnProperty.call(ctx().emitters, emitterMatch[1])) {
      const name2 = emitterMatch[1];
      const method = emitterMatch[2];
      const cfg = ctx().emitters[name2] || {};
      const scope = buildScope(locals, trimmed);
      const existing = evaluateExpression(name2, scope);
      const current = Array.isArray(existing) ? existing : [];
      if (method === "step") {
        if (current.length === 0) return true;
        const friction = cfg.friction ?? 0.92;
        const gravity = cfg.gravity ?? 0;
        const surviving = [];
        const rawCurrent2 = current.__raw || current;
        for (let i = 0; i < rawCurrent2.length; i += 1) {
          const item = rawCurrent2[i];
          if (!item || typeof item !== "object") continue;
          const p = item.__raw || item;
          const life2 = Number(p.life || 0) - 1;
          if (life2 <= 0) continue;
          const vx = Number(p.vx || 0) * friction;
          const vy = Number(p.vy || 0) * friction + gravity;
          p.x = Math.round((Number(p.x || 0) + Number(p.vx || 0)) * 10) / 10;
          p.y = Math.round((Number(p.y || 0) + Number(p.vy || 0)) * 10) / 10;
          p.vx = vx;
          p.vy = vy;
          p.life = life2;
          surviving.push(p);
        }
        assignPath(name2, surviving, locals);
        return true;
      }
      const parts = emitterMatch[3].trim() ? splitTopLevel(emitterMatch[3], ",") : [];
      if (parts.length < 2) {
        console.warn(`[rune-web] ${name2}.burst(x, y, [count, color, speed]) needs at least x and y`);
        return true;
      }
      const arg = (i) => parts.length > i ? evaluateExpression(parts[i], scope) : void 0;
      const xVal = Math.round(Number(arg(0) || 0) * 10) / 10;
      const yVal = Math.round(Number(arg(1) || 0) * 10) / 10;
      const countVal = Number(arg(2) ?? cfg.count ?? 8);
      const colorVal = arg(3) !== void 0 ? valueToString(arg(3)) : cfg.color ?? "#ffffff";
      const speedVal = Number(arg(4) ?? cfg.speed ?? 7);
      const life = cfg.life ?? 14;
      const maxParticles = cfg.max !== void 0 ? Number(cfg.max) : 36;
      const [minSize, maxSize] = Array.isArray(cfg.size) ? cfg.size : [cfg.size ?? 3, cfg.size ?? 5];
      const rawCurrent = current.__raw || current;
      const newParticles = [];
      for (let i = 0; i < countVal; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = (Math.random() * 0.7 + 0.3) * speedVal;
        newParticles.push({
          x: xVal,
          y: yVal,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life,
          max_life: life,
          color: colorVal,
          size: minSize + Math.floor(Math.random() * (maxSize - minSize + 1))
        });
      }
      const combined = rawCurrent.concat(newParticles);
      const capped = combined.length > maxParticles ? combined.slice(combined.length - maxParticles) : combined;
      assignPath(name2, capped, locals);
      return true;
    }
    const restoreMatch = trimmed.match(/^(?:restore|reset)\s+([a-zA-Z0-9_.[\]'"]+)$/) || trimmed.match(/^([a-zA-Z0-9_.[\]'"]+)\.(?:restore|reset)\(\)$/);
    if (restoreMatch) {
      const targetPath = restoreMatch[1].trim();
      const initial = ctx().initialState;
      if (initial && Object.prototype.hasOwnProperty.call(initial, targetPath)) {
        assignPath(targetPath, JSON.parse(JSON.stringify(initial[targetPath])), locals);
        return true;
      }
      const targetVal = evaluateExpression(targetPath, buildScope(locals, trimmed));
      if (Array.isArray(targetVal)) {
        for (const item of targetVal) {
          if (item && typeof item === "object") {
            for (const key2 of Object.keys(item)) {
              if (key2.startsWith("start_")) {
                const baseProp = key2.slice(6);
                item[baseProp] = item[key2];
              }
            }
            if ("alive" in item) {
              item.alive = true;
            }
          }
        }
        assignPath(targetPath, targetVal, locals);
        return true;
      } else if (targetVal && typeof targetVal === "object") {
        const item = targetVal;
        for (const key2 of Object.keys(item)) {
          if (key2.startsWith("start_")) {
            item[key2.slice(6)] = item[key2];
          }
        }
        if ("alive" in item) {
          item.alive = true;
        }
        assignPath(targetPath, item, locals);
        return true;
      }
      return true;
    }
    const compoundMatch = trimmed.match(/^([a-zA-Z0-9_.[\]'"]+)\s*(\+|\-|\*|\/)=\s*(.+)$/);
    if (compoundMatch) {
      const left = compoundMatch[1].trim();
      const op = compoundMatch[2];
      const right = compoundMatch[3].trim();
      const rightVal = evaluateExpression(right, buildScope(locals, trimmed));
      const leftVal = evaluateExpression(left, buildScope(locals, trimmed));
      let newVal;
      if (op === "+") {
        if (typeof leftVal === "number" && typeof rightVal === "number") {
          newVal = leftVal + rightVal;
        } else {
          newVal = `${valueToString(leftVal)}${valueToString(rightVal)}`;
        }
      } else if (op === "-") {
        newVal = Number(leftVal) - Number(rightVal);
      } else if (op === "*") {
        newVal = Number(leftVal) * Number(rightVal);
      } else if (op === "/") {
        newVal = Number(leftVal) / Number(rightVal);
      }
      assignPath(left, newVal, locals);
      return true;
    }
    if (trimmed.includes("=") && !trimmed.match(/^.+?\.push\(/)) {
      const assignmentMatch = trimmed.match(/^(.*?)(?<![!<>=])=(?!=)([\s\S]*)$/);
      if (assignmentMatch) {
        const rawLeft = assignmentMatch[1].trim();
        const left = rawLeft.replace(/^(?:local|let)\s+/, "");
        const right = assignmentMatch[2].trim();
        const builtinVal = handleBuiltin(right, locals);
        if (builtinVal == STOP) {
          return false;
        }
        if (builtinVal == NO_ACTION) {
          return true;
        }
        const value = builtinVal !== void 0 ? builtinVal : evaluateExpression(right, buildScope(locals, trimmed));
        if (left !== rawLeft) locals[left] = value;
        else assignPath(left, value, locals);
        return true;
      }
    }
    const cmdResult = handleBuiltin(trimmed, locals);
    if (cmdResult) {
      if (cmdResult == STOP) {
        return false;
      }
      return true;
    }
    const pushMatch = trimmed.match(/^(.+?)\.push\((.+)\)$/);
    if (pushMatch) {
      const path = pushMatch[1].trim();
      const arg = pushMatch[2].trim();
      const collection = evaluateExpression(path, buildScope(locals, trimmed));
      if (Array.isArray(collection)) {
        const val = evaluateExpression(arg, buildScope(locals, trimmed));
        collection.push(val);
        assignPath(path, collection, locals);
      }
      return true;
    }
    if (trimmed.includes("(") && trimmed.endsWith(")")) {
      const parenIndex = trimmed.indexOf("(");
      const funcName = trimmed.slice(0, parenIndex).trim();
      const argsStr = trimmed.slice(parenIndex + 1, -1);
      if (funcName === "window.__runeWebEmit") {
        const args = argsStr ? splitTopLevel(argsStr, ",").map(
          (arg) => evaluateExpression(arg, buildScope(locals, trimmed))
        ) : [];
        const emitFn = getWindowProp("__runeWebEmit");
        if (emitFn && typeof emitFn === "function") {
          emitFn.apply(null, args);
        }
        return true;
      }
    }
    return true;
  }
  function suspendForFetch(pending, locals, rest) {
    const context = ctx();
    runFetchAssignment(pending, locals).then(
      (value) => withContext(context, () => {
        try {
          assignPath(pending.target, value, locals);
          executeSteps(rest, locals);
        } catch (error) {
          console.error(error);
        }
        context.app.render();
      }),
      (error) => withContext(context, () => reportFetchFailure(error, pending.onError, locals))
    );
  }
  function executeSteps(steps, locals, nested = false) {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (Object.prototype.hasOwnProperty.call(step, "Statement")) {
        const storage = storageAssignment(step.Statement);
        if (storage) {
          if (nested) throw new Error("Storage I/O must be a top-level action step");
          const context = ctx();
          const packet = evaluateExpression(storage.packet, buildScope(locals, step.Statement));
          requestDataSource(storage.source, packet, { kind: storage.kind }).then(
            (result) => withContext(context, () => {
              assignPath(storage.target, result, locals);
              executeSteps(steps.slice(i + 1), locals);
              context.app.render();
            }),
            (error) => withContext(context, () => {
              if (storage.onError) context.app.invokeAction(storage.onError, [{ message: String(error.message ?? error) }], locals);
              else console.error(error);
              context.app.render();
            })
          );
          return false;
        }
        const pending = parseFetchAssignment(step.Statement);
        if (pending) {
          if (nested) {
            throw new Error(`'${step.Statement}' must be a top-level action step, not inside if/for. Use 'fetch-json <url> then <action>' there.`);
          }
          suspendForFetch(pending, locals, steps.slice(i + 1));
          return false;
        }
        if (!executeStatement(step.Statement, locals)) return false;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(step, "Conditional")) {
        const conditional = step.Conditional;
        if (Boolean(
          evaluateExpression(
            conditional.condition,
            buildScope(locals, conditional.condition)
          )
        )) {
          if (!executeSteps(conditional.steps || [], locals, true)) return false;
        }
      }
      if (Object.prototype.hasOwnProperty.call(step, "Match")) {
        const matchStep = step.Match;
        const targetVal = evaluateExpression(
          matchStep.expression,
          buildScope(locals, matchStep.expression)
        );
        for (const c of matchStep.cases) {
          const pat = c.pattern.trim();
          let matched = false;
          if (pat === "else" || pat === "_" || pat === "default" || pat === "*") {
            matched = true;
          } else {
            const parts = splitTopLevel(pat, ",");
            for (const p of parts) {
              const trimmedP = p.trim();
              let caseVal;
              try {
                caseVal = evaluateExpression(trimmedP, buildScope(locals, trimmedP));
              } catch {
                caseVal = trimmedP;
              }
              if (caseVal === targetVal || String(caseVal) === String(targetVal) || trimmedP === targetVal) {
                matched = true;
                break;
              }
            }
          }
          if (matched) {
            if (!executeSteps(c.steps || [], locals, true)) return false;
            break;
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(step, "ForLoop")) {
        const loop = step.ForLoop;
        const collection = evaluateExpression(
          loop.collection,
          buildScope(locals, loop.collection)
        );
        if (Array.isArray(collection)) {
          for (let i2 = 0; i2 < collection.length; i2++) {
            const item = collection[i2];
            const childLocals = Object.assign(
              {},
              locals || {}
            );
            childLocals[loop.item_name] = item;
            if (loop.index_name) {
              childLocals[loop.index_name] = i2;
            }
            if (!executeSteps(loop.steps || [], childLocals, true)) {
              break;
            }
          }
        }
      }
    }
    return true;
  }
  function storageAssignment(source) {
    const match = source.trim().match(/^([\w$.[\]'\"]+)\s*=\s*(db|events)\s+([A-Za-z_][\w-]*)\s+([\s\S]+?)(?:\s+catch\s+([\w]+))?$/);
    return match ? { target: match[1], kind: match[2], source: match[3], packet: match[4], onError: match[5] } : null;
  }
  var PITCH_ROWS = {
    "C5": 0,
    "B4": 1,
    "A#4": 2,
    "BB4": 2,
    "A4": 3,
    "G#4": 4,
    "AB4": 4,
    "G4": 5,
    "F#4": 6,
    "GB4": 6,
    "F4": 7,
    "E4": 8,
    "D#4": 9,
    "EB4": 9,
    "D4": 10,
    "C#4": 11,
    "DB4": 11,
    "C4": 12,
    "B3": 13,
    "A#3": 14,
    "BB3": 14,
    "A3": 15,
    "G#3": 16,
    "AB3": 16,
    "G3": 17,
    "F#3": 18,
    "GB3": 18,
    "F3": 19,
    "E3": 20,
    "D#3": 21,
    "EB3": 21,
    "D3": 22,
    "C#3": 23,
    "DB3": 23,
    "C3": 24,
    "B2": 25,
    "A#2": 26,
    "BB2": 26,
    "A2": 27,
    "G#2": 28,
    "AB2": 28,
    "G2": 29,
    "F#2": 30,
    "GB2": 30,
    "F2": 31,
    "E2": 32,
    "D2": 33,
    "C2": 34,
    "A1": 35,
    // Drums
    "hihat": 0,
    "snare": 1,
    "kick": 2
  };
  function getPitchRow(pitch2, isDrum) {
    if (isDrum) {
      const p = pitch2.toLowerCase();
      if (p.includes("hihat") || p.includes("crash")) return 0;
      if (p.includes("snare") || p.includes("tom")) return 1;
      return 2;
    }
    const clean = pitch2.toUpperCase().trim();
    if (clean in PITCH_ROWS) return PITCH_ROWS[clean];
    const match = clean.match(/^([A-G][#B]?)([0-8])$/);
    if (match) {
      const oct = parseInt(match[2], 10);
      if (oct >= 5) return 0;
      if (oct === 4) return 8;
      if (oct === 3) return 15;
      if (oct <= 2) return 27;
    }
    return 12;
  }
  function parseTrackToSteps(scoreStr, selectedIdx, timeSignature = "4/4", selectedBar = 0, fixedBars = false) {
    if (!scoreStr) return [];
    const tokens2 = String(scoreStr).trim().split(/\s+/).filter(Boolean);
    const steps = [];
    const beatsPerBar = timeSignature.startsWith("3/") ? 3 : 4;
    let barNum = 1;
    let currentBeatInBar = 0;
    let totalBeatOffset = 0;
    let stepInBar = 1;
    for (let i = 0; i < tokens2.length; i++) {
      const raw = tokens2[i];
      if (raw === "|") {
        const totalLeft2 = Math.round(totalBeatOffset * 120);
        const barLeft2 = Math.round(currentBeatInBar * 120);
        steps.push({
          id: i,
          raw,
          note: "|",
          duration: "",
          len_label: "BAR " + barNum,
          beats: 0,
          is_bar: true,
          is_chord: false,
          is_rest: false,
          is_selected: i === selectedIdx,
          bar_num: barNum,
          step_num: stepInBar,
          pitch_class: "step-bar",
          matrix_top: 0,
          matrix_left: selectedBar > 0 ? barLeft2 : totalLeft2,
          matrix_total_left: totalLeft2,
          matrix_bar_left: barLeft2,
          matrix_width: 8,
          strip_width: 54,
          can_stretch: false,
          can_shorten: false
        });
        barNum += 1;
        currentBeatInBar = 0;
        stepInBar = 1;
        continue;
      }
      let pitch2 = raw;
      let dur = ":8";
      let isChord = false;
      let chordNotes = [];
      if (raw.startsWith("[") && raw.includes("]")) {
        const closeIdx = raw.indexOf("]");
        pitch2 = raw.slice(1, closeIdx);
        const after = raw.slice(closeIdx + 1);
        dur = after.startsWith(":") ? after : ":8";
        isChord = true;
        chordNotes = pitch2.split(/[,+]/).map((s) => s.trim()).filter(Boolean);
      } else {
        const colonIdx = raw.indexOf(":");
        pitch2 = colonIdx !== -1 ? raw.slice(0, colonIdx) : raw;
        dur = colonIdx !== -1 ? raw.slice(colonIdx) : ":8";
        if (pitch2.includes("+")) {
          isChord = true;
          chordNotes = pitch2.split("+").map((s) => s.trim()).filter(Boolean);
        }
      }
      const isRest = pitch2 === "-" || pitch2.toLowerCase() === "rest";
      let lenLabel = "1/8";
      let beats = 0.5;
      if (dur === ":16") {
        lenLabel = "1/16";
        beats = 0.25;
      } else if (dur === ":8") {
        lenLabel = "1/8";
        beats = 0.5;
      } else if (dur === ":4") {
        lenLabel = "1/4";
        beats = 1;
      } else if (dur === ":2") {
        lenLabel = "1/2";
        beats = 2;
      } else if (dur === ":1") {
        lenLabel = "1/1";
        beats = fixedBars ? 4 : beatsPerBar;
      } else if (fixedBars) {
        beats = 4 / Number(dur.slice(1));
        lenLabel = Math.round(beats * 4) + "/16";
      }
      let pitchClass = "step-note";
      if (isRest) pitchClass = "step-rest";
      else if (isChord) pitchClass = "step-chord";
      else if (pitch2.includes("2") || pitch2.includes("1")) pitchClass = "step-bass";
      else if (pitch2.includes("3")) pitchClass = "step-mid-low";
      else if (pitch2.includes("4")) pitchClass = "step-mid";
      else if (pitch2.includes("5")) pitchClass = "step-high";
      else if (pitch2 === "kick") pitchClass = "step-kick";
      else if (pitch2 === "snare") pitchClass = "step-snare";
      else if (pitch2 === "hihat") pitchClass = "step-hihat";
      const rootPitch = isChord && chordNotes.length > 0 ? chordNotes[0] : pitch2;
      const isDrumPitch = ["kick", "snare", "hihat", "crash", "tom"].includes(rootPitch.toLowerCase());
      const row = getPitchRow(rootPitch, isDrumPitch);
      const rowHeight = isDrumPitch ? 48 : 28;
      const matrixTop = row * rowHeight + 2;
      const totalLeft = Math.round(totalBeatOffset * 120);
      const barLeft = Math.round(currentBeatInBar * 120);
      const matrixLeft = selectedBar > 0 ? barLeft : totalLeft;
      const matrixWidth = Math.max(fixedBars ? 1 : 34, Math.round(beats * 120) - 4);
      const stripWidth = Math.max(54, Math.round(beats * 140));
      const displayNote = isRest ? "REST" : isChord ? pitch2.startsWith("[") ? pitch2 : `[${pitch2}]` : pitch2;
      steps.push({
        id: i,
        raw,
        note: displayNote,
        chord_notes: isChord ? chordNotes : [pitch2],
        duration: dur,
        len_label: lenLabel,
        beats,
        is_bar: false,
        is_chord: isChord,
        is_rest: isRest,
        is_selected: i === selectedIdx,
        bar_num: barNum,
        step_num: stepInBar,
        pitch_class: pitchClass,
        pitch_row: row,
        matrix_top: matrixTop,
        matrix_left: matrixLeft,
        matrix_total_left: totalLeft,
        matrix_bar_left: barLeft,
        matrix_width: matrixWidth,
        strip_width: stripWidth,
        can_stretch: beats < 4,
        can_shorten: beats > 0.25
      });
      totalBeatOffset += beats;
      currentBeatInBar += beats;
      stepInBar += 1;
      if (currentBeatInBar >= beatsPerBar && !tokens2.includes("|")) {
        barNum += 1;
        currentBeatInBar = 0;
        stepInBar = 1;
      }
    }
    return steps;
  }
  var STUDIO_VOICES = ["lead", "bass", "chords", "drums"];
  var STUDIO_PITCHES = Object.keys(PITCH_ROWS).filter((pitch2) => /^[A-G]#?\d$/.test(pitch2)).sort((a, b) => PITCH_ROWS[a] - PITCH_ROWS[b]);
  var DRUM_PITCHES = ["hihat", "snare", "kick"];
  function studioSongParts(state, barTicks, bars) {
    const voicePatterns = (voice) => studioTrackPatterns(String(state[voice + "_track"] || ""), barTicks, bars);
    const lead = voicePatterns("lead");
    const bass = voicePatterns("bass");
    const chords = voicePatterns("chords");
    const drums = voicePatterns("drums");
    const layers = {};
    const instruments = {};
    for (const [voice, patterns] of Object.entries({ lead, bass, chords, drums })) {
      const instrument = String(state[voice + "_instrument"]);
      instruments[voice] = instrument;
      for (let lane = 1; lane < patterns.length; lane++) {
        const name2 = voice + "_studio_" + lane;
        layers[name2] = patterns[lane];
        instruments[name2] = instrument;
      }
    }
    return { lead, bass, chords, drums, layers, instruments };
  }
  function syncSequencerState(state) {
    const voice = String(state.active_voice || "lead");
    const timeSignature = String(state.time_signature || "4/4");
    const selectedBar = Number(state.selected_bar ?? 0);
    const selectedId = Number(state.selected_step_id ?? -1);
    const score = String(state[voice + "_track"] || "");
    if (state.studio_fixed_bars !== true) {
      state.active_steps = parseTrackToSteps(score, selectedId, timeSignature, selectedBar);
      return;
    }
    state.active_instrument = state[voice + "_instrument"];
    if (state.studio_selection_count) {
      state.studio_selected_notes = {};
      state.studio_selection_count = 0;
    }
    const barTicks = studioBarTicks(timeSignature);
    const bars = Number(state.bars) || 1;
    const parts = studioSongParts(state, barTicks, bars);
    const patterns = parts[voice] ?? parts.lead;
    const steps = patterns.flatMap(
      (pattern, lane) => parseTrackToSteps(pattern, selectedId - lane * STUDIO_STEP_IDS_PER_VOICE, timeSignature, selectedBar, true).map((step) => ({ ...step, id: Number(step.id) + lane * STUDIO_STEP_IDS_PER_VOICE, lane }))
    );
    state.studio_timeline_width = (selectedBar ? 1 : bars) * barTicks * STUDIO_TICK_WIDTH;
    const stripTickWidth = STUDIO_STRIP_TICK_WIDTH;
    state.studio_strip_width = (selectedBar ? 1 : bars) * barTicks * stripTickWidth;
    state.studio_strip_height = patterns.length * 88 - 4;
    for (const step of steps) {
      step.strip_top = Number(step.lane) * 88;
      step.strip_left = Math.round(Number(step.matrix_left) / STUDIO_TICK_WIDTH) * stripTickWidth;
      if (step.is_bar) {
        step.bar_num = Number(step.bar_num) + 1;
        step.len_label = "BAR " + step.bar_num;
        continue;
      }
      const tick = Math.round(Number(step.matrix_bar_left) / STUDIO_TICK_WIDTH);
      const ticks = Math.round(Number(step.beats) * 4);
      step.step_num = tick + 1;
      step.strip_width = ticks * stripTickWidth - 4;
      if (!step.is_rest) {
        const limit = studioNoteLimit(steps, step, barTicks);
        step.can_stretch = studioStretchTicks(ticks, 1, limit) > ticks;
        step.can_shorten = ticks > 1;
      }
    }
    state.active_steps = steps;
    for (const channel of STUDIO_VOICES) {
      state[channel + "_export"] = parts[channel][0];
    }
    state.layer_exports = Object.entries(parts.layers).map(([name2, pattern]) => "\n" + name2 + ":\n    " + pattern + "\n").join("");
    state.export_instruments_body = JSON.stringify(parts.instruments).slice(1, -1);
  }
  function studioNoteLimit(steps, step, barTicks) {
    const start = Number(step.matrix_bar_left) / STUDIO_TICK_WIDTH;
    const next2 = steps.filter((other) => !other.is_bar && !other.is_rest && other.bar_num === step.bar_num && other.pitch_row === step.pitch_row).map((other) => Number(other.matrix_bar_left) / STUDIO_TICK_WIDTH).filter((tick) => tick > start);
    return Math.min(barTicks, ...next2) - start;
  }
  function auditionStudioNote(state, voice, note) {
    auditionMusicNote(note, String(state[voice + "_instrument"]));
  }
  function editStudioSequence(state, kind, first, second) {
    const voice = String(state.active_voice || "lead");
    if (kind === "audition") {
      const note2 = String(first);
      state.selected_note = note2;
      auditionStudioNote(state, voice, note2);
      return;
    }
    if (kind === "instrument") {
      if (voice === "drums") return;
      const instrument = String(first);
      state[voice + "_instrument"] = instrument;
      setTrackInstrument(voice, instrument, true);
      syncSequencerState(state);
      state.status_message = "Set " + voice + " instrument sound to " + instrument;
      return;
    }
    const barTicks = studioBarTicks(String(state.time_signature));
    const bars = Number(state.bars) || 1;
    const selectedBar = Number(state.selected_bar) || 0;
    const trackKey = voice + "_track";
    const score = String(state[trackKey] || "");
    let bar = selectedBar;
    let tick = -1;
    let note = "";
    let lane = 0;
    if (kind === "addBar" || kind === "duplicateBar" || kind === "deleteBar") {
      if (kind === "deleteBar" ? bars <= 1 : bars >= 8) return;
      for (const channel of STUDIO_VOICES) {
        const key2 = channel + "_track";
        state[key2] = studioScoreLanes(String(state[key2] || ""), barTicks).map(
          (voiceScore) => editStudioTrack(voiceScore, barTicks, bars, { kind, bar: selectedBar || bars })?.score ?? voiceScore
        ).join("\n");
      }
      state.bars = bars + (kind === "deleteBar" ? -1 : 1);
      state.selected_bar = kind === "deleteBar" ? Math.min(selectedBar || bars, bars - 1) : state.bars;
      state.selected_step_id = -1;
      syncSequencerState(state);
      state.status_message = kind === "deleteBar" ? "Deleted bar " + (selectedBar || bars) : "Added bar " + state.bars;
      return;
    }
    if (kind === "matrix") {
      const column = Math.floor(Number(first) / STUDIO_TICK_WIDTH);
      const pitches = voice === "drums" ? DRUM_PITCHES : STUDIO_PITCHES;
      note = pitches[Math.floor(Number(second) / (voice === "drums" ? 48 : 28))];
      bar = selectedBar || Math.floor(column / barTicks) + 1;
      tick = column % barTicks;
      if (!note) return;
      const ticks = studioTokenTicks(note + String(state.active_duration || ":8"), barTicks);
      const result = placeStudioNote(score, barTicks, bars, { bar, tick, pitch: note, ticks });
      if (!result?.score) return;
      state[trackKey] = result.score;
      selectStudioPosition(state, bar, tick, result.lane ?? 0);
    } else {
      const lanes = studioScoreLanes(score, barTicks);
      if (kind === "delete" || kind === "stretch") {
        const steps = state.active_steps;
        const step = steps.find((step2) => step2.id === Number(first) && !step2.is_rest && !step2.is_bar);
        if (!step) return;
        bar = Number(step.bar_num);
        tick = Math.round(Number(step.matrix_bar_left) / STUDIO_TICK_WIDTH);
        lane = Number(step.lane);
        if (kind === "stretch") {
          const ticks = Math.round(Number(step.beats) * 4);
          const targetTicks = studioStretchTicks(ticks, Number(second), studioNoteLimit(steps, step, barTicks));
          const pitch2 = step.chord_notes[0];
          const result = placeStudioNote(score, barTicks, bars, {
            bar,
            tick,
            pitch: pitch2,
            source: { bar, tick, lane },
            resizeBy: targetTicks - ticks
          });
          if (!result?.score) return;
          state[trackKey] = result.score;
          selectStudioPosition(state, bar, tick, result.lane ?? 0);
        } else {
          const result = editStudioTrack(lanes[lane], barTicks, bars, { kind, bar, tick });
          if (!result) return;
          lanes[lane] = result.score;
          while (lanes.length > 1 && !/[^|\s]/.test(lanes[lanes.length - 1])) lanes.pop();
          state[trackKey] = lanes.join("\n");
          selectStudioPosition(state, bar, tick, lane, false);
        }
      } else return;
    }
    if (note) {
      state.selected_note = note;
      auditionStudioNote(state, voice, note);
      state.status_message = "Placed " + note + " in bar " + bar;
    } else {
      state.status_message = (kind === "delete" ? "Removed note from bar " : "Resized note in bar ") + bar;
    }
  }
  function selectStudioPosition(state, bar, tick, lane, select2 = true) {
    syncSequencerState(state);
    const selected = select2 ? state.active_steps.find((step) => !step.is_rest && !step.is_bar && step.bar_num === bar && step.lane === lane && step.matrix_bar_left === tick * STUDIO_TICK_WIDTH) : void 0;
    state.selected_step_id = selected?.id ?? -1;
  }
  function updateStudioNoteDrag(state, id, columnDelta, rowDelta, resize, commit = false) {
    const step = state.active_steps.find((item) => item.id === id && !item.is_rest && !item.is_bar);
    if (!step) return;
    const voice = String(state.active_voice);
    const pitches = voice === "drums" ? DRUM_PITCHES : STUDIO_PITCHES;
    const trackKey = voice + "_track";
    const barTicks = studioBarTicks(String(state.time_signature));
    const bars = Number(state.bars);
    const selectedBar = Number(state.selected_bar);
    const bar = Number(step.bar_num);
    const tick = Number(step.matrix_bar_left) / STUDIO_TICK_WIDTH;
    const sourceColumn = (bar - 1) * barTicks + tick;
    const first = selectedBar ? (selectedBar - 1) * barTicks : 0;
    const last = selectedBar ? selectedBar * barTicks - 1 : bars * barTicks - 1;
    const column = resize ? sourceColumn : Math.max(first, Math.min(last, sourceColumn + columnDelta));
    const targetBar = Math.floor(column / barTicks) + 1;
    const targetTick = column % barTicks;
    const sourceRow = Number(step.pitch_row);
    const row = resize ? sourceRow : Math.max(0, Math.min(pitches.length - 1, sourceRow + rowDelta));
    const fromPitch = step.chord_notes[0];
    const toPitch = row === sourceRow ? fromPitch : pitches[row];
    const result = placeStudioNote(String(state[trackKey] || ""), barTicks, bars, {
      bar: targetBar,
      tick: targetTick,
      pitch: toPitch,
      source: { bar, tick, lane: Number(step.lane) },
      resizeBy: resize ? columnDelta : void 0
    });
    if (!result) return;
    if (commit && result.score !== void 0) {
      state[trackKey] = result.score;
      selectStudioPosition(state, targetBar, targetTick, result.lane ?? 0);
      state.selected_note = toPitch;
      state.status_message = (resize ? "Resized note in bar " : "Moved note to bar ") + targetBar;
    }
    return { valid: result.valid, ticks: result.ticks, column: column - first, row };
  }

  // src/logic.ts
  function createLogicApp(render) {
    return {
      state: {},
      derived: {},
      playSound,
      playMusic,
      stopMusic,
      pauseMusic,
      resumeMusic,
      computeDerived() {
        const context = ctx();
        const baseScope = buildScope({});
        for (const [name2, def] of Object.entries(
          context.derivedDefinitions
        )) {
          const sourceValue = resolveValue(def.source, baseScope);
          const sourceKey = valueToString(sourceValue);
          let resolved = void 0;
          for (const currentCase of def.cases || []) {
            const matcher = normalizeLiteral(currentCase.matcher);
            if (matcher === "_" || matcher === sourceKey) {
              resolved = evaluateExpression(
                currentCase.value,
                buildScope({})
              );
              break;
            }
          }
          this.derived[name2] = resolved;
        }
      },
      render,
      invokeAction(name2, args, locals) {
        const context = ctx();
        name2 = callableName(name2, "action");
        let def = context.actionDefinitions[name2];
        let receiver;
        if (def?.scope?.startsWith("@") && def.scope === context.logicOwner) receiver = context.logicState;
        if (!def && name2.includes(".")) {
          const dot = name2.lastIndexOf(".");
          const value = evaluateExpression(name2.slice(0, dot), buildScope(locals || {}));
          if (value && typeof value === "object" && !Array.isArray(value)) {
            receiver = value;
            const type = receiver.__type;
            if (typeof type === "string") def = context.actionDefinitions[`${type}.${name2.slice(dot + 1)}`];
          }
        }
        if (!def) {
          if (name2.includes(".") || context.logicOwner) throw new Error(`Unknown Rune-Web action: ${name2}`);
          if (typeof window !== "undefined" && typeof window[name2] === "function") {
            window[name2](...args);
          }
          return;
        }
        const scopedLocals = def.scope ? {} : Object.assign({}, locals);
        if (receiver) scopedLocals.self = receiver;
        (def.params || []).forEach((param, index2) => {
          scopedLocals[param] = args[index2];
        });
        inLogicScope(name2, def, receiver, () => executeSteps(def.steps || [], scopedLocals));
      }
    };
  }

  // src/game_ready.ts
  function beginGameLoading() {
    if (typeof document !== "undefined") document.documentElement.dataset.runeGameState = "loading";
  }
  function markGameReady() {
    if (typeof document === "undefined" || typeof window === "undefined" || document.documentElement.dataset.runeGameState === "ready") return;
    document.documentElement.dataset.runeGameState = "ready";
    if (window.parent !== window) window.parent.postMessage({ type: "rune-game-ready" }, "*");
  }

  // src/rendering.ts
  function renderNode(node, locals) {
    if (node.Element) {
      const element = node.Element;
      if (element.for_each) {
        const collection = evaluateExpression(
          element.for_each.collection,
          buildScope(locals)
        );
        if (!Array.isArray(collection)) return "";
        return collection.map((item, index2) => {
          const childLocals = Object.assign(
            {},
            locals || {}
          );
          childLocals[element.for_each.item_name] = item;
          if (element.for_each.index_name)
            childLocals[element.for_each.index_name] = index2;
          return renderElement(element, childLocals);
        }).join("");
      }
      return renderElement(element, locals);
    }
    if (node.Loop) {
      const loop = node.Loop;
      const collection = evaluateExpression(
        loop.collection,
        buildScope(locals)
      );
      if (!Array.isArray(collection)) return "";
      return collection.map((item, index2) => {
        const childLocals = Object.assign(
          {},
          locals || {}
        );
        childLocals[loop.item_name] = item;
        if (loop.index_name) childLocals[loop.index_name] = index2;
        return (loop.body || []).map((child) => renderNode(child, childLocals)).join("");
      }).join("");
    }
    if (node.Conditional) {
      const conditional = node.Conditional;
      if (Boolean(
        evaluateExpression(
          conditional.condition,
          buildScope(locals)
        )
      )) {
        return (conditional.body || []).map((child) => renderNode(child, locals)).join("");
      }
      return "";
    }
    if (node.Match) {
      const match = node.Match;
      const value = String(evaluateExpression(match.expression, buildScope(locals)));
      for (const caseDef of match.cases) {
        let matcher = normalizeLiteral(caseDef.matcher);
        if (matcher === "_" || matcher === value) {
          return (caseDef.body || []).map((child) => renderNode(child, locals)).join("");
        }
      }
      return "";
    }
    if (node.ComponentScope) {
      const scope = node.ComponentScope;
      const childLocals = Object.assign(
        {},
        locals || {}
      );
      for (const [key2, value] of Object.entries(scope.props || {})) {
        const valStr = String(value ?? "").trim();
        if (valStr.startsWith("{") && valStr.endsWith("}")) {
          const exprStr = valStr.slice(1, -1).trim();
          childLocals[key2] = evaluateExpression(
            exprStr,
            buildScope(locals)
          );
        } else {
          const parsed = tryParseLiteral(valStr, buildScope(locals));
          childLocals[key2] = parsed !== void 0 ? parsed : valStr;
        }
      }
      return renderNode(scope.body, childLocals);
    }
    if (node.MemoryBinding) {
      const binding = node.MemoryBinding;
      const memValue = ctx().app.state[binding.key];
      const childLocals = Object.assign(
        {},
        locals || {},
        { [binding.var]: memValue }
      );
      return (binding.body || []).map((child) => renderNode(child, childLocals)).join("");
    }
    if (node.Text !== void 0) {
      return escapeHtml(interpolate(node.Text, buildScope(locals)));
    }
    if (node.Comment !== void 0) {
      return `<!--${interpolate(node.Comment, buildScope(locals))}-->`;
    }
    if (node.LazyRoute) {
      const lazy = node.LazyRoute;
      const context = ctx();
      const app = context.app;
      const cleanRoute = lazy.route.toLowerCase();
      if (context.loadedChunks && context.loadedChunks[cleanRoute]) {
        const chunk = context.loadedChunks[cleanRoute];
        if (Array.isArray(chunk)) {
          return chunk.map((c) => renderNode(c, locals)).join("");
        }
        return renderNode(chunk, locals);
      }
      if (app && app.loadChunk) {
        app.loadChunk(cleanRoute, lazy.chunk_url);
      }
      if (lazy.fallback && lazy.fallback.length > 0) {
        return lazy.fallback.map((c) => renderNode(c, locals)).join("");
      }
      return `<div class="rune-lazy-placeholder" data-route="${escapeHtml(lazy.route)}"></div>`;
    }
    return "";
  }
  function renderElement(element, locals) {
    const scope = buildScope(locals);
    let attrs = "";
    if (element.id)
      attrs += ` id="${escapeHtml(interpolate(element.id, scope))}"`;
    if (element.classes && element.classes.length) {
      const renderedClasses = element.classes.map((c) => interpolate(c, scope)).filter((c) => c.length > 0);
      if (renderedClasses.length)
        attrs += ` class="${renderedClasses.join(" ")}"`;
    }
    for (const [key2, value] of Object.entries(element.attrs || {})) {
      const interpolated = interpolate(value, scope);
      const renderedValue = key2 === "src" || key2 === "href" ? hostedUrl(interpolated) : interpolated;
      if (renderedValue === "false" || renderedValue === "undefined" || renderedValue === "null") {
        const boolAttrs = [
          "checked",
          "disabled",
          "readonly",
          "selected",
          "hidden",
          "required",
          "multiple",
          "autofocus"
        ];
        if (boolAttrs.includes(key2)) continue;
      }
      attrs += ` ${key2}="${escapeHtml(renderedValue)}"`;
    }
    const eventEntries = Object.entries(element.events || {});
    if (eventEntries.length > 0 && locals && Object.keys(locals).length) {
      attrs += ` data-rune-scope="${escapeHtml(JSON.stringify(locals))}"`;
    }
    for (const [eventName, handler] of eventEntries) {
      attrs += ` data-on-${eventName}="${escapeHtml(interpolate(handler, scope))}"`;
    }
    const text = element.text ? escapeHtml(interpolate(element.text, scope)) : "";
    const children = (element.children || []).map((child) => renderNode(child, locals)).join("");
    return `<${element.tag}${attrs}>${text}${children}</${element.tag}>`;
  }

  // node_modules/leaflet/dist/leaflet.css
  var leaflet_default = `/* required styles */\r
\r
.leaflet-pane,\r
.leaflet-tile,\r
.leaflet-marker-icon,\r
.leaflet-marker-shadow,\r
.leaflet-tile-container,\r
.leaflet-pane > svg,\r
.leaflet-pane > canvas,\r
.leaflet-zoom-box,\r
.leaflet-image-layer,\r
.leaflet-layer {\r
	position: absolute;\r
	left: 0;\r
	top: 0;\r
	}\r
.leaflet-container {\r
	overflow: hidden;\r
	}\r
.leaflet-tile,\r
.leaflet-marker-icon,\r
.leaflet-marker-shadow {\r
	-webkit-user-select: none;\r
	   -moz-user-select: none;\r
	        user-select: none;\r
	  -webkit-user-drag: none;\r
	}\r
/* Prevents IE11 from highlighting tiles in blue */\r
.leaflet-tile::selection {\r
	background: transparent;\r
}\r
/* Safari renders non-retina tile on retina better with this, but Chrome is worse */\r
.leaflet-safari .leaflet-tile {\r
	image-rendering: -webkit-optimize-contrast;\r
	}\r
/* hack that prevents hw layers "stretching" when loading new tiles */\r
.leaflet-safari .leaflet-tile-container {\r
	width: 1600px;\r
	height: 1600px;\r
	-webkit-transform-origin: 0 0;\r
	}\r
.leaflet-marker-icon,\r
.leaflet-marker-shadow {\r
	display: block;\r
	}\r
/* .leaflet-container svg: reset svg max-width decleration shipped in Joomla! (joomla.org) 3.x */\r
/* .leaflet-container img: map is broken in FF if you have max-width: 100% on tiles */\r
.leaflet-container .leaflet-overlay-pane svg {\r
	max-width: none !important;\r
	max-height: none !important;\r
	}\r
.leaflet-container .leaflet-marker-pane img,\r
.leaflet-container .leaflet-shadow-pane img,\r
.leaflet-container .leaflet-tile-pane img,\r
.leaflet-container img.leaflet-image-layer,\r
.leaflet-container .leaflet-tile {\r
	max-width: none !important;\r
	max-height: none !important;\r
	width: auto;\r
	padding: 0;\r
	}\r
\r
.leaflet-container img.leaflet-tile {\r
	/* See: https://bugs.chromium.org/p/chromium/issues/detail?id=600120 */\r
	mix-blend-mode: plus-lighter;\r
}\r
\r
.leaflet-container.leaflet-touch-zoom {\r
	-ms-touch-action: pan-x pan-y;\r
	touch-action: pan-x pan-y;\r
	}\r
.leaflet-container.leaflet-touch-drag {\r
	-ms-touch-action: pinch-zoom;\r
	/* Fallback for FF which doesn't support pinch-zoom */\r
	touch-action: none;\r
	touch-action: pinch-zoom;\r
}\r
.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom {\r
	-ms-touch-action: none;\r
	touch-action: none;\r
}\r
.leaflet-container {\r
	-webkit-tap-highlight-color: transparent;\r
}\r
.leaflet-container a {\r
	-webkit-tap-highlight-color: rgba(51, 181, 229, 0.4);\r
}\r
.leaflet-tile {\r
	filter: inherit;\r
	visibility: hidden;\r
	}\r
.leaflet-tile-loaded {\r
	visibility: inherit;\r
	}\r
.leaflet-zoom-box {\r
	width: 0;\r
	height: 0;\r
	-moz-box-sizing: border-box;\r
	     box-sizing: border-box;\r
	z-index: 800;\r
	}\r
/* workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=888319 */\r
.leaflet-overlay-pane svg {\r
	-moz-user-select: none;\r
	}\r
\r
.leaflet-pane         { z-index: 400; }\r
\r
.leaflet-tile-pane    { z-index: 200; }\r
.leaflet-overlay-pane { z-index: 400; }\r
.leaflet-shadow-pane  { z-index: 500; }\r
.leaflet-marker-pane  { z-index: 600; }\r
.leaflet-tooltip-pane   { z-index: 650; }\r
.leaflet-popup-pane   { z-index: 700; }\r
\r
.leaflet-map-pane canvas { z-index: 100; }\r
.leaflet-map-pane svg    { z-index: 200; }\r
\r
.leaflet-vml-shape {\r
	width: 1px;\r
	height: 1px;\r
	}\r
.lvml {\r
	behavior: url(#default#VML);\r
	display: inline-block;\r
	position: absolute;\r
	}\r
\r
\r
/* control positioning */\r
\r
.leaflet-control {\r
	position: relative;\r
	z-index: 800;\r
	pointer-events: visiblePainted; /* IE 9-10 doesn't have auto */\r
	pointer-events: auto;\r
	}\r
.leaflet-top,\r
.leaflet-bottom {\r
	position: absolute;\r
	z-index: 1000;\r
	pointer-events: none;\r
	}\r
.leaflet-top {\r
	top: 0;\r
	}\r
.leaflet-right {\r
	right: 0;\r
	}\r
.leaflet-bottom {\r
	bottom: 0;\r
	}\r
.leaflet-left {\r
	left: 0;\r
	}\r
.leaflet-control {\r
	float: left;\r
	clear: both;\r
	}\r
.leaflet-right .leaflet-control {\r
	float: right;\r
	}\r
.leaflet-top .leaflet-control {\r
	margin-top: 10px;\r
	}\r
.leaflet-bottom .leaflet-control {\r
	margin-bottom: 10px;\r
	}\r
.leaflet-left .leaflet-control {\r
	margin-left: 10px;\r
	}\r
.leaflet-right .leaflet-control {\r
	margin-right: 10px;\r
	}\r
\r
\r
/* zoom and fade animations */\r
\r
.leaflet-fade-anim .leaflet-popup {\r
	opacity: 0;\r
	-webkit-transition: opacity 0.2s linear;\r
	   -moz-transition: opacity 0.2s linear;\r
	        transition: opacity 0.2s linear;\r
	}\r
.leaflet-fade-anim .leaflet-map-pane .leaflet-popup {\r
	opacity: 1;\r
	}\r
.leaflet-zoom-animated {\r
	-webkit-transform-origin: 0 0;\r
	    -ms-transform-origin: 0 0;\r
	        transform-origin: 0 0;\r
	}\r
svg.leaflet-zoom-animated {\r
	will-change: transform;\r
}\r
\r
.leaflet-zoom-anim .leaflet-zoom-animated {\r
	-webkit-transition: -webkit-transform 0.25s cubic-bezier(0,0,0.25,1);\r
	   -moz-transition:    -moz-transform 0.25s cubic-bezier(0,0,0.25,1);\r
	        transition:         transform 0.25s cubic-bezier(0,0,0.25,1);\r
	}\r
.leaflet-zoom-anim .leaflet-tile,\r
.leaflet-pan-anim .leaflet-tile {\r
	-webkit-transition: none;\r
	   -moz-transition: none;\r
	        transition: none;\r
	}\r
\r
.leaflet-zoom-anim .leaflet-zoom-hide {\r
	visibility: hidden;\r
	}\r
\r
\r
/* cursors */\r
\r
.leaflet-interactive {\r
	cursor: pointer;\r
	}\r
.leaflet-grab {\r
	cursor: -webkit-grab;\r
	cursor:    -moz-grab;\r
	cursor:         grab;\r
	}\r
.leaflet-crosshair,\r
.leaflet-crosshair .leaflet-interactive {\r
	cursor: crosshair;\r
	}\r
.leaflet-popup-pane,\r
.leaflet-control {\r
	cursor: auto;\r
	}\r
.leaflet-dragging .leaflet-grab,\r
.leaflet-dragging .leaflet-grab .leaflet-interactive,\r
.leaflet-dragging .leaflet-marker-draggable {\r
	cursor: move;\r
	cursor: -webkit-grabbing;\r
	cursor:    -moz-grabbing;\r
	cursor:         grabbing;\r
	}\r
\r
/* marker & overlays interactivity */\r
.leaflet-marker-icon,\r
.leaflet-marker-shadow,\r
.leaflet-image-layer,\r
.leaflet-pane > svg path,\r
.leaflet-tile-container {\r
	pointer-events: none;\r
	}\r
\r
.leaflet-marker-icon.leaflet-interactive,\r
.leaflet-image-layer.leaflet-interactive,\r
.leaflet-pane > svg path.leaflet-interactive,\r
svg.leaflet-image-layer.leaflet-interactive path {\r
	pointer-events: visiblePainted; /* IE 9-10 doesn't have auto */\r
	pointer-events: auto;\r
	}\r
\r
/* visual tweaks */\r
\r
.leaflet-container {\r
	background: #ddd;\r
	outline-offset: 1px;\r
	}\r
.leaflet-container a {\r
	color: #0078A8;\r
	}\r
.leaflet-zoom-box {\r
	border: 2px dotted #38f;\r
	background: rgba(255,255,255,0.5);\r
	}\r
\r
\r
/* general typography */\r
.leaflet-container {\r
	font-family: "Helvetica Neue", Arial, Helvetica, sans-serif;\r
	font-size: 12px;\r
	font-size: 0.75rem;\r
	line-height: 1.5;\r
	}\r
\r
\r
/* general toolbar styles */\r
\r
.leaflet-bar {\r
	box-shadow: 0 1px 5px rgba(0,0,0,0.65);\r
	border-radius: 4px;\r
	}\r
.leaflet-bar a {\r
	background-color: #fff;\r
	border-bottom: 1px solid #ccc;\r
	width: 26px;\r
	height: 26px;\r
	line-height: 26px;\r
	display: block;\r
	text-align: center;\r
	text-decoration: none;\r
	color: black;\r
	}\r
.leaflet-bar a,\r
.leaflet-control-layers-toggle {\r
	background-position: 50% 50%;\r
	background-repeat: no-repeat;\r
	display: block;\r
	}\r
.leaflet-bar a:hover,\r
.leaflet-bar a:focus {\r
	background-color: #f4f4f4;\r
	}\r
.leaflet-bar a:first-child {\r
	border-top-left-radius: 4px;\r
	border-top-right-radius: 4px;\r
	}\r
.leaflet-bar a:last-child {\r
	border-bottom-left-radius: 4px;\r
	border-bottom-right-radius: 4px;\r
	border-bottom: none;\r
	}\r
.leaflet-bar a.leaflet-disabled {\r
	cursor: default;\r
	background-color: #f4f4f4;\r
	color: #bbb;\r
	}\r
\r
.leaflet-touch .leaflet-bar a {\r
	width: 30px;\r
	height: 30px;\r
	line-height: 30px;\r
	}\r
.leaflet-touch .leaflet-bar a:first-child {\r
	border-top-left-radius: 2px;\r
	border-top-right-radius: 2px;\r
	}\r
.leaflet-touch .leaflet-bar a:last-child {\r
	border-bottom-left-radius: 2px;\r
	border-bottom-right-radius: 2px;\r
	}\r
\r
/* zoom control */\r
\r
.leaflet-control-zoom-in,\r
.leaflet-control-zoom-out {\r
	font: bold 18px 'Lucida Console', Monaco, monospace;\r
	text-indent: 1px;\r
	}\r
\r
.leaflet-touch .leaflet-control-zoom-in, .leaflet-touch .leaflet-control-zoom-out  {\r
	font-size: 22px;\r
	}\r
\r
\r
/* layers control */\r
\r
.leaflet-control-layers {\r
	box-shadow: 0 1px 5px rgba(0,0,0,0.4);\r
	background: #fff;\r
	border-radius: 5px;\r
	}\r
.leaflet-control-layers-toggle {\r
	background-image: url(images/layers.png);\r
	width: 36px;\r
	height: 36px;\r
	}\r
.leaflet-retina .leaflet-control-layers-toggle {\r
	background-image: url(images/layers-2x.png);\r
	background-size: 26px 26px;\r
	}\r
.leaflet-touch .leaflet-control-layers-toggle {\r
	width: 44px;\r
	height: 44px;\r
	}\r
.leaflet-control-layers .leaflet-control-layers-list,\r
.leaflet-control-layers-expanded .leaflet-control-layers-toggle {\r
	display: none;\r
	}\r
.leaflet-control-layers-expanded .leaflet-control-layers-list {\r
	display: block;\r
	position: relative;\r
	}\r
.leaflet-control-layers-expanded {\r
	padding: 6px 10px 6px 6px;\r
	color: #333;\r
	background: #fff;\r
	}\r
.leaflet-control-layers-scrollbar {\r
	overflow-y: scroll;\r
	overflow-x: hidden;\r
	padding-right: 5px;\r
	}\r
.leaflet-control-layers-selector {\r
	margin-top: 2px;\r
	position: relative;\r
	top: 1px;\r
	}\r
.leaflet-control-layers label {\r
	display: block;\r
	font-size: 13px;\r
	font-size: 1.08333em;\r
	}\r
.leaflet-control-layers-separator {\r
	height: 0;\r
	border-top: 1px solid #ddd;\r
	margin: 5px -10px 5px -6px;\r
	}\r
\r
/* Default icon URLs */\r
.leaflet-default-icon-path { /* used only in path-guessing heuristic, see L.Icon.Default */\r
	background-image: url(images/marker-icon.png);\r
	}\r
\r
\r
/* attribution and scale controls */\r
\r
.leaflet-container .leaflet-control-attribution {\r
	background: #fff;\r
	background: rgba(255, 255, 255, 0.8);\r
	margin: 0;\r
	}\r
.leaflet-control-attribution,\r
.leaflet-control-scale-line {\r
	padding: 0 5px;\r
	color: #333;\r
	line-height: 1.4;\r
	}\r
.leaflet-control-attribution a {\r
	text-decoration: none;\r
	}\r
.leaflet-control-attribution a:hover,\r
.leaflet-control-attribution a:focus {\r
	text-decoration: underline;\r
	}\r
.leaflet-attribution-flag {\r
	display: inline !important;\r
	vertical-align: baseline !important;\r
	width: 1em;\r
	height: 0.6669em;\r
	}\r
.leaflet-left .leaflet-control-scale {\r
	margin-left: 5px;\r
	}\r
.leaflet-bottom .leaflet-control-scale {\r
	margin-bottom: 5px;\r
	}\r
.leaflet-control-scale-line {\r
	border: 2px solid #777;\r
	border-top: none;\r
	line-height: 1.1;\r
	padding: 2px 5px 1px;\r
	white-space: nowrap;\r
	-moz-box-sizing: border-box;\r
	     box-sizing: border-box;\r
	background: rgba(255, 255, 255, 0.8);\r
	text-shadow: 1px 1px #fff;\r
	}\r
.leaflet-control-scale-line:not(:first-child) {\r
	border-top: 2px solid #777;\r
	border-bottom: none;\r
	margin-top: -2px;\r
	}\r
.leaflet-control-scale-line:not(:first-child):not(:last-child) {\r
	border-bottom: 2px solid #777;\r
	}\r
\r
.leaflet-touch .leaflet-control-attribution,\r
.leaflet-touch .leaflet-control-layers,\r
.leaflet-touch .leaflet-bar {\r
	box-shadow: none;\r
	}\r
.leaflet-touch .leaflet-control-layers,\r
.leaflet-touch .leaflet-bar {\r
	border: 2px solid rgba(0,0,0,0.2);\r
	background-clip: padding-box;\r
	}\r
\r
\r
/* popup */\r
\r
.leaflet-popup {\r
	position: absolute;\r
	text-align: center;\r
	margin-bottom: 20px;\r
	}\r
.leaflet-popup-content-wrapper {\r
	padding: 1px;\r
	text-align: left;\r
	border-radius: 12px;\r
	}\r
.leaflet-popup-content {\r
	margin: 13px 24px 13px 20px;\r
	line-height: 1.3;\r
	font-size: 13px;\r
	font-size: 1.08333em;\r
	min-height: 1px;\r
	}\r
.leaflet-popup-content p {\r
	margin: 17px 0;\r
	margin: 1.3em 0;\r
	}\r
.leaflet-popup-tip-container {\r
	width: 40px;\r
	height: 20px;\r
	position: absolute;\r
	left: 50%;\r
	margin-top: -1px;\r
	margin-left: -20px;\r
	overflow: hidden;\r
	pointer-events: none;\r
	}\r
.leaflet-popup-tip {\r
	width: 17px;\r
	height: 17px;\r
	padding: 1px;\r
\r
	margin: -10px auto 0;\r
	pointer-events: auto;\r
\r
	-webkit-transform: rotate(45deg);\r
	   -moz-transform: rotate(45deg);\r
	    -ms-transform: rotate(45deg);\r
	        transform: rotate(45deg);\r
	}\r
.leaflet-popup-content-wrapper,\r
.leaflet-popup-tip {\r
	background: white;\r
	color: #333;\r
	box-shadow: 0 3px 14px rgba(0,0,0,0.4);\r
	}\r
.leaflet-container a.leaflet-popup-close-button {\r
	position: absolute;\r
	top: 0;\r
	right: 0;\r
	border: none;\r
	text-align: center;\r
	width: 24px;\r
	height: 24px;\r
	font: 16px/24px Tahoma, Verdana, sans-serif;\r
	color: #757575;\r
	text-decoration: none;\r
	background: transparent;\r
	}\r
.leaflet-container a.leaflet-popup-close-button:hover,\r
.leaflet-container a.leaflet-popup-close-button:focus {\r
	color: #585858;\r
	}\r
.leaflet-popup-scrolled {\r
	overflow: auto;\r
	}\r
\r
.leaflet-oldie .leaflet-popup-content-wrapper {\r
	-ms-zoom: 1;\r
	}\r
.leaflet-oldie .leaflet-popup-tip {\r
	width: 24px;\r
	margin: 0 auto;\r
\r
	-ms-filter: "progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678)";\r
	filter: progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678);\r
	}\r
\r
.leaflet-oldie .leaflet-control-zoom,\r
.leaflet-oldie .leaflet-control-layers,\r
.leaflet-oldie .leaflet-popup-content-wrapper,\r
.leaflet-oldie .leaflet-popup-tip {\r
	border: 1px solid #999;\r
	}\r
\r
\r
/* div icon */\r
\r
.leaflet-div-icon {\r
	background: #fff;\r
	border: 1px solid #666;\r
	}\r
\r
\r
/* Tooltip */\r
/* Base styles for the element that has a tooltip */\r
.leaflet-tooltip {\r
	position: absolute;\r
	padding: 6px;\r
	background-color: #fff;\r
	border: 1px solid #fff;\r
	border-radius: 3px;\r
	color: #222;\r
	white-space: nowrap;\r
	-webkit-user-select: none;\r
	-moz-user-select: none;\r
	-ms-user-select: none;\r
	user-select: none;\r
	pointer-events: none;\r
	box-shadow: 0 1px 3px rgba(0,0,0,0.4);\r
	}\r
.leaflet-tooltip.leaflet-interactive {\r
	cursor: pointer;\r
	pointer-events: auto;\r
	}\r
.leaflet-tooltip-top:before,\r
.leaflet-tooltip-bottom:before,\r
.leaflet-tooltip-left:before,\r
.leaflet-tooltip-right:before {\r
	position: absolute;\r
	pointer-events: none;\r
	border: 6px solid transparent;\r
	background: transparent;\r
	content: "";\r
	}\r
\r
/* Directions */\r
\r
.leaflet-tooltip-bottom {\r
	margin-top: 6px;\r
}\r
.leaflet-tooltip-top {\r
	margin-top: -6px;\r
}\r
.leaflet-tooltip-bottom:before,\r
.leaflet-tooltip-top:before {\r
	left: 50%;\r
	margin-left: -6px;\r
	}\r
.leaflet-tooltip-top:before {\r
	bottom: 0;\r
	margin-bottom: -12px;\r
	border-top-color: #fff;\r
	}\r
.leaflet-tooltip-bottom:before {\r
	top: 0;\r
	margin-top: -12px;\r
	margin-left: -6px;\r
	border-bottom-color: #fff;\r
	}\r
.leaflet-tooltip-left {\r
	margin-left: -6px;\r
}\r
.leaflet-tooltip-right {\r
	margin-left: 6px;\r
}\r
.leaflet-tooltip-left:before,\r
.leaflet-tooltip-right:before {\r
	top: 50%;\r
	margin-top: -6px;\r
	}\r
.leaflet-tooltip-left:before {\r
	right: 0;\r
	margin-right: -12px;\r
	border-left-color: #fff;\r
	}\r
.leaflet-tooltip-right:before {\r
	left: 0;\r
	margin-left: -12px;\r
	border-right-color: #fff;\r
	}\r
\r
/* Printing */\r
\r
@media print {\r
	/* Prevent printers from removing background-images of controls. */\r
	.leaflet-control {\r
		-webkit-print-color-adjust: exact;\r
		print-color-adjust: exact;\r
		}\r
	}\r
`;

  // src/map.ts
  var osmTiles = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  var osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  function mapTiles(element) {
    const url = element.dataset.mapTiles ? element.dataset.mapTiles.replace(/\$z/g, "{z}").replace(/\$x/g, "{x}").replace(/\$y/g, "{y}") : osmTiles;
    const attribution = element.dataset.mapAttribution;
    if (!["{z}", "{x}", "{y}"].every((part) => url.includes(part))) {
      throw new Error("Map tile URL must contain {z}, {x}, and {y}.");
    }
    const parsed = new URL(url.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0"));
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new Error("Map tiles require an HTTPS URL without embedded credentials.");
    }
    if (url !== osmTiles && !attribution) throw new Error("A custom tile provider requires data-map-attribution.");
    return { url, attribution: url === osmTiles ? osmAttribution : escapeHtml(attribution) };
  }
  function createMapManager() {
    const entries = /* @__PURE__ */ new Map();
    const context = () => ctx();
    function detach(root) {
      const saved = /* @__PURE__ */ new Map();
      for (const element of Array.from(root.querySelectorAll("[data-rune-map]"))) {
        const key2 = element.dataset.runeMap;
        if (key2 && entries.has(key2)) {
          element.remove();
          saved.set(key2, element);
        }
      }
      return saved;
    }
    function restore(root, saved, app) {
      const found = /* @__PURE__ */ new Set();
      for (const placeholder of Array.from(root.querySelectorAll("[data-rune-map]"))) {
        const key2 = placeholder.dataset.runeMap;
        const latitude = Number(placeholder.dataset.latitude);
        const longitude = Number(placeholder.dataset.longitude);
        let tileConfig;
        try {
          tileConfig = mapTiles(placeholder);
        } catch (error) {
          console.error("Rune-Web map configuration error:", error);
          continue;
        }
        if (!key2 || found.has(key2) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          console.error("Rune-Web map requires a unique data-rune-map and valid coordinates.");
          continue;
        }
        found.add(key2);
        const old = saved.get(key2);
        const entry = entries.get(key2);
        if (old && entry) {
          for (const attr of Array.from(placeholder.attributes)) {
            if (attr.name.startsWith("data-") || attr.name.startsWith("aria-")) old.setAttribute(attr.name, attr.value);
          }
          placeholder.replaceWith(old);
          if (tileConfig.url !== entry.tileUrl || tileConfig.attribution !== entry.attribution) {
            entry.map.attributionControl.removeAttribution(entry.attribution);
            entry.tiles.options.attribution = tileConfig.attribution;
            entry.map.attributionControl.addAttribution(tileConfig.attribution);
            entry.tiles.setUrl(tileConfig.url);
            entry.tileUrl = tileConfig.url;
            entry.attribution = tileConfig.attribution;
          }
          if (latitude !== entry.latitude || longitude !== entry.longitude) {
            entry.latitude = latitude;
            entry.longitude = longitude;
            entry.marker.setLatLng([latitude, longitude]);
            entry.map.setView([latitude, longitude], entry.map.getZoom(), { animate: false });
          }
          entry.map.invalidateSize({ animate: false });
          continue;
        }
        const captured = context();
        void Promise.resolve().then(() => __toESM(require_leaflet_src(), 1)).then((L2) => {
          if (!placeholder.isConnected || entries.has(key2)) return;
          if (!document.getElementById("rune-leaflet-css")) {
            const style = document.createElement("style");
            style.id = "rune-leaflet-css";
            style.textContent = leaflet_default;
            document.head.append(style);
          }
          const map = L2.map(placeholder, { zoomControl: true }).setView([latitude, longitude], 10);
          const tiles = L2.tileLayer(tileConfig.url, {
            maxZoom: 19,
            attribution: tileConfig.attribution
          }).addTo(map);
          const marker = L2.circleMarker([latitude, longitude], { radius: 8, color: "#126a78", fillOpacity: 0.8 }).addTo(map);
          const select2 = (lat, lon) => withContext(captured, () => {
            const action = placeholder.dataset.mapSelect;
            if (!action) {
              console.error("Rune-Web map requires data-map-select.");
              return;
            }
            app.invokeAction(action, [{ latitude: Number(lat.toFixed(5)), longitude: Number(lon.toFixed(5)) }]);
            app.render();
          });
          map.on("click", (event) => {
            const point = event.latlng.wrap();
            select2(point.lat, point.lng);
          });
          placeholder.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && event.target === placeholder) {
              event.preventDefault();
              const center = map.getCenter().wrap();
              select2(center.lat, center.lng);
            }
          });
          entries.set(key2, { element: placeholder, map, marker, tiles, tileUrl: tileConfig.url, attribution: tileConfig.attribution, latitude, longitude });
        }).catch((error) => console.error("Rune-Web map could not initialize:", error));
      }
      for (const [key2, entry] of entries) {
        if (!found.has(key2)) {
          entry.map.remove();
          entries.delete(key2);
        }
      }
    }
    return { detach, restore };
  }

  // src/studio_drag.ts
  function bindStudioNoteDrag(state) {
    let drag;
    document.addEventListener("pointerdown", (event) => {
      if (drag || event.button !== 0 || !event.isPrimary || event.shiftKey || state.studio_note_tool === "select" || state.studio_note_tool === "paste" || !(event.target instanceof Element)) return;
      const note = event.target.closest("[data-studio-note]");
      if (!note || event.target.closest("button")) return;
      const grid = note.closest(".matrix-grid-surface");
      if (!grid) return;
      drag = {
        pointerId: event.pointerId,
        stepId: Number(note.dataset.stepIdx),
        resize: Boolean(event.target.closest("[data-studio-resize]")),
        grid,
        startX: event.clientX,
        startY: event.clientY,
        gridX: grid.getBoundingClientRect().left,
        rowHeight: state.active_voice === "drums" ? 48 : 28,
        noteHeight: note.offsetHeight
      };
    });
    function update(event, commit) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.preview) {
        if (commit || Math.max(Math.abs(dx), Math.abs(drag.resize ? 0 : dy)) < 5) return;
        document.documentElement.setPointerCapture(event.pointerId);
        drag.preview = document.createElement("div");
        drag.preview.className = "studio-drag-preview";
        drag.preview.setAttribute("aria-hidden", "true");
        (document.fullscreenElement ?? document.body).append(drag.preview);
      }
      const grid = drag.grid.isConnected ? drag.grid : document.querySelector(".matrix-grid-surface");
      if (!grid) return;
      const bounds = grid.getBoundingClientRect();
      const columnDelta = Math.round((dx + drag.gridX - bounds.left) / STUDIO_TICK_WIDTH);
      const rowDelta = Math.round(dy / drag.rowHeight);
      const result = updateStudioNoteDrag(state, drag.stepId, columnDelta, rowDelta, drag.resize, commit);
      if (!result || commit) return;
      const left = bounds.left + result.column * STUDIO_TICK_WIDTH;
      const top = bounds.top + result.row * drag.rowHeight + 2;
      const width = result.ticks * STUDIO_TICK_WIDTH - 4;
      const preview = drag.preview;
      const scroller = grid.closest("[data-studio-scroll]")?.getBoundingClientRect();
      preview.classList.toggle("studio-drag-blocked", !result.valid);
      Object.assign(preview.style, {
        left: left + "px",
        top: top + "px",
        width: width + "px",
        height: drag.noteHeight + "px",
        clipPath: scroller ? `inset(0 ${Math.max(0, left + width - scroller.right)}px 0 ${Math.max(0, scroller.left - left)}px)` : ""
      });
    }
    function stop() {
      if (!drag) return;
      drag.preview?.remove();
      drag = void 0;
    }
    document.addEventListener("pointermove", (event) => update(event, false));
    document.addEventListener("pointerup", (event) => {
      if (drag?.pointerId !== event.pointerId) return;
      update(event, true);
      stop();
    });
    document.addEventListener("pointercancel", (event) => {
      if (drag?.pointerId === event.pointerId) stop();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") stop();
    });
    window.addEventListener("blur", stop);
  }

  // src/studio_note_tools.ts
  var GRID = ".matrix-grid-surface";
  var NOTE = "[data-studio-note]";
  function notesInView(state) {
    const bar = Number(state.selected_bar) || 0;
    return (state.active_steps ?? []).filter((step) => !step.is_bar && !step.is_rest && (!bar || step.bar_num === bar));
  }
  function selection(state) {
    const group = state.studio_selected_notes;
    return notesInView(state).filter((step) => group?.[String(step.id)] || step.id === state.selected_step_id).map((step) => Number(step.id));
  }
  function select(state, ids) {
    const unique = [...new Set(ids)];
    state.selected_step_id = -1;
    state.studio_selected_notes = Object.fromEntries(unique.map((id) => [id, true]));
    state.studio_selection_count = unique.length;
  }
  function position(step, barTicks) {
    return (Number(step.bar_num) - 1) * barTicks + Math.round(Number(step.matrix_bar_left) / STUDIO_TICK_WIDTH);
  }
  function pitch(step) {
    return step.chord_notes[0];
  }
  function bindStudioNoteTools(state) {
    let clipboard;
    let marquee;
    function copy() {
      const ids = new Set(selection(state));
      const selected = notesInView(state).filter((step) => ids.has(Number(step.id)));
      if (!selected.length) return false;
      const barTicks = studioBarTicks(String(state.time_signature));
      const start = Math.min(...selected.map((step) => position(step, barTicks)));
      clipboard = {
        notes: selected.map((step) => ({
          offset: position(step, barTicks) - start,
          pitch: pitch(step),
          ticks: Math.round(Number(step.beats) * 4)
        })),
        percussion: state.active_voice === "drums"
      };
      state.studio_clipboard_count = selected.length;
      state.status_message = "Copied " + selected.length + (selected.length === 1 ? " note" : " notes");
      return true;
    }
    function armPaste() {
      if (!clipboard) return false;
      if (clipboard.percussion !== (state.active_voice === "drums")) {
        state.status_message = "Paste pitched notes into a pitched voice, or drum hits into Drums.";
        return true;
      }
      state.studio_note_tool = state.studio_note_tool === "paste" ? "edit" : "paste";
      return true;
    }
    function paste(grid, x) {
      if (!clipboard) return;
      if (clipboard.percussion !== (state.active_voice === "drums")) {
        state.status_message = "Paste pitched notes into a pitched voice, or drum hits into Drums.";
        return;
      }
      const barTicks = studioBarTicks(String(state.time_signature));
      const start = Math.floor((x - grid.getBoundingClientRect().left) / STUDIO_TICK_WIDTH) + Math.max(0, Number(state.selected_bar) - 1) * barTicks;
      const key2 = String(state.active_voice) + "_track";
      const result = pasteStudioNotes(String(state[key2] || ""), barTicks, Number(state.bars), start, clipboard.notes);
      if ("error" in result) {
        state.status_message = result.error === "overlap" ? "A pasted note overlaps an existing note at the same pitch. Choose another step." : "The pasted notes must fit inside the existing bars. Choose another step or add a bar.";
        return;
      }
      const pasted = new Set(clipboard.notes.map((note) => start + note.offset + ":" + note.pitch));
      state[key2] = result.score;
      syncSequencerState(state);
      select(state, notesInView(state).filter((step) => pasted.has(position(step, barTicks) + ":" + pitch(step))).map((step) => Number(step.id)));
      state.studio_note_tool = "select";
      state.status_message = "Pasted " + clipboard.notes.length + (clipboard.notes.length === 1 ? " note" : " notes");
    }
    document.addEventListener("click", (event) => {
      if (state.editor_mode !== "matrix" || !(event.target instanceof Element)) return;
      const tool = event.target.closest("[data-studio-note-tool]")?.dataset.studioNoteTool;
      if (tool === "select") state.studio_note_tool = state.studio_note_tool === "select" ? "edit" : "select";
      if (tool === "copy") copy();
      if (tool === "paste") armPaste();
      const grid = event.target.closest(GRID);
      if (!grid || state.studio_note_tool === "edit" && !event.shiftKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (state.studio_note_tool === "paste") {
        paste(grid, event.clientX);
        return;
      }
      const note = event.target.closest(NOTE);
      if (!note) {
        if (!event.shiftKey) select(state, []);
        return;
      }
      const id = Number(note.dataset.stepIdx);
      const ids = selection(state);
      select(state, ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
    }, true);
    document.addEventListener("contextmenu", (event) => {
      if (state.studio_note_tool === "edit" || !(event.target instanceof Element) || !event.target.closest(GRID)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    document.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary || state.studio_note_tool !== "select" && !(state.studio_note_tool === "edit" && event.shiftKey) || !(event.target instanceof Element) || !event.target.closest(GRID)) return;
      marquee = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, additive: event.shiftKey };
    });
    function rectangle(event) {
      const scroller = document.querySelector(".matrix-container");
      const viewport = scroller?.getBoundingClientRect();
      if (!marquee || !viewport) return;
      const keys = scroller?.querySelector(".matrix-keys-column")?.getBoundingClientRect();
      const x = Math.max(keys?.right ?? viewport.left, Math.min(viewport.right, event.clientX));
      const y = Math.max(viewport.top, Math.min(viewport.bottom, event.clientY));
      return {
        left: Math.min(x, marquee.x),
        right: Math.max(x, marquee.x),
        top: Math.min(y, marquee.y),
        bottom: Math.max(y, marquee.y)
      };
    }
    document.addEventListener("pointermove", (event) => {
      if (event.pointerId !== marquee?.pointerId) return;
      if (!marquee.box && Math.max(Math.abs(event.clientX - marquee.x), Math.abs(event.clientY - marquee.y)) < 5) return;
      const bounds = rectangle(event);
      if (!bounds) return;
      if (!marquee.box) {
        document.documentElement.setPointerCapture(event.pointerId);
        marquee.box = document.createElement("div");
        marquee.box.className = "studio-note-marquee";
        marquee.box.setAttribute("aria-hidden", "true");
        (document.fullscreenElement ?? document.body).append(marquee.box);
      }
      Object.assign(marquee.box.style, {
        left: bounds.left + "px",
        top: bounds.top + "px",
        width: bounds.right - bounds.left + "px",
        height: bounds.bottom - bounds.top + "px"
      });
    });
    function clearMarquee() {
      marquee?.box?.remove();
      marquee = void 0;
    }
    document.addEventListener("pointerup", (event) => {
      if (event.pointerId !== marquee?.pointerId) return;
      const bounds = marquee.box && rectangle(event);
      if (bounds) {
        const ids = marquee.additive ? selection(state) : [];
        document.querySelectorAll(GRID + " " + NOTE).forEach((note) => {
          const rect = note.getBoundingClientRect();
          if (rect.left < bounds.right && rect.right > bounds.left && rect.top < bounds.bottom && rect.bottom > bounds.top) {
            ids.push(Number(note.dataset.stepIdx));
          }
        });
        select(state, ids);
      }
      clearMarquee();
    });
    document.addEventListener("pointercancel", (event) => {
      if (event.pointerId === marquee?.pointerId) clearMarquee();
    });
    window.addEventListener("blur", clearMarquee);
    window.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || state.editor_mode !== "matrix" || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.isContentEditable || target?.closest("input, textarea, select")) return;
      if (event.key === "Escape") {
        clearMarquee();
        state.studio_note_tool = "edit";
        select(state, []);
        return;
      }
      if (!event.ctrlKey && !event.metaKey || event.shiftKey) return;
      const key2 = event.key.toLowerCase();
      if (key2 === "c" && window.getSelection()?.isCollapsed !== false && copy()) event.preventDefault();
      if (key2 === "v" && armPaste()) event.preventDefault();
      if (key2 === "a") {
        event.preventDefault();
        select(state, notesInView(state).map((step) => Number(step.id)));
        state.studio_note_tool = "select";
      }
    });
  }

  // src/studio_transport.ts
  function studioDuration(state) {
    return studioBarTicks(String(state.time_signature)) * Number(state.bars) / 4;
  }
  function paintStudioPlayhead(root, state) {
    const duration = studioDuration(state);
    const snapshot = audioSync.getSnapshot();
    const beat = state.is_playing && snapshot.isPlaying ? snapshot.currentBeat : Number(state.playback_beat) || 0;
    const beatsPerBar = studioBarTicks(String(state.time_signature)) / 4;
    const parked = Math.max(0, Math.min(duration - 1e-6, beat));
    const bar = Math.floor(parked / beatsPerBar) + 1;
    const ruler = root.querySelector("#ruler-playhead");
    if (ruler) ruler.style.left = parked / duration * 100 + "%";
    const rail = root.querySelector('[data-studio-seek="progress"]');
    rail?.setAttribute("aria-valuemax", String(duration));
    rail?.setAttribute("aria-valuenow", String(Math.round(parked * 100) / 100));
    rail?.setAttribute("aria-disabled", String(Boolean(state.is_playing)));
    const playhead = root.querySelector("#seq-playhead");
    const scroller = playhead?.parentElement;
    if (!playhead || !scroller) return;
    const viewBar = Number(scroller.dataset.syncViewBar) || 0;
    const pixelsPerBeat = Number(scroller.dataset.syncPixelsPerBeat) || 120;
    playhead.style.display = !viewBar || viewBar === bar ? "block" : "none";
    playhead.style.left = Math.round((parked - (viewBar ? (viewBar - 1) * beatsPerBar : 0)) * pixelsPerBeat) + "px";
  }
  function bindStudioTransport(app) {
    let seek;
    function parkAt(beat) {
      const beatsPerBar = studioBarTicks(String(app.state.time_signature)) / 4;
      const end = studioDuration(app.state);
      const snapped = Math.max(0, Math.min(end - 0.25, Math.round(beat * 4) / 4));
      app.state.playback_beat = snapped;
      app.state.playback_bar = Math.floor(snapped / beatsPerBar) + 1;
      app.state.playback_progress = snapped / end * 100;
      app.state.playback_step_id = -1;
      const root = document.getElementById("app");
      if (root) paintStudioPlayhead(root, app.state);
    }
    function update(event) {
      if (!seek || seek.pointerId !== event.pointerId || app.state.is_playing) return;
      const x = event.clientX - seek.xOffset;
      if (seek.mode === "progress") {
        const bounds = document.querySelector('[data-studio-seek="progress"]')?.getBoundingClientRect();
        if (bounds?.width) parkAt((x - bounds.left) / bounds.width * studioDuration(app.state));
      } else {
        const scroller = document.querySelector("[data-studio-scroll]");
        if (!scroller) return;
        const bar = Number(scroller.dataset.syncViewBar) || 0;
        const pixelsPerBeat = Number(scroller.dataset.syncPixelsPerBeat) || 120;
        const grid = scroller.querySelector(".matrix-grid-surface, .step-strip");
        if (!grid) return;
        const beat = (x - grid.getBoundingClientRect().left) / pixelsPerBeat;
        const beatsPerBar = studioBarTicks(String(app.state.time_signature)) / 4;
        parkAt(bar ? (bar - 1) * beatsPerBar + Math.max(0, Math.min(beatsPerBar - 0.25, beat)) : beat);
      }
    }
    document.addEventListener("click", (event) => {
      if (app.state.is_playing || !(event.target instanceof Element)) return;
      const button = event.target.closest("[data-studio-seek-bar]");
      if (!button) return;
      const beatsPerBar = studioBarTicks(String(app.state.time_signature)) / 4;
      const current = Math.floor((Number(app.state.playback_beat) || 0) / beatsPerBar);
      const step = button.dataset.studioSeekBar;
      const bar = step === "start" ? 0 : Math.max(0, Math.min(Number(app.state.bars) - 1, current + Number(step)));
      parkAt(bar * beatsPerBar);
      if (Number(app.state.selected_bar)) app.invokeAction("selectBar", [bar + 1]);
    });
    document.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary || app.state.is_playing || !(event.target instanceof Element)) return;
      const target = event.target.closest("[data-studio-seek]");
      if (!target) return;
      const mode = target.dataset.studioSeek;
      const xOffset = mode === "beat" ? event.clientX - target.parentElement.getBoundingClientRect().left : 0;
      seek = { pointerId: event.pointerId, mode, xOffset };
      document.documentElement.setPointerCapture(event.pointerId);
      event.preventDefault();
      update(event);
    });
    document.addEventListener("pointermove", update);
    document.addEventListener("pointerup", (event) => {
      if (event.pointerId !== seek?.pointerId) return;
      update(event);
      seek = void 0;
    });
    document.addEventListener("pointercancel", (event) => {
      if (event.pointerId === seek?.pointerId) seek = void 0;
    });
    window.addEventListener("blur", () => {
      seek = void 0;
    });
    window.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.isContentEditable || target?.closest("input, textarea, select")) return;
      if (event.code === "Space") {
        if (target?.closest("[data-studio-seek-bar]")) return;
        event.preventDefault();
        if (!event.repeat) app.invokeAction(app.state.is_playing ? "pauseTrack" : "playTrack", []);
        return;
      }
      if (target?.dataset.studioSeek !== "progress" || app.state.is_playing) return;
      const beat = Number(app.state.playback_beat) || 0;
      const wanted = { ArrowLeft: beat - 0.25, ArrowRight: beat + 0.25, Home: 0, End: studioDuration(app.state) };
      const position2 = wanted[event.key];
      if (typeof position2 === "number") {
        event.preventDefault();
        parkAt(position2);
        requestAnimationFrame(() => document.querySelector('[data-studio-seek="progress"]')?.focus());
      }
    });
  }

  // src/events.ts
  function parseHandlerSpec(spec) {
    const trimmed = String(spec || "").trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^([A-Za-z_][\w.-]*)(?:\((.*)\))?$/);
    if (match) {
      const args = match[2] ? splitTopLevel(match[2], ",") : [];
      return { name: match[1], args, raw: trimmed };
    }
    return { name: "", args: [], raw: trimmed };
  }
  function readScope(element) {
    const raw = element.getAttribute("data-rune-scope");
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return {};
    }
  }
  function bindEvent(eventName) {
    document.addEventListener(eventName, function(event) {
      const selector = `[data-on-${eventName}]`;
      const element = event.target && event.target.closest ? event.target.closest(selector) : null;
      if (!element) return;
      const linkClick = eventName === "click" && element.tagName === "A";
      const mouse = event;
      if (linkClick && (mouse.ctrlKey || mouse.metaKey || mouse.shiftKey || mouse.altKey || mouse.button > 0 || element.getAttribute("target") === "_blank")) return;
      const href = linkClick ? element.getAttribute("href") : null;
      if (linkClick && element.getAttribute("data-route-link") === "true") {
        event.preventDefault();
      }
      const spec = parseHandlerSpec(
        element.getAttribute(`data-on-${eventName}`) || ""
      );
      if (!spec) return;
      if (eventName === "contextmenu") event.preventDefault();
      if (typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }
      const locals = readScope(element);
      if (spec.name) {
        const scope = buildScope(
          Object.assign({}, locals, {
            this: element,
            event: { offsetX: mouse.offsetX, offsetY: mouse.offsetY }
          })
        );
        const args = spec.args.map(
          (arg) => evaluateExpression(arg, scope)
        );
        ctx().app.invokeAction(spec.name, args, locals);
      } else {
        executeStatement(spec.raw, locals);
      }
      if (href?.startsWith("#") && href.length > 1 && !event.defaultPrevented) {
        requestAnimationFrame(() => {
          let id = href.slice(1);
          try {
            id = decodeURIComponent(id);
          } catch (_) {
          }
          document.getElementById(id)?.scrollIntoView();
        });
      }
    });
  }
  function createComponentRender(componentId) {
    return function() {
      const context = ctx();
      setWindowProp("__renderingComponent", componentId);
      context.app.computeDerived();
      const elem = document.getElementById(componentId);
      if (elem) {
        const newHtml = renderNode(context.pageTree, {});
        elem.innerHTML = newHtml;
      }
      setWindowProp("__renderingComponent", null);
    };
  }
  function setupMemoryUpdateListener() {
    const context = ctx();
    const ws = getWindowProp("__ws");
    if (ws && ws.addEventListener) {
      ws.addEventListener("message", function(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "memory_update" && data.key) {
            context.app.state[data.key] = data.value;
            if (context.memorySubscriptions[data.key]) {
              context.memorySubscriptions[data.key].forEach(
                (componentId) => {
                  if (componentId === "app") {
                    requestAnimationFrame(
                      context.app.render.bind(context.app)
                    );
                  } else {
                    const componentRender = createComponentRender(componentId);
                    requestAnimationFrame(componentRender);
                  }
                }
              );
            } else {
              requestAnimationFrame(context.app.render.bind(context.app));
            }
          }
        } catch (_err) {
        }
      });
    }
  }

  // src/index.ts
  function boot(config) {
    const maps = createMapManager();
    configureDataSources(config.dataSources);
    beginGameLoading();
    registerSounds(config.sounds);
    registerMusic(config.music);
    const app = createLogicApp(function() {
      const context = ctx();
      if (context.isRendering) return;
      context.isRendering = true;
      try {
        this.computeDerived();
        const root = document.getElementById("app");
        if (!root) return;
        const studio = this.state.studio_fixed_bars === true;
        const previousTimeline = studio ? root.querySelector("[data-studio-scroll]") : null;
        const left = previousTimeline?.scrollLeft ?? 0;
        const top = previousTimeline?.scrollTop ?? 0;
        const title = studio ? root.querySelector("[data-studio-song-title]:focus") : null;
        const start = title?.selectionStart ?? 0;
        const end = title?.selectionEnd ?? start;
        const focusedInput = root.querySelector("input[id]:focus:not([value])");
        const inputValue = focusedInput?.value;
        const inputStart = focusedInput?.selectionStart;
        const inputEnd = focusedInput?.selectionEnd;
        const savedMaps = maps.detach(root);
        root.innerHTML = renderNode(context.pageTree, {});
        maps.restore(root, savedMaps, this);
        if (focusedInput && inputValue !== void 0) {
          const nextInput = document.getElementById(focusedInput.id);
          if (nextInput instanceof HTMLInputElement && root.contains(nextInput) && !nextInput.hasAttribute("value")) {
            nextInput.value = inputValue;
            nextInput.focus({ preventScroll: true });
            if (inputStart !== null && inputStart !== void 0 && inputEnd !== null && inputEnd !== void 0) {
              nextInput.setSelectionRange(inputStart, inputEnd);
            }
          }
        }
        if (studio) {
          paintStudioPlayhead(root, this.state);
          const timeline = root.querySelector("[data-studio-scroll]");
          if (previousTimeline && timeline) {
            if (timeline.dataset.studioScroll === previousTimeline.dataset.studioScroll) timeline.scrollLeft = left;
          }
          if (timeline?.dataset.studioVoice) {
            if (previousTimeline?.dataset.studioViewportReady && timeline.dataset.studioVoice === previousTimeline.dataset.studioVoice) {
              timeline.scrollTop = top;
            } else {
              const firstNote = timeline.querySelector(".matrix-note-block");
              timeline.scrollTop = (firstNote?.offsetTop ?? 8 * 28) - timeline.clientHeight * 0.19;
            }
            timeline.dataset.studioViewportReady = "true";
          }
          const nextTitle = root.querySelector("[data-studio-song-title]");
          if (nextTitle) {
            nextTitle.value = String(this.state.song_title ?? "");
            if (title && nextTitle.dataset.studioSongTitle === title.dataset.studioSongTitle) {
              nextTitle.focus({ preventScroll: true });
              nextTitle.setSelectionRange(start, end);
            }
          }
        }
      } finally {
        context.isRendering = false;
      }
    });
    const loadedChunks = {};
    const loadingChunks = {};
    app.loadedChunks = loadedChunks;
    app.loadChunk = function(route, chunkUrl) {
      const cleanRoute = route.toLowerCase();
      if (loadedChunks[cleanRoute]) {
        return Promise.resolve(loadedChunks[cleanRoute]);
      }
      if (cleanRoute in loadingChunks) {
        return loadingChunks[cleanRoute];
      }
      if (typeof fetch === "undefined") {
        return Promise.resolve(null);
      }
      const promise = fetch(hostedUrl(chunkUrl)).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching route chunk ${chunkUrl}`);
        return res.json();
      }).then((data) => {
        loadedChunks[cleanRoute] = data;
        delete loadingChunks[cleanRoute];
        app.render();
        return data;
      }).catch((err) => {
        delete loadingChunks[cleanRoute];
        console.warn(`[RuneWeb] Failed to load route chunk '${route}':`, err);
        return null;
      });
      loadingChunks[cleanRoute] = promise;
      return promise;
    };
    app.preloadChunks = function() {
      if (typeof window === "undefined" || typeof fetch === "undefined") return;
      const context = ctx();
      const opt = context.optimizer;
      if (!opt || !opt.pre_load) return;
      const chunksToPreload = [];
      function collectLazy(n) {
        if (!n) return;
        if (n.LazyRoute) {
          chunksToPreload.push({ route: n.LazyRoute.route, chunk_url: n.LazyRoute.chunk_url });
        }
        if (n.Element?.children) n.Element.children.forEach(collectLazy);
        if (n.Loop?.body) n.Loop.body.forEach(collectLazy);
        if (n.Conditional?.body) n.Conditional.body.forEach(collectLazy);
        if (n.Match?.cases) n.Match.cases.forEach((c) => (c.body || []).forEach(collectLazy));
        if (n.ComponentScope?.body) collectLazy(n.ComponentScope.body);
        if (n.MemoryBinding?.body) n.MemoryBinding.body.forEach(collectLazy);
      }
      collectLazy(context.pageTree);
      const runPreload = () => {
        chunksToPreload.forEach(({ route, chunk_url }) => {
          const cleanRoute = route.toLowerCase();
          if (!loadedChunks[cleanRoute] && !loadingChunks[cleanRoute]) {
            fetch(hostedUrl(chunk_url)).then((r) => r.json()).then((data) => {
              loadedChunks[cleanRoute] = data;
            }).catch(() => {
            });
          }
        });
      };
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(runPreload, { timeout: 2e3 });
      } else {
        setTimeout(runPreload, 300);
      }
    };
    initContext({
      pageTree: config.pageTree,
      derivedDefinitions: config.derivedDefinitions,
      helperDefinitions: config.helperDefinitions,
      actionDefinitions: config.actionDefinitions,
      i18nData: config.i18nData,
      app,
      isRendering: false,
      memorySubscriptions: {},
      navigator: config.navigator || null,
      initialState: JSON.parse(JSON.stringify(config.stateJson || {})),
      emitters: config.emitters || {},
      seo: config.seo || null,
      optimizer: config.optimizer || null,
      loadedChunks,
      loadingChunks
    });
    app.state = makeReactive(
      Object.assign({}, config.stateJson, { i18n: config.i18nData })
    );
    if (config.navigator) {
      setupNavigator(config.navigator, app);
    } else if (config.seo) {
      updateSeoMetadata("home");
    }
    if (config.optimizer?.pre_load && app.preloadChunks) {
      app.preloadChunks();
    }
    const originalRender = app.render;
    app.render = function() {
      setWindowProp("__renderingComponent", "app");
      originalRender.call(this);
      setWindowProp("__renderingComponent", null);
    };
    let activeTimerId = null;
    app.startTimer = function(action, ms) {
      if (activeTimerId !== null) clearInterval(activeTimerId);
      activeTimerId = setInterval(() => {
        app.invokeAction(action, []);
      }, ms);
    };
    app.stopTimer = function() {
      if (activeTimerId !== null) {
        clearInterval(activeTimerId);
        activeTimerId = null;
      }
    };
    setupMemoryUpdateListener();
    bindEvent("click");
    bindEvent("contextmenu");
    if (app.state.studio_fixed_bars === true) {
      bindStudioNoteDrag(app.state);
      bindStudioNoteTools(app.state);
      bindStudioTransport(app);
    }
    bindEvent("change");
    bindEvent("input");
    bindEvent("pointerdown");
    bindEvent("pointerup");
    bindEvent("pointerleave");
    bindEvent("pointercancel");
    bindEvent("touchstart");
    bindEvent("touchend");
    if (config.keys && typeof window !== "undefined") {
      window.addEventListener("keydown", (event) => {
        const keyMap = config.keys;
        const action = keyMap[event.code] || keyMap[event.key] || keyMap[event.key.toLowerCase()] || keyMap[event.code.toLowerCase()];
        if (action) {
          event.preventDefault();
          app.invokeAction(action, []);
        }
      });
    }
    if (config.timer) {
      const match = String(config.timer).trim().match(/^([A-Za-z_][\w-]*)\s*([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
      if (match) {
        const action = match[1];
        let ms = Number(match[2]);
        if (match[3]?.toLowerCase() === "s") ms *= 1e3;
        app.startTimer(action, ms);
      }
    }
    if (config.wsEndpoint) {
      setupWebSocket(config.wsEndpoint, app);
    }
    setWindowProp("runeWebApp", app);
    setWindowProp("audioSync", audioSync);
    setWindowProp("playSound", playSound);
    setWindowProp("playMusic", playMusic);
    setWindowProp("stopMusic", stopMusic);
    setWindowProp("pauseMusic", pauseMusic);
    setWindowProp("resumeMusic", resumeMusic);
    setWindowProp("registerSounds", registerSounds);
    setWindowProp("registerMusic", registerMusic);
    if (typeof window !== "undefined") {
      window.__RuneWeb = {
        ctx,
        app,
        audioSync
      };
    }
    if (typeof document !== "undefined") {
      document.addEventListener("fullscreenchange", () => {
        const isFs = Boolean(
          document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement
        );
        if (isFs) {
          document.body.setAttribute("data-fullscreen", "true");
          document.body.classList.add("fullscreen");
        } else {
          document.body.removeAttribute("data-fullscreen");
          document.body.classList.remove("fullscreen");
        }
        if (typeof app.state?.is_fullscreen !== "undefined") {
          app.state.is_fullscreen = isFs;
          app.render();
        }
      });
    }
    if (app.state?.active_voice && !app.state.active_steps) syncSequencerState(app.state);
    if (app.state.studio_fixed_bars === true && config.actionDefinitions.loadSongLibrary) {
      app.invokeAction("loadSongLibrary", []);
    }
    app.render();
    if (config.onMount) app.invokeAction(config.onMount, []);
    if (typeof document !== "undefined" && !document.querySelector("canvas[data-rune-pixel], canvas[data-rune-pixel-3d]")) markGameReady();
    return app;
  }
  function setupWebSocket(endpoint, app) {
    setWindowProp("__runeWebEmit", function(eventName, payload) {
      const ws2 = getWindowProp("__runeWebSocket");
      if (!ws2 || ws2.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket not connected");
        return;
      }
      ws2.send(JSON.stringify({ type: eventName, payload: payload || {} }));
    });
    const ws = new WebSocket(endpoint);
    setWindowProp("__runeWebSocket", ws);
    ws.onmessage = function(event) {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "memory_update") {
          app.state[message.key] = message.value;
          if (app.state?.active_voice && !app.state.active_steps) syncSequencerState(app.state);
          app.render();
        }
      } catch (_err) {
      }
    };
    ws.onerror = function(error) {
      console.error("WebSocket error:", error);
    };
  }
  return __toCommonJS(index_exports);
})();
/*! Bundled license information:

leaflet/dist/leaflet-src.js:
  (* @preserve
   * Leaflet 1.9.4, a JS library for interactive maps. https://leafletjs.com
   * (c) 2010-2023 Vladimir Agafonkin, (c) 2010-2011 CloudMade
   *)
*/
