"use strict";
var __RuneWeb = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key2, value) => key2 in obj ? __defProp(obj, key2, { enumerable: true, configurable: true, writable: true, value }) : obj[key2] = value;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
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
          FIND_CHUNK: for (const record2 of records) {
            const recordBytes = record2.bytes;
            for (let j = 0; j < byteLength; j++) {
              if (recordBytes[j] !== bytes[inputOffset + j]) {
                continue FIND_CHUNK;
              }
            }
            return record2.str;
          }
          return null;
        }
        store(bytes, value) {
          const records = this.caches[bytes.length - 1];
          const record2 = { bytes, str: value };
          if (records.length >= this.maxLengthPerKey) {
            records[Math.random() * records.length | 0] = record2;
          } else {
            records.push(record2);
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

  // src/testing/index.ts
  var index_exports = {};
  __export(index_exports, {
    boot: () => boot,
    invoke: () => invoke,
    snapshot: () => snapshot
  });

  // src/context.ts
  var _ctx = null;
  function initContext(context) {
    _ctx = context;
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
  var session = () => ({ indices: /* @__PURE__ */ new WeakMap(), members: /* @__PURE__ */ new WeakMap() });
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
    const owner = active ?? session(), indices = owner.indices.get(source) ?? /* @__PURE__ */ new Map();
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
      case "overlay":
        return overlay(ev(e.items[0]), ev(e.items[1]));
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

  // src/utils.ts
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
      const resolved = valueToString(evaluateExpression(expr, scope));
      return resolved.includes("{") && resolved.includes("}") ? interpolate(resolved, scope) : resolved;
    }).replace(new RegExp(OPEN, "g"), "{").replace(new RegExp(CLOSE, "g"), "}");
  }

  // src/navigator.ts
  var isNavigatingFromUrl = false;
  var lastKnownRoute = null;
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
    const config2 = context.navigator;
    if (!config2) {
      updateSeoMetadata(route);
      return;
    }
    const cleanRoute = String(route || "").trim();
    if (cleanRoute === lastKnownRoute) return;
    lastKnownRoute = cleanRoute;
    const mode = config2.mode || "auto";
    const param = config2.param || "page";
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
        url.searchParams.delete(config2.bind);
        if (url.hash && !url.hash.startsWith("#/")) {
          url.hash = "";
        }
        const finalUrl = newPath + (url.search ? url.search : "") + (url.hash ? url.hash : "");
        const stateObj = { [config2.bind]: cleanRoute };
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
      if (url.hash && !url.hash.startsWith("#/")) {
        url.hash = "";
      }
      const newUrl = url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");
      const stateObj = { [config2.bind]: cleanRoute };
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
    const config2 = context.navigator;
    if (!config2 || prop !== config2.bind) return;
    updateNavigatorUrl(String(value ?? ""));
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
  function buildScope(locals, expression) {
    const c = ctx();
    if (c.compactScopes && expression !== void 0 && Object.keys(c.helperDefinitions).length === 0) {
      let names = expressionNames.get(expression);
      if (!names) {
        names = [...new Set(expression.match(/[A-Za-z_$][\w$]*/g) || [])];
        if (expressionNames.size >= 4096) expressionNames.clear();
        expressionNames.set(expression, names);
      }
      const scope = {};
      for (const name2 of names) {
        for (const source of [locals, c.app.derived, c.app.state]) {
          if (source && Object.prototype.propertyIsEnumerable.call(source, name2)) {
            scope[name2] = source[name2];
            break;
          }
        }
      }
      return scope;
    }
    return Object.assign({}, c.app.state, c.app.derived, locals || {});
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
        if (typeof prop === "string" && context.navigator && prop === context.navigator.bind) {
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
      if (this.renderCells || volume > 65536) return;
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
    let snapshot2 = worldSnapshots.get(world);
    const width = Math.ceil(world.width / 4), height = Math.ceil(world.height / 4);
    const length = width * height * Math.ceil(world.depth / 4);
    if (!snapshot2 || snapshot2.width !== world.width || snapshot2.height !== world.height || snapshot2.depth !== world.depth) {
      snapshot2 = {
        width: world.width,
        height: world.height,
        depth: world.depth,
        materialCount: -1,
        cells: new Uint16Array(world.cells.length),
        populations: new Uint8Array(length),
        chunks: { width, height, depth: Math.ceil(world.depth / 4), occupied: new Uint8Array(length), count: 0 }
      };
      worldSnapshots.set(world, snapshot2);
    }
    const { cells, populations, chunks } = snapshot2, limit = world.materials.length;
    const validateAll = snapshot2.materialCount !== limit;
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
    snapshot2.materialCount = limit;
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
    return traceVoxelRay(
      world,
      origin,
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
  function traceVoxelRay(world, origin, rx, ry, rz, dx, dy, dz, maxDistance, output, chunks, crossings, column = 0, row = 0) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const width = world.width, height = world.height, depth = world.depth;
    const sourceStore = chunkStore(world), cells = sourceStore?.renderCells ?? world.cells;
    const store = sourceStore?.renderCells ? void 0 : sourceStore;
    let lastChunk = -1, blocks;
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return null;
    const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1, sz = rz < 0 ? -1 : 1;
    const stepY = sy * width, stepZ = sz * width * height;
    let cellIndex = (z * height + y) * width + x;
    let tx = rx === 0 ? Infinity : (sx < 0 ? origin.x - x : x + 1 - origin.x) * dx;
    let ty = ry === 0 ? Infinity : (sy < 0 ? origin.y - y : y + 1 - origin.y) * dy;
    let tz = rz === 0 ? Infinity : (sz < 0 ? origin.z - z : z + 1 - origin.z) * dz;
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
    let distance = 0, face = 2;
    for (let iteration = 0; iteration < width + height + depth + 3 && distance <= maxDistance; iteration++) {
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

  // src/expression.ts
  var MAX_DEPTH = 64;
  var voxelFunctions = {
    voxel_world: (width, height, depth, materials, options) => voxelWorld(width, height, depth, materials, options),
    nearby: (entities, position, radius) => nearby(entities, position, radius),
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
  function parseHelperCall(expr) {
    const trimmed = String(expr || "").trim();
    if (!trimmed) return null;
    const { helperDefinitions } = ctx();
    const parenMatch = trimmed.match(/^([A-Za-z_][\w-]*)\((.*)?\)$/);
    if (parenMatch && helperDefinitions[parenMatch[1]]) {
      return {
        name: parenMatch[1],
        args: parenMatch[2] ? splitTopLevel(parenMatch[2], ",") : []
      };
    }
    const firstSpace = trimmed.indexOf(" ");
    if (firstSpace > 0) {
      const name2 = trimmed.slice(0, firstSpace);
      if (helperDefinitions[name2]) {
        return {
          name: name2,
          args: trimmed.slice(firstSpace + 1).split(/\s+/).filter(Boolean)
        };
      }
    }
    if (helperDefinitions[trimmed]) {
      return { name: trimmed, args: [] };
    }
    return null;
  }
  function callHelper(name2, args, scope, depth) {
    const { helperDefinitions } = ctx();
    const helper = helperDefinitions[name2];
    if (!helper) return void 0;
    const helperLocals = Object.assign({}, scope || {});
    (helper.params || []).forEach((param, index2) => {
      helperLocals[param] = args[index2];
    });
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
  }
  var exprCache = /* @__PURE__ */ new Map();
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
    let compiled = exprCache.get(trimmed);
    if (!compiled) {
      compiled = compileExpression(trimmed, depth || 0);
      if (exprCache.size >= MAX_CACHE_SIZE) {
        exprCache.clear();
      }
      exprCache.set(trimmed, compiled);
    }
    return compiled(scope);
  }

  // src/testing/host.ts
  var mock = {
    storage: {},
    downloads: [],
    clipboard: [],
    audio: []
  };
  function downloadText(filename, content) {
    mock.downloads.push({ filename, content });
  }
  function copyText(text) {
    mock.clipboard.push(text);
  }
  var record = (operation, args) => {
    mock.audio.push({ operation, args });
  };
  var playSound = (...args) => record("sound.play", args);
  var playMusic = (...args) => record("music.play", args);
  var stopMusic = () => record("music.stop", []);
  var pauseMusic = () => record("music.pause", []);
  var resumeMusic = () => record("music.resume", []);
  var setMusicTempo = (...args) => record("music.tempo", args);
  var setMusicVolume = (...args) => record("music.volume", args);
  var registerMusic = (...args) => record("music.register", args);
  function installHost() {
    const storage = /* @__PURE__ */ new Map();
    let frames = [];
    const unsupported = () => {
      throw new Error("This browser API is not supported by logic tests");
    };
    Object.assign(globalThis, {
      window: globalThis,
      // DOM, fetch, timers, and WebAudio are deliberately unavailable in this prototype.
      fetch: unsupported,
      setTimeout: unsupported,
      setInterval: unsupported,
      requestAnimationFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      localStorage: {
        getItem: (key2) => storage.get(key2) ?? null,
        setItem: (key2, value) => {
          storage.set(key2, value);
        },
        removeItem: (key2) => {
          storage.delete(key2);
        },
        clear: () => storage.clear()
      },
      console: { log() {
      }, warn() {
      }, error() {
      } }
    });
    return () => {
      let budget = 100;
      while (frames.length) {
        if (--budget === 0) throw new Error("Too many queued logic renders");
        const current = frames;
        frames = [];
        current.forEach((callback) => callback(0));
      }
      mock.storage = Object.fromEntries([...storage].map(([key2, value]) => {
        try {
          return [key2, JSON.parse(value)];
        } catch {
          return [key2, value];
        }
      }));
    };
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
  function increment(record2, path, by) {
    check(Array.isArray(path) && path.length <= 32, "mutation path exceeds 32 segments");
    const box = { value: record2 };
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
    if (["get", "scan", "put", "delete", "increment"].includes(packet.op)) name(packet.collection);
    if (["get", "put", "delete", "increment"].includes(packet.op)) key(packet.key);
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
    const read = ["get", "scan", "read"].includes(packet.op);
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
            const record2 = { key: op.key, value, revision: commit };
            await request(records().put(encode2(record2), recordKey(op)));
            receipt = op.op === "increment" ? { key: op.key, revision: commit, patch } : record2;
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
    const config2 = definitions[source];
    check(config2, `unknown datasource: ${source}`);
    check(["rune-db", "vect-event"].includes(config2.type), "unsupported storage provider");
    if (config2.type === "vect-event" && config2.mode !== "remote") {
      check(config2.store, "vect-event requires store");
      const parent = resolve(config2.store, seen);
      check(!parent.eventsOnly, "vect-event store must be rune-db");
      return { config: parent.config, eventsOnly: true };
    }
    check(config2.mode == null || ["embedded", "remote"].includes(config2.mode), "invalid datasource mode");
    const database = config2.database ?? source;
    if (config2.mode !== "remote") check(/^[A-Za-z0-9_-]{1,128}$/.test(database), "database name must contain only letters, numbers, _ or -");
    return { config: { ...config2, database }, eventsOnly: config2.type === "vect-event" };
  }
  function eventsOnly(packet) {
    return ["append", "read"].includes(packet.op) || packet.op === "batch" && packet.operations.every(eventsOnly);
  }
  async function requestDataSource(source, packet, options = {}) {
    const { config: config2, eventsOnly: restricted } = resolve(source);
    if (options.kind) check(restricted === (options.kind === "events"), "use db with rune-db and events with vect-event");
    check(config2.mode === "remote" ? typeof fetch !== "undefined" : typeof indexedDB !== "undefined", "This host does not provide the requested datasource adapter");
    await loadCodec();
    jsonValue(packet);
    const bytes = encode2(packet);
    check(bytes.length <= MAX_PACKET, "packet exceeds 8 MiB");
    packet = decode2(bytes);
    validate(packet);
    check(!restricted || eventsOnly(packet), "vect-event accepts only event operations");
    if (config2.mode === "remote") {
      check(config2.endpoint, "remote datasource requires endpoint");
      const url = new URL(config2.endpoint, typeof location !== "undefined" ? location.href : void 0);
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
    const database = config2.database;
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
        redirect: "follow",
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
      throw new FetchError(`fetch: request to ${shown} failed (network error or blocked by CORS)`);
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
    const run = pending.kind === "fetch" ? runFetch : runFetchJson;
    return Promise.resolve().then(() => run(evaluateExpression(pending.urlExpr, buildScope(locals, pending.urlExpr))));
  }
  function reportFetchFailure(error, onError) {
    const message = error instanceof Error ? error.message : String(error);
    if (onError) deliver(onError, { status: error instanceof FetchError ? error.status : 0, message });
    else console.warn(message);
  }
  function deliver(action, payload) {
    const app2 = ctx().app;
    app2.invokeAction(action, [payload]);
    app2.render();
  }
  function makeHandler(name2) {
    return (statement, locals) => {
      const match = statement.trim().match(new RegExp(`^${name2}\\s+(.+?)\\s+then\\s+(\\S+)(?:\\s+catch\\s+(\\S+))?$`));
      if (!match) return void 0;
      const [, urlExpr, onSuccess, onError] = match;
      const run = name2 === "fetch" ? runFetch : runFetchJson;
      Promise.resolve().then(() => run(evaluateExpression(urlExpr, buildScope(locals, statement)))).then(
        (value) => deliver(onSuccess, value),
        (error) => reportFetchFailure(error, onError)
      );
      return true;
    };
  }
  var fetchCommand = {
    prefix: ["fetch"],
    signature: "fetch <url> then <action> [catch <action>]",
    description: "HTTP GET; calls the action with { status, ok, url, content_type, body }",
    handler: makeHandler("fetch")
  };
  var fetchJsonCommand = {
    prefix: ["fetch-json"],
    signature: "fetch-json <url> then <action> [catch <action>]",
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
    const app2 = ctx().app;
    if (app2.startTimer) {
      app2.startTimer(action, ms);
    }
    return true;
  }
  function handleStopTimer(statement, _locals) {
    const trimmed = statement.trim();
    if (trimmed !== "stop-timer" && trimmed !== "clear-timer" && trimmed !== "clear-interval") return void 0;
    const app2 = ctx().app;
    if (app2.stopTimer) {
      app2.stopTimer();
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

  // src/statement.ts
  function assignPath(pathExpr, value, locals) {
    const segments = splitPathSegments(pathExpr);
    if (!segments.length) return;
    const baseKey = segments[0];
    let current;
    if (locals && Object.prototype.hasOwnProperty.call(locals, baseKey)) {
      current = locals[baseKey];
      if (segments.length === 1) {
        locals[baseKey] = value;
        entitiesChanged(value);
        return;
      }
    } else {
      current = ctx().app.state[baseKey];
      if (segments.length === 1) {
        ctx().app.state[baseKey] = value;
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
    let current;
    if (locals && Object.prototype.hasOwnProperty.call(locals, baseKey)) {
      current = locals[baseKey];
      if (segments.length === 1) {
        delete locals[baseKey];
        return;
      }
    } else {
      current = ctx().app.state[baseKey];
      if (segments.length === 1) {
        delete ctx().app.state[baseKey];
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
      const match = rest.match(/^([a-zA-Z_][\w]*)(?:\s+(.*))?$/);
      if (!match || !Object.prototype.hasOwnProperty.call(ctx().actionDefinitions, match[1])) {
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
          const songBars = Number(ctx().app?.state?.bars) || 4;
          registerMusic({
            [name2]: {
              music_type: "8bit",
              tempo,
              time_signature: timeSig,
              bars: songBars,
              loop_track: true,
              volume: 0.2,
              lead,
              bass,
              drums
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
        if (trimmed.startsWith("music.play(") && trimmed.endsWith(")")) {
          trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals, trimmed)) || "");
        } else if (trimmed.startsWith("play_music(") && trimmed.endsWith(")")) {
          trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals, trimmed)) || "");
        } else if (trimmed.startsWith("music.play ")) {
          trackName = String(evaluateExpression(trimmed.slice(11), buildScope(locals, trimmed)) || "");
        } else if (trimmed.startsWith("music ")) {
          trackName = String(evaluateExpression(trimmed.slice(6), buildScope(locals, trimmed)) || "");
        }
        trackName = normalizeLiteral(trackName);
        if (trackName) playMusic(trackName);
        return true;
      }
    }
    if (trimmed === "music.sync_steps" || trimmed === "music.sync_steps()") {
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "");
        const selectedId = Number(state.selected_step_id ?? -1);
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        state.active_steps = parseTrackToSteps(score, selectedId, timeSig, selectedBar);
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
        const score = String(state[voice + "_track"] || "");
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        state.active_steps = parseTrackToSteps(score, id, timeSig, selectedBar);
        const step = state.active_steps.find((s) => s.id === id);
        if (step && !step.is_bar && !step.is_rest) {
          state.selected_note = step.note;
          if (step.is_chord && step.chord_notes && step.chord_notes.length > 0) {
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
        const app2 = ctx().app;
        if (typeof app2?.state !== "undefined") {
          app2.state.is_fullscreen = shouldEnter;
          if (typeof app2.render === "function") {
            app2.render();
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
    runFetchAssignment(pending, locals).then(
      (value) => {
        try {
          assignPath(pending.target, value, locals);
          executeSteps(rest, locals);
        } catch (error) {
          console.error(error);
        }
        ctx().app.render();
      },
      (error) => reportFetchFailure(error, pending.onError)
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
  function getPitchRow(pitch, isDrum) {
    if (isDrum) {
      const p = pitch.toLowerCase();
      if (p.includes("hihat") || p.includes("crash")) return 0;
      if (p.includes("snare") || p.includes("tom")) return 1;
      return 2;
    }
    const clean = pitch.toUpperCase().trim();
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
  function parseTrackToSteps(scoreStr, selectedIdx, timeSignature = "4/4", selectedBar = 0) {
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
      let pitch = raw;
      let dur = ":8";
      let isChord = false;
      let chordNotes = [];
      if (raw.startsWith("[") && raw.includes("]")) {
        const closeIdx = raw.indexOf("]");
        pitch = raw.slice(1, closeIdx);
        const after = raw.slice(closeIdx + 1);
        dur = after.startsWith(":") ? after : ":8";
        isChord = true;
        chordNotes = pitch.split(/[,+]/).map((s) => s.trim()).filter(Boolean);
      } else {
        const colonIdx = raw.indexOf(":");
        pitch = colonIdx !== -1 ? raw.slice(0, colonIdx) : raw;
        dur = colonIdx !== -1 ? raw.slice(colonIdx) : ":8";
        if (pitch.includes("+")) {
          isChord = true;
          chordNotes = pitch.split("+").map((s) => s.trim()).filter(Boolean);
        }
      }
      const isRest = pitch === "-" || pitch.toLowerCase() === "rest";
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
        beats = beatsPerBar;
      }
      let pitchClass = "step-note";
      if (isRest) pitchClass = "step-rest";
      else if (isChord) pitchClass = "step-chord";
      else if (pitch.includes("2") || pitch.includes("1")) pitchClass = "step-bass";
      else if (pitch.includes("3")) pitchClass = "step-mid-low";
      else if (pitch.includes("4")) pitchClass = "step-mid";
      else if (pitch.includes("5")) pitchClass = "step-high";
      else if (pitch === "kick") pitchClass = "step-kick";
      else if (pitch === "snare") pitchClass = "step-snare";
      else if (pitch === "hihat") pitchClass = "step-hihat";
      const rootPitch = isChord && chordNotes.length > 0 ? chordNotes[0] : pitch;
      const isDrumPitch = ["kick", "snare", "hihat", "crash", "tom"].includes(rootPitch.toLowerCase());
      const row = getPitchRow(rootPitch, isDrumPitch);
      const rowHeight = isDrumPitch ? 48 : 28;
      const matrixTop = row * rowHeight + 2;
      const totalLeft = Math.round(totalBeatOffset * 120);
      const barLeft = Math.round(currentBeatInBar * 120);
      const matrixLeft = selectedBar > 0 ? barLeft : totalLeft;
      const matrixWidth = Math.max(34, Math.round(beats * 120) - 4);
      const stripWidth = Math.max(54, Math.round(beats * 140));
      const displayNote = isRest ? "REST" : isChord ? pitch.startsWith("[") ? pitch : `[${pitch}]` : pitch;
      steps.push({
        id: i,
        raw,
        note: displayNote,
        chord_notes: isChord ? chordNotes : [pitch],
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
        const def = context.actionDefinitions[name2];
        if (!def) {
          if (typeof window !== "undefined" && typeof window[name2] === "function") {
            window[name2](...args);
          }
          return;
        }
        const scopedLocals = Object.assign(
          {},
          locals || {}
        );
        (def.params || []).forEach((param, index2) => {
          scopedLocals[param] = args[index2];
        });
        executeSteps(def.steps || [], scopedLocals);
      }
    };
  }

  // src/testing/index.ts
  var app;
  var config;
  var flush;
  function boot(options) {
    config = options;
    flush = installHost();
    app = createLogicApp(function() {
      this.computeDerived();
    });
    initContext({
      pageTree: config.pageTree,
      derivedDefinitions: config.derivedDefinitions,
      helperDefinitions: config.helperDefinitions,
      actionDefinitions: config.actionDefinitions,
      i18nData: config.i18nData,
      // Match the game hosts: snapshot only bindings referenced by each expression.
      app,
      isRendering: false,
      compactScopes: true,
      memorySubscriptions: {},
      initialState: JSON.parse(JSON.stringify(config.stateJson)),
      emitters: config.emitters || {},
      loadedChunks: {},
      loadingChunks: {}
    });
    app.state = makeReactive({ ...config.stateJson, i18n: config.i18nData });
    if (typeof app.state.active_voice === "string") {
      app.state.active_steps = parseTrackToSteps(String(app.state[`${app.state.active_voice}_track`] || ""), Number(app.state.selected_step_id ?? -1), String(app.state.time_signature || "4/4"), Number(app.state.selected_bar ?? 0));
    }
    app.computeDerived();
    flush();
  }
  function invoke(name2, args) {
    if (!Object.prototype.hasOwnProperty.call(config.actionDefinitions, name2)) {
      throw new Error(`Unknown Rune-Web action: ${name2}`);
    }
    app.invokeAction(name2, args);
    flush();
    app.computeDerived();
  }
  function snapshot() {
    flush();
    return JSON.stringify({ state: app.state, derived: app.derived, mock });
  }
  return __toCommonJS(index_exports);
})();
