"use strict";
var __RunePixel3DRuntime = (() => {
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
        countWithoutUndefined(object, keys2) {
          let count = 0;
          for (const key2 of keys2) {
            if (object[key2] !== void 0) {
              count++;
            }
          }
          return count;
        }
        encodeMap(object, depth) {
          const keys2 = Object.keys(object);
          if (this.sortKeys) {
            keys2.sort();
          }
          const size = this.ignoreUndefined ? this.countWithoutUndefined(object, keys2) : keys2.length;
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
          for (const key2 of keys2) {
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

  // src/pixel3d/index.ts
  var index_exports = {};
  __export(index_exports, {
    boot: () => boot,
    configure: () => configure,
    mount: () => mount
  });

  // src/input/controller.ts
  var InputController = class {
    constructor(profile) {
      this.profile = profile;
      this.sources = /* @__PURE__ */ new Map();
    }
    event(event) {
      const source = event.source || `${event.device}:${event.code}`;
      const previous = this.sources.get(source);
      if (event.cancel) {
        this.sources.delete(source);
        return;
      }
      let binding;
      if (event.device === "virtual") binding = event.input ? { input: event.input, mode: event.mode } : void 0;
      else if (event.device === "keyboard") binding = this.profile.keys[event.code];
      else binding = this.profile[event.device][event.code];
      const command = (event.device === "keyboard" ? this.profile.commands[event.code] : void 0) || (binding && typeof binding !== "string" ? binding.command : void 0);
      if (command) {
        const def2 = binding && typeof binding !== "string" ? binding : void 0;
        const pressed = typeof event.value === "boolean" ? event.value : Number(event.value) * (def2?.invert ? -1 : 1) > (def2?.threshold ?? 0.5);
        this.sources.set(source, { input: "", mode: "button", value: pressed, pending: false });
        if (pressed && !previous?.value) return command;
        return;
      }
      if (!binding) {
        this.sources.delete(source);
        return;
      }
      const def = typeof binding === "string" ? { input: binding } : binding;
      if (!def.input) return;
      const isMouseDelta = event.device === "mouse" && /^(Move|Wheel)[XY]$/.test(event.code);
      const digitalAxis = event.device === "gamepad" && /[+-]$/.test(event.code);
      const mode = def.mode || (isMouseDelta ? "delta" : typeof event.value === "boolean" || /^Button/.test(event.code) || digitalAxis ? "button" : "value");
      let value = Number(event.value);
      if (def.invert) value = -value;
      if (event.device === "gamepad" && !/^Button/.test(event.code)) {
        const deadzone = def.deadzone ?? 0.18;
        value = Math.abs(value) <= deadzone ? 0 : Math.sign(value) * (Math.abs(value) - deadzone) / (1 - deadzone);
      }
      value *= def.scale ?? 1;
      if (mode === "button") {
        const down = value > (def.threshold ?? 0.5);
        this.sources.set(source, { input: def.input, mode, value: down, pending: Boolean(previous?.pending || down && !previous?.value) });
      } else {
        this.sources.set(source, { input: def.input, mode, value: mode === "delta" ? Number(previous?.value || 0) + value : value, pending: false });
      }
    }
    /** Queued presses survive a down/up between ticks; deltas drain exactly once. */
    sample(dt) {
      const buttons = /* @__PURE__ */ Object.create(null);
      const axes = /* @__PURE__ */ Object.create(null);
      const deltas = /* @__PURE__ */ Object.create(null);
      for (const entry of this.sources.values()) {
        if (!entry.input) continue;
        if (entry.mode === "button") buttons[entry.input] = Boolean(buttons[entry.input] || entry.value || entry.pending);
        else if (entry.mode === "value") {
          if (Math.abs(Number(entry.value)) >= Math.abs(axes[entry.input] || 0)) axes[entry.input] = Number(entry.value);
        } else {
          const scale = entry.mode === "rate" ? Math.max(0, Math.min(0.25, dt)) : 1;
          deltas[entry.input] = (deltas[entry.input] || 0) + Number(entry.value) * scale;
        }
        entry.pending = false;
        if (entry.mode === "delta") entry.value = 0;
      }
      const result = { ...buttons, ...axes };
      for (const [input, value] of Object.entries(deltas)) result[input] = Number(result[input] || 0) + value;
      return result;
    }
    /** Browser Gamepad API or a native adapter can supply the same normalized pads. */
    gamepads(pads) {
      const live = /* @__PURE__ */ new Set();
      const commands = [];
      for (const pad of pads) {
        if (!pad) continue;
        for (const code of Object.keys(this.profile.gamepad)) {
          const match = code.match(/^(Button|Axis)(\d+)([+-])?$/);
          if (!match) continue;
          const source = `pad:${pad.index}:${code}`;
          live.add(source);
          let value = match[1] === "Button" ? pad.buttons[Number(match[2])]?.value || 0 : pad.axes[Number(match[2])] || 0;
          if (match[3]) value = Math.max(0, value * (match[3] === "-" ? -1 : 1));
          const command = this.event({ device: "gamepad", code, value, source });
          if (command) commands.push(command);
        }
      }
      for (const source of this.sources.keys()) if (source.startsWith("pad:") && !live.has(source)) this.sources.delete(source);
      return commands;
    }
    clear(keepCommands = false) {
      if (!keepCommands) this.sources.clear();
      else for (const [key2, source] of this.sources) if (source.input) this.sources.delete(key2);
    }
  };

  // src/input/game.ts
  var isPausableStatus = (status) => ["playing", "intro", "landing", "departing", "ending", "credits"].includes(String(status));
  var GameControls = class {
    constructor(profile, game) {
      this.game = game;
      this.controller = new InputController(profile);
    }
    get profile() {
      return this.controller.profile;
    }
    event(event) {
      const command = this.controller.event(event);
      return command ? this.command(command) : void 0;
    }
    command(command) {
      if (command === "host.fullscreen") return command;
      if (command !== "host.mute") this.controller.clear(true);
      if (command === "host.pause") {
        const status = this.game.app.state.status;
        if (isPausableStatus(status)) this.game.paused = !this.game.paused;
        else if (["title", "won", "gameover"].includes(String(status))) this.game.start();
      } else if (command === "host.mute") this.game.muted = !this.game.muted;
      else if (command === "host.start") {
        if (!this.game.key?.("Enter")) this.game.start();
      } else if (command === "host.advance") {
        if (this.game.app.state.status !== "playing") this.game.invoke("advance");
      } else this.game.invoke(command);
    }
    gamepads(pads) {
      return this.controller.gamepads(pads).flatMap((command) => {
        const host = this.command(command);
        return host ? [host] : [];
      });
    }
    sample(dt) {
      return this.controller.sample(dt);
    }
    clear(keepCommands = false) {
      this.controller.clear(keepCommands);
    }
  };

  // src/game_ready.ts
  function beginGameLoading() {
    if (typeof document !== "undefined") document.documentElement.dataset.runeGameState = "loading";
  }
  function markGameReady() {
    if (typeof document === "undefined" || typeof window === "undefined" || document.documentElement.dataset.runeGameState === "ready") return;
    document.documentElement.dataset.runeGameState = "ready";
    if (window.parent !== window) window.parent.postMessage({ type: "rune-game-ready" }, "*");
  }

  // src/input/touch.ts
  function mountControlTouch(canvas, controls, profile, options) {
    const surface = canvas.parentElement || canvas;
    const padding = Math.max(0, Math.min(24, Number(canvas.dataset.pixelTouchPadding) || 0));
    const style = document.createElement("style");
    style.textContent = `.rune-control-touch{position:absolute;z-index:6;pointer-events:none;display:none;user-select:none;-webkit-user-select:none;touch-action:none}@media(pointer:coarse),(hover:none){.rune-control-touch{display:block}}.rune-control-touch.is-touch{display:block}.rune-control-touch[hidden]{display:none}.rune-control-touch button{position:absolute;pointer-events:auto;touch-action:none;color:#fff;background:#172c42bb;border:2px solid #efca6a99;border-radius:50%;font:bold 11px ui-monospace,monospace;padding:4px;box-sizing:border-box;min-width:44px;min-height:44px}.rune-control-touch button:focus-visible{outline:3px solid white}.rune-control-touch .control-thumb{position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:#efca6aaa;pointer-events:none}`;
    document.head.append(style);
    const overlay2 = document.createElement("div");
    overlay2.className = "rune-control-touch";
    surface.append(overlay2);
    const position = getComputedStyle(surface).position;
    if (position === "static") surface.style.position = "relative";
    const oldTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    const hint = document.createElement("div");
    hint.className = "rune-control-rotate";
    hint.setAttribute("role", "status");
    hint.setAttribute("aria-live", "polite");
    const cramped = document.createElement("strong");
    cramped.textContent = "It's cramped in here";
    const rotate = document.createElement("span");
    rotate.textContent = "Please rotate your phone to landscape.";
    hint.append(cramped, rotate);
    surface.append(hint);
    style.textContent += ".rune-control-rotate{position:absolute;z-index:7;top:calc(max(12px,env(safe-area-inset-top)) + 68px);left:50%;transform:translateX(-50%);width:min(300px,calc(100% - 32px));padding:12px;box-sizing:border-box;border:1px solid #627b98;border-radius:8px;background:#142432ed;color:white;text-align:center;font:14px system-ui,sans-serif;pointer-events:none;user-select:none;-webkit-user-select:none}.rune-control-rotate strong,.rune-control-rotate span{display:block}.rune-control-rotate span{margin-top:6px;font-size:12px}.rune-control-rotate[hidden]{display:none!important}";
    const abort = new AbortController();
    function listen(target, name2, fn) {
      target.addEventListener(name2, fn, { signal: abort.signal, passive: false });
    }
    const pointers = /* @__PURE__ */ new Map();
    const occupied = /* @__PURE__ */ new Set();
    const visibility = /* @__PURE__ */ new Map();
    const starters = /* @__PURE__ */ new Map();
    function bind(target, start) {
      starters.set(target, start);
      listen(target, "pointerdown", start);
    }
    function visible(path) {
      if (path === void 0) return true;
      let value = options.state?.();
      for (const key2 of path.split(".")) {
        value = value && typeof value === "object" ? Reflect.get(value, key2) : void 0;
      }
      if (typeof value !== "boolean") throw new Error(`Touch visible must reference boolean state: ${path}`);
      return value;
    }
    function activate(e) {
      e.preventDefault();
      e.stopPropagation();
      options.interact();
      overlay2.classList.add("is-touch");
      canvas.focus({ preventScroll: true });
      if (!options.playing()) {
        if (options.tapToAdvance !== false) options.advance();
        return false;
      }
      if (options.paused()) {
        options.resume();
        return false;
      }
      return true;
    }
    function capture(target, e, pointer) {
      occupied.add(target);
      pointers.set(e.pointerId, pointer);
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
      }
    }
    function emit(id, input, value, mode, cancel = false) {
      controls.event({ device: "virtual", code: id, source: `touch:${id}`, input, value, mode, cancel });
    }
    function button(label, id, anchor, offset, size) {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = label;
      element.dataset.controlTouch = id;
      element.setAttribute("aria-label", label);
      const [vertical, horizontal] = anchor.split("-");
      element.style[horizontal] = `max(${offset[0]}px,env(safe-area-inset-${horizontal}))`;
      element.style[vertical] = `max(${offset[1]}px,env(safe-area-inset-${vertical}))`;
      element.style.width = element.style.height = `${size}px`;
      overlay2.append(element);
      return element;
    }
    if (profile.joystick) {
      let move2 = function(e, cancel = false) {
        const rect = stick.getBoundingClientRect(), radius = rect.width * 0.36;
        let x = e ? (e.clientX - rect.left - rect.width / 2) / radius : 0;
        let y = e ? -(e.clientY - rect.top - rect.height / 2) / radius : 0;
        const length = Math.hypot(x, y), deadzone = def.deadzone ?? 0.15;
        const strength = Math.min(1, Math.max(0, (length - deadzone) / (1 - deadzone)));
        x = length ? x / length * strength : 0;
        y = length ? y / length * strength : 0;
        thumb.style.transform = e ? `translate(${x * radius}px,${-y * radius}px)` : "";
        if (def.x) emit("stick:x", def.x, x, "value", cancel);
        if (def.y) emit("stick:y", def.y, y, "value", cancel);
        for (const [direction, amount] of [["left", -x], ["right", x], ["up", y], ["down", -y]]) {
          if (def[direction]) emit(`stick:${direction}`, def[direction], amount > 0.35, "button", cancel);
        }
      };
      var move = move2;
      const def = profile.joystick;
      const stick = button("MOVE", "joystick", def.anchor || "bottom-left", [12, 12], def.size || 96);
      if (def.visible !== void 0) visibility.set(stick, def.visible);
      stick.dataset.gameplay = "true";
      stick.setAttribute("aria-label", "Move joystick");
      const thumb = document.createElement("span");
      thumb.className = "control-thumb";
      stick.append(thumb);
      bind(stick, (e) => {
        if (occupied.has(stick) || !activate(e)) return;
        capture(stick, e, { target: stick, move: move2, end: (cancel) => move2(void 0, cancel) });
        move2(e);
      });
    }
    for (const [index2, def] of (profile.buttons || []).entries()) {
      const target = button(def.label, def.id, def.anchor || "bottom-right", def.offset || [12 + index2 * 68, 12], def.size || 56);
      if (def.visible !== void 0) visibility.set(target, def.visible);
      target.classList.add("touch-" + def.id);
      if (def.aria_label) target.setAttribute("aria-label", def.aria_label);
      if (def.input) target.dataset.gameplay = "true";
      bind(target, (e) => {
        if (def.command) {
          e.preventDefault();
          e.stopPropagation();
          options.interact();
          canvas.focus({ preventScroll: true });
          if (controls.command(def.command) === "host.fullscreen") options.fullscreen();
          return;
        }
        if (occupied.has(target) || !activate(e)) return;
        let lastX = e.clientX;
        emit(def.id, def.input, true, "button");
        capture(target, e, { target, move: (e2) => {
          if (def.drag_x) emit(`${def.id}:look`, def.drag_x, (e2.clientX - lastX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width) * (profile.look?.sensitivity ?? 1), "delta");
          lastX = e2.clientX;
        }, end: (cancel) => emit(def.id, def.input, false, "button", cancel) });
      });
      target.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, { signal: abort.signal });
    }
    if (padding > 0) {
      let available2 = function(button2) {
        const css = getComputedStyle(button2);
        return !button2.disabled && button2.getClientRects().length > 0 && css.visibility !== "hidden" && css.pointerEvents !== "none";
      }, distance2 = function(button2, x, y) {
        const r = button2.getBoundingClientRect();
        return Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      };
      var available = available2, distance = distance2;
      let assistedClickUntil = 0;
      const guardedTouches = /* @__PURE__ */ new Set();
      document.addEventListener("pointerdown", (e) => {
        assistedClickUntil = 0;
        guardedTouches.delete(e.pointerId);
      }, { signal: abort.signal, capture: true });
      document.addEventListener("pointerup", (e) => {
        assistedClickUntil = guardedTouches.delete(e.pointerId) ? Date.now() + 700 : 0;
      }, { signal: abort.signal, capture: true });
      document.addEventListener("pointercancel", (e) => {
        guardedTouches.delete(e.pointerId);
      }, { signal: abort.signal, capture: true });
      document.addEventListener("click", (e) => {
        if (e.isTrusted && e.detail !== 0 && Date.now() < assistedClickUntil) {
          assistedClickUntil = 0;
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }, { signal: abort.signal, capture: true });
      surface.addEventListener("pointerdown", (e) => {
        if (!["touch", "pen"].includes(e.pointerType)) return;
        overlay2.classList.add("is-touch");
        const direct = e.target instanceof Element ? e.target.closest("button") : null;
        if (direct) {
          if (starters.has(direct)) {
            guardedTouches.add(e.pointerId);
            e.preventDefault();
          }
          return;
        }
        guardedTouches.add(e.pointerId);
        e.preventDefault();
        e.stopImmediatePropagation();
        let nearest, best = Infinity, center = Infinity;
        for (const button3 of Array.from(surface.querySelectorAll("button"))) {
          if (!available2(button3)) continue;
          const d = distance2(button3, e.clientX, e.clientY), r = button3.getBoundingClientRect();
          const c = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
          if (d <= padding && (d < best || d === best && c < center)) {
            nearest = button3;
            best = d;
            center = c;
          }
        }
        if (!nearest) return;
        const start = starters.get(nearest);
        if (start) {
          start(e);
          return;
        }
        if (occupied.has(surface)) return;
        const button2 = nearest;
        let inside = true;
        capture(surface, e, {
          target: surface,
          needsOverlay: false,
          move: (p) => {
            inside = distance2(button2, p.clientX, p.clientY) <= padding;
          },
          end: (cancel) => {
            if (!cancel && inside && button2.isConnected && available2(button2)) {
              button2.click();
            }
          }
        });
      }, { signal: abort.signal, capture: true, passive: false });
      const suppress = (e) => {
        e.preventDefault();
      };
      for (const name2 of ["contextmenu", "selectstart", "dragstart", "dblclick", "gesturestart", "gesturechange", "gestureend"]) {
        surface.addEventListener(name2, suppress, { signal: abort.signal, passive: false });
      }
      surface.addEventListener("touchmove", suppress, { signal: abort.signal, passive: false });
      surface.addEventListener("click", (e) => {
        if (!(e.target instanceof Element && e.target.closest("button"))) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }, { signal: abort.signal, capture: true });
    }
    listen(canvas, "pointerdown", (e) => {
      if (!["touch", "pen"].includes(e.pointerType) || occupied.has(canvas)) return;
      if (!activate(e) || !profile.look) return;
      let lastX = e.clientX, lastY = e.clientY;
      capture(canvas, e, { target: canvas, move: (e2) => {
        emit("aim", profile.look.x, (e2.clientX - lastX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width) * (profile.look.sensitivity ?? 1), "delta");
        lastX = e2.clientX;
        if (profile.look.y) emit("aim:y", profile.look.y, (e2.clientY - lastY) * 1200 / Math.max(1, canvas.getBoundingClientRect().height) * (profile.look.sensitivity ?? 1), "delta");
        lastY = e2.clientY;
      }, end: (cancel) => {
        if (cancel) {
          emit("aim", profile.look.x, 0, "delta", true);
          if (profile.look.y) emit("aim:y", profile.look.y, 0, "delta", true);
        }
      } });
    });
    listen(document, "pointermove", (e) => {
      const pointer = pointers.get(e.pointerId);
      if (pointer) {
        e.preventDefault();
        pointer.move?.(e);
      }
    });
    function end(e) {
      const pointer = pointers.get(e.pointerId);
      if (!pointer) return;
      pointers.delete(e.pointerId);
      occupied.delete(pointer.target);
      pointer.end(e.type !== "pointerup");
    }
    for (const name2 of ["pointerup", "pointercancel", "lostpointercapture"]) listen(document, name2, end);
    function reset(keepMenu = false) {
      const active2 = [...pointers];
      for (const [id, pointer] of active2) {
        if (keepMenu && pointer.needsOverlay === false) continue;
        pointers.delete(id);
        occupied.delete(pointer.target);
        pointer.end(true);
        try {
          pointer.target.releasePointerCapture(id);
        } catch {
        }
      }
    }
    function update() {
      const rect = canvas.getBoundingClientRect(), parent = surface.getBoundingClientRect();
      Object.assign(overlay2.style, { left: `${rect.left - parent.left - surface.clientLeft}px`, top: `${rect.top - parent.top - surface.clientTop}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      overlay2.hidden = !visible(profile.visible);
      for (const element of Array.from(overlay2.querySelectorAll("button"))) {
        element.hidden = element.dataset.gameplay === "true" && !options.playing() || !visible(visibility.get(element));
      }
      for (const [id, pointer] of [...pointers]) {
        if (overlay2.hidden && pointer.needsOverlay !== false || pointer.target.hidden) {
          pointers.delete(id);
          occupied.delete(pointer.target);
          pointer.end(true);
          try {
            pointer.target.releasePointerCapture(id);
          } catch {
          }
        }
      }
      const expanded = options.expanded?.() || false;
      hint.hidden = !expanded || innerWidth >= innerHeight;
      for (const def of profile.buttons || []) {
        const target = Array.from(overlay2.querySelectorAll("button")).find((b) => b.dataset.controlTouch === def.id);
        if (def.command === "host.pause") {
          target.textContent = options.paused() ? "RESUME" : def.label;
          target.setAttribute("aria-label", options.paused() ? "Resume game" : def.aria_label || def.label);
        }
        if (def.command === "host.fullscreen") target.textContent = expanded ? "EXIT" : def.label;
      }
    }
    const resize = new ResizeObserver(update);
    resize.observe(canvas);
    resize.observe(surface);
    update();
    return { reset, update, dispose() {
      reset();
      abort.abort();
      resize.disconnect();
      overlay2.remove();
      hint.remove();
      style.remove();
      canvas.style.touchAction = oldTouchAction;
      if (position === "static") surface.style.position = "";
    } };
  }

  // src/input/browser.ts
  function mountControls(canvas, controls, options) {
    const abort = new AbortController();
    let lastTouch = 0;
    const send = (event) => {
      if (controls.event(event) === "host.fullscreen") options.fullscreen();
    };
    function listen(target, name2, handler) {
      target.addEventListener(name2, handler, { signal: abort.signal });
    }
    listen(canvas, "keydown", (e) => {
      options.interact();
      if (Object.prototype.hasOwnProperty.call(controls.profile.keys, e.code) || Object.prototype.hasOwnProperty.call(controls.profile.commands, e.code)) e.preventDefault();
      if (options.paused() && !e.repeat && options.menuKey?.(e.code)) return;
      if (!options.playing() && !controls.profile.commands[e.code]) {
        if (!e.repeat && options.menuKey?.(e.code)) return;
        const binding = controls.profile.keys[e.code];
        const input = typeof binding === "string" ? binding : binding?.input;
        if (input && options.advanceInputs?.includes(input)) {
          if (!e.repeat) options.advance();
          return;
        }
      }
      send({ device: "keyboard", code: e.code, value: true });
    });
    listen(document, "keyup", (e) => send({ device: "keyboard", code: e.code, value: false }));
    const mouseCode = (button) => ["Left", "Middle", "Right", "Back", "Forward"][button];
    listen(canvas, "mousedown", (e) => {
      if (Date.now() - lastTouch < 700 || !options.playing()) return;
      options.interact();
      canvas.focus();
      const code = mouseCode(e.button);
      if (code) send({ device: "mouse", code, value: true });
    });
    listen(document, "mouseup", (e) => {
      const code = mouseCode(e.button);
      if (code) send({ device: "mouse", code, value: false });
    });
    listen(canvas, "contextmenu", (e) => {
      if (controls.profile.mouse.Right) e.preventDefault();
    });
    listen(document, "mousemove", (e) => {
      if (!options.playing() || options.paused()) return;
      const lock = document.pointerLockElement;
      const focused = document.activeElement === canvas;
      const canvasLook = options.unlockedCanvasLook?.() && !lock && focused && e.target === canvas;
      if (options.lockedMouse ? lock !== canvas && !canvasLook : !focused) return;
      send({ device: "mouse", code: "MoveX", value: e.movementX });
      send({ device: "mouse", code: "MoveY", value: e.movementY });
    });
    canvas.addEventListener("wheel", (e) => {
      if (document.activeElement !== canvas || !options.playing()) return;
      if (controls.profile.mouse.WheelX || controls.profile.mouse.WheelY) e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
      send({ device: "mouse", code: "WheelX", value: e.deltaX * unit });
      send({ device: "mouse", code: "WheelY", value: e.deltaY * unit });
    }, { signal: abort.signal, passive: false });
    const touch = controls.profile.touch && controls.profile.touch.enabled !== false ? mountControlTouch(canvas, controls, controls.profile.touch, {
      ...options,
      interact() {
        lastTouch = Date.now();
        options.interact();
      }
    }) : void 0;
    function clear(keepCommands = false) {
      touch?.reset(keepCommands);
      controls.clear(keepCommands);
    }
    listen(canvas, "blur", () => clear());
    listen(window, "blur", () => clear());
    listen(document, "visibilitychange", () => {
      if (document.hidden) clear();
    });
    return {
      clear,
      recentTouch: () => Date.now() - lastTouch < 700,
      update() {
        touch?.update();
      },
      sample(dt) {
        let pads = [];
        try {
          if (document.hasFocus() && document.activeElement === canvas) pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
        } catch {
        }
        for (const command of controls.gamepads(pads)) if (command === "host.fullscreen") options.fullscreen();
        return controls.sample(dt);
      },
      dispose() {
        clear();
        touch?.dispose();
        abort.abort();
      }
    };
  }

  // src/storage.ts
  var persistent = false;
  function storageIsPersistent() {
    return persistent;
  }
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

  // src/pixel/persistence.ts
  function restore(defaults, saved) {
    if (Array.isArray(defaults)) return Array.isArray(saved) && saved.length <= 128 && saved.every((v) => typeof v === typeof defaults[0]) ? saved.slice() : defaults.slice();
    if (defaults && typeof defaults === "object") return Object.fromEntries(Object.keys(defaults).map((key2) => [key2, restore(defaults[key2], saved?.[key2])]));
    return typeof defaults === typeof saved && (typeof saved !== "number" || Number.isSafeInteger(saved)) ? saved : defaults;
  }
  var GameSave = class {
    constructor(config) {
      this.config = config;
      this.status = "session";
      this.previous = "";
      this.elapsed = 0;
      if (config.interval_ticks !== void 0 && (!Number.isInteger(config.interval_ticks) || config.interval_ticks < 1 || config.interval_ticks > 3600)) {
        throw new Error("Persistence interval_ticks must be an integer from 1 to 3600");
      }
      if (config.revision !== void 0 && !/^[A-Za-z_]\w*$/.test(config.revision)) {
        throw new Error("Persistence revision must name a state field");
      }
    }
    load(defaults) {
      const raw = getStorageItem("rune-pixel-" + this.config.key);
      if (!raw) return defaults;
      try {
        if (raw.length > 16384) throw new Error("Save too large");
        const data = JSON.parse(raw);
        if (data.version !== 1 || !data.data || typeof data.data !== "object") throw new Error("Unknown save format");
        return restore(defaults, data.data);
      } catch {
        this.status = "recovered";
        return defaults;
      }
    }
    tick(value, revision) {
      this.checkRevision(revision);
      if (++this.elapsed >= (this.config.interval_ticks ?? 1)) this.flush(value, revision);
    }
    persist(state, immediate = true) {
      const revision = this.config.revision ? state[this.config.revision] : void 0;
      if (revision !== void 0 && typeof revision !== "number") throw new Error("Persistence revision must be a number");
      if (immediate) this.flush(state[this.config.state], revision);
      else this.tick(state[this.config.state], revision);
    }
    checkRevision(revision) {
      if (this.config.revision !== void 0 && (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)) throw new Error("Persistence revision must be a nonnegative safe integer");
    }
    flush(value, revision) {
      this.checkRevision(revision);
      this.elapsed = 0;
      if (this.config.revision !== void 0 && value === this.previousValue && revision === this.previousRevision) return;
      const json = JSON.stringify({ version: 1, data: value });
      this.previousValue = value;
      this.previousRevision = revision;
      if (json === this.previous) return;
      setStorageItem("rune-pixel-" + this.config.key, json);
      this.previous = json;
      if (this.status !== "recovered") this.status = storageIsPersistent() ? "saved" : "session";
    }
  };

  // src/context.ts
  var _ctx = null;
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
  function withEntityQueries(run) {
    const previous = active;
    active = active ?? session();
    try {
      return run();
    } finally {
      active = previous;
    }
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
  function nearbyForRender(source, origin, radius, padding) {
    return query(source, origin, radius, padding);
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
        const rows2 = expression(8);
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
        left = { kind: "grid", items: [cols, rows2, x, y, dx, dy, overrides] };
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
        const [cols, rows2] = e.items.slice(0, 2).map((item) => collectionCount(ev(item)));
        const count = collectionCount(cols * rows2);
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
  function degToIndex(degrees) {
    const raw = Math.round(degrees * DEG_TO_INDEX) % ANGLE_UNITS;
    return raw < 0 ? raw + ANGLE_UNITS : raw;
  }
  function fastSin(degrees) {
    return SIN_TABLE[degToIndex(degrees)];
  }
  function fastCos(degrees) {
    return COS_TABLE[degToIndex(degrees)];
  }

  // src/pixel3d/spatial.ts
  var activeMap = null;
  function setActiveMap(map) {
    activeMap = map;
    if (typeof globalThis !== "undefined") {
      globalThis.__RuneSpatialMap = map;
    }
  }
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

  // src/pixel3d/sky.ts
  function noise(x, y, seed) {
    let n = x * 374761393 + y * 668265263 + seed >>> 0;
    n = Math.imul(n ^ n >>> 13, 1274126177) >>> 0;
    return ((n ^ n >>> 16) >>> 0) / 4294967295;
  }
  function mix(a, b, t) {
    let color = 4278190080;
    for (const shift of [0, 8, 16]) {
      color |= Math.floor((a >>> shift & 255) * (1 - t) + (b >>> shift & 255) * t) << shift;
    }
    return color >>> 0;
  }
  function cloudDensity(u, v, seed, wrap = 63) {
    const x = Math.floor(u), y = Math.floor(v);
    const fx = u - x, fy = v - y;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const left = x & wrap, right = x + 1 & wrap;
    const a = noise(left, y, seed) * (1 - sx) + noise(right, y, seed) * sx;
    const b = noise(left, y + 1, seed) * (1 - sx) + noise(right, y + 1, seed) * sx;
    return Math.max(0, Math.min(1, (a * (1 - sy) + b * sy - 0.5) * 4));
  }
  function skyPixel(sky, longitude, altitude, time) {
    const u = longitude / (2 * Math.PI) * 64;
    const drift = time * sky.speed;
    if (altitude < 0 && sky.below !== void 0) {
      const depth = -altitude;
      const gradient = mix(sky.horizon, sky.below, Math.floor(Math.sqrt(depth) * 32) / 32);
      const far = cloudDensity(u + drift * 0.35, depth * 23, sky.seed);
      const near = cloudDensity(u / 2 + drift, depth * 14 + 13, sky.seed + 719, 31);
      return mix(gradient, sky.cloud, (far * 0.18 + near * 0.42) * Math.min(1, depth * 7));
    }
    if (altitude <= 0) return (4278190080 | sky.horizon) >>> 0;
    const density = cloudDensity(((u + drift) % 64 + 64) % 64, altitude * 12, sky.seed);
    const band = Math.floor(altitude * 16) / 16;
    return mix(mix(sky.horizon, sky.zenith, band), sky.cloud, density * Math.min(1, altitude * 5));
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
  function prepareVoxelChunks(world) {
    if (world.storage === "chunked" && !chunkStore(world)) validateWorld(world);
    const store = chunkStore(world);
    if (store) return sparseMetadata(store);
    return inspectWorld(world);
  }
  var sparseChunks = /* @__PURE__ */ new WeakMap();
  function sparseMetadata(store) {
    let chunks = sparseChunks.get(store);
    if (!chunks) {
      chunks = { width: store.cw, height: store.ch, depth: store.cd, occupied: store.occupied, count: 0 };
      sparseChunks.set(store, chunks);
    }
    chunks.count = store.raw.size;
    return chunks;
  }
  function validatedVoxelChunks(world) {
    const store = chunkStore(world);
    return store ? sparseMetadata(store) : worldSnapshots.get(world)?.chunks;
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
  function noise2(x, y, seed) {
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
      const top = camp ? 3 : 3 + Math.floor(noise2(Math.floor(x / 3), Math.floor(y / 3), seed + (biomeValue === "ember" ? 137 : 0)) * 3);
      for (let z = 0; z < top; z++) set(x, y, z, z === 0 ? 1 : z === top - 1 ? 3 : noise2(x + z * 13, y, seed) > 0.87 ? 5 : 2);
      if (!camp && x > 1 && y > 1 && x < 18 && y < 18 && noise2(x, y, seed + 1) > 0.94) {
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
      set(x, 8, 2, noise2(x, 8, seed) > 0.4 ? 5 : 2);
      set(x, 15, 2, noise2(x, 15, seed) > 0.4 ? 5 : 2);
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
  function wrappedTexel(point, size) {
    const wrapped = point - Math.trunc(point) + 1;
    return Math.floor((wrapped >= 1 ? wrapped - 1 : wrapped) * size);
  }
  function traceTerrainPose(world, cells, store, origin, rx, ry, rz, limit, output, chunks) {
    const { x, y, z } = origin;
    const enterX = terrainEntry(x, rx, world.width);
    const enterY = terrainEntry(y, ry, world.height);
    const enterZ = terrainEntry(z, rz, world.depth);
    const entry = Math.max(enterX, enterY, enterZ);
    if (entry > limit) return null;
    if (entry < 0) {
      return traceVoxelRay(
        world,
        cells,
        store,
        x,
        y,
        z,
        rx,
        ry,
        rz,
        Math.abs(1 / rx),
        Math.abs(1 / ry),
        Math.abs(1 / rz),
        limit,
        output,
        chunks
      );
    }
    const exit = Math.min(
      rx === 0 ? Infinity : ((rx > 0 ? world.width : 0) - x) / rx,
      ry === 0 ? Infinity : ((ry > 0 ? world.height : 0) - y) / ry,
      rz === 0 ? Infinity : ((rz > 0 ? world.depth : 0) - z) / rz
    );
    if (entry >= exit) return null;
    const start = entry + Math.min(1e-7, (exit - entry) / 2);
    const face = entry === enterX ? 0 : entry === enterY ? 1 : 2;
    const hit = traceVoxelRay(
      world,
      cells,
      store,
      x + rx * start,
      y + ry * start,
      z + rz * start,
      rx,
      ry,
      rz,
      Math.abs(1 / rx),
      Math.abs(1 / ry),
      Math.abs(1 / rz),
      limit - start,
      output,
      chunks,
      void 0,
      0,
      0,
      face
    );
    if (hit) hit.distance += hit.distance === 0 ? entry : start;
    return hit;
  }
  function terrainEntry(origin, direction, end) {
    if (origin === 0 && direction < 0) return Infinity;
    if (origin <= 0 && direction > 0) return -origin / direction;
    if (origin >= end && direction < 0) return (end - origin) / direction;
    return origin < 0 || origin >= end ? Infinity : -Infinity;
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
  var crossingScratch = /* @__PURE__ */ new WeakMap();
  function fillCrossings(values, offset, stride, position, component, delta) {
    const cell = Math.floor(position);
    let next2 = component === 0 ? Infinity : (component < 0 ? position - cell : cell + 1 - position) * delta;
    for (let i = 0; i < stride; i++) {
      values[offset + i] = next2;
      next2 += delta;
    }
  }
  function crossingBefore(values, offset, stride, before, delta) {
    let count = Math.max(0, Math.min(stride - 1, Math.ceil((before - values[offset]) / delta)));
    while (count < stride - 1 && values[offset + count] < before) count++;
    while (count > 0 && values[offset + count - 1] >= before) count--;
    return count;
  }
  function rayCrossings(world, origin, rays, owner) {
    const previous = crossingScratch.get(owner);
    const strideX = world.width + 1, strideY = world.height + 1, strideZ = world.depth + 1;
    const sameRays = previous && previous.angle === rays.angle && previous.fov === rays.fov && previous.width === rays.width && previous.height === rays.height;
    const x = previous?.x.length === rays.width * strideX ? previous.x : new Float64Array(rays.width * strideX);
    const y = previous?.y.length === rays.width * strideY ? previous.y : new Float64Array(rays.width * strideY);
    const z = previous?.z.length === rays.height * strideZ ? previous.z : new Float64Array(rays.height * strideZ);
    if (!sameRays || previous.originX !== origin.x || previous.strideX !== strideX) {
      for (let column = 0; column < rays.width; column++)
        fillCrossings(x, column * strideX, strideX, origin.x, rays.columns[column * 4], rays.columns[column * 4 + 2]);
    }
    if (!sameRays || previous.originY !== origin.y || previous.strideY !== strideY) {
      for (let column = 0; column < rays.width; column++)
        fillCrossings(y, column * strideY, strideY, origin.y, rays.columns[column * 4 + 1], rays.columns[column * 4 + 3]);
    }
    if (!sameRays || previous.originZ !== origin.z || previous.strideZ !== strideZ) {
      for (let row = 0; row < rays.height; row++)
        fillCrossings(z, row * strideZ, strideZ, origin.z, rays.rows[row * 2], rays.rows[row * 2 + 1]);
    }
    const result = {
      originX: origin.x,
      originY: origin.y,
      originZ: origin.z,
      angle: rays.angle,
      fov: rays.fov,
      width: rays.width,
      height: rays.height,
      strideX,
      strideY,
      strideZ,
      x,
      y,
      z
    };
    crossingScratch.set(owner, result);
    return result;
  }
  var cameraRayScratch = /* @__PURE__ */ new WeakMap();
  function cameraRays(camera, fov, width, height, depth) {
    if ((camera.pitch ?? 0) !== 0) return null;
    const angle = camera.angle;
    let cached = cameraRayScratch.get(depth);
    if (cached && cached.width === width && cached.height === height && cached.angle === angle && cached.fov === fov) return cached;
    const a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const scale = Math.tan(fov * Math.PI / 360);
    const columns = cached?.columns.length === width * 4 ? cached.columns : new Float64Array(width * 4);
    const rows2 = cached?.rows.length === height * 2 ? cached.rows : new Float64Array(height * 2);
    const longitudes = cached?.longitudes.length === width ? cached.longitudes : new Float64Array(width);
    for (let x = 0; x < width; x++) {
      const u = (2 * x / width - 1) * scale, i = x * 4;
      const rx = ca - sa * u, ry = sa + ca * u;
      columns[i] = rx;
      columns[i + 1] = ry;
      columns[i + 2] = Math.abs(1 / rx);
      columns[i + 3] = Math.abs(1 / ry);
      longitudes[x] = Math.atan2(ry, rx);
    }
    for (let y = 0; y < height; y++) {
      const rz = (height / 2 - y - 0.5) / height;
      rows2[y * 2] = rz;
      rows2[y * 2 + 1] = Math.abs(1 / rz);
    }
    cached = { width, height, angle, fov, columns, rows: rows2, longitudes };
    cameraRayScratch.set(depth, cached);
    return cached;
  }
  var chunkBoundsCache = /* @__PURE__ */ new WeakMap();
  function solidChunkBounds(store) {
    const cached = chunkBoundsCache.get(store);
    if (cached?.revision === store.revision) return cached.bounds;
    const bounds = [];
    for (const [id, blocks] of store.raw) {
      let x0 = 4, y0 = 4, z0 = 4, x1 = 0, y1 = 0, z1 = 0;
      for (let i = 0; i < 64; i++) {
        if (!blocks[i]) continue;
        const x2 = i & 3, y2 = i >> 2 & 3, z2 = i >> 4;
        x0 = Math.min(x0, x2);
        y0 = Math.min(y0, y2);
        z0 = Math.min(z0, z2);
        x1 = Math.max(x1, x2 + 1);
        y1 = Math.max(y1, y2 + 1);
        z1 = Math.max(z1, z2 + 1);
      }
      const x = id % store.cw * 4;
      const y = Math.floor(id / store.cw) % store.ch * 4;
      const z = Math.floor(id / (store.cw * store.ch)) * 4;
      bounds.push(x + x0, y + y0, z + z0, x + x1, y + y1, z + z1);
    }
    chunkBoundsCache.set(store, { revision: store.revision, bounds });
    return bounds;
  }
  var visibilityScratch = /* @__PURE__ */ new WeakMap();
  function visibleVoxelTiles(store, origin, ca, sa, cp, sp, c, s, fovScale, width, height, depth) {
    const tileWidth = Math.ceil(width / 8), tileHeight = Math.ceil(height / 8);
    let tiles = visibilityScratch.get(depth);
    if (tiles?.length !== tileWidth * tileHeight) {
      tiles = new Uint8Array(tileWidth * tileHeight);
      visibilityScratch.set(depth, tiles);
    } else tiles.fill(0);
    const bounds = solidChunkBounds(store);
    for (let i = 0; i < bounds.length; i += 6) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let near = Infinity, far = -Infinity;
      let outside = 15;
      for (let corner = 0; corner < 8; corner++) {
        const x = bounds[i + (corner & 1 ? 3 : 0)] - origin.x;
        const localY = bounds[i + (corner & 2 ? 4 : 1)] - origin.y;
        const localZ = bounds[i + (corner & 4 ? 5 : 2)] - origin.z;
        const y = c * localY - s * localZ, z = s * localY + c * localZ;
        const heading = x * ca + y * sa;
        const forward = cp * heading + sp * z;
        near = Math.min(near, forward);
        far = Math.max(far, forward);
        const side = -sa * x + ca * y, up = cp * z - sp * heading;
        outside &= (side < -fovScale * forward - 1e-7 ? 1 : 0) | (side > fovScale * forward + 1e-7 ? 2 : 0) | (up < -0.5 * forward - 1e-7 ? 4 : 0) | (up > 0.5 * forward + 1e-7 ? 8 : 0);
        if (forward <= 1e-7) continue;
        const px = (1 + side / (forward * fovScale)) * width / 2;
        const py = height / 2 - 0.5 - up / forward * height;
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
      if (outside || far < -1e-7) continue;
      if (near <= 1e-7) return void 0;
      const left = Math.max(0, Math.floor((minX - 1) / 8));
      const right = Math.min(tileWidth - 1, Math.floor((maxX + 1) / 8));
      const top = Math.max(0, Math.floor((minY - 1) / 8));
      const bottom = Math.min(tileHeight - 1, Math.floor((maxY + 1) / 8));
      if (left > right) continue;
      for (let row = top; row <= bottom; row++) {
        tiles.fill(1, row * tileWidth + left, row * tileWidth + right + 1);
      }
    }
    return tiles;
  }
  function renderVoxels(world, camera, textures, sky, fov, width, height, buffer, depth, time, preparedChunks, preserveBackdrop = false) {
    const pose = camera.terrainPose;
    const eye = (camera.z ?? 0) + 1.25, a = camera.angle * Math.PI / 180, p = (camera.pitch ?? 0) * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(p), sp = Math.sin(p);
    const scale = Math.tan(fov * Math.PI / 360);
    if (![camera.x, camera.y, eye, camera.angle, camera.pitch ?? 0].every(Number.isFinite) || Math.abs(camera.pitch ?? 0) > 85) {
      throw new Error("Voxel camera must be finite, with pitch between -85 and 85 degrees");
    }
    if (pose) {
      if (!Array.isArray(pose.pivot) || pose.pivot.length !== 2 || !Array.isArray(pose.position) || pose.position.length !== 2 || ![...pose.pivot, ...pose.position, pose.angle].every(Number.isFinite)) {
        throw new Error("Voxel terrain pose needs finite Y/Z pivot and position pairs and an angle");
      }
      world = validateWorld(pose.world);
      preparedChunks = void 0;
    }
    const materialTextures = world.materials.map((name2) => {
      const texture = textures[name2];
      if (!texture) throw new Error(`Unknown voxel material texture: ${name2}`);
      return texture;
    });
    const sourceStore = chunkStore(world);
    sourceStore?.prepareRenderCells();
    const cells = sourceStore?.renderCells ?? world.cells;
    const sparseStore = sourceStore?.renderCells ? void 0 : sourceStore;
    const origin = { x: camera.x, y: camera.y, z: eye };
    const theta = (pose?.angle ?? 0) * Math.PI / 180, c = Math.cos(theta), s = Math.sin(theta);
    if (pose) {
      const y = origin.y - pose.position[0], z = origin.z - pose.position[1];
      origin.y = pose.pivot[0] + c * y + s * z;
      origin.z = pose.pivot[1] - s * y + c * z;
    }
    const rays = cameraRays(camera, fov, width, height, depth);
    const needsTerrainEntry = origin.x <= 0 || origin.x >= world.width || origin.y <= 0 || origin.y >= world.height || origin.z <= 0 || origin.z >= world.depth;
    const hitOutput = { x: 0, y: 0, z: 0, block: 0, distance: 0, face: 0 };
    const maxDistance = Math.min(Math.hypot(world.width, world.height, world.depth), world.renderDistance ?? Infinity);
    const occupancy = preparedChunks ?? prepareVoxelChunks(world);
    const chunks = (!pose || Math.min(world.width, world.height, world.depth) > 8) && occupancy.count < occupancy.width * occupancy.height * occupancy.depth * 0.6 ? occupancy : void 0;
    const crossings = !pose && !needsTerrainEntry && rays && chunks && world.width <= 256 && world.height <= 256 ? rayCrossings(world, origin, rays, depth) : void 0;
    const visibleTiles = sourceStore && sourceStore.raw.size <= 1024 ? visibleVoxelTiles(sourceStore, origin, ca, sa, cp, sp, c, s, scale, width, height, depth) : void 0;
    const tileWidth = Math.ceil(width / 8);
    const horizon = sky ? (4278190080 | sky.horizon) >>> 0 : 4281608224;
    for (let y = 0; y < height; y++) {
      const tileRow = (y >> 3) * tileWidth;
      const v = (height / 2 - y - 0.5) / height;
      const rz = rays ? rays.rows[y * 2] : sp + cp * v;
      const dz = rays ? rays.rows[y * 2 + 1] : Math.abs(1 / rz);
      for (let x = 0; x < width; x++) {
        const i = y * width + x, r = x * 4;
        const u = (2 * x / width - 1) * scale;
        const rx = rays ? rays.columns[r] : ca * cp - sa * u - ca * sp * v;
        const ry = rays ? rays.columns[r + 1] : sa * cp + ca * u - sa * sp * v;
        const dx = rays ? rays.columns[r + 2] : Math.abs(1 / rx);
        const dy = rays ? rays.columns[r + 3] : Math.abs(1 / ry);
        const localY = pose ? c * ry + s * rz : ry;
        const localZ = pose ? -s * ry + c * rz : rz;
        const hit = occupancy.count === 0 || visibleTiles && !visibleTiles[tileRow + (x >> 3)] ? null : needsTerrainEntry ? traceTerrainPose(world, cells, sparseStore, origin, rx, localY, localZ, maxDistance, hitOutput, chunks) : traceVoxelRay(
          world,
          cells,
          sparseStore,
          origin.x,
          origin.y,
          origin.z,
          rx,
          localY,
          localZ,
          dx,
          pose ? Math.abs(1 / localY) : dy,
          pose ? Math.abs(1 / localZ) : dz,
          maxDistance,
          hitOutput,
          chunks,
          crossings,
          x,
          y
        );
        if (!hit) {
          depth[i] = Infinity;
          if (!preserveBackdrop) {
            buffer[i] = sky && (rz > 0 || sky.below !== void 0) ? skyPixel(sky, rays ? rays.longitudes[x] : Math.atan2(ry, rx), Math.max(-1, Math.min(1, rz)), time) : horizon;
          }
        } else {
          depth[i] = hit.distance;
          const texture = materialTextures[hit.block - 1];
          const pointU = hit.face === 0 ? origin.y + localY * hit.distance : origin.x + rx * hit.distance;
          const pointV = hit.face === 2 ? origin.y + localY * hit.distance : origin.z + localZ * hit.distance;
          const tx = wrappedTexel(pointU, texture.width);
          const ty = wrappedTexel(pointV, texture.height);
          const color = texture.pixels[ty * texture.width + tx];
          const shade3 = hit.face === 0 ? sideShade : frontShade;
          buffer[i] = hit.face === 2 ? (4278190080 | color) >>> 0 : (4278190080 | shade3[color & 255] | shade3[color >>> 8 & 255] << 8 | shade3[color >>> 16 & 255] << 16) >>> 0;
        }
      }
    }
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
        const keys2 = scope ? Object.keys(scope).filter(
          (k) => k !== "this" && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(k)
        ) : [];
        const vals = keys2.map((k) => scope[k]);
        return new Function(...keys2, `return (${trimmed});`)(...vals);
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
          for (const [header3, value2] of Object.entries(item)) {
            const name2 = header3.toLowerCase();
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
  function reportFetchFailure(error, onError) {
    const message = error instanceof Error ? error.message : String(error);
    if (onError) deliver(onError, { status: error instanceof FetchError ? error.status : 0, message });
    else console.warn(message);
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

  // src/music_clock.ts
  var MusicClock = class {
    constructor(time, bpm, beat = 0) {
      this.marks = [{ time, bpm, beat }];
    }
    at(position, key2) {
      let i = this.marks.length - 1;
      while (i > 0 && this.marks[i][key2] > position) i--;
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
          const pitch = tokenPitches(span.token)[index2];
          if (pitch) part.push({ ...span, token: pitch });
        }
        return serializeMeasure(part, barTicks, false);
      }).join(" | "));
    });
  }
  function studioTrackPatterns(score, barTicks, bars) {
    return studioScoreLanes(score, barTicks).map((lane) => studioTrackPattern(lane, barTicks, bars));
  }
  function pitchKey(pitch) {
    const match = /^([A-G])([#b]?)(\d+)$/i.exec(pitch);
    if (!match) return pitch.toLowerCase();
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
  function configureAudioHost(options) {
    syncPageAudio = options.syncPage;
    playbackUnlocked = !options.deferPlayback;
    pendingMusic = null;
    audioSync.configure({ getAudioContext: () => audioCtx, syncPage: syncPageAudio });
  }
  function unlockAudio() {
    playbackUnlocked = true;
    const context = getAudioContext();
    const track = pendingMusic;
    pendingMusic = null;
    if (track) playMusic(track.track, track.beat);
    return context;
  }
  function setAudioMuted(muted) {
    audioMuted = muted;
    if (masterGain && audioCtx) masterGain.gain.setValueAtTime(muted ? 0 : 1, audioCtx.currentTime);
  }
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
    const noise3 = ctx2.createBufferSource();
    noise3.buffer = buffer;
    const filter = ctx2.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, filterStart), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);
    const gain = ctx2.createGain();
    sweepEnvelope(gain.gain, now, duration, volume, attack);
    noise3.connect(filter);
    filter.connect(gain);
    gain.connect(sfxOutput(ctx2));
    noise3.start(now);
    noise3.stop(now + duration + 0.01);
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
    const noise3 = ctx2.createBufferSource();
    noise3.buffer = buffer;
    const filter = ctx2.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, filterStart), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);
    const gain = ctx2.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
    noise3.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise3.start(now);
    noise3.stop(now + duration + 0.01);
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
      (error) => withContext(context, () => reportFetchFailure(error, pending.onError))
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
        beats = fixedBars ? 4 : beatsPerBar;
      } else if (fixedBars) {
        beats = 4 / Number(dur.slice(1));
        lenLabel = Math.round(beats * 4) + "/16";
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
      const matrixWidth = Math.max(fixedBars ? 1 : 34, Math.round(beats * 120) - 4);
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
  var STUDIO_VOICES = ["lead", "bass", "chords", "drums"];
  var STUDIO_PITCHES = Object.keys(PITCH_ROWS).filter((pitch) => /^[A-G]#?\d$/.test(pitch)).sort((a, b) => PITCH_ROWS[a] - PITCH_ROWS[b]);
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
          const pitch = step.chord_notes[0];
          const result = placeStudioNote(score, barTicks, bars, {
            bar,
            tick,
            pitch,
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
  function selectStudioPosition(state, bar, tick, lane, select = true) {
    syncSequencerState(state);
    const selected = select ? state.active_steps.find((step) => !step.is_rest && !step.is_bar && step.bar_num === bar && step.lane === lane && step.matrix_bar_left === tick * STUDIO_TICK_WIDTH) : void 0;
    state.selected_step_id = selected?.id ?? -1;
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

  // src/pixel3d/grid.ts
  var shade = (c, f) => (4278190080 | Math.floor((c & 255) * f) | Math.floor((c >>> 8 & 255) * f) << 8 | Math.floor((c >>> 16 & 255) * f) << 16) >>> 0;
  var pack = (c) => (4278190080 | (c & 255) << 16 | c & 65280 | c >>> 16 & 255) >>> 0;
  function sample(surface, u, v) {
    if (typeof surface === "number") return (surface | 4278190080) >>> 0;
    const x = Math.floor(u * surface.width) & surface.width - 1;
    const y = Math.floor(v * surface.height) & surface.height - 1;
    return surface.pixels[y * surface.width + x];
  }
  function renderGrid(map, camera, textures, overrides, things, sprites, fov, width, height, buffer, depth, time) {
    const eye = camera.height ?? 0.5, pitch = (camera.pitch ?? 0) * Math.PI / 180;
    if (![camera.x, camera.y, camera.angle, eye, pitch].every(Number.isFinite) || eye <= 0 || Math.abs(pitch) > 85 * Math.PI / 180) {
      throw new Error("Grid camera must be finite, above the floor, with pitch between -85 and 85 degrees");
    }
    const angle = camera.angle * Math.PI / 180, dx = Math.cos(angle), dy = Math.sin(angle);
    const cp = Math.cos(pitch), sp = Math.sin(pitch), scale = Math.tan(fov * Math.PI / 360);
    const top = map.ceilingHeight ?? 1;
    const tiles = new Map(overrides.map((o) => [o.y * map.width + o.x, o.texture]));
    const billboards = things.filter((t) => t.sprite && !t.model && t.visible !== false);
    for (let y = 0; y < height; y++) {
      const v = ((height >> 1) - y - 0.5) / height;
      const rz = sp + cp * v;
      const plane = map.sky?.below === void 0 && rz < -1e-10 ? -eye / rz : !map.sky && rz > 1e-10 ? (top - eye) / rz : Infinity;
      const altitude = rz < 0 ? Math.max(-1, rz) : Math.min(1, rz * 2);
      for (let x = 0; x < width; x++) {
        const u = (2 * x / width - 1) * scale;
        const rx = dx * (cp - sp * v) - dy * u, ry = dy * (cp - sp * v) + dx * u;
        let hit = Infinity;
        let color = sample(map.ceiling, 0, 0);
        if (plane > 0 && Number.isFinite(plane)) {
          hit = plane;
          color = sample(rz < 0 ? map.floor : map.ceiling, camera.x + rx * hit, camera.y + ry * hit);
        }
        let mx = Math.floor(camera.x), my = Math.floor(camera.y), enter = 0, side = 2;
        const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
        const tx = Math.abs(1 / rx), ty = Math.abs(1 / ry);
        let nextX = rx === 0 ? Infinity : (rx < 0 ? camera.x - mx : mx + 1 - camera.x) * tx;
        let nextY = ry === 0 ? Infinity : (ry < 0 ? camera.y - my : my + 1 - camera.y) * ty;
        for (let steps = 0; steps < map.width + map.height + 4 && enter < hit; steps++) {
          if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) break;
          const cell = my * map.width + mx, wall = map.grid[cell];
          const exit = Math.min(nextX, nextY);
          if (wall > 0) {
            const a = rz === 0 ? -Infinity : (0 - eye) / rz;
            const b = rz === 0 ? Infinity : (top - eye) / rz;
            const near = Math.max(enter, Math.min(a, b), 1e-4);
            const far = Math.min(exit, Math.max(a, b));
            if ((rz !== 0 || eye <= top) && near <= far && near < hit) {
              hit = near;
              const hx = camera.x + rx * hit, hy = camera.y + ry * hit, hz = eye + rz * hit;
              const face = near > enter + 1e-8 ? 2 : side;
              const tex = textures[tiles.get(cell) ?? wall - 1];
              color = tex ? shade(sample(tex, face === 0 ? hy : hx, face === 2 ? hy : 1 - hz), face === 2 ? 1 : face === 0 ? 1 : 0.75) : 4281545523;
              break;
            }
          }
          if (nextX < nextY) {
            enter = nextX;
            nextX += tx;
            mx += sx;
            side = 0;
          } else {
            enter = nextY;
            nextY += ty;
            my += sy;
            side = 1;
          }
        }
        if (!Number.isFinite(hit) && map.sky) {
          color = skyPixel(map.sky, Math.atan2(ry, rx), altitude, time);
        }
        for (const thing of billboards) {
          const sprite = sprites[thing.sprite];
          if (!sprite) continue;
          const forward = (thing.x - camera.x) * dx + (thing.y - camera.y) * dy;
          const t = forward / (rx * dx + ry * dy);
          if (t <= 1e-3 || t >= hit) continue;
          const size = thing.scale ?? 1;
          const across = (camera.x + rx * t - thing.x) * -dy + (camera.y + ry * t - thing.y) * dx;
          const su = across / (size * sprite.width / sprite.height) + 0.5;
          const sv = 1 - (eye + rz * t - (thing.z ?? 0)) / size;
          if (su < 0 || su >= 1 || sv < 0 || sv >= 1) continue;
          const c = sprite.colors[sprite.pixels[Math.floor(sv * sprite.height) * sprite.width + Math.floor(su * sprite.width)]];
          if (c !== null && c !== void 0) {
            color = pack(c);
            hit = t;
          }
        }
        const index2 = y * width + x;
        buffer[index2] = color;
        depth[index2] = hit;
      }
    }
  }

  // src/pixel3d/enhanced_lighting.ts
  var TILE = 4;
  var GLASS_TINT = 15780225;
  var FALLBACK_HAZE = 4798522;
  function viewOf(camera, dirX, dirY, fov, rowOrigin) {
    const pitch = (camera.pitch ?? 0) * Math.PI / 180;
    return {
      x: camera.x,
      y: camera.y,
      z: camera.height ?? 0.5,
      dirX,
      dirY,
      cp: Math.cos(pitch),
      sp: Math.sin(pitch),
      fov,
      rowOrigin
    };
  }
  function blendColor(color, tint, alpha) {
    const red = color & 255, green = color >>> 8 & 255, blue = color >>> 16 & 255;
    return (4278190080 | red + ((tint & 255) - red) * alpha | green + ((tint >>> 8 & 255) - green) * alpha << 8 | blue + ((tint >>> 16 & 255) - blue) * alpha << 16) >>> 0;
  }
  function addColor(color, glow) {
    return (4278190080 | Math.min(255, (color & 255) + (glow & 255)) | Math.min(255, (color >>> 8 & 255) + (glow >>> 8 & 255)) << 8 | Math.min(255, (color >>> 16 & 255) + (glow >>> 16)) << 16) >>> 0;
  }
  function mixGlow(a, b, weight) {
    const other = 4 - weight;
    return (a & 16711935) * other + (b & 16711935) * weight >>> 2 & 16711935 | (a & 65280) * other + (b & 65280) * weight >>> 2 & 65280;
  }
  function blur(source, target, width, height, horizontal) {
    const stride = horizontal ? 1 : width;
    const length = horizontal ? width : height;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x, position = horizontal ? x : y;
        const a = position > 1 ? source[i - 2 * stride] : 0;
        const b = position > 0 ? source[i - stride] : 0;
        const c = source[i];
        const d = position + 1 < length ? source[i + stride] : 0;
        const e = position + 2 < length ? source[i + 2 * stride] : 0;
        const rb = (a & 16711935) + 2 * (b & 16711935) + 4 * (c & 16711935) + 2 * (d & 16711935) + (e & 16711935) >>> 0;
        const green = ((a >>> 8 & 255) + 2 * (b >>> 8 & 255) + 4 * (c >>> 8 & 255) + 2 * (d >>> 8 & 255) + (e >>> 8 & 255)) / 10;
        target[i] = (rb & 65535) / 10 | (green | 0) << 8 | ((rb >>> 16) / 10 | 0) << 16;
      }
    }
  }
  function makeGlass(thing, size) {
    const angle = (thing.angle ?? 0) * Math.PI / 180;
    const pitch = (thing.pitch ?? 0) * Math.PI / 180;
    const c = Math.cos(angle), s = Math.sin(angle), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = thing.scale ?? 1;
    return {
      x: thing.x,
      y: thing.y,
      z: thing.z ?? 0,
      ax: c * cp,
      ay: s * cp,
      az: -sp,
      bx: -s,
      by: c,
      halfA: size[0] * scale / 2,
      halfB: size[1] * scale / 2,
      scale
    };
  }
  var EnhancedLighting = class {
    constructor() {
      this.tileWidth = 0;
      this.tileHeight = 0;
      this.width = 0;
      this.height = 0;
      this.scratch = new Uint32Array(0);
      this.glow = new Uint32Array(0);
      this.paneDepth = new Float64Array(0);
      this.paneAlpha = new Uint8Array(0);
      this.panes = [];
      this.shadowCache = [];
      this.shadowList = [];
      this.emission = { width: 0, pixels: new Int32Array(0), depths: new Float64Array(0), colors: new Uint32Array(0) };
    }
    begin(width, height) {
      if (this.width !== width || this.height !== height) {
        this.width = width;
        this.height = height;
        this.tileWidth = Math.ceil(width / TILE);
        this.tileHeight = Math.ceil(height / TILE);
        const count = this.tileWidth * this.tileHeight;
        this.emission = {
          width: this.tileWidth,
          pixels: new Int32Array(count),
          depths: new Float64Array(count),
          colors: new Uint32Array(count)
        };
        this.scratch = new Uint32Array(count);
        this.glow = new Uint32Array(count);
        this.paneDepth = new Float64Array(count);
        this.paneAlpha = new Uint8Array(count);
      }
      this.panes.length = 0;
      this.paneDepth.fill(Infinity);
      this.paneAlpha.fill(0);
      this.emission.colors.fill(0);
      return this.emission;
    }
    rememberGlass(thing, model) {
      if (model.glass && (thing.dissolve ?? 0) < 1) this.panes.push(makeGlass(thing, model.glass));
    }
    /** The backdrop is composed while its own depth is still available. */
    backdrop(buffer, depth) {
      if (this.buildGlow(depth)) this.combine(buffer, depth, true, 0);
      this.emission.colors.fill(0);
    }
    buildGlow(depth) {
      const { colors, pixels, depths } = this.emission;
      let any = false;
      for (let i = 0; i < colors.length; i++) {
        if (!colors[i]) continue;
        if (depth[pixels[i]] !== depths[i]) colors[i] = 0;
        else any = true;
      }
      if (!any) return false;
      blur(colors, this.scratch, this.tileWidth, this.tileHeight, true);
      blur(this.scratch, this.glow, this.tileWidth, this.tileHeight, false);
      return true;
    }
    finish(buffer, depth, camera, dirX, dirY, fov, rowOrigin, world, things, models, horizon) {
      const view = viewOf(camera, dirX, dirY, fov, rowOrigin);
      if (world) this.shadows(buffer, depth, view, world, things, models);
      for (const pane of this.panes) this.tintPane(view, pane);
      const haze = world ? Math.max(0, Math.min(1, (Math.abs(dirX) - 0.35) / 0.4)) * Math.max(0, Math.min(1, (0.8 - Math.abs(view.sp)) / 0.25)) : 0;
      this.combine(buffer, depth, this.buildGlow(depth), haze, horizon);
    }
    prepareDeferred(depth, camera, dirX, dirY, fov, rowOrigin, world, things, models, horizon) {
      const view = viewOf(camera, dirX, dirY, fov, rowOrigin);
      for (const pane of this.panes) this.tintPane(view, pane);
      const { colors, pixels, depths } = this.emission;
      for (let i = 0; i < colors.length; i++) {
        if (colors[i] && depth[pixels[i]] !== depths[i]) colors[i] = 0;
      }
      return {
        emission: this.emission,
        tileWidth: this.tileWidth,
        tileHeight: this.tileHeight,
        paneDepth: this.paneDepth,
        paneAlpha: this.paneAlpha,
        shadows: world ? this.shadowPlanes(world, things, models) : [],
        haze: world ? Math.max(0, Math.min(1, (Math.abs(dirX) - 0.35) / 0.4)) * Math.max(0, Math.min(1, (0.8 - Math.abs(view.sp)) / 0.25)) : 0,
        horizon: horizon ?? FALLBACK_HAZE
      };
    }
    combine(buffer, depth, bloom, haze, horizon) {
      const width = this.width, height = this.height;
      const hazeTint = horizon ?? FALLBACK_HAZE;
      const glass = this.panes.length > 0;
      if (!glass && !bloom && !haze) return;
      const tileWidth = this.tileWidth;
      for (let y = 0; y < height; y++) {
        const row = y * width, blockY = y >> 2, tileRow = blockY * tileWidth;
        const nextRow = Math.min(this.tileHeight - 1, blockY + 1) * tileWidth;
        const yWeight = y & 3;
        let nearGlow = bloom ? mixGlow(this.glow[tileRow], this.glow[nextRow], yWeight) : 0;
        for (let left = 0; left < width; left += TILE) {
          const blockX = left >> 2, tile = tileRow + blockX;
          const nextX = Math.min(tileWidth - 1, blockX + 1);
          const startGlow = nearGlow;
          const farGlow = bloom ? mixGlow(this.glow[tileRow + nextX], this.glow[nextRow + nextX], yWeight) : 0;
          nearGlow = farGlow;
          const tint = glass ? this.paneAlpha[tile] : 0;
          if (!startGlow && !farGlow && !tint && !haze) continue;
          const paneDepth = tint ? this.paneDepth[tile] : Infinity;
          const end = row + Math.min(width, left + TILE);
          for (let i = row + left; i < end; i++) {
            let pixel = buffer[i];
            const distance = depth[i];
            if (haze && distance > 22 && distance < Infinity) {
              pixel = blendColor(pixel, hazeTint, haze * Math.min(0.3, (distance - 22) * 8e-3));
            }
            if (distance > paneDepth + 1e-5) pixel = blendColor(pixel, GLASS_TINT, tint / 255);
            const glow = startGlow || farGlow ? mixGlow(startGlow, farGlow, i - row - left) : 0;
            buffer[i] = glow ? addColor(pixel, glow) : pixel;
          }
        }
      }
    }
    bounds(view, plane, cell) {
      const corners = [];
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const dx = plane.x - view.x + a * plane.ax * plane.halfA + b * plane.bx * plane.halfB;
        const dy = plane.y - view.y + a * plane.ay * plane.halfA + b * plane.by * plane.halfB;
        const dz = plane.z - view.z + a * plane.az * plane.halfA;
        const heading = dx * view.dirX + dy * view.dirY;
        corners.push([-dx * view.dirY + dy * view.dirX, dz * view.cp - heading * view.sp, heading * view.cp + dz * view.sp]);
      }
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      const near = 0.1;
      for (let i = 0; i < 4; i++) {
        let [side, up, forward] = corners[i];
        if (forward < near) continue;
        for (let neighbor = -1; neighbor <= 1; neighbor += 2) {
          left = Math.min(left, this.width / 2 * (1 + side / (forward * view.fov)));
          right = Math.max(right, this.width / 2 * (1 + side / (forward * view.fov)));
          top = Math.min(top, view.rowOrigin - up / forward * this.height - 0.5);
          bottom = Math.max(bottom, view.rowOrigin - up / forward * this.height - 0.5);
          const [nextSide, nextUp, nextForward] = corners[(i + neighbor + 4) % 4];
          if (nextForward >= near) continue;
          const t = (near - forward) / (nextForward - forward);
          side += (nextSide - side) * t;
          up += (nextUp - up) * t;
          forward = near;
          left = Math.min(left, this.width / 2 * (1 + side / (forward * view.fov)));
          right = Math.max(right, this.width / 2 * (1 + side / (forward * view.fov)));
          top = Math.min(top, view.rowOrigin - up / forward * this.height - 0.5);
          bottom = Math.max(bottom, view.rowOrigin - up / forward * this.height - 0.5);
          [side, up, forward] = corners[i];
        }
      }
      const x0 = Math.max(0, Math.floor(left / cell));
      const y0 = Math.max(0, Math.floor(top / cell));
      const x1 = Math.min(Math.ceil(this.width / cell), Math.ceil(right / cell) + 1);
      const y1 = Math.min(Math.ceil(this.height / cell), Math.ceil(bottom / cell) + 1);
      if (x0 < x1 && y0 < y1) return [x0, y0, x1, y1];
    }
    tintPane(view, plane) {
      const bounds = this.bounds(view, plane, TILE);
      if (!bounds) return;
      const [left, top, right, bottom] = bounds;
      const nx = -plane.az * plane.by, ny = plane.az * plane.bx;
      const nz = plane.ax * plane.by - plane.ay * plane.bx;
      const ox = view.x - plane.x, oy = view.y - plane.y, oz = view.z - plane.z;
      const offset = -(ox * nx + oy * ny + oz * nz);
      const startA = ox * plane.ax + oy * plane.ay + oz * plane.az;
      const startB = ox * plane.bx + oy * plane.by;
      const edgeWidth = 0.26 * plane.scale;
      for (let y = top; y < bottom; y++) {
        const up = (view.rowOrigin - (y * TILE + TILE / 2) - 0.5) / this.height;
        const heading = view.cp - view.sp * up, rz = view.sp + view.cp * up;
        for (let x = left; x < right; x++) {
          const side = (2 * (x * TILE + TILE / 2) / this.width - 1) * view.fov;
          const rx = view.dirX * heading - view.dirY * side, ry = view.dirY * heading + view.dirX * side;
          const rate = rx * nx + ry * ny + rz * nz;
          const distance = offset / rate;
          const i = y * this.tileWidth + x;
          if (!(distance > 0.1 && distance < this.paneDepth[i])) continue;
          const a = startA + distance * (rx * plane.ax + ry * plane.ay + rz * plane.az);
          const b = startB + distance * (rx * plane.bx + ry * plane.by);
          const edge = Math.min(plane.halfA - Math.abs(a), plane.halfB - Math.abs(b));
          if (edge < 0) continue;
          const grazing = Math.max(0, 1 - Math.abs(rate));
          const rim = Math.max(0, 1 - edge / edgeWidth);
          this.paneDepth[i] = distance;
          this.paneAlpha[i] = 10 + 23 * grazing * grazing + (22 + 28 * grazing) * rim;
        }
      }
    }
    shadowPlanes(world, things, models) {
      var _a;
      const shadows = this.shadowList;
      shadows.length = 0;
      for (const thing of things) {
        const radius = thing.model && models[thing.model]?.contactShadow;
        if (!radius || thing.visible === false || (thing.dissolve ?? 0) >= 1 || thing.z === void 0) continue;
        let floor, onGlass = false;
        for (const pane of this.panes) {
          if (Math.abs(pane.az) > 0.01 || thing.z < pane.z - 0.05 || thing.z > pane.z + 1.65) continue;
          const dx = thing.x - pane.x, dy = thing.y - pane.y;
          if (Math.abs(dx * pane.ax + dy * pane.ay) <= pane.halfA && Math.abs(dx * pane.bx + dy * pane.by) <= pane.halfB) {
            floor = pane.z + 0.02;
            onGlass = true;
            break;
          }
        }
        if (floor === void 0) {
          const below = Math.floor(thing.z - 0.05);
          for (let z = below; z >= Math.max(0, below - 2); z--) {
            if (voxelGet(world, Math.floor(thing.x), Math.floor(thing.y), z)) {
              floor = z + 1;
              break;
            }
          }
        }
        if (floor === void 0) continue;
        const scale = thing.scale ?? 1, halfA = radius * scale, halfB = halfA * 0.77;
        const strength = 0.33 * Math.max(0, 1 - (thing.z - floor) * 0.6) * (1 - (thing.dissolve ?? 0));
        const index2 = shadows.length;
        const shadow = (_a = this.shadowCache)[index2] ?? (_a[index2] = { x: 0, y: 0, z: 0, halfA: 0, halfB: 0, strength: 0, onGlass: false });
        shadow.x = thing.x;
        shadow.y = thing.y;
        shadow.z = floor;
        shadow.halfA = halfA;
        shadow.halfB = halfB;
        shadow.strength = strength;
        shadow.onGlass = onGlass;
        shadows.push(shadow);
      }
      return shadows;
    }
    shadows(buffer, depth, view, world, things, models) {
      for (const shadow of this.shadowPlanes(world, things, models)) {
        const { x: shadowX, y: shadowY, z: floor, halfA, halfB, strength, onGlass } = shadow;
        const bounds = this.bounds(view, {
          x: shadowX,
          y: shadowY,
          z: floor,
          ax: 1,
          ay: 0,
          az: 0,
          bx: 0,
          by: 1,
          halfA,
          halfB,
          scale: 1
        }, 1);
        if (!bounds) continue;
        const [left, top, right, bottom] = bounds;
        for (let y = top; y < bottom; y++) {
          const up = (view.rowOrigin - y - 0.5) / this.height;
          const rz = view.sp + view.cp * up;
          const distance = (floor - view.z) / rz;
          if (!(distance > 0.1)) continue;
          const heading = view.cp - view.sp * up;
          for (let x = left; x < right; x++) {
            const i = y * this.width + x;
            if (onGlass ? depth[i] < distance - 0.02 : Math.abs(depth[i] - distance) > 0.055) continue;
            const side = (2 * x / this.width - 1) * view.fov;
            const dx = (view.x - shadowX + distance * (view.dirX * heading - view.dirY * side)) / halfA;
            const dy = (view.y - shadowY + distance * (view.dirY * heading + view.dirX * side)) / halfB;
            const fade = 1 - dx * dx - dy * dy;
            if (fade > 0) buffer[i] = blendColor(buffer[i], 1050891, fade * strength);
          }
        }
      }
    }
  };

  // src/pixel3d/model.ts
  function shade2(color, factor) {
    return (4278190080 | Math.floor((color & 255) * factor) | Math.floor((color >>> 8 & 255) * factor) << 8 | Math.floor((color >>> 16 & 255) * factor) << 16) >>> 0;
  }
  function fragmentNoise(x, y) {
    const hash = Math.imul(Math.floor(x / 2), 73856093) ^ Math.imul(Math.floor(y / 2), 19349663);
    return (Math.imul(hash ^ hash >>> 13, 1274126177) >>> 0) / 4294967296;
  }
  var geometryCache = /* @__PURE__ */ new WeakMap();
  function geometry(block) {
    let cached = geometryCache.get(block);
    if (!cached || block.from[0] !== cached.from[0] || block.from[1] !== cached.from[1] || block.from[2] !== cached.from[2] || block.size[0] !== cached.size[0] || block.size[1] !== cached.size[1] || block.size[2] !== cached.size[2]) {
      const [x, y, z] = block.from, [w, h, d] = block.size;
      cached = {
        from: [x, y, z],
        size: [w, h, d],
        max: [x + w, y + h, z + d],
        center: [x + w / 2, y + h / 2, z + d / 2]
      };
      geometryCache.set(block, cached);
    }
    return cached;
  }
  function renderModel(model, instance, camera, dirX, dirY, fovScale, width, height, buffer, depth, emission, haze = 0, hazeColor = 0) {
    const scale = instance.scale ?? 1;
    const dissolve = instance.dissolve ?? 0;
    if (!Number.isFinite(dissolve) || dissolve < 0 || dissolve > 1) throw new Error("Model dissolve must be between 0 and 1");
    if (!Number.isFinite(scale) || scale <= 0) throw new Error("Model scale must be finite and positive");
    if (![instance.x, instance.y, instance.z ?? 0, instance.angle ?? 0, instance.pitch ?? 0].every(Number.isFinite)) {
      throw new Error("Model position and angle must be finite");
    }
    if (dissolve === 1) return;
    const angle = (instance.angle ?? 0) * Math.PI / 180;
    const eye = camera.height ?? 0.5, pitch = (camera.pitch ?? 0) * Math.PI / 180;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const c = Math.cos(angle), s = Math.sin(angle);
    const tilt = instance.axisTilt ?? (instance.pitch ?? 0) * Math.PI / 180, axialScale = instance.axialScale ?? 1;
    const oriented = tilt !== 0 || axialScale !== 1;
    const tc = oriented ? Math.cos(tilt) : 1, ts = oriented ? Math.sin(tilt) : 0;
    const ox = camera.x - instance.x, oy = camera.y - instance.y;
    const origin = [(ox * c + oy * s) / scale, (-ox * s + oy * c) / scale, (eye - (instance.z ?? 0)) / scale];
    if (oriented) {
      const [x, , z] = origin;
      origin[0] = x * tc - z * ts;
      origin[2] = (x * ts + z * tc) / axialScale;
    }
    for (const block of model.blocks) {
      const { max, center } = geometry(block);
      let left = width, right = 0, top = height, bottom = 0, clipped = false, frontCorners = 0;
      let outsideLeft = 0, outsideRight = 0, outsideTop = 0, outsideBottom = 0;
      for (let corner = 0; corner < 8; corner++) {
        let lx = (corner & 1 ? max[0] : block.from[0]) * scale;
        const ly = (corner & 2 ? max[1] : block.from[1]) * scale;
        let z = (corner & 4 ? max[2] : block.from[2]) * scale;
        if (oriented) {
          const x2 = lx, height2 = z * axialScale;
          lx = x2 * tc + height2 * ts;
          z = -x2 * ts + height2 * tc;
        }
        z += instance.z ?? 0;
        const x = instance.x + lx * c - ly * s - camera.x;
        const y = instance.y + lx * s + ly * c - camera.y;
        const forward = x * dirX + y * dirY;
        const d = forward * cp + (z - eye) * sp;
        const side = -x * dirY + y * dirX;
        const up = (z - eye) * cp - forward * sp;
        if (side < -d * fovScale - 1e-9) outsideLeft++;
        if (side > d * fovScale + 1e-9) outsideRight++;
        if (up > d * ((height >> 1) / height) + 1e-9) outsideTop++;
        if (up < -d * ((height - (height >> 1)) / height) - 1e-9) outsideBottom++;
        if (d <= 1e-3) {
          clipped = true;
          continue;
        }
        frontCorners++;
        const sx = width / 2 * (1 + side / (d * fovScale));
        const sy = (height >> 1) - up * height / d;
        left = Math.min(left, sx);
        right = Math.max(right, sx);
        top = Math.min(top, sy);
        bottom = Math.max(bottom, sy);
      }
      if (frontCorners === 0 || outsideLeft === 8 || outsideRight === 8 || outsideTop === 8 || outsideBottom === 8) continue;
      const color = haze > 0 ? blendColor(block.color, hazeColor, haze) : block.color;
      const colorX = shade2(color, 0.8), colorY = shade2(color, 0.65), colorZ = shade2(color, 1);
      const emitter = emission && block.emissive ? emission : void 0;
      const emissiveColor = block.color & 16777215;
      const x0 = clipped ? 0 : Math.max(0, Math.floor(left));
      const x1 = clipped ? width : Math.min(width, Math.ceil(right));
      const y0 = clipped ? 0 : Math.max(0, Math.floor(top));
      const y1 = clipped ? height : Math.min(height, Math.ceil(bottom));
      for (let x = x0; x < x1; x++) {
        const cx = 2 * x / width - 1;
        for (let y = y0; y < y1; y++) {
          if (dissolve > 0 && fragmentNoise(x, y) < dissolve) continue;
          const v = ((height >> 1) - y - 0.5) / height;
          const rx = dirX * cp - dirY * fovScale * cx - dirX * sp * v;
          const ry = dirY * cp + dirX * fovScale * cx - dirY * sp * v;
          let rayX = (rx * c + ry * s) / scale;
          const rayY = (-rx * s + ry * c) / scale;
          let rayZ = (sp + cp * v) / scale;
          if (oriented) {
            const x2 = rayX;
            rayX = x2 * tc - rayZ * ts;
            rayZ = (x2 * ts + rayZ * tc) / axialScale;
          }
          let near = -Infinity, far = Infinity, face = 0, exitFace = 0, valid = true;
          for (let axis = 0; axis < 3; axis++) {
            const component = axis === 0 ? rayX : axis === 1 ? rayY : rayZ;
            if (Math.abs(component) < 1e-12) {
              if (origin[axis] < block.from[axis] || origin[axis] > max[axis]) valid = false;
            } else {
              const a = (block.from[axis] - origin[axis]) / component;
              const b = (max[axis] - origin[axis]) / component;
              const entry = Math.min(a, b);
              if (entry > near) {
                near = entry;
                face = axis;
              }
              if (Math.max(a, b) < far) {
                far = Math.max(a, b);
                exitFace = axis;
              }
            }
          }
          let curvedShade;
          if (block.shape === "sphere" || block.shape === "cylinder") {
            const px = origin[0] - center[0], py = origin[1] - center[1], pz = origin[2] - center[2];
            const sphere = block.shape === "sphere", radius = block.size[0] / 2;
            const a = rayX * rayX + rayY * rayY + (sphere ? rayZ * rayZ : 0);
            const b = px * rayX + py * rayY + (sphere ? pz * rayZ : 0);
            const k = px * px + py * py + (sphere ? pz * pz : 0) - radius * radius;
            if (a < 1e-20) {
              if (k > 0) valid = false;
            } else {
              const discriminant = b * b - a * k;
              if (discriminant < 0) valid = false;
              else {
                const root = Math.sqrt(discriminant);
                near = Math.max(near, (-b - root) / a);
                far = Math.min(far, (-b + root) / a);
              }
            }
            const distance = near > 1e-3 ? near : far;
            const nx = px + rayX * distance, ny = py + rayY * distance, nz = pz + rayZ * distance;
            const cap = !sphere && Math.abs(Math.abs(nz) - block.size[2] / 2) < 1e-7;
            const normalLength = sphere ? radius : Math.hypot(nx, ny);
            const light = cap ? nz > 0 ? 0.75 : -0.75 : (-0.4 * nx - 0.5 * ny + (sphere ? 0.75 * nz : 0)) / normalLength;
            curvedShade = 0.55 + 0.45 * Math.max(0, light);
          } else if (block.shape === "ramp") {
            const slope = block.size[2] / block.size[0];
            const offset = origin[2] - block.from[2] - slope * (origin[0] - block.from[0]);
            const rate = rayZ - slope * rayX;
            if (Math.abs(rate) < 1e-12) {
              if (offset > 0) valid = false;
            } else if (rate < 0 && -offset / rate > near) {
              near = -offset / rate;
              face = 3;
            } else if (rate > 0 && -offset / rate < far) {
              far = -offset / rate;
              exitFace = 3;
            }
          }
          const index2 = y * width + x;
          const hit = near > 1e-3 ? near : far;
          if (near <= 1e-3) face = exitFace;
          if (valid && far >= near && hit > 1e-3 && hit < depth[index2]) {
            depth[index2] = hit;
            buffer[index2] = curvedShade !== void 0 ? shade2(color, curvedShade) : face === 3 ? shade2(color, 0.9) : face === 2 ? colorZ : face === 0 ? colorX : colorY;
            if (emitter) {
              const tile = (y >> 2) * emitter.width + (x >> 2);
              if (!emitter.colors[tile] || hit < emitter.depths[tile]) {
                emitter.depths[tile] = hit;
                emitter.pixels[tile] = index2;
                emitter.colors[tile] = emissiveColor;
              }
            }
          }
        }
      }
    }
  }

  // src/pixel3d/on_screen_keyboard.ts
  var rows = [
    [..."QWERTYUIOP"],
    [..."ASDFGHJKL"],
    [..."ZXCVBNM"],
    [..."1234567890", "-", "'"],
    ["SHIFT", "SPACE", "DELETE", "CANCEL", "SAVE"]
  ];
  var keys = rows.flat();
  function validateKeyboard(value) {
    if (!value || typeof value.title !== "string" || typeof value.value !== "string" || !Number.isInteger(value.maxLength) || value.maxLength < 1 || value.maxLength > 128 || value.value.length > value.maxLength || !["submitAction", "cancelAction"].every((k) => typeof Reflect.get(value, k) === "string" && Reflect.get(value, k).length > 0) || value.changeAction !== void 0 && (typeof value.changeAction !== "string" || !value.changeAction) || value.width !== void 0 && (!Number.isInteger(value.width) || value.width < 240 || value.width > 640) || value.keyHeight !== void 0 && (!Number.isInteger(value.keyHeight) || value.keyHeight < 18 || value.keyHeight > 48) || value.gap !== void 0 && (!Number.isInteger(value.gap) || value.gap < 1 || value.gap > 12) || value.textScale !== void 0 && value.textScale !== 1 && value.textScale !== 2) {
      throw new Error("Pixel-3d keyboard needs text, bounded sizing, maxLength (1-128), and submit/cancel actions");
    }
  }
  var OnScreenKeyboard = class {
    constructor() {
      this.value = "";
      this.focus = 0;
      this.uppercase = false;
      this.pressed = /* @__PURE__ */ new Set();
      this.pads = /* @__PURE__ */ new Set();
    }
    seedController(held) {
      this.pads = new Set(held);
    }
    sync(config) {
      if (!config) {
        this.config = void 0;
        this.previousValue = void 0;
        this.pressed.clear();
        this.pads.clear();
        return;
      }
      if (!this.config || this.previousValue !== config.value) {
        this.value = config.value;
        if (!this.config) {
          this.focus = 0;
          this.uppercase = false;
          this.pressed.clear();
        }
      }
      this.config = config;
      this.previousValue = config.value;
    }
    move(dx, dy) {
      let start = 0, row = 0;
      while (this.focus >= start + rows[row].length) {
        start += rows[row].length;
        row++;
      }
      const col = this.focus - start;
      if (dx) this.focus = start + (col + dx + rows[row].length) % rows[row].length;
      if (dy) {
        const next2 = (row + dy + rows.length) % rows.length;
        this.focus = rows.slice(0, next2).reduce((n, r) => n + r.length, 0) + Math.min(rows[next2].length - 1, Math.round(col * (rows[next2].length - 1) / Math.max(1, rows[row].length - 1)));
      }
    }
    activate(key2, invoke) {
      const config = this.config;
      if (!config) return;
      if (!keys.includes(key2)) throw new Error(`Unknown on-screen keyboard key: ${key2}`);
      if (key2 === "SAVE") {
        invoke(config.submitAction, [{ name: this.value }]);
        return;
      }
      if (key2 === "CANCEL") {
        invoke(config.cancelAction, []);
        return;
      }
      if (key2 === "SHIFT") {
        this.uppercase = !this.uppercase;
        return;
      }
      if (key2 === "DELETE") this.value = Array.from(this.value).slice(0, -1).join("");
      else {
        const text = key2 === "SPACE" ? " " : this.uppercase ? key2.toUpperCase() : key2.toLowerCase();
        if (this.value.length + text.length <= config.maxLength) this.value += text;
      }
      if (config.changeAction) invoke(config.changeAction, [{ name: this.value }]);
    }
    physical(key2, down, repeat, invoke) {
      if (!this.config) return false;
      const label = key2 === " " ? "SPACE" : key2 === "Backspace" || key2 === "Delete" ? "DELETE" : key2 === "Enter" ? "SAVE" : key2 === "Escape" ? "CANCEL" : key2 === "Shift" ? "SHIFT" : key2.toUpperCase();
      if (!down) {
        this.pressed.delete(label);
        return true;
      }
      this.pressed.add(label);
      if (key2.startsWith("Arrow")) {
        this.move(key2 === "ArrowLeft" ? -1 : key2 === "ArrowRight" ? 1 : 0, key2 === "ArrowUp" ? -1 : key2 === "ArrowDown" ? 1 : 0);
      } else if (key2 === "Enter") {
        if (!repeat) this.activate("SAVE", invoke);
      } else if (key2 === "Escape") {
        if (!repeat) this.activate("CANCEL", invoke);
      } else if (key2 === "Backspace" || key2 === "Delete") this.activate("DELETE", invoke);
      else if (key2.length === 1 && /^[a-zA-Z0-9 '\-]$/.test(key2)) {
        if (this.value.length < this.config.maxLength) {
          this.value += key2;
          if (this.config.changeAction) invoke(this.config.changeAction, [{ name: this.value }]);
        }
      }
      return true;
    }
    controller(pads, invoke) {
      const held = /* @__PURE__ */ new Set();
      for (const pad of pads) {
        if (!pad) continue;
        const buttons = [12, 13, 14, 15, 0, 1];
        for (const button of buttons) {
          if ((pad.buttons[button]?.value ?? 0) <= 0.5) continue;
          const id = `${pad.index}:${button}`;
          held.add(id);
          if (this.pads.has(id)) continue;
          if (button === 0) this.activate(keys[this.focus], invoke);
          else if (button === 1) this.activate("CANCEL", invoke);
          else this.move(button === 14 ? -1 : button === 15 ? 1 : 0, button === 12 ? -1 : button === 13 ? 1 : 0);
        }
        for (const [axis, negative, positive] of [[0, "left", "right"], [1, "up", "down"]]) {
          const value = pad.axes[axis] ?? 0;
          if (Math.abs(value) < 0.6) continue;
          const id = `${pad.index}:${value < 0 ? negative : positive}`;
          held.add(id);
          if (!this.pads.has(id)) this.move(axis === 0 ? Math.sign(value) : 0, axis === 1 ? Math.sign(value) : 0);
        }
      }
      this.pads = held;
    }
    render(canvas, theme) {
      if (!this.config) return;
      const c = this.config, layout = keyboardLayout(c, canvas.width, canvas.height);
      const bg = theme?.background ?? 860723, ink = theme?.text ?? 15858679;
      roundedRect(canvas, layout.x, layout.y, layout.width, layout.height, theme?.radius ?? 6, bg);
      canvas.rect(layout.x, layout.y, layout.width, 2, theme?.accent ?? 8185036);
      canvas.text(c.title.slice(0, Math.floor((layout.width - 72) / 8)), layout.x + 10, layout.y + 10, ink, 2);
      canvas.text(`${this.value.length}/${c.maxLength}`, layout.x + layout.width - 48, layout.y + 12, theme?.muted ?? 10665415);
      canvas.rect(layout.x + 10, layout.y + 28, layout.width - 20, 21, theme?.surface ?? 1587530);
      canvas.text((this.value || "_").slice(-Math.floor((layout.width - 32) / 8)), layout.x + 16, layout.y + 35, ink, 2);
      layout.cells.forEach((cell) => {
        const focused = cell.index === this.focus, pressed = this.pressed.has(cell.key);
        roundedRect(canvas, cell.x, cell.y, cell.w, cell.h, theme?.radius ?? 6, focused ? theme?.focus ?? 12845032 : theme?.border ?? 3560808);
        roundedRect(
          canvas,
          cell.x + 2,
          cell.y + 2,
          cell.w - 4,
          cell.h - 4,
          Math.max(0, (theme?.radius ?? 6) - 2),
          pressed ? theme?.accent ?? 8185036 : focused ? theme?.selected ?? 2512741 : theme?.surface ?? 1587530
        );
        const label = cell.key === "'" ? cell.w >= 20 ? "APOS" : "AP" : cell.key.length === 1 && !this.uppercase && !this.pressed.has("SHIFT") ? cell.key.toLowerCase() : cell.key;
        const scale = Math.min(c.textScale ?? 1, Math.floor((cell.w - 4) / (label.length * 4)) >= 2 ? 2 : 1);
        canvas.text(
          label,
          cell.x + Math.floor((cell.w - label.length * 4 * scale) / 2),
          cell.y + Math.floor((cell.h - 5 * scale) / 2),
          pressed ? bg : ink,
          scale
        );
      });
      canvas.text("D-PAD MOVE / A SELECT / B CANCEL", layout.x + 10, layout.y + layout.height - 12, theme?.muted ?? 10665415);
    }
    hits(width, height) {
      return this.config ? keyboardLayout(this.config, width, height).cells.map((cell) => ({
        x: cell.x,
        y: cell.y,
        w: cell.w,
        h: cell.h,
        action: "host.keyboard",
        args: [cell.key]
      })) : [];
    }
  };
  function keyboardLayout(config, W, H) {
    const width = Math.min(config.width ?? 480, W - 16), gap = config.gap ?? 4;
    const keyHeight = Math.max(12, Math.min(config.keyHeight ?? 28, Math.floor((H - 90 - gap * 4) / 5)));
    const height = 76 + keyHeight * 5 + gap * 4;
    const x = Math.floor((W - width) / 2), y = Math.max(8, H - height - 8);
    let index2 = 0;
    const cells = rows.flatMap((row, r) => {
      const w = Math.floor((width - 20 - gap * (row.length - 1)) / row.length);
      return row.map((key2) => ({ key: key2, index: index2++, x: x + 10 + row.indexOf(key2) * (w + gap), y: y + 56 + r * (keyHeight + gap), w, h: keyHeight }));
    });
    return { x, y, width, height, cells };
  }

  // src/pixel3d/hud.ts
  function validateHud(value, sprites = {}) {
    if (!value || typeof value !== "object") throw new Error("Pixel-3d ui must be a HUD object");
    const hud = value;
    if ((hud.keyboard || hud.buttons || hud.callout) && hud.style !== "floating") throw new Error("Pixel-3d keyboard, buttons and callouts require a floating HUD");
    if (hud.keyboard !== void 0) validateKeyboard(hud.keyboard);
    if (hud.buttons !== void 0 && (!Array.isArray(hud.buttons) || hud.buttons.length > 8 || hud.buttons.some((b) => !b || !["menu", "feed", "fish", "sound", "flower", "critter"].includes(b.icon) || !["top-right", "bottom-left"].includes(b.anchor) || typeof b.label !== "string" || !b.label || typeof b.action !== "string" || !b.action || b.offset !== void 0 && (!Number.isInteger(b.offset) || b.offset < 0 || b.offset > 640) || b.size !== void 0 && (!Number.isInteger(b.size) || b.size < 24 || b.size > 64) || b.disabled !== void 0 && typeof b.disabled !== "boolean" || b.selected !== void 0 && typeof b.selected !== "boolean"))) throw new Error("Pixel-3d HUD buttons need valid icons, anchors, actions and bounded sizes");
    if (hud.callout !== void 0) {
      const c = hud.callout;
      if (!c || typeof c.title !== "string" || !Array.isArray(c.lines) || c.lines.length > 6 || !c.lines.every((line) => typeof line === "string") || !c.target || ![c.target.x, c.target.y, c.target.z].every(Number.isFinite) || c.screen !== void 0 && (!c.screen || ![c.screen.x, c.screen.y].every(Number.isFinite)) || c.dismissAction !== void 0 && (typeof c.dismissAction !== "string" || !c.dismissAction) || c.width !== void 0 && (!Number.isInteger(c.width) || c.width < 140 || c.width > 400) || !Array.isArray(c.actions) || c.actions.length > 3 || !c.actions.every((a) => a && typeof a.label === "string" && typeof a.action === "string" && a.action)) {
        throw new Error("Pixel-3d HUD callout needs a world target, text and up to three actions");
      }
    }
    if (hud.theme !== void 0) {
      const theme = hud.theme;
      if (!theme || typeof theme !== "object" || Array.isArray(theme) || Object.entries(theme).some(([key2, color]) => key2 === "radius" ? !Number.isInteger(color) || color < 0 || color > 12 : !["background", "surface", "selected", "border", "text", "muted", "accent", "focus"].includes(key2) || !Number.isInteger(color) || color < 0 || color > 16777215)) {
        throw new Error("HUD theme needs RGB integer colors and an optional radius from 0 to 12");
      }
    }
    if (hud.cinema) {
      const c = hud.cinema;
      if (!Array.isArray(c.lines) || c.lines.length > 64 || !c.lines.every((line) => typeof line === "string" && line.length <= 80) || !Number.isFinite(c.offset) || Math.abs(c.offset) > 1e4 || ![1, 2].includes(c.scale ?? 2) || !Number.isFinite(c.top ?? 0.55) || !Number.isFinite(c.bottom ?? 0.94) || (c.top ?? 0.55) < 0 || (c.bottom ?? 0.94) > 1 || (c.top ?? 0.55) >= (c.bottom ?? 0.94) || !Number.isFinite(c.spacing ?? 18) || (c.spacing ?? 18) < 12 || (c.spacing ?? 18) > 48 || !Number.isFinite(c.fade ?? 0) || (c.fade ?? 0) < 0 || (c.fade ?? 0) > 1) throw new Error("HUD cinema needs bounded text, scroll offset, viewport, scale and fade");
    }
    if (hud.damageDirection !== void 0 && ![-1, 0, 1].includes(hud.damageDirection)) throw new Error("HUD damageDirection must be -1, 0 or 1");
    if (hud.map !== void 0) {
      const map = hud.map;
      if (!map || typeof map.current !== "string" || typeof map.expanded !== "boolean" || !Array.isArray(map.nodes) || map.nodes.length > 24 || !Array.isArray(map.links) || map.links.length > 48 || !map.nodes.every((n) => n && typeof n.id === "string" && typeof n.label === "string" && Number.isFinite(n.x) && n.x >= 0 && n.x <= 100 && Number.isFinite(n.y) && n.y >= 0 && n.y <= 100 && typeof n.visited === "boolean" && typeof n.locked === "boolean") || new Set(map.nodes.map((n) => n.id)).size !== map.nodes.length || !map.nodes.some((n) => n.id === map.current) || !map.links.every((l) => l && (l.shortcut === void 0 || typeof l.shortcut === "boolean") && map.nodes.some((n) => n.id === l.from) && map.nodes.some((n) => n.id === l.to))) throw new Error("HUD map needs unique positioned nodes, valid links and a current room");
    }
    if (hud.style !== void 0 && hud.style !== "floating") throw new Error("Pixel-3d ui style must be floating");
    if (hud.reticle !== void 0 && typeof hud.reticle !== "boolean") throw new Error("HUD reticle must be a boolean");
    if (hud.countdown !== void 0 && (hud.style !== "floating" || !Number.isFinite(hud.countdown) || hud.countdown < 0 || hud.countdown > 3599)) {
      throw new Error("Pixel-3d countdown needs floating HUD style and seconds from 0 to 3599");
    }
    if (hud.heading !== void 0 && typeof hud.heading !== "string") throw new Error("Pixel-3d ui heading must be a string");
    if (hud.textScale !== void 0 && hud.textScale !== 1 && hud.textScale !== 2) {
      throw new Error("Pixel-3d ui textScale must be 1 or 2");
    }
    if (!Array.isArray(hud.meters) || hud.meters.length > 3 || !hud.meters.every((m) => m && typeof m.label === "string" && Number.isFinite(m.value) && Number.isFinite(m.max) && m.max > 0 && Number.isInteger(m.color) && m.color >= 0 && m.color <= 16777215 && (m.showValue === void 0 || typeof m.showValue === "boolean") && (m.display === void 0 || ["counter", "pips", "bar"].includes(m.display)) && (m.display !== "pips" || Number.isInteger(m.max) && m.max <= 16 && m.icon !== void 0 && m.emptyIcon !== void 0)) || !["objective", "detail", "prompt", "notice"].every((k) => typeof Reflect.get(hud, k) === "string")) {
      throw new Error("Pixel-3d ui needs up to three valid meters and objective/detail/prompt/notice strings");
    }
    for (const name2 of [hud.noticeIcon, ...hud.meters.flatMap((m) => [m.icon, m.emptyIcon])]) {
      if (name2 === void 0) continue;
      if (typeof name2 !== "string" || !name2 || !Object.prototype.hasOwnProperty.call(sprites, name2)) {
        throw new Error(`Pixel-3d ui references unknown sprite: ${String(name2)}`);
      }
    }
    if (hud.panel !== null) {
      const p = hud.panel;
      if (!p || !["title", "body", "footer"].every((k) => typeof Reflect.get(p, k) === "string") || !Array.isArray(p.choices) || p.choices.length > 5 || !p.choices.every((c) => typeof c === "string") || !Number.isInteger(p.selected) || p.selected < 0 || p.selected >= Math.max(1, p.choices.length)) {
        throw new Error("Pixel-3d ui panel needs title/body/footer, up to five choices, and a valid selected index");
      }
    }
    if (hud.grid !== void 0) {
      const g = hud.grid;
      if (!g || g.layout !== void 0 && g.layout !== "sidebar" || !Number.isInteger(g.columns) || g.columns < 1 || g.columns > 8 || !Array.isArray(g.items) || g.items.length > 24 || g.layout === "sidebar" && (g.columns !== 1 || g.items.length > 10) || g.textScale !== void 0 && g.textScale !== 1 && g.textScale !== 2 || g.closeOnActivate !== void 0 && (typeof g.closeOnActivate !== "boolean" || g.layout !== "sidebar" || g.closeOnActivate && !g.dismissAction) || Object.entries({ width: g.width, rowHeight: g.rowHeight, gap: g.gap, padding: g.padding }).some(([key2, n]) => n !== void 0 && (!Number.isInteger(n) || n < (key2 === "gap" ? 0 : key2 === "padding" ? 4 : key2 === "width" ? 120 : 18) || n > (key2 === "width" ? 640 : key2 === "rowHeight" ? 64 : 24))) || ["subtitle", "dismissAction", "moveAction"].some((key2) => {
        const entry = Reflect.get(g, key2);
        return entry !== void 0 && (typeof entry !== "string" || key2 !== "subtitle" && !entry);
      }) || (g.dismissAction !== void 0 || g.moveAction !== void 0) && g.layout !== "sidebar" || !g.items.every((it) => it && typeof it.label === "string")) {
        throw new Error("Pixel-3d ui grid needs columns (1-8) and up to 24 labeled items");
      }
    }
    if (hud.slots !== void 0) {
      if (!Array.isArray(hud.slots) || hud.slots.length > 12 || !hud.slots.every((s) => s && typeof s.label === "string" && Number.isInteger(s.color) && s.color >= 0 && s.color <= 16777215)) {
        throw new Error("Pixel-3d ui slots needs up to 12 slots with label and color");
      }
    }
    if (hud.wheel !== void 0 && hud.wheel !== null) {
      const w = hud.wheel;
      if (!w || !Array.isArray(w.items) || w.items.length > 12 || !w.items.every((it) => it && typeof it.label === "string" && Number.isInteger(it.color) && it.color >= 0 && it.color <= 16777215)) {
        throw new Error("Pixel-3d ui wheel needs up to 12 items with label and color");
      }
    }
    return hud;
  }
  function wrapText(text, columns) {
    if (!Number.isInteger(columns) || columns < 1) throw new Error("HUD wrap columns must be a positive integer");
    const lines = [];
    for (const paragraph of text.split("|")) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/)) {
        if (line && line.length + word.length + 1 > columns) {
          lines.push(line);
          line = "";
        }
        let rest = word;
        while (rest.length > columns) {
          if (line) {
            lines.push(line);
            line = "";
          }
          lines.push(rest.slice(0, columns));
          rest = rest.slice(columns);
        }
        line += (line ? " " : "") + rest;
      }
      if (line) lines.push(line);
    }
    return lines;
  }
  function floatingPanelLayout(width, height, ui, status, top) {
    const p = ui.panel;
    const maxWidth = status === "title" ? 320 : status === "playing" ? 360 : width - 48;
    const bw = Math.min(width - 32, Math.max(180, maxWidth));
    const panelColumns = Math.max(1, Math.floor((bw - 20) / 4));
    const body = wrapText(p.body, panelColumns).slice(0, 4);
    const bh = 38 + body.length * 9 + p.choices.length * 13;
    const bx = Math.floor((width - bw) / 2);
    const y = status === "title" ? Math.max(top + 28, height - bh - 28) : p.choices.length <= 1 ? Math.max(top + 8, Math.floor(height * 0.16)) : Math.max(top + 28, Math.floor((height - bh - 12) / 2));
    return { panelColumns, body, bh, bw, bx, y };
  }
  function renderFloatingHud(canvas, ui, status, paused, sprites) {
    const W = canvas.width, H = canvas.height, ink = ui.theme?.background ?? 1518397, gold = ui.theme?.accent ?? 16767621;
    const text = (value, x, y, color = ui.theme?.text ?? 16777215, scale = 1) => {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) canvas.text(value, x + dx, y + dy, ink, scale);
      canvas.text(value, x, y, color, scale);
    };
    const asset = (name2) => {
      if (!Object.prototype.hasOwnProperty.call(sprites, name2)) throw new Error(`Pixel-3d ui references unknown sprite: ${name2}`);
      return sprites[name2];
    };
    const icon = (name2, x, y, scale = 2) => {
      const sprite = asset(name2);
      for (let sy = 0; sy < sprite.height; sy++) for (let sx = 0; sx < sprite.width; sx++) {
        const color = sprite.colors[sprite.pixels[sy * sprite.width + sx]];
        if (color !== null && color !== void 0) canvas.rect(x + sx * scale, y + sy * scale, scale, scale, color);
      }
    };
    let metersBottom = 32;
    let meterOffset = 0, splitMeters = false;
    if (ui.countdown !== void 0) {
      const remaining = ui.countdown;
      const seconds = Math.ceil(remaining);
      const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      const pulse = remaining <= 10 ? 0.5 + 0.5 * Math.cos(remaining * 2 * Math.PI) : 0;
      const desiredScale = remaining > 20 ? 3 : pulse > 0.58 ? 5 : 4;
      const scale = Math.min(desiredScale, Math.max(1, Math.floor((W - 16) / (4 * clock.length - 1))));
      const width = (4 * clock.length - 1) * scale;
      const x = Math.floor((W - width) / 2), bottom = 13 + 5 * scale;
      const color = remaining > 10 ? 16769958 : 16711680 | Math.floor(78 + 79 * pulse) << 8 | Math.floor(94 + 67 * pulse);
      canvas.rect(x - 7, 4, width + 14, bottom - 4, 590872);
      canvas.rect(x - 7, bottom, width + 14, 2, color);
      text(clock, x, 8, color, scale);
      splitMeters = ui.meters.length <= 2 && Math.floor((W - 16) / 3) >= width + 18;
      if (!splitMeters) meterOffset = bottom + 3;
      metersBottom = Math.max(bottom + 2, 32 + meterOffset);
    }
    const slot = Math.floor((W - 16) / (splitMeters ? 3 : Math.max(1, ui.meters.length)));
    ui.meters.forEach((meter, i) => {
      const x = splitMeters && i === 1 ? W - 8 - slot : 8 + i * slot;
      const columns2 = Math.max(1, Math.floor((slot - 4) / 4));
      const iconTop = meterOffset + (meter.label ? 14 : 8);
      if (meter.label) text(meter.label.slice(0, columns2), x, meterOffset + 6, gold);
      if (meter.display === "pips") {
        const full = asset(meter.icon), empty = asset(meter.emptyIcon);
        const count = Math.ceil(meter.max), pipWidth = Math.max(full.width, empty.width);
        const scale = slot >= count * (pipWidth * 2 + 3) ? 2 : 1;
        const perRow = Math.max(1, Math.floor((slot - 1) / (scale * pipWidth + 3)));
        const rowHeight = scale * Math.max(full.height, empty.height) + 3;
        for (let pip = 0; pip < count; pip++) icon(pip < Math.ceil(meter.value) ? meter.icon : meter.emptyIcon, x + pip % perRow * (scale * pipWidth + 3), iconTop + Math.floor(pip / perRow) * rowHeight, scale);
        metersBottom = Math.max(metersBottom, iconTop + Math.ceil(count / perRow) * rowHeight);
      } else {
        if (meter.icon) icon(meter.icon, x, iconTop);
        const left = x + (meter.icon ? asset(meter.icon).width * 2 + 7 : 0);
        if (meter.showValue !== false) {
          const number = `${Math.max(0, Math.ceil(meter.value))}/${Math.ceil(meter.max)}`;
          const scale = number.length * 8 <= slot - (left - x) - 4 ? 2 : 1;
          text(number, left, iconTop + 4, 16773839, scale);
        }
        if (meter.display === "bar") {
          const barWidth = Math.max(0, slot - (left - x) - 4);
          const fill = Math.max(0, Math.min(1, meter.value / meter.max));
          if (meter.showValue === false) {
            const width = Math.min(48, barWidth);
            canvas.rect(left, iconTop + 9, width, 4, ink);
            canvas.rect(left + 1, iconTop + 10, Math.floor(Math.max(0, width - 2) * fill), 2, meter.color);
          } else {
            canvas.rect(left, iconTop + 16, barWidth, 2, ink);
            canvas.rect(left, iconTop + 16, Math.floor(barWidth * fill), 2, meter.color);
          }
        }
      }
    });
    const columns = Math.max(1, Math.floor((W - 16) / 4));
    const top = ui.meters.length ? Math.max(39, metersBottom + 5) : 8;
    if (ui.detail) text(ui.detail.slice(0, columns), 8, top, ui.theme?.muted ?? 12381148);
    if (ui.objective) text(ui.objective.slice(0, columns), 8, top + 10, gold);
    if (ui.heading && (status !== "playing" || paused)) {
      const heading = ui.heading.slice(0, Math.max(1, Math.floor((W - 32) / 8)));
      text(heading, Math.floor((W - heading.length * 8) / 2), top + 26, gold, 2);
    }
    if (ui.panel) {
      const p = ui.panel;
      const { panelColumns, body, bh, bw, bx, y } = floatingPanelLayout(W, H, ui, status, top);
      canvas.rect(bx, y, bw, bh, 590872);
      canvas.rect(bx, y, bw, 2, 16719515);
      canvas.rect(bx, y + bh - 2, bw, 2, 62975);
      canvas.rect(bx, y, 2, bh, 62975);
      canvas.rect(bx + bw - 2, y, 2, bh, 16719515);
      text(p.title.slice(0, panelColumns), bx + 10, y + 7, gold);
      body.forEach((line, i) => text(line, bx + 10, y + 18 + i * 9, 14937833));
      p.choices.forEach((choice, i) => {
        const cy = y + 22 + body.length * 9 + i * 13;
        if (i === p.selected) canvas.rect(bx + 8, cy - 2, bw - 16, 10, 2757716);
        text(`${i === p.selected ? ">" : " "} ${choice}`.slice(0, panelColumns), bx + 10, cy, i === p.selected ? 62975 : 14937833);
      });
      if (p.footer) text(p.footer.slice(0, panelColumns), bx + 10, y + bh - 11, 9105871);
    } else if (ui.grid) {
      renderHudGrid(canvas, ui.grid, W, H, top, text, ui.theme);
    } else if (ui.notice) {
      const lines = wrapText(ui.notice, columns - 5).slice(0, 2);
      const y = top + 25;
      if (ui.noticeIcon) icon(ui.noticeIcon, 8, y - 2, 1);
      const left = ui.noticeIcon ? 8 + asset(ui.noticeIcon).width + 6 : 8;
      lines.forEach((line, i) => text(line, left, y + i * 9, gold));
    }
    if (ui.wheel && ui.wheel.active !== false && ui.wheel.items && ui.wheel.items.length > 0 && !ui.panel && !ui.grid) {
      renderHudWheel(canvas, ui.wheel, W, H, text);
    } else if (ui.slots && ui.slots.length > 0 && !ui.panel && !ui.grid) {
      renderHudSlots(canvas, ui.slots, W, H, text, ui.theme);
    }
    if (ui.prompt) text(ui.prompt.slice(0, columns), 8, H - 12, ui.theme?.muted ?? 14937833);
  }
  function gridLayout(grid, W, H) {
    const cols = Math.max(1, grid.columns);
    const rows2 = Math.max(1, Math.ceil(grid.items.length / cols));
    const sidebar = grid.layout === "sidebar";
    if (sidebar) {
      const padding = grid.padding ?? 10, margin = 10, gap2 = grid.gap ?? 4;
      const panelW2 = Math.min(grid.width ?? 220, W - margin * 2);
      const panelX = W - margin - panelW2, padX2 = panelX + padding;
      const headerH2 = (grid.title ? (grid.textScale ?? 1) * 5 + 12 : 4) + (grid.subtitle ? 13 : 0);
      const footerH2 = grid.footer ? 18 : 4;
      const available = H - margin * 2 - padding * 2 - headerH2 - footerH2 - (rows2 - 1) * gap2;
      const cellH2 = Math.max(1, Math.min(grid.rowHeight ?? 24, Math.floor(available / rows2)));
      const totalH2 = padding * 2 + headerH2 + rows2 * cellH2 + (rows2 - 1) * gap2 + footerH2;
      const y02 = Math.max(margin, Math.floor((H - totalH2) / 2));
      return {
        cols,
        rows: rows2,
        padX: padX2,
        gap: gap2,
        cellW: panelW2 - padding * 2,
        cellH: cellH2,
        headerH: headerH2 + padding,
        footerH: footerH2,
        totalH: totalH2,
        y0: y02,
        panelW: panelW2,
        panelX,
        padding
      };
    }
    const panelW = W - 16;
    const padX = 12, gap = 4;
    const cellW = Math.floor((W - padX * 2 - gap * (cols - 1)) / cols);
    const cellH = rows2 <= 2 ? 22 : 18;
    const headerH = grid.title ? 12 : 4;
    const footerH = grid.footer ? 11 : 4;
    const totalH = headerH + rows2 * cellH + (rows2 - 1) * gap + footerH + 6;
    const y0 = Math.max(44, H - totalH - 16);
    return { cols, rows: rows2, padX, gap, cellW, cellH, headerH, footerH, totalH, y0, panelW, panelX: padX - 4, padding: 4 };
  }
  function roundedRect(canvas, x, y, w, h, radius, color) {
    const r = Math.max(0, Math.min(radius, Math.floor(w / 2), Math.floor(h / 2)));
    canvas.rect(x + r, y, w - r * 2, h, color);
    canvas.rect(x, y + r, w, h - r * 2, color);
    for (let row = 0; row < r; row++) {
      const inset = Math.ceil(r - Math.sqrt(r * r - (r - row - 0.5) ** 2));
      canvas.rect(x + inset, y + row, w - inset * 2, 1, color);
      canvas.rect(x + inset, y + h - row - 1, w - inset * 2, 1, color);
    }
  }
  function buttonLayout(button, W, H) {
    const size = button.size ?? 30, offset = button.offset ?? 0;
    return {
      x: button.anchor === "top-right" ? W - 10 - size - offset : 10 + offset,
      y: button.anchor === "top-right" ? 10 : H - 10 - size,
      w: size,
      h: size
    };
  }
  function hudButtonAt(ui, width, height, x, y) {
    return (ui?.buttons ?? []).some((button) => {
      const box = buttonLayout(button, width, height);
      return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
    });
  }
  function calloutLayout(callout, W) {
    return {
      x: 10,
      y: 44,
      w: Math.min(callout.width ?? 240, W - 20),
      h: 42 + callout.lines.length * 12 + (callout.actions.length ? 30 : 0)
    };
  }
  function renderWidgets(canvas, ui) {
    const theme = ui.theme;
    const ink = theme?.text ?? 15858679, accent = theme?.accent ?? 8185036;
    for (const button of ui.buttons ?? []) {
      const { x: x2, y: y2, w: w2, h: h2 } = buttonLayout(button, canvas.width, canvas.height);
      const color = button.disabled ? theme?.muted ?? 10665415 : accent;
      roundedRect(canvas, x2, y2, w2, h2, theme?.radius ?? 6, color);
      roundedRect(canvas, x2 + 1, y2 + 1, w2 - 2, h2 - 2, theme?.radius ?? 6, theme?.surface ?? 1587530);
      const cx = Math.floor(x2 + w2 / 2), cy = Math.floor(y2 + h2 / 2);
      if (button.icon === "menu") {
        for (const dy of [-5, 0, 5]) canvas.rect(cx - 7, cy + dy, 14, 2, color);
      } else if (button.icon === "feed") {
        canvas.rect(cx - 7, cy + 2, 14, 3, color);
        canvas.rect(cx - 5, cy + 5, 10, 3, color);
        for (const [dx, dy] of [[-4, -6], [3, -4], [-1, -1]]) canvas.rect(cx + dx, cy + dy, 2, 2, 16769142);
      } else if (button.icon === "fish") {
        roundedRect(canvas, cx - 8, cy - 4, 13, 9, 4, color);
        canvas.rect(cx + 5, cy - 5, 3, 11, color);
        canvas.rect(cx - 5, cy - 1, 2, 2, theme?.background ?? 860723);
      } else if (button.icon === "flower") {
        canvas.rect(cx - 1, cy, 2, 9, color);
        canvas.rect(cx + 1, cy + 4, 5, 2, color);
        for (const [dx, dy] of [[-5, -4], [2, -4], [-2, -8], [-2, -1]]) {
          roundedRect(canvas, cx + dx, cy + dy, 5, 5, 2, color);
        }
        canvas.rect(cx - 1, cy - 4, 3, 3, 16769142);
      } else if (button.icon === "critter") {
        roundedRect(canvas, cx - 5, cy - 3, 10, 7, 3, color);
        for (const dx of [-7, 5]) {
          canvas.rect(cx + dx, cy - 6, 2, 5, color);
          for (const dy of [0, 4, 7]) canvas.rect(cx + dx, cy + dy, 3, 1, color);
        }
        canvas.rect(cx - 3, cy - 2, 1, 1, ink);
        canvas.rect(cx + 2, cy - 2, 1, 1, ink);
      } else {
        canvas.rect(cx - 7, cy - 3, 4, 6, color);
        canvas.rect(cx - 3, cy - 6, 4, 12, color);
        canvas.rect(cx + 5, cy - 4, 2, 8, color);
        if (button.selected) canvas.rect(cx - 8, cy, 17, 2, ink);
      }
    }
    const callout = ui.callout;
    if (!callout) return;
    const { x, y, w, h } = calloutLayout(callout, canvas.width);
    if (callout.screen) {
      const tx = Math.max(0, Math.min(canvas.width - 1, Math.round(callout.screen.x)));
      const ty = Math.max(0, Math.min(canvas.height - 1, Math.round(callout.screen.y)));
      const sx = x + w, sy = y + h / 2, count = Math.ceil(Math.max(Math.abs(tx - sx), Math.abs(ty - sy)));
      for (let i = 0; i <= count; i++) canvas.rect(
        Math.round(sx + (tx - sx) * i / Math.max(1, count)),
        Math.round(sy + (ty - sy) * i / Math.max(1, count)),
        1,
        1,
        accent
      );
      canvas.rect(tx - 2, ty - 2, 5, 5, accent);
    }
    roundedRect(canvas, x, y, w, h, theme?.radius ?? 6, accent);
    roundedRect(canvas, x + 1, y + 1, w - 2, h - 2, theme?.radius ?? 6, theme?.background ?? 860723);
    canvas.text(callout.title.slice(0, Math.floor((w - 20) / 8)), x + 10, y + 10, ink, 2);
    callout.lines.forEach((line, i) => canvas.text(line.slice(0, Math.floor((w - 20) / 4)), x + 10, y + 29 + i * 12, theme?.muted ?? 10665415));
    const buttonW = Math.floor((w - 20) / Math.max(1, callout.actions.length));
    callout.actions.forEach((a, i) => {
      canvas.rect(
        x + 10 + i * buttonW,
        y + h - 28,
        buttonW - 4,
        20,
        callout.selected === i ? theme?.selected ?? 2512741 : theme?.surface ?? 1587530
      );
      canvas.text(a.label.slice(0, Math.floor((buttonW - 10) / 4)), x + 14 + i * buttonW, y + h - 21, accent);
    });
  }
  function renderHudGrid(canvas, grid, W, H, _top, text, theme) {
    const { cols, padX, gap, cellW, cellH, headerH, totalH, y0, panelW, panelX, padding } = gridLayout(grid, W, H);
    if (grid.layout === "sidebar") {
      const colors = {
        background: 860723,
        surface: 1587530,
        selected: 2512741,
        border: 3560808,
        text: 15858679,
        muted: 10665415,
        accent: 8185036,
        focus: 12845032,
        ...theme
      };
      const radius = theme?.radius ?? 5;
      roundedRect(canvas, panelX - 3, y0 + 4, panelW + 6, totalH, radius + 1, 463390);
      roundedRect(canvas, panelX, y0, panelW, totalH, radius, colors.border);
      roundedRect(canvas, panelX + 1, y0 + 1, panelW - 2, totalH - 2, radius, colors.background);
      const labelScale = Math.min(grid.textScale ?? 1, cellH >= 28 ? 2 : 1);
      const closeW = grid.dismissAction ? 26 : 0;
      if (grid.title) text(
        grid.title.slice(0, Math.max(1, Math.floor((cellW - closeW) / (4 * labelScale)))),
        padX,
        y0 + padding + 2,
        colors.text,
        labelScale
      );
      if (grid.subtitle) text(
        grid.subtitle.slice(0, Math.floor(cellW / 4)),
        padX,
        y0 + padding + labelScale * 5 + 9,
        colors.accent
      );
      if (grid.dismissAction) {
        roundedRect(canvas, panelX + panelW - padding - 22, y0 + padding - 2, 22, 22, 4, colors.surface);
        text("X", panelX + panelW - padding - 14, y0 + padding + 5, colors.muted, 2);
      }
      grid.items.forEach((item, i) => {
        const x = padX, y = y0 + headerH + i * (cellH + gap);
        const focus = item.selected === true;
        roundedRect(canvas, x, y, cellW, cellH, radius, focus ? colors.focus : colors.surface);
        if (focus) roundedRect(canvas, x + 2, y + 2, cellW - 4, cellH - 4, Math.max(0, radius - 1), colors.selected);
        const accent = item.disabled ? colors.muted : item.color ?? colors.accent;
        canvas.rect(x + 7, y + 7, 2, Math.max(1, cellH - 14), accent);
        const left = x + 17, maxChars2 = Math.max(1, Math.floor((cellW - 27) / (4 * labelScale)));
        text(item.label.slice(0, maxChars2), left, y + 6, item.disabled ? colors.muted : colors.text, labelScale);
        const sub = item.sub || item.badge;
        if (sub && cellH >= 22) text(
          sub.slice(0, Math.floor((cellW - 27) / 4)),
          left,
          y + 6 + labelScale * 5 + 5,
          item.disabled ? colors.muted : colors.accent
        );
      });
      if (grid.footer) text(grid.footer.slice(0, Math.floor(cellW / 4)), padX, y0 + totalH - padding - 7, colors.muted);
      return;
    }
    canvas.rect(padX - 4, y0, panelW, totalH, 590872);
    canvas.rect(padX - 4, y0, panelW, 1, 62975);
    canvas.rect(padX - 4, y0 + totalH - 1, panelW, 1, 16719515);
    if (grid.title) {
      text(grid.title.slice(0, Math.floor((panelW - 8) / 4)), padX, y0 + 4, 62975);
    }
    const maxChars = Math.max(1, Math.floor((cellW - 6) / 4));
    grid.items.forEach((item, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = padX + col * (cellW + gap);
      const y = y0 + headerH + row * (cellH + gap);
      const accent = item.color ?? 62975;
      const bg = item.selected ? 2495053 : item.disabled ? 919580 : 1247785;
      const border = item.selected ? 16770560 : item.disabled ? 3877992 : accent;
      canvas.rect(x, y, cellW, cellH, bg);
      canvas.rect(x, y, cellW, 1, border);
      canvas.rect(x, y + cellH - 1, cellW, 1, border);
      canvas.rect(x, y, 1, cellH, border);
      canvas.rect(x + cellW - 1, y, 1, cellH, border);
      if (item.selected) canvas.rect(x + 1, y + 1, cellW - 2, 1, accent);
      const textColor = item.selected ? 16770560 : item.disabled ? 6705817 : 16054271;
      text(item.label.slice(0, maxChars), x + 3, y + 4, textColor);
      if (item.sub) {
        text(item.sub.slice(0, maxChars), x + 3, y + 12, item.selected ? 62975 : accent);
      } else if (item.badge) {
        text(item.badge.slice(0, maxChars), x + 3, y + 12, item.selected ? 62975 : accent);
      }
    });
    if (grid.footer) {
      text(grid.footer.slice(0, Math.floor((panelW - 8) / 4)), padX, y0 + totalH - 9, 16770560);
    }
  }
  function slotsLayout(slots, W, H) {
    const gap = 3, margin = 8;
    const totalW = W - margin * 2;
    const slotW = Math.floor((totalW - gap * (slots.length - 1)) / slots.length);
    const slotH = 12;
    const y = H - 27;
    return { gap, margin, slotW, slotH, y };
  }
  function renderHudSlots(canvas, slots, W, H, text, theme) {
    const { gap, margin, slotW, slotH, y } = slotsLayout(slots, W, H);
    const maxChars = Math.max(1, Math.floor((slotW - 4) / 4));
    slots.forEach((slot, i) => {
      const x = margin + i * (slotW + gap);
      const bg = slot.selected ? theme?.selected ?? 2495053 : slot.locked ? theme?.background ?? 590872 : theme?.surface ?? 1247785;
      const border = slot.selected ? theme?.focus ?? 16770560 : slot.locked ? theme?.border ?? 2891853 : theme?.border ?? slot.color;
      canvas.rect(x, y, slotW, slotH, bg);
      canvas.rect(x, y, slotW, 1, border);
      canvas.rect(x, y + slotH - 1, slotW, 1, border);
      canvas.rect(x, y, 1, slotH, border);
      canvas.rect(x + slotW - 1, y, 1, slotH, border);
      const labelColor = slot.selected ? theme?.focus ?? 16770560 : slot.locked ? theme?.muted ?? 5390970 : theme?.text ?? slot.color;
      const label = slot.label.slice(0, maxChars);
      const tx = x + Math.max(2, Math.floor((slotW - label.length * 4) / 2));
      text(label, tx, y + 4, labelColor);
    });
  }
  function wheelLayout(wheel, W, H) {
    const items = wheel.items || [];
    const cx = Math.floor(W / 2);
    const cy = Math.floor(H / 2) - 6;
    const radius = Math.min(88, Math.floor(H * 0.28));
    const itemW = 56;
    const itemH = 18;
    const hubW = 108;
    const hubH = 34;
    return { items, cx, cy, radius, itemW, itemH, hubW, hubH };
  }
  function renderHudWheel(canvas, wheel, W, H, text) {
    const { items, cx, cy, radius, itemW, itemH, hubW, hubH } = wheelLayout(wheel, W, H);
    if (!items.length) return;
    const bgPad = radius + 38;
    canvas.rect(cx - bgPad, cy - radius - 20, bgPad * 2, (radius + 20) * 2, 394002);
    canvas.rect(cx - bgPad, cy - radius - 20, bgPad * 2, 1, 1773883);
    canvas.rect(cx - bgPad, cy + radius + 20 - 1, bgPad * 2, 1, 1773883);
    canvas.rect(cx - bgPad, cy - radius - 20, 1, (radius + 20) * 2, 1773883);
    canvas.rect(cx + bgPad - 1, cy - radius - 20, 1, (radius + 20) * 2, 1773883);
    const selectedItem = items.find((it) => it.selected) || items[0];
    items.forEach((item, i) => {
      const angle = -Math.PI / 2 + i * 2 * Math.PI / items.length;
      const nx = Math.round(cx + Math.cos(angle) * radius);
      const ny = Math.round(cy + Math.sin(angle) * radius);
      const spokeColor = item.selected ? 62975 : item.locked ? 1642291 : 3617891;
      const steps = 8;
      for (let s = 2; s < steps; s++) {
        const t = s / steps;
        const sx = Math.round(cx + (nx - cx) * t);
        const sy = Math.round(cy + (ny - cy) * t);
        canvas.rect(sx, sy, 1, 1, spokeColor);
      }
    });
    const hubBorder = selectedItem ? selectedItem.selected ? 16770560 : selectedItem.color : 62975;
    canvas.rect(cx - hubW / 2, cy - hubH / 2, hubW, hubH, 1313579);
    canvas.rect(cx - hubW / 2, cy - hubH / 2, hubW, 1, hubBorder);
    canvas.rect(cx - hubW / 2, cy + hubH / 2 - 1, hubW, 1, hubBorder);
    canvas.rect(cx - hubW / 2, cy - hubH / 2, 1, hubH, hubBorder);
    canvas.rect(cx + hubW / 2 - 1, cy - hubH / 2, 1, hubH, hubBorder);
    if (selectedItem?.selected) {
      canvas.rect(cx - hubW / 2 + 1, cy - hubH / 2 + 1, hubW - 2, 1, 62975);
    }
    const titleText = (wheel.title || "WEAPON WHEEL").slice(0, 20);
    const titleX = cx - Math.floor(titleText.length * 4 / 2);
    text(titleText, titleX, cy - hubH / 2 + 3, 62975);
    const selName = (selectedItem ? selectedItem.label : "").slice(0, 20);
    const selX = cx - Math.floor(selName.length * 4 / 2);
    text(selName, selX, cy - 2, 16770560);
    const subPrompt = "[TAB/Q/E] SELECT".slice(0, 20);
    const subX = cx - Math.floor(subPrompt.length * 4 / 2);
    text(subPrompt, subX, cy + hubH / 2 - 9, 9105871);
    const maxChars = Math.max(1, Math.floor((itemW - 4) / 4));
    items.forEach((item, i) => {
      const angle = -Math.PI / 2 + i * 2 * Math.PI / items.length;
      const nx = Math.round(cx + Math.cos(angle) * radius);
      const ny = Math.round(cy + Math.sin(angle) * radius);
      const x = nx - Math.floor(itemW / 2);
      const y = ny - Math.floor(itemH / 2);
      const bg = item.selected ? 3020889 : item.locked ? 656663 : 1313579;
      const border = item.selected ? 16770560 : item.locked ? 2891853 : item.color;
      canvas.rect(x, y, itemW, itemH, bg);
      canvas.rect(x, y, itemW, 1, border);
      canvas.rect(x, y + itemH - 1, itemW, 1, border);
      canvas.rect(x, y, 1, itemH, border);
      canvas.rect(x + itemW - 1, y, 1, itemH, border);
      if (item.selected) {
        canvas.rect(x + 1, y + 1, itemW - 2, 1, 62975);
        canvas.rect(x - 2, y - 2, itemW + 4, 1, 16770560);
        canvas.rect(x - 2, y + itemH + 1, itemW + 4, 1, 16770560);
      }
      const labelColor = item.selected ? 16770560 : item.locked ? 5588087 : item.color;
      const label = item.label.slice(0, maxChars);
      const tx = x + Math.max(2, Math.floor((itemW - label.length * 4) / 2));
      text(label, tx, y + 3, labelColor);
      const sub = item.locked ? "LOCKED" : item.sub || (item.selected ? "EQUIPPED" : "READY");
      const subColor = item.selected ? 62975 : item.locked ? 4010073 : 9105871;
      const sx = x + Math.max(2, Math.floor((itemW - sub.slice(0, maxChars).length * 4) / 2));
      text(sub.slice(0, maxChars), sx, y + 10, subColor);
    });
  }
  function collectHudHitRegions(width, height, ui, status, paused) {
    if (!ui) return [];
    const regions = [];
    for (const button of ui.buttons ?? []) {
      if (!button.disabled) regions.push({ ...buttonLayout(button, width, height), action: button.action, args: [] });
    }
    if (ui.callout) {
      const c = ui.callout, { x, y, w, h } = calloutLayout(c, width);
      const bw = Math.floor((w - 20) / Math.max(1, c.actions.length));
      c.actions.forEach((a, i) => regions.push({ x: x + 10 + i * bw, y: y + h - 28, w: bw - 4, h: 20, action: a.action, args: [] }));
      if (c.dismissAction) {
        for (const [rx, ry, rw, rh] of [
          [0, 0, x, height],
          [x + w, 0, width - x - w, height],
          [x, 0, w, y],
          [x, y + h, w, height - y - h]
        ]) {
          if (rw > 0 && rh > 0) regions.push({ x: rx, y: ry, w: rw, h: rh, action: c.dismissAction, args: [] });
        }
      }
      return regions;
    }
    if (ui.panel && ui.panel.choiceActions?.length) {
      const p = ui.panel;
      const top = ui.meters.length ? 44 : 8;
      const { body, bw, bx, y } = floatingPanelLayout(width, height, ui, status, top);
      p.choices.forEach((_, i) => {
        const ca = p.choiceActions?.[i];
        if (!ca) return;
        const cy = y + 22 + body.length * 9 + i * 13;
        regions.push({ x: bx + 8, y: cy - 3, w: bw - 16, h: 12, action: ca.action, args: ca.args ?? [] });
      });
    } else if (ui.grid) {
      const { cols, padX, gap, cellW, cellH, headerH, y0, panelW, panelX, totalH, padding } = gridLayout(ui.grid, width, height);
      ui.grid.items.forEach((item, i) => {
        if (!item.action || item.disabled) return;
        const col = i % cols, row = Math.floor(i / cols);
        regions.push({
          x: padX + col * (cellW + gap),
          y: y0 + headerH + row * (cellH + gap),
          w: cellW,
          h: cellH,
          action: item.action,
          args: item.args ?? []
        });
      });
      if (ui.grid.layout === "sidebar") {
        const action = ui.grid.dismissAction;
        if (action) {
          regions.push({ x: panelX + panelW - padding - 22, y: y0 + padding - 2, w: 22, h: 22, action, args: [] });
          for (const [x, y, w, h] of [
            [0, 0, panelX, height],
            [panelX + panelW, 0, width - panelX - panelW, height],
            [panelX, 0, panelW, y0],
            [panelX, y0 + totalH, panelW, height - y0 - totalH]
          ]) if (w > 0 && h > 0) regions.push({ x, y, w, h, action, args: [] });
        }
        return regions;
      }
    }
    if (ui.wheel && ui.wheel.active !== false && ui.wheel.items && ui.wheel.items.length > 0 && status === "playing" && !paused) {
      const { items, cx, cy, radius, itemW, itemH } = wheelLayout(ui.wheel, width, height);
      items.forEach((item, i) => {
        if (!item.action || item.locked) return;
        const angle = -Math.PI / 2 + i * 2 * Math.PI / items.length;
        const nx = Math.round(cx + Math.cos(angle) * radius);
        const ny = Math.round(cy + Math.sin(angle) * radius);
        regions.push({
          x: nx - Math.floor(itemW / 2),
          y: ny - Math.floor(itemH / 2),
          w: itemW,
          h: itemH,
          action: item.action,
          args: item.args ?? []
        });
      });
    } else if (ui.slots && ui.slots.length > 0 && status === "playing" && !paused) {
      const { gap, margin, slotW, slotH, y } = slotsLayout(ui.slots, width, height);
      ui.slots.forEach((slot, i) => {
        if (!slot.action || slot.locked) return;
        regions.push({
          x: margin + i * (slotW + gap),
          y,
          w: slotW,
          h: slotH,
          action: slot.action,
          args: slot.args ?? []
        });
      });
    }
    return regions;
  }
  function renderHud(canvas, ui, status, paused, sprites = {}) {
    if (ui.cinema) {
      const c = ui.cinema, W2 = canvas.width, H2 = canvas.height, scale = c.scale ?? 2;
      canvas.rect(0, 0, W2, Math.floor(H2 * 0.1), 198419);
      canvas.rect(0, Math.floor(H2 * 0.96), W2, H2, 198419);
      const centered = (line, y, color, size = 1, clip2) => canvas.text(line, Math.floor((W2 - (line.length * 4 - 1) * size) / 2), y, color, size, clip2);
      if (ui.heading) centered(ui.heading, 10, 10283741);
      const clip = { top: Math.floor(H2 * (c.top ?? 0.55)), bottom: Math.floor(H2 * (c.bottom ?? 0.94)) };
      c.lines.forEach((line, i) => {
        const y = Math.floor(clip.bottom - c.offset + i * (c.spacing ?? 18));
        if (y + 5 * scale > clip.top && y < clip.bottom) centered(line, y, 15003369, scale, clip);
      });
      if (ui.prompt) centered(ui.prompt, H2 - 8, 9284536);
      return;
    }
    if (ui.reticle && status === "playing" && !paused) {
      const x = Math.floor(canvas.width / 2), y = Math.floor(canvas.height / 2);
      canvas.rect(x - 7, y - 1, 5, 3, 593948);
      canvas.rect(x + 3, y - 1, 5, 3, 593948);
      canvas.rect(x - 1, y - 7, 3, 5, 593948);
      canvas.rect(x - 1, y + 3, 3, 5, 593948);
      canvas.rect(x - 6, y, 3, 1, 12187135);
      canvas.rect(x + 4, y, 3, 1, 12187135);
      canvas.rect(x, y - 6, 1, 3, 12187135);
      canvas.rect(x, y + 4, 1, 3, 12187135);
    }
    if (ui.damageDirection && status === "playing" && !paused) {
      const x = ui.damageDirection < 0 ? 4 : canvas.width - 8, y = Math.floor(canvas.height * 0.55);
      canvas.rect(x, y - 13, 4, 26, 15756162);
      canvas.rect(x + (ui.damageDirection < 0 ? 4 : -4), y - 7, 4, 14, 16761223);
    }
    if (ui.map) renderMap(canvas, ui.map);
    if (ui.style === "floating") {
      renderFloatingHud(canvas, ui, status, paused, sprites);
      renderWidgets(canvas, ui);
      return;
    }
    if (ui.textScale === 2) {
      renderLargeHud(canvas, ui, status, paused);
      return;
    }
    const W = canvas.width, H = canvas.height;
    const columns = Math.max(1, Math.floor((W - 12) / 4));
    const panelColumns = Math.max(1, Math.floor((W - 48) / 4));
    const width = Math.floor((W - 16) / Math.max(1, ui.meters.length));
    const topHeight = ui.detail ? 25 : ui.meters.length ? 18 : 0;
    if (topHeight) canvas.rect(0, 0, W, topHeight, 725275);
    ui.meters.forEach((m, i) => {
      const x = 6 + i * width;
      canvas.text(`${m.label} ${Math.ceil(m.value)}/${Math.ceil(m.max)}`, x, 3, m.color);
      canvas.rect(x, 11, width - 6, 5, 2569285);
      canvas.rect(x, 11, Math.floor((width - 6) * Math.max(0, Math.min(1, m.value / m.max))), 5, m.color);
    });
    canvas.text(ui.detail.slice(0, columns), 6, 19, 11913694);
    if (ui.objective) {
      canvas.rect(0, topHeight, W, 11, 1515827);
      canvas.text(ui.objective.slice(0, columns), 6, topHeight + 3, 15914378);
    }
    const heading = (status !== "playing" || paused) && ui.heading ? ui.heading.slice(0, Math.max(1, Math.floor((W - 32) / 12))) : "";
    if (heading) {
      canvas.rect(16, 40, W - 32, 26, 725275);
      canvas.text(heading, Math.floor((W - heading.length * 12) / 2), 44, 15914378, 3);
    }
    function renderLargeHud(canvas2, ui2, status2, paused2) {
      const W2 = canvas2.width, H2 = canvas2.height;
      const columns2 = Math.max(1, Math.floor((W2 - 12) / 8));
      const text = (value, x, y, color = 16777215) => canvas2.text(value, x, y, color, 2);
      let top = 0;
      if (ui2.meters.length) {
        const width2 = Math.floor((W2 - 12) / ui2.meters.length);
        canvas2.rect(0, 0, W2, 23, 725275);
        ui2.meters.forEach((meter, i) => {
          const x = 6 + i * width2;
          const label = `${meter.label} ${Math.ceil(meter.value)}/${Math.ceil(meter.max)}`;
          const available = Math.max(1, Math.floor((width2 - 6) / 8));
          const short = `${meter.label.slice(0, 1)} ${Math.ceil(meter.value)}/${Math.ceil(meter.max)}`;
          text((label.length <= available ? label : short).slice(0, available), x, 3, meter.color);
          canvas2.rect(x, 16, width2 - 6, 4, 2569285);
          canvas2.rect(x, 16, Math.floor((width2 - 6) * Math.max(0, Math.min(1, meter.value / meter.max))), 4, meter.color);
        });
        top = 23;
      }
      const strip = (value, color) => {
        if (!value) return;
        const lines = wrapText(value, columns2).slice(0, 2);
        canvas2.rect(0, top, W2, lines.length * 12 + 6, 1515827);
        lines.forEach((line, i) => text(line, 6, top + 3 + i * 12, color));
        top += lines.length * 12 + 6;
      };
      strip(ui2.objective, 15914378);
      if (ui2.heading && (status2 !== "playing" || paused2)) strip(ui2.heading, 15914378);
      if (ui2.meters.length < 3 && !ui2.panel) strip(ui2.detail, 11913694);
      const prompt2 = paused2 && !ui2.heading ? "PAUSED - P TO RESUME" : ui2.prompt;
      const promptLines = wrapText(prompt2, columns2).slice(0, 2);
      const bottom = H2 - promptLines.length * 12 - 6;
      if (ui2.panel) {
        const panel = ui2.panel;
        const rows2 = Math.max(0, Math.floor((bottom - top - 8) / 12));
        const title = wrapText(panel.title, columns2).slice(0, 1);
        const footer = wrapText(panel.footer, columns2).slice(0, 1);
        const choices = panel.choices.map((choice, i) => `${i === panel.selected ? ">" : " "} ${i + 1} ${choice}`.slice(0, columns2));
        const bodyRows = Math.max(0, rows2 - title.length - footer.length - choices.length);
        const lines = [...title, ...wrapText(panel.body, columns2).slice(0, bodyRows), ...choices, ...footer].slice(0, rows2);
        canvas2.rect(0, top, W2, lines.length * 12 + 8, 725275);
        lines.forEach((line, i) => text(line, 6, top + 4 + i * 12, i === 0 ? 15914378 : 11913694));
      } else {
        const noticeRows = Math.max(0, Math.min(2, Math.floor((bottom - top - 40) / 12)));
        const lines = wrapText(ui2.notice, columns2).slice(0, noticeRows);
        if (lines.length) {
          canvas2.rect(0, top, W2, lines.length * 12 + 6, 1515827);
          lines.forEach((line, i) => text(line, 6, top + 3 + i * 12, 15914378));
        }
        if (status2 === "playing" && !paused2) {
          const x = W2 >> 1, y = H2 >> 1;
          canvas2.rect(x - 3, y, 7, 1, 16777215);
          canvas2.rect(x, y - 3, 1, 7, 16777215);
        }
      }
      canvas2.rect(0, bottom, W2, H2 - bottom, 725275);
      promptLines.forEach((line, i) => text(line, 6, bottom + 3 + i * 12));
    }
    if (ui.notice && !ui.panel) {
      const noticeY = heading ? 70 : 40;
      const lines = wrapText(ui.notice, Math.max(1, Math.floor((W - 32) / 4))).slice(0, 2);
      canvas.rect(12, noticeY, W - 24, lines.length * 8 + 8, 1515827);
      lines.forEach((line, i) => canvas.text(line, 16, noticeY + 4 + i * 8, 15914378));
    }
    if (ui.panel) {
      const p = ui.panel;
      const camp = status !== "playing" || paused;
      const body = wrapText(p.body, panelColumns).slice(0, camp ? 3 : 2);
      const bh = 35 + body.length * 8 + p.choices.length * 12;
      const by = camp ? heading ? 70 : 44 : H - bh - 18;
      canvas.rect(16, by, W - 32, bh, 725275);
      canvas.rect(16, by, W - 32, 2, 15914378);
      canvas.text(p.title.slice(0, panelColumns), 24, by + 7, 15914378);
      body.forEach((line, i) => canvas.text(line, 24, by + 18 + i * 8, 11913694));
      p.choices.forEach((choice, i) => {
        const y = by + 22 + body.length * 8 + i * 12;
        if (i === p.selected) canvas.rect(22, y - 2, W - 44, 10, 3163228);
        canvas.text(`${i === p.selected ? ">" : " "} ${i + 1} ${choice}`.slice(0, panelColumns), 24, y, i === p.selected ? 16777215 : 11913694);
      });
      canvas.text(p.footer.slice(0, panelColumns), 24, by + bh - 8, 8312492);
    } else if (!ui.map) {
      const x = W >> 1, y = H >> 1;
      canvas.rect(x - 3, y, 2, 1, 16777215);
      canvas.rect(x + 2, y, 2, 1, 16777215);
      canvas.rect(x, y - 3, 1, 2, 16777215);
      canvas.rect(x, y + 2, 1, 2, 16777215);
    }
    const prompt = paused && !ui.heading ? "PAUSED - P OR PAUSE BUTTON TO RESUME" : ui.prompt;
    if (prompt) {
      canvas.rect(0, H - 14, W, 14, 725275);
      canvas.text(prompt.slice(0, columns), 6, H - 9, 16777215);
    }
  }
  function renderMap(canvas, map) {
    const width = map.expanded ? canvas.width - 48 : 124, height = map.expanded ? canvas.height - 126 : 67;
    const x = map.expanded ? 24 : canvas.width - width - 8, y = map.expanded ? 91 : 90;
    canvas.rect(x - 3, y - 10, width + 6, height + 15, 726822);
    canvas.text("EXPLORATION MAP", x, y - 7, 10809296);
    const point = (n) => ({ x: x + 8 + n.x * (width - 24) / 100, y: y + 8 + n.y * (height - 24) / 100 });
    for (const link of map.links) {
      const from = map.nodes.find((n) => n.id === link.from), to = map.nodes.find((n) => n.id === link.to);
      if (!from.visited && !to.visited) continue;
      const a = point(from), b = point(to), color = link.shortcut ? 5828565 : from.locked || to.locked ? 9327208 : 4549237;
      if (link.shortcut) {
        for (let px = Math.min(a.x, b.x); px <= Math.max(a.x, b.x); px += 5) canvas.rect(px, a.y, 2, 1, color);
        for (let py = Math.min(a.y, b.y); py <= Math.max(a.y, b.y); py += 5) canvas.rect(b.x, py, 1, 2, color);
      } else {
        canvas.rect(Math.min(a.x, b.x), a.y, Math.abs(b.x - a.x) + 1, 1, color);
        canvas.rect(b.x, Math.min(a.y, b.y), 1, Math.abs(b.y - a.y) + 1, color);
      }
    }
    for (const node of map.nodes) {
      const p = point(node), current = node.id === map.current;
      const color = current ? 5828565 : node.locked ? 15756162 : node.visited ? 7196300 : 5465474;
      canvas.rect(p.x - 3, p.y - 2, 7, 5, color);
      if (current) canvas.rect(p.x - 1, p.y - 1, 3, 3, 16777215);
      if (map.expanded) canvas.text(node.visited || node.locked ? node.label : "???", p.x - 8, p.y + 5, color);
    }
  }

  // src/pixel3d/tether.ts
  function validateTether(value) {
    const validPoint = (p) => Array.isArray(p) && p.length === 3 && p.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e6);
    const tether = value;
    if (!tether || !Array.isArray(tether.points) || tether.points.length < 2 || tether.points.length > 32 || !tether.points.every(validPoint)) {
      throw new Error("Pixel-3d tether needs 2 to 32 finite [x,y,z] points within one million tiles");
    }
    if (!Number.isFinite(tether.radius) || tether.radius < 2e-3 || tether.radius > 2 || !Number.isInteger(tether.color) || tether.color < 0 || tether.color > 16777215 || tether.visible !== void 0 && typeof tether.visible !== "boolean") {
      throw new Error("Pixel-3d tether needs a radius from .002 to 2, an RGB color, and an optional boolean visible");
    }
    const slack = tether.slack ?? 0;
    if (!Number.isFinite(slack) || slack < 0 || slack > 32 || slack > 0 && tether.points.length !== 2) {
      throw new Error("Pixel-3d tether slack must be 0 to 32 and needs exactly two points when nonzero");
    }
    return tether;
  }
  function tetherModel(joint, color = 4294967295) {
    return { blocks: [{ from: [-0.5, -0.5, -0.5], size: [1, 1, 1], shape: joint ? "sphere" : "cylinder", color }] };
  }
  function* tetherPieces(tether) {
    if (tether.visible === false) return;
    let points = tether.points;
    if (tether.slack) {
      const [a, b] = points;
      const slack = tether.slack;
      points = Array.from({ length: 9 }, (_, i) => {
        const t = i / 8;
        return [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
          a[2] + (b[2] - a[2]) * t - 4 * slack * t * (1 - t)
        ];
      });
    }
    const scale = tether.radius * 2;
    let lastJoint;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const length = Math.hypot(dx, dy, dz);
      if (length < 1e-6) continue;
      if (!lastJoint) yield { x: a[0], y: a[1], z: a[2], scale, joint: true };
      yield {
        x: (a[0] + b[0]) / 2,
        y: (a[1] + b[1]) / 2,
        z: (a[2] + b[2]) / 2,
        angle: Math.atan2(dy, dx) * 180 / Math.PI,
        scale,
        joint: false,
        axisTilt: Math.atan2(Math.hypot(dx, dy), dz),
        axialScale: length / scale
      };
      yield { x: b[0], y: b[1], z: b[2], scale, joint: true };
      lastJoint = b;
    }
  }

  // src/pixel3d/lighting.ts
  function validatePointLights(value) {
    if (!Array.isArray(value) || value.length > 8) throw new Error("Pixel-3d lights needs an array of up to 8 point lights");
    return value.map((light) => {
      if (!light || typeof light !== "object") throw new Error("Pixel-3d point light must be an object");
      const { x, y, z, radius, intensity, color } = light;
      const rgb2 = typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? parseInt(color.slice(1), 16) : color;
      if (![x, y, z, radius, intensity].every(Number.isFinite) || radius <= 0 || radius > 64 || intensity < 0 || intensity > 1 || !Number.isInteger(rgb2) || rgb2 < 0 || rgb2 > 16777215) {
        throw new Error("Pixel-3d point light needs finite x/y/z, radius in (0, 64], intensity in [0, 1], and an RGB color");
      }
      return { x, y, z, radius, intensity, color: rgb2 };
    });
  }
  function lightFrame(lights, buffer, depth, width, height, camera, dirX, dirY, fovScale, rowOrigin = height / 2) {
    const eye = camera.height ?? 0.5;
    const pitch = (camera.pitch ?? 0) * Math.PI / 180;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const columnStep = 2 * fovScale / width;
    for (const light of lights) {
      if (light.intensity <= 0) continue;
      const dx = light.x - camera.x, dy = light.y - camera.y, dz = light.z - eye;
      const heading = dx * dirX + dy * dirY;
      const forward = heading * cp + dz * sp;
      const up = dz * cp - heading * sp;
      const side = -dx * dirY + dy * dirX;
      const radius = light.radius, near = forward - radius, far = forward + radius;
      if (far <= 0) continue;
      let left = 0, right = width, top = 0, bottom = height;
      if (near > 0) {
        const xMin = (side - radius) / (side - radius < 0 ? near : far);
        const xMax = (side + radius) / (side + radius > 0 ? near : far);
        const yMin = (up - radius) / (up - radius < 0 ? near : far);
        const yMax = (up + radius) / (up + radius > 0 ? near : far);
        left = Math.max(0, Math.floor((xMin / fovScale + 1) * width / 2));
        right = Math.min(width, Math.ceil((xMax / fovScale + 1) * width / 2) + 1);
        top = Math.max(0, Math.floor(rowOrigin - yMax * height - 0.5));
        bottom = Math.min(height, Math.ceil(rowOrigin - yMin * height - 0.5) + 1);
      }
      const radiusSquared = radius * radius;
      const red = (light.color >>> 16) * light.intensity;
      const green = (light.color >>> 8 & 255) * light.intensity;
      const blue = (light.color & 255) * light.intensity;
      for (let y = top; y < bottom; y++) {
        const rayUp = (rowOrigin - y - 0.5) / height;
        for (let x = left; x < right; x++) {
          const i = y * width + x, distance = depth[i];
          if (!Number.isFinite(distance) || distance < near || distance > far) continue;
          const atSide = distance * (x * columnStep - fovScale) - side;
          const atUp = distance * rayUp - up;
          const atForward = distance - forward;
          const distanceSquared = atSide * atSide + atUp * atUp + atForward * atForward;
          if (distanceSquared >= radiusSquared) continue;
          const edge = 1 - distanceSquared / radiusSquared, amount = edge * edge;
          const color = buffer[i];
          const r = Math.min(255, (color & 255) + red * amount) | 0;
          const g = Math.min(255, (color >>> 8 & 255) + green * amount) | 0;
          const b = Math.min(255, (color >>> 16 & 255) + blue * amount) | 0;
          buffer[i] = (4278190080 | b << 16 | g << 8 | r) >>> 0;
        }
      }
    }
  }

  // src/pixel3d/raycaster.ts
  var packed = (rgb2) => (4278190080 | (rgb2 & 255) << 16 | rgb2 & 65280 | rgb2 >>> 16 & 255) >>> 0;
  var FONT = {
    A: "010101111101101",
    B: "110101110101110",
    C: "011100100100011",
    D: "110101101101110",
    E: "111100110100111",
    F: "111100110100100",
    G: "011100101101011",
    H: "101101111101101",
    I: "111010010010111",
    J: "001001001101010",
    K: "101101110101101",
    L: "100100100100111",
    M: "101111111101101",
    N: "101111111111101",
    O: "010101101101010",
    P: "110101110100100",
    Q: "010101101111011",
    R: "110101110101101",
    S: "011100010001110",
    T: "111010010010010",
    U: "101101101101111",
    V: "101101101101010",
    W: "101101111111101",
    X: "101101010101101",
    Y: "101101010010010",
    Z: "111001010100111",
    "0": "111101101101111",
    "1": "010110010010111",
    "2": "110001010100111",
    "3": "110001010001110",
    "4": "101101111001001",
    "5": "111100110001110",
    "6": "011100111101111",
    "7": "111001010010010",
    "8": "111101111101111",
    "9": "111101111001110",
    ":": "000010000010000",
    "-": "000000111000000",
    "!": "010010010000010",
    "%": "101001010100101",
    "[": "011010010010011",
    "]": "110010010010110",
    "(": "010100100100010",
    ")": "010001001001010",
    "/": "001010010010100",
    ".": "000000000000010",
    ",": "000000000010010",
    "?": "110001010000010",
    "|": "010010010010010",
    "+": "000010111010000",
    "_": "000000000000111",
    ">": "100010001010100",
    "<": "001010100010001",
    " ": "000000000000000"
  };
  var Raycaster3D = class {
    constructor(config) {
      this.config = config;
      this.hudScale = 1;
      this.drawScale = 1;
      this.silhouettes = false;
      this.outlineColor = 4278190080;
      this.deferredColor = new Uint32Array(0);
      this.deferredOverlay = new Uint32Array(0);
      this.width = config.width;
      this.height = config.height;
      this.fov = config.fov || 66;
      this.silhouettes = Boolean(config.outline);
      if (config.outlineColor !== void 0) this.outlineColor = packed(config.outlineColor);
      this.buffer = new Uint32Array(this.width * this.height);
      this.zBuffer = new Float64Array(this.width);
      this.pixelDepth = new Float64Array(this.width * this.height);
      this.setMap(config.map);
    }
    get enhancedLighting() {
      return this.enhanced !== void 0;
    }
    setEnhancedLighting(enabled) {
      if (enabled) this.enhanced ?? (this.enhanced = new EnhancedLighting());
      else this.enhanced = void 0;
    }
    get outlineRadius() {
      return this.silhouettes ? Math.max(1, Math.round(this.hudScale)) : 0;
    }
    setMap(map) {
      const height = map.ceilingHeight ?? 1;
      if (!Number.isFinite(height) || height <= 0.5 || height > 16) {
        throw new Error("Map ceilingHeight must be greater than 0.5 and at most 16 tiles");
      }
      this.config.map = map;
    }
    resize(width, height, hudScale = 1) {
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 2048 || height > 2048 || width * height > 1048576) throw new Error("Invalid pixel3d viewport size");
      if (!Number.isFinite(hudScale) || hudScale <= 0) throw new Error("Invalid pixel3d HUD scale");
      const scaleChanged = this.hudScale !== hudScale;
      this.hudScale = hudScale;
      if (width === this.width && height === this.height) return scaleChanged;
      this.width = this.config.width = width;
      this.height = this.config.height = height;
      this.buffer = new Uint32Array(width * height);
      this.zBuffer = new Float64Array(width);
      this.pixelDepth = new Float64Array(width * height);
      return true;
    }
    setPalette(colors, silhouettes = false) {
      if (colors === void 0) {
        this.palette = void 0;
        this.silhouettes = silhouettes || Boolean(this.config.outline);
        return;
      }
      if (colors.length < 2 || colors.length > 16 || !colors.every((color) => Number.isInteger(color) && color >= 0 && color <= 16777215)) {
        throw new Error("Pixel-3d palette needs 2 to 16 RGB colors, from darkest to lightest");
      }
      this.palette = Uint32Array.from({ length: 256 }, (_, light) => packed(colors[Math.floor(light * colors.length / 256)]));
      this.silhouettes = silhouettes || Boolean(this.config.outline);
    }
    /** Pick visible model pixels, with a small near-miss allowance for touch. */
    projectPoint(camera, point) {
      const dx = point.x - camera.x, dy = point.y - camera.y;
      const z = point.z - (this.config.world ? (camera.z ?? 0) + 1.25 : camera.height ?? 0.5);
      const forward = dx * fastCos(camera.angle) + dy * fastSin(camera.angle);
      const pitch = (camera.pitch ?? 0) * Math.PI / 180;
      const d = forward * Math.cos(pitch) + z * Math.sin(pitch);
      if (d <= 1e-3) return void 0;
      return {
        x: this.width / 2 * (1 + (-dx * fastSin(camera.angle) + dy * fastCos(camera.angle)) / (d * Math.tan(this.fov * Math.PI / 360))),
        y: (this.height >> 1) - (z * Math.cos(pitch) - forward * Math.sin(pitch)) * this.height / d
      };
    }
    pickModels(camera, things, x, y) {
      if (![x, y].every(Number.isFinite)) throw new Error("Pixel-3d pick coordinates must be finite");
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
      const W = this.width, H = this.height;
      const buffer = new Uint32Array(W * H), depth = new Float64Array(W * H);
      const eye = this.config.world ? { ...camera, height: (camera.z ?? 0) + 1.25 } : camera;
      const fov = Math.tan(this.fov * Math.PI / 360);
      let selected = -1, bestDistance = Infinity, bestDepth = Infinity;
      const radius = 8;
      things.forEach((thing, index2) => {
        if (!thing || thing.visible === false || !thing.model) return;
        const model = this.config.models?.[thing.model];
        if (!model) throw new Error(`Unknown pixel-3d model: ${thing.model}`);
        depth.fill(Infinity);
        renderModel(model, thing, eye, fastCos(camera.angle), fastSin(camera.angle), fov, W, H, buffer, depth);
        for (let py = Math.max(0, Math.floor(y - radius)); py <= Math.min(H - 1, Math.ceil(y + radius)); py++) {
          for (let px = Math.max(0, Math.floor(x - radius)); px <= Math.min(W - 1, Math.ceil(x + radius)); px++) {
            const d = depth[py * W + px], distance = Math.hypot(px + 0.5 - x, py + 0.5 - y);
            if (distance > radius || !Number.isFinite(d) || d > this.pixelDepth[py * W + px] + 1e-6) continue;
            if (distance < bestDistance || distance === bestDistance && d < bestDepth) {
              selected = index2;
              bestDistance = distance;
              bestDepth = d;
            }
          }
        }
      });
      return selected;
    }
    render(camera, things = [], weapon, flash = 0, stats, wallOverrides = [], time = 0, preparedChunks, tethers = [], lights = [], deferredLighting) {
      const W = this.width;
      const H = this.height;
      const halfH = H >> 1;
      const map = this.config.map;
      const emission = this.enhanced?.begin(W, H);
      const px = camera.x;
      const py = camera.y;
      const ang = camera.angle;
      const pitched = !this.config.world && ((camera.height ?? 0.5) !== 0.5 || (camera.pitch ?? 0) !== 0 || map.sky?.below !== void 0 || lights.length > 0);
      const freeCamera = pitched || !!this.config.world;
      const dirX = freeCamera ? Math.cos(ang * Math.PI / 180) : fastCos(ang);
      const dirY = freeCamera ? Math.sin(ang * Math.PI / 180) : fastSin(ang);
      const fovScale = Math.tan(this.fov / 2 * Math.PI / 180);
      const planeX = -dirY * fovScale;
      const planeY = dirX * fovScale;
      this.pixelDepth.fill(Infinity);
      if (!this.config.world && (tethers.length || things.some((t) => t.model && t.visible !== false))) {
        for (let y = 0; y < H; y++) {
          if (y < halfH && map.sky) continue;
          const planeHeight = y < halfH ? (map.ceilingHeight ?? 1) - 0.5 : 0.5;
          const distance = planeHeight * H / Math.abs(halfH - y - 0.5);
          this.pixelDepth.fill(distance, y * W, (y + 1) * W);
        }
      }
      const backdrop = this.config.world ? camera.backdrop : void 0;
      if (this.config.world) {
        if (backdrop) this.renderSideBackdrop(backdrop.x ?? camera.x, backdrop, fovScale, time, emission);
        renderVoxels(
          this.config.world,
          camera,
          this.config.textures,
          map.sky,
          this.fov,
          W,
          H,
          this.buffer,
          this.pixelDepth,
          time,
          preparedChunks,
          Boolean(backdrop)
        );
        this.zBuffer.fill(Infinity);
      } else if (pitched) {
        renderGrid(
          map,
          camera,
          Object.values(this.config.textures),
          wallOverrides,
          things,
          this.config.sprites,
          this.fov,
          W,
          H,
          this.buffer,
          this.pixelDepth,
          time
        );
        this.zBuffer.fill(Infinity);
      } else {
        this.renderFloorAndCeiling(px, py, dirX, dirY, planeX, planeY, time);
        this.renderWalls(px, py, dirX, dirY, planeX, planeY, wallOverrides);
      }
      const modelCamera = this.config.world ? { ...camera, height: (camera.z ?? 0) + 1.25 } : camera;
      const backdropThings = backdrop && new Set(backdrop.things);
      for (const thing of things) {
        if (thing.visible === false || !thing.model || backdropThings?.has(thing)) continue;
        const model = this.config.models?.[thing.model];
        if (!model) throw new Error(`Unknown pixel-3d model: ${thing.model}`);
        this.enhanced?.rememberGlass(thing, model);
        const haze = emission && (!this.config.world || !backdrop && thing.y < 4) ? Math.min(0.2, Math.max(
          0,
          ((thing.x - px) * dirX + (thing.y - py) * dirY - 11) * 0.025
        )) : 0;
        renderModel(
          model,
          thing,
          modelCamera,
          dirX,
          dirY,
          fovScale,
          W,
          H,
          this.buffer,
          this.pixelDepth,
          emission,
          haze,
          map.sky?.horizon
        );
      }
      for (const tether of tethers) {
        if (tether.visible === false) continue;
        const rod = tetherModel(false, packed(tether.color)), joint = tetherModel(true, packed(tether.color));
        for (const piece of tetherPieces(tether)) {
          renderModel(piece.joint ? joint : rod, piece, modelCamera, dirX, dirY, fovScale, W, H, this.buffer, this.pixelDepth);
        }
      }
      if (!this.config.world && !pitched && things && things.length > 0) {
        this.renderThings(px, py, dirX, dirY, planeX, planeY, things);
      }
      if (deferredLighting) {
        if (this.deferredColor.length !== this.buffer.length) {
          this.deferredColor = new Uint32Array(this.buffer.length);
          this.deferredOverlay = new Uint32Array(this.buffer.length);
        }
        this.deferredColor.set(this.buffer);
        const rowOrigin = this.config.world ? H / 2 : halfH;
        const enhancement = this.enhanced?.prepareDeferred(
          this.pixelDepth,
          modelCamera,
          dirX,
          dirY,
          fovScale,
          rowOrigin,
          this.config.world,
          things,
          this.config.models ?? {},
          map.sky?.horizon
        );
        this.buffer.fill(0);
        this.renderWorldTitles(camera, things, dirX, dirY, fovScale);
        if (weapon?.sprite) this.renderWeapon(weapon);
        this.deferredOverlay.set(this.buffer);
        this.buffer.fill(0);
        if (stats) this.drawHud(stats);
        deferredLighting({
          width: W,
          height: H,
          color: this.deferredColor,
          depth: this.pixelDepth,
          sceneOverlay: this.deferredOverlay,
          hud: this.buffer,
          camera: modelCamera,
          dirX,
          dirY,
          fov: fovScale,
          rowOrigin,
          lights,
          enhancement,
          outlineRadius: this.outlineRadius,
          outlineColor: this.outlineColor,
          flash,
          fade: stats?.ui?.cinema?.fade ?? 0,
          palette: this.palette
        });
        return this.buffer;
      }
      if (lights.length) {
        lightFrame(
          lights,
          this.buffer,
          this.pixelDepth,
          W,
          H,
          modelCamera,
          dirX,
          dirY,
          fovScale,
          this.config.world ? H / 2 : halfH
        );
      }
      this.enhanced?.finish(
        this.buffer,
        this.pixelDepth,
        modelCamera,
        dirX,
        dirY,
        fovScale,
        this.config.world ? H / 2 : halfH,
        this.config.world,
        things,
        this.config.models ?? {},
        map.sky?.horizon
      );
      if (this.silhouettes) this.drawSilhouettes();
      this.renderWorldTitles(camera, things, dirX, dirY, fovScale);
      if (weapon && weapon.sprite) {
        this.renderWeapon(weapon);
      }
      if (flash > 0) {
        this.applyFlash(flash);
      }
      const fade = stats?.ui?.cinema?.fade ?? 0;
      if (fade > 0) {
        const light = 1 - Math.min(1, fade);
        for (let i = 0; i < this.buffer.length; i++) {
          const c = this.buffer[i];
          this.buffer[i] = (4278190080 | Math.floor((c & 255) * light) | Math.floor((c >>> 8 & 255) * light) << 8 | Math.floor((c >>> 16 & 255) * light) << 16) >>> 0;
        }
      }
      if (stats) this.drawHud(stats);
      this.applyPalette();
      return this.buffer;
    }
    renderSideBackdrop(x, backdrop, fovScale, time, emission) {
      if (![x, backdrop.y, backdrop.z].every(Number.isFinite) || !Array.isArray(backdrop.things)) {
        throw new Error("Voxel backdrop needs a finite side camera position and a model list");
      }
      const { width, height, buffer, pixelDepth } = this;
      const sky = this.config.map.sky;
      buffer.fill(sky ? (4278190080 | sky.horizon) >>> 0 : 4281608224);
      if (sky) {
        const longitudes = Float64Array.from({ length: width }, (_, col) => Math.atan2(-1, (2 * col / width - 1) * fovScale));
        const rows2 = sky.below === void 0 ? height >> 1 : height;
        for (let row = 0; row < rows2; row++) {
          const altitude = (height / 2 - row - 0.5) / height;
          for (let col = 0; col < width; col++) {
            buffer[row * width + col] = skyPixel(sky, longitudes[col], altitude, time);
          }
        }
      }
      const camera = { x, y: backdrop.y, height: backdrop.z + 1.25 };
      for (const thing of backdrop.things) {
        if (thing.visible === false || !thing.model) continue;
        const model = this.config.models?.[thing.model];
        if (!model) throw new Error(`Unknown pixel-3d model: ${thing.model}`);
        const haze = emission ? Math.min(0.22, Math.max(0, (backdrop.y - thing.y - 10) * 0.027)) : 0;
        renderModel(model, thing, camera, 0, -1, fovScale, width, height, buffer, pixelDepth, emission, haze, sky?.horizon);
      }
      this.enhanced?.backdrop(buffer, pixelDepth);
      if (this.silhouettes) this.drawSilhouettes();
      pixelDepth.fill(Infinity);
    }
    /** Transparent HUD for the browser's model renderer. Uses the same layout and palette. */
    renderOverlay(stats) {
      this.buffer.fill(0);
      this.drawHud(stats);
      this.applyPalette(true);
    }
    drawHud(stats) {
      this.drawScale = this.hudScale;
      try {
        this.renderHUD(stats);
        stats.keyboard?.render({
          width: Math.floor(this.width / this.drawScale),
          height: Math.floor(this.height / this.drawScale),
          rect: this.rect.bind(this),
          text: this.text.bind(this)
        }, stats.ui?.theme);
      } finally {
        this.drawScale = 1;
      }
    }
    applyPalette(transparent = false) {
      const palette = this.palette;
      if (palette) {
        const pixels = this.buffer;
        for (let i = 0; i < pixels.length; i++) {
          const pixel = pixels[i];
          if (transparent && pixel === 0) continue;
          const light = (pixel & 255) * 54 + (pixel >>> 8 & 255) * 183 + (pixel >>> 16 & 255) * 19 >>> 8;
          pixels[i] = palette[light];
        }
      }
    }
    drawSilhouettes() {
      const { width, height, pixelDepth: depth, buffer } = this;
      const radius = this.outlineRadius;
      const diagonal = radius > 1 ? Math.max(1, Math.floor(radius / Math.SQRT2)) : 0;
      for (let y = 0; y < height; y++) {
        const row = y * width, above = Math.max(0, y - radius) * width, below = Math.min(height - 1, y + radius) * width;
        const upper = Math.max(0, y - diagonal) * width, lower = Math.min(height - 1, y + diagonal) * width;
        for (let x = 0; x < width; x++) {
          const i = row + x;
          let edge = Math.min(
            depth[row + Math.max(0, x - radius)],
            depth[row + Math.min(width - 1, x + radius)],
            depth[above + x],
            depth[below + x]
          );
          if (diagonal) {
            const left = Math.max(0, x - diagonal), right = Math.min(width - 1, x + diagonal);
            edge = Math.min(edge, depth[upper + left], depth[upper + right], depth[lower + left], depth[lower + right]);
          }
          if (depth[i] - edge > Math.max(0.12, edge * 0.025)) buffer[i] = this.outlineColor;
        }
      }
    }
    /** Pixel-font plaques anchored above actors, using the same projection/depth as models. */
    renderWorldTitles(camera, things, dirX, dirY, fov) {
      const eye = this.config.world ? (camera.z ?? 0) + 1.25 : camera.height ?? 0.5;
      const pitch = (camera.pitch ?? 0) * Math.PI / 180, cp = Math.cos(pitch), sp = Math.sin(pitch);
      const labels = [];
      for (const thing of things) {
        if (thing.visible === false || thing.title === void 0 || (thing.dissolve ?? 0) >= 1) continue;
        if (typeof thing.title !== "string" || !/^([\x20-\x7e]){1,48}$/.test(thing.title)) throw new Error("Thing title must contain 1-48 printable characters");
        if (thing.titleHeight !== void 0 && (!Number.isFinite(thing.titleHeight) || thing.titleHeight < 0 || thing.titleHeight > 64)) throw new Error("Thing titleHeight must be in [0, 64]");
        if (thing.titleColor !== void 0 && (!Number.isInteger(thing.titleColor) || thing.titleColor < 0 || thing.titleColor > 16777215)) throw new Error("Thing titleColor must be an RGB integer");
        if (![thing.x, thing.y, thing.z ?? 0, thing.scale ?? 1].every(Number.isFinite) || (thing.scale ?? 1) <= 0) throw new Error("Titled thing position and scale must be finite and scale positive");
        let height = 1;
        for (const block of this.config.models?.[thing.model ?? ""]?.blocks ?? []) height = Math.max(height, block.from[2] + block.size[2]);
        const z = (thing.z ?? 0) + (thing.titleHeight ?? height * (thing.scale ?? 1) + 0.4);
        const dx = thing.x - camera.x, dy = thing.y - camera.y, forward = dx * dirX + dy * dirY;
        const distance = forward * cp + (z - eye) * sp, side = -dx * dirY + dy * dirX, up = (z - eye) * cp - forward * sp;
        if (distance <= 0.1 || distance > 48) continue;
        const width = thing.title.length * 4 - 1, x = Math.round(this.width / 2 * (1 + side / (distance * fov)) - width / 2);
        const y = Math.round((this.height >> 1) - up * this.height / distance) - 5;
        if (x + width + 3 < 0 || x - 3 >= this.width || y + 7 < 0 || y - 2 >= this.height) continue;
        labels.push({ text: thing.title.toUpperCase(), x, y, distance, color: thing.titleColor ?? 10283741 });
      }
      labels.sort((a, b) => b.distance - a.distance);
      for (const label of labels) {
        const width = label.text.length * 4 - 1;
        const pixel = (x, y, color) => {
          if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
            const i = y * this.width + x;
            if (label.distance < this.pixelDepth[i]) this.buffer[i] = packed(color);
          }
        };
        for (let y = -2; y < 7; y++) for (let x = -3; x < width + 3; x++) pixel(label.x + x, label.y + y, y === 6 ? 2646380 : 727844);
        for (let c = 0; c < label.text.length; c++) {
          const glyph = FONT[label.text[c]];
          if (!glyph) continue;
          for (let i = 0; i < glyph.length; i++) if (glyph[i] === "1") pixel(label.x + c * 4 + i % 3, label.y + Math.floor(i / 3), label.color);
        }
      }
    }
    rect(x, y, width, height, color) {
      const c = packed(color);
      const scale = this.drawScale;
      const left = Math.min(this.width, Math.max(0, Math.floor(x * scale)));
      const top = Math.max(0, Math.floor(y * scale));
      const right = Math.min(this.width, Math.floor((x + width) * scale));
      const bottom = Math.min(this.height, Math.floor((y + height) * scale));
      for (let row = top; row < bottom; row++) {
        this.buffer.fill(c, row * this.width + left, row * this.width + Math.max(left, right));
      }
    }
    text(str, x, y, color = 16116172, scale = 1, clip) {
      let curX = Math.floor(x);
      const curY = Math.floor(y);
      for (const char of str.toUpperCase()) {
        const glyph = FONT[char];
        if (glyph) {
          for (let p = 0; p < glyph.length; p++) {
            if (glyph[p] === "1") {
              const y2 = curY + Math.floor(p / 3) * scale, top = Math.max(y2, clip?.top ?? y2), bottom = Math.min(y2 + scale, clip?.bottom ?? y2 + scale);
              if (bottom > top) this.rect(curX + p % 3 * scale, top, scale, bottom - top, color);
            }
          }
        }
        curX += 4 * scale;
      }
    }
    renderHUD(stats) {
      const W = Math.floor(this.width / this.drawScale);
      const H = Math.floor(this.height / this.drawScale);
      if (stats.titleScene) {
        const title = stats.titleScene;
        const scale = Math.max(1, Math.min(4, Math.floor((W - 32) / (title.heading.length * 4))));
        const left = Math.floor((W - (title.heading.length * 4 - 1) * scale) / 2);
        const top = Math.floor(H * 0.18);
        const pulse = 0.6 + 0.4 * Math.sin((stats.presentationTime ?? 0) * 2);
        for (const [radius, color] of [[3, 1060157], [2, 1594219], [1, 3316907]]) {
          for (const [ox, oy] of [[-radius, 0], [radius, 0], [0, -radius], [0, radius]]) {
            this.text(title.heading, left + ox, top + oy, color, scale);
          }
        }
        const channel = Math.floor(205 + 50 * pulse);
        this.text(title.heading, left, top, channel << 16 | 65535, scale);
        const centered = (text, y, color) => this.text(
          text,
          Math.max(4, Math.floor((W - text.length * 4) / 2)),
          y,
          color
        );
        centered(title.subtitle, top + 5 * scale + 12, 10340050);
        this.rect(0, H - 23, W, 23, 528152);
        centered(title.prompt, H - 15, 10873068);
        if (stats.ui?.panel) {
          const canvas = this.drawScale === 1 ? this : {
            width: W,
            height: H,
            rect: this.rect.bind(this),
            text: this.text.bind(this)
          };
          renderHud(canvas, { ...stats.ui, style: "floating", heading: "", detail: "", objective: "", prompt: "" }, stats.status || "title", false, this.config.sprites);
        }
        return;
      }
      if (stats.ui) {
        const canvas = this.drawScale === 1 ? this : {
          width: W,
          height: H,
          rect: this.rect.bind(this),
          text: this.text.bind(this)
        };
        renderHud(canvas, stats.ui, stats.status || "playing", stats.paused || false, this.config.sprites);
        return;
      }
      if (stats.presentation) {
        const p = stats.presentation;
        this.rect(0, 0, W, 10, 658446);
        this.text(stats.hudText || p.title, 6, 2, 16174148);
        if (stats.status !== "playing") {
          const bx = 18, by = 24;
          this.rect(bx, by, W - 36, H - 48, 1053212);
          this.rect(bx, by, W - 36, 2, 11703392);
          const title = stats.status === "won" ? p.victory : stats.status === "gameover" ? p.defeat : p.title;
          this.text(title, bx + 12, by + 14, 16174148, 2);
          this.text(p.subtitle, bx + 12, by + 34, 10532551);
          p.instructions.forEach((line, i) => this.text(line, bx + 12, by + 52 + i * 13, 14999764));
          this.text("ENTER / CLICK: BEGIN A NEW RUN", bx + 12, H - 44, 6728260);
        }
        const message = stats.message || p.objective;
        this.rect(0, H - 12, W, 12, 658446);
        this.text(message, 6, H - 9, 14999764);
        return;
      }
      if (stats.status === "title") {
        const bw = 280;
        const bh = 160;
        const bx = Math.floor((W - bw) / 2);
        const by = Math.floor((H - bh) / 2);
        this.rect(bx, by, bw, bh, 461842);
        this.rect(bx, by, bw, 2, 4029066);
        this.rect(bx, by + bh - 2, bw, 2, 4029066);
        this.rect(bx, by, 2, bh, 4029066);
        this.rect(bx + bw - 2, by, 2, bh, 4029066);
        this.text("VECT BREACH", bx + 36, by + 16, 16174148, 3);
        this.text("CYBERNETIC SECTOR INFILTRATION", bx + 28, by + 46, 8952234, 1);
        this.rect(bx + 20, by + 60, bw - 40, 1, 2241348);
        this.text("WASD: MOVE / STRAFE       MOUSE: AIM", bx + 22, by + 72, 13932834, 1);
        this.text("SPACE / L-CLICK: FIRE     E: USE SWITCH", bx + 22, by + 86, 13932834, 1);
        this.text("PURGE GUARDS - UNLOCK ELEVATORS - SURVIVE", bx + 16, by + 102, 5596791, 1);
        this.rect(bx + 20, by + 118, bw - 40, 1, 2241348);
        this.text("PRESS ENTER OR CLICK TO BEGIN MISSION", bx + 18, by + 132, 6728260, 1);
        return;
      }
      if (stats.status === "story") {
        const bw = 284;
        const bh = 164;
        const bx = Math.floor((W - bw) / 2);
        const by = Math.floor((H - bh) / 2);
        this.rect(bx, by, bw, bh, 397578);
        this.rect(bx, by, bw, 2, 4500019);
        this.rect(bx, by + bh - 2, bw, 2, 4500019);
        this.rect(bx, by, 2, bh, 4500019);
        this.rect(bx + bw - 2, by, 2, bh, 4500019);
        this.text("// HIGH COMMAND TRANSMISSION //", bx + 28, by + 12, 16174148, 1);
        this.text(stats.levelTitle || stats.storyTitle || "SECTOR BRIEFING", bx + 28, by + 26, 6728260, 1);
        this.rect(bx + 16, by + 38, bw - 32, 1, 1785893);
        const body = stats.storyBody || "";
        const lines = body.split("|");
        let textY = by + 48;
        for (const line of lines) {
          if (line.trim().length > 0) {
            this.text(line.trim(), bx + 20, textY, 14999764, 1);
            textY += 14;
          }
        }
        this.rect(bx + 16, by + 124, bw - 32, 1, 1785893);
        this.text("OBJECTIVE: LOCATE TERMINAL SWITCH & EXTRACT", bx + 18, by + 132, 13932834, 1);
        this.text("PRESS ENTER OR CLICK TO ENGAGE", bx + 42, by + 146, 6728260, 1);
        return;
      }
      this.rect(0, 0, W, 9, 658446);
      const hp = stats.health ?? 100;
      const hpColor = hp > 30 ? 6728260 : 14496546;
      this.text(`SEC 0${stats.level ?? 1}`, 6, 2, 8952234);
      this.text(`HP: ${hp}%`, 54, 2, hpColor);
      this.text(`AMMO: ${stats.ammo ?? 24}`, 114, 2, 16174148);
      this.text(`KILLS: ${stats.kills ?? 0}`, 174, 2, 8952234);
      this.text(`SCORE: ${stats.score ?? 0}`, 230, 2, 14999764);
      if (stats.switchActivated) {
        this.text("OVR", 296, 2, 6728260);
      }
      if (stats.heading !== void 0) {
        const directions = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
        const direction = directions[Math.floor(((stats.heading % 360 + 360) % 360 + 22.5) / 45) % 8];
        this.rect(W - 48, 11, 46, 9, 658446);
        this.text(`FACING ${direction}`, W - 45, 13, 16174148);
      }
      if (stats.message && stats.message.length > 0) {
        const msgW = Math.min(W - 20, stats.message.length * 4 + 16);
        const msgX = Math.floor((W - msgW) / 2);
        this.rect(msgX, H - 24, msgW, 12, 658446);
        this.rect(msgX, H - 24, msgW, 1, 13932834);
        this.text(stats.message, msgX + 8, H - 21, 16174148, 1);
      }
      if (stats.status === "won") {
        const bw = 250;
        const bh = 68;
        const bx = Math.floor((W - bw) / 2);
        const by = Math.floor((H - bh) / 2) - 10;
        this.rect(bx, by, bw, bh, 660493);
        this.rect(bx, by, bw, 2, 6728260);
        this.rect(bx, by + bh - 2, bw, 2, 6728260);
        this.rect(bx, by, 2, bh, 6728260);
        this.rect(bx + bw - 2, by, 2, bh, 6728260);
        this.text("MISSION ACCOMPLISHED", bx + 26, by + 10, 16174148, 2);
        this.text("ALL 3 SECTORS SECURED // SYSTEM PURGED", bx + 16, by + 28, 6728260, 1);
        this.text(`FINAL SCORE: ${stats.score ?? 0}  |  KILLS: ${stats.kills ?? 0}`, bx + 36, by + 40, 8952234, 1);
        this.text("PRESS FIRE, CLICK OR ENTER TO REPLAY", bx + 20, by + 54, 14999764, 1);
      }
      if (stats.status === "gameover") {
        const bw = 240;
        const bh = 60;
        const bx = Math.floor((W - bw) / 2);
        const by = Math.floor((H - bh) / 2) - 10;
        this.rect(bx, by, bw, bh, 2034186);
        this.rect(bx, by, bw, 2, 14496546);
        this.rect(bx, by + bh - 2, bw, 2, 14496546);
        this.rect(bx, by, 2, bh, 14496546);
        this.rect(bx + bw - 2, by, 2, bh, 14496546);
        this.text("AGENT TERMINATED", bx + 38, by + 10, 14496546, 2);
        this.text("CRITICAL VITALS LOST // SIGNAL LOST", bx + 30, by + 28, 14496546, 1);
        this.text("PRESS FIRE, CLICK OR ENTER TO RETRY", bx + 14, by + 44, 16174148, 1);
      }
    }
    renderFloorAndCeiling(px, py, dirX, dirY, planeX, planeY, time) {
      const W = this.width;
      const H = this.height;
      const halfH = H >> 1;
      const map = this.config.map;
      const floorIsTex = typeof map.floor === "object" && map.floor !== null;
      const ceilIsTex = typeof map.ceiling === "object" && map.ceiling !== null;
      const floorColor = !floorIsTex ? typeof map.floor === "number" ? (map.floor & 4278190080) === 0 ? (4278190080 | map.floor) >>> 0 : map.floor >>> 0 : 4281545523 : 0;
      const ceilColor = !ceilIsTex ? typeof map.ceiling === "number" ? (map.ceiling & 4278190080) === 0 ? (4278190080 | map.ceiling) >>> 0 : map.ceiling >>> 0 : 4279900698 : 0;
      if (!floorIsTex && !ceilIsTex && !map.sky) {
        for (let y = 0; y < halfH; y++) {
          this.buffer.fill(ceilColor, y * W, (y + 1) * W);
        }
        for (let y = halfH; y < H; y++) {
          this.buffer.fill(floorColor, y * W, (y + 1) * W);
        }
        return;
      }
      const floorTex = floorIsTex ? map.floor : null;
      const ceilTex = ceilIsTex ? map.ceiling : null;
      this.buffer.fill(ceilColor, 0, halfH * W);
      this.buffer.fill(floorColor, halfH * W);
      if (map.sky) {
        for (let x = 0; x < W; x++) {
          const cx = 2 * x / W - 1;
          const longitude = Math.atan2(dirY + planeY * cx, dirX + planeX * cx);
          for (let y = 0; y < halfH; y++) {
            this.buffer[y * W + x] = skyPixel(map.sky, longitude, (halfH - y) / halfH, time);
          }
        }
      }
      for (let y = halfH; y < H; y++) {
        const p = y - halfH + 0.5;
        const posZ = 0.5 * H;
        const rowDistance = posZ / p;
        const rowFloorIdx = y * W;
        const rowCeilIdx = (H - y - 1) * W;
        for (let x = 0; x < W; x++) {
          const cx = 2 * x / W - 1;
          const floorX = px + rowDistance * (dirX + planeX * cx);
          const floorY = py + rowDistance * (dirY + planeY * cx);
          if (floorTex) {
            const tx = Math.floor(floorX * floorTex.width) & floorTex.width - 1;
            const ty = Math.floor(floorY * floorTex.height) & floorTex.height - 1;
            this.buffer[rowFloorIdx + x] = floorTex.pixels[ty * floorTex.width + tx];
          } else {
            this.buffer[rowFloorIdx + x] = floorColor;
          }
          if (!map.sky && ceilTex) {
            const ceilingDistance = ((map.ceilingHeight ?? 1) - 0.5) * H / p;
            const ceilingX = px + ceilingDistance * (dirX + planeX * cx);
            const ceilingY = py + ceilingDistance * (dirY + planeY * cx);
            const tx = Math.floor(ceilingX * ceilTex.width) & ceilTex.width - 1;
            const ty = Math.floor(ceilingY * ceilTex.height) & ceilTex.height - 1;
            this.buffer[rowCeilIdx + x] = ceilTex.pixels[ty * ceilTex.width + tx];
          } else if (!map.sky) {
            this.buffer[rowCeilIdx + x] = ceilColor;
          }
        }
      }
    }
    renderWalls(px, py, dirX, dirY, planeX, planeY, wallOverrides) {
      const W = this.width;
      const H = this.height;
      const halfH = H >> 1;
      const map = this.config.map;
      const textureList = Object.values(this.config.textures);
      for (let x = 0; x < W; x++) {
        const cameraX = 2 * x / W - 1;
        const rayDirX = dirX + planeX * cameraX;
        const rayDirY = dirY + planeY * cameraX;
        let mapX = Math.floor(px);
        let mapY = Math.floor(py);
        const deltaDistX = Math.abs(1 / (rayDirX === 0 ? 1e-6 : rayDirX));
        const deltaDistY = Math.abs(1 / (rayDirY === 0 ? 1e-6 : rayDirY));
        let stepX;
        let stepY;
        let sideDistX;
        let sideDistY;
        if (rayDirX < 0) {
          stepX = -1;
          sideDistX = (px - mapX) * deltaDistX;
        } else {
          stepX = 1;
          sideDistX = (mapX + 1 - px) * deltaDistX;
        }
        if (rayDirY < 0) {
          stepY = -1;
          sideDistY = (py - mapY) * deltaDistY;
        } else {
          stepY = 1;
          sideDistY = (mapY + 1 - py) * deltaDistY;
        }
        let hit = 0;
        let side = 0;
        while (hit === 0) {
          if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
          } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
          }
          if (mapX < 0 || mapX >= map.width || mapY < 0 || mapY >= map.height) {
            hit = 1;
            break;
          }
          const cell = map.grid[mapY * map.width + mapX];
          if (cell > 0) {
            hit = cell;
          }
        }
        let perpWallDist;
        if (side === 0) {
          perpWallDist = sideDistX - deltaDistX;
        } else {
          perpWallDist = sideDistY - deltaDistY;
        }
        if (perpWallDist < 1e-3) perpWallDist = 1e-3;
        this.zBuffer[x] = perpWallDist;
        const lineHeight = Math.floor(H / perpWallDist);
        const drawStart = Math.max(0, Math.floor(-lineHeight * ((map.ceilingHeight ?? 1) - 0.5) + halfH));
        const drawEnd = Math.min(H - 1, Math.floor(lineHeight / 2 + halfH));
        const override = wallOverrides.find((tile) => tile.x === mapX && tile.y === mapY);
        const tex = (override ? textureList[override.texture] : void 0) || textureList[(hit - 1) % textureList.length] || textureList[0];
        if (!tex) continue;
        let wallX;
        if (side === 0) {
          wallX = py + perpWallDist * rayDirY;
        } else {
          wallX = px + perpWallDist * rayDirX;
        }
        wallX -= Math.floor(wallX);
        let texX = Math.floor(wallX * tex.width);
        if (side === 0 && rayDirX > 0) texX = tex.width - texX - 1;
        if (side === 1 && rayDirY < 0) texX = tex.width - texX - 1;
        texX = Math.max(0, Math.min(tex.width - 1, texX));
        const step = tex.height / lineHeight;
        const originalStart = Math.max(0, Math.floor(-lineHeight / 2 + halfH));
        let texPos = (drawStart - halfH + lineHeight / 2) * step;
        for (let y = drawStart; y <= drawEnd; y++) {
          if (y === originalStart) texPos = (originalStart - halfH + lineHeight / 2) * step;
          const texY = y < originalStart ? (Math.floor(texPos) % tex.height + tex.height) % tex.height : Math.min(tex.height - 1, Math.max(0, Math.floor(texPos)));
          texPos += step;
          let color = tex.pixels[texY * tex.width + texX] ?? 4278190080;
          if (side === 1) {
            const r = Math.floor((color & 255) * 0.75);
            const g = Math.floor((color >> 8 & 255) * 0.75);
            const b = Math.floor((color >> 16 & 255) * 0.75);
            color = (4278190080 | b << 16 | g << 8 | r) >>> 0;
          }
          this.buffer[y * W + x] = color;
          this.pixelDepth[y * W + x] = perpWallDist;
        }
      }
    }
    renderThings(px, py, dirX, dirY, planeX, planeY, things) {
      const W = this.width;
      const H = this.height;
      const halfH = H >> 1;
      const sorted = things.filter((t) => t.visible !== false).map((t) => ({
        ...t,
        dist: (px - t.x) * (px - t.x) + (py - t.y) * (py - t.y)
      })).sort((a, b) => b.dist - a.dist);
      const invDet = 1 / (planeX * dirY - dirX * planeY);
      for (const thing of sorted) {
        if (thing.model || !thing.sprite) continue;
        const sprite = this.config.sprites[thing.sprite];
        if (!sprite) continue;
        const spriteX = thing.x - px;
        const spriteY = thing.y - py;
        const transformX = invDet * (dirY * spriteX - dirX * spriteY);
        const transformY = invDet * (-planeY * spriteX + planeX * spriteY);
        if (transformY <= 0.1) continue;
        const spriteScreenX = Math.floor(W / 2 * (1 + transformX / transformY));
        const scale = thing.scale || 1;
        const spriteH = Math.abs(Math.floor(H / transformY * scale));
        const spriteW = Math.abs(Math.floor(H / transformY * scale * (sprite.width / sprite.height)));
        const drawStartY = Math.max(0, Math.floor(-spriteH / 2 + halfH));
        const drawEndY = Math.min(H - 1, Math.floor(spriteH / 2 + halfH));
        const drawStartX = Math.max(0, Math.floor(-spriteW / 2 + spriteScreenX));
        const drawEndX = Math.min(W - 1, Math.floor(spriteW / 2 + spriteScreenX));
        for (let stripe = drawStartX; stripe <= drawEndX; stripe++) {
          if (transformY < this.zBuffer[stripe]) {
            const texX = Math.floor((stripe - (-spriteW / 2 + spriteScreenX)) * sprite.width / spriteW);
            if (texX < 0 || texX >= sprite.width) continue;
            for (let y = drawStartY; y <= drawEndY; y++) {
              const d = y - halfH + spriteH / 2;
              const texY = Math.floor(d * sprite.height / spriteH);
              if (texY < 0 || texY >= sprite.height) continue;
              const colorIdx = sprite.pixels[texY * sprite.width + texX];
              const color = sprite.colors[colorIdx];
              if (color !== null && color !== void 0 && transformY < this.pixelDepth[y * W + stripe]) {
                this.buffer[y * W + stripe] = packed(color);
              }
            }
          }
        }
      }
    }
    renderWeapon(weapon) {
      const sprite = this.config.sprites[weapon.sprite];
      if (!sprite) return;
      const W = this.width;
      const H = this.height;
      const scale = 2.5;
      const renderW = Math.floor(sprite.width * scale);
      const renderH = Math.floor(sprite.height * scale);
      const bobOffset = weapon.bob ? Math.sin(weapon.bob) * 4 : 0;
      const startX = Math.floor(W / 2 - renderW / 2 + (weapon.x || 0));
      const startY = Math.floor(H - renderH + (weapon.y || 0) + bobOffset);
      for (let sy = 0; sy < renderH; sy++) {
        const destY = startY + sy;
        if (destY < 0 || destY >= H) continue;
        const texY = Math.floor(sy * sprite.height / renderH);
        for (let sx = 0; sx < renderW; sx++) {
          const destX = startX + sx;
          if (destX < 0 || destX >= W) continue;
          const texX = Math.floor(sx * sprite.width / renderW);
          const colorIdx = sprite.pixels[texY * sprite.width + texX];
          const color = sprite.colors[colorIdx];
          if (color !== null && color !== void 0) {
            this.buffer[destY * W + destX] = packed(color);
          }
        }
      }
    }
    applyFlash(amount) {
      const intensity = Math.min(1, amount * 0.12);
      const W = this.width;
      const H = this.height;
      for (let i = 0; i < W * H; i++) {
        const c = this.buffer[i];
        let r = c & 255;
        let g = c >> 8 & 255;
        let b = c >> 16 & 255;
        r = Math.min(255, r + Math.floor(180 * intensity));
        g = Math.max(0, g - Math.floor(50 * intensity));
        b = Math.max(0, b - Math.floor(50 * intensity));
        this.buffer[i] = (4278190080 | b << 16 | g << 8 | r) >>> 0;
      }
    }
  };

  // src/pixel3d/camera.ts
  function sampleCamera(track, seconds) {
    const points = track.points, n = points.length;
    const progress = track.loop ? (seconds / track.duration % 1 + 1) % 1 : Math.max(0, Math.min(1, seconds / track.duration));
    const at = progress * (track.loop ? n : n - 1);
    const segment = Math.min(Math.floor(at), track.loop ? n - 1 : n - 2), t = at - segment;
    const point = (i) => points[track.loop ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    const result = {};
    for (const key2 of ["x", "y", "height", "angle", "pitch"]) {
      const values = [-1, 0, 1, 2].map((i) => point(segment + i)[key2] ?? (key2 === "height" ? 0.5 : 0));
      if (key2 === "angle") {
        for (let i = 1; i < 4; i++) values[i] = values[i - 1] + ((values[i] - values[i - 1] + 540) % 360 + 360) % 360 - 180;
      }
      const [a, b, c, d] = values;
      result[key2] = 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    }
    result.height = Math.max(0.05, result.height);
    result.pitch = Math.max(-85, Math.min(85, result.pitch));
    return result;
  }

  // src/pixel3d/engine.ts
  var Pixel3DEngine = class {
    constructor(config, options) {
      this.config = config;
      this.keyboard = new OnScreenKeyboard();
      this.hudPadHeld = /* @__PURE__ */ new Set();
      this.calloutFocus = 0;
      this.uiFullscreen = false;
      this._paused = false;
      this._muted = false;
      this.frameRevision = 0;
      this.presentedRevision = -1;
      this.ticks = 0;
      this.presentationTicks = 0;
      this.wasTitle = false;
      this.currentMapName = "";
      this.modelRadius = 0;
      if (config.renderRadius !== void 0 && (!Number.isFinite(config.renderRadius) || config.renderRadius <= 0 || config.renderRadius > 4096)) throw new Error("renderRadius must be in (0, 4096]");
      for (const model of Object.values(config.models ?? {})) for (const block of model.blocks) {
        this.modelRadius = Math.max(this.modelRadius, Math.hypot(...block.from.map((v, i) => Math.max(Math.abs(v), Math.abs(v + block.size[i])))));
      }
      for (const sprite of Object.values(config.sprites)) this.modelRadius = Math.max(this.modelRadius, Math.hypot(sprite.width / sprite.height / 2, 0.5));
      if (typeof window === "undefined") {
        Object.assign(globalThis, { window: globalThis });
      }
      this.raycaster = new Raycaster3D({
        fov: config.fov,
        outline: config.outline,
        outlineColor: config.outlineColor,
        width: config.width,
        height: config.height,
        textures: config.textures,
        sprites: config.sprites,
        models: config.models,
        map: config.map
      });
      Object.assign(globalThis, {
        __RuneSpatialMaps: config.maps || {},
        __RuneSideMaps: config.sideMaps || {}
      });
      const spatialMap = {
        width: config.map.width,
        height: config.map.height,
        grid: config.map.grid
      };
      setActiveMap(spatialMap);
      this.app = createLogicApp(function() {
        this.computeDerived();
      });
      this.context = {
        ...options,
        app: this.app,
        isRendering: false,
        compactScopes: true,
        memorySubscriptions: {},
        initialState: JSON.parse(JSON.stringify(options.stateJson)),
        loadedChunks: {},
        loadingChunks: {},
        navigator: null
      };
      this.app.state = JSON.parse(JSON.stringify(options.stateJson));
      if (config.controls) this.controls = new GameControls(config.controls, this);
      configureAudioHost({
        syncPage: false,
        deferPlayback: typeof document !== "undefined"
      });
      registerSounds(options.sounds);
      registerMusic(options.music);
      if (config.persistence) {
        this.save = new GameSave(config.persistence);
        this.app.state[config.persistence.state] = this.save.load(
          this.app.state[config.persistence.state]
        );
      }
      withContext(this.context, () => {
        if (options.actionDefinitions.initialize) {
          this.app.invokeAction("initialize", []);
        }
        this.app.computeDerived();
      });
      this.syncScene();
      this.persist();
    }
    consumeUiFullscreen() {
      const requested = this.uiFullscreen;
      this.uiFullscreen = false;
      return requested;
    }
    keyboardHud() {
      const state = this.app.state;
      const field = this.paused && this.config.pauseUi && state.status === "playing" ? this.config.pauseUi : this.config.ui;
      return field ? validateHud(state[field], this.config.sprites) : void 0;
    }
    keyboardKey(key2, down, repeat = false) {
      this.keyboard.sync(this.keyboardHud()?.keyboard);
      const handled = this.keyboard.physical(key2, down, repeat, (a, args) => this.activate(a, args));
      if (handled) {
        this.controls?.clear(true);
        this.invalidateFrame();
      }
      return handled;
    }
    keyboardControlEvent(event) {
      const hud = this.keyboardHud();
      if (!hud?.keyboard) {
        if (event.device === "gamepad" && (hud?.callout || hud?.grid?.layout === "sidebar")) return true;
        return event.device === "keyboard" ? this.hudKey(event.code, Boolean(event.value), event.repeat) : false;
      }
      if (event.device !== "keyboard") return true;
      const key2 = event.code.startsWith("Key") ? this.keyboard.pressed.has("SHIFT") ? event.code.slice(3) : event.code.slice(3).toLowerCase() : event.code.startsWith("Digit") ? event.code.slice(5) : event.code === "Space" ? " " : event.code.startsWith("Shift") ? "Shift" : event.code;
      return this.keyboardKey(key2, Boolean(event.value), event.repeat);
    }
    hudKey(code, down, repeat = false) {
      const hud = this.keyboardHud();
      if (hud?.callout && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Space", "Escape", "Backspace"].includes(code)) {
        const count = hud.callout.actions.length;
        if (down) {
          if (code.startsWith("Arrow") && count) this.calloutFocus = (this.calloutFocus + (code === "ArrowLeft" || code === "ArrowUp" ? -1 : 1) + count) % count;
          else if (!repeat && ["Enter", "Space"].includes(code) && count) this.activate(hud.callout.actions[this.calloutFocus % count].action);
          else if (!repeat && hud.callout.dismissAction) this.activate(hud.callout.dismissAction);
        }
        this.controls?.clear(true);
        this.invalidateFrame();
        return true;
      }
      if (hud?.grid?.layout === "sidebar") {
        const grid = hud.grid;
        if (down && ["ArrowUp", "ArrowDown"].includes(code) && grid.moveAction) this.activate(grid.moveAction, [code === "ArrowUp" ? -1 : 1]);
        else if (down && !repeat && ["Enter", "Space"].includes(code) && grid.moveAction) {
          const item = grid.items.find((i) => i.selected && !i.disabled);
          if (item?.action) {
            if (grid.closeOnActivate && grid.dismissAction) this.activate(grid.dismissAction);
            if (item.action === "host.fullscreen") this.uiFullscreen = true;
            else if (item.action === "host.mute") this.muted = !this.muted;
            else this.activate(item.action, item.args ?? []);
          }
        } else if (down && !repeat && ["Escape", "Backspace"].includes(code) && grid.dismissAction) this.activate(grid.dismissAction);
        else return false;
        this.controls?.clear(true);
        return true;
      }
      return false;
    }
    keyboardPads(pads) {
      const hud = this.keyboardHud();
      this.keyboard.sync(hud?.keyboard);
      if (!hud?.keyboard) return false;
      this.keyboard.controller(pads, (a, args) => this.activate(a, args));
      if (!this.keyboardHud()?.keyboard) {
        this.hudPadHeld = new Set(pads.flatMap((p) => p ? p.buttons.flatMap((b, i) => b.value > 0.5 ? [`${p.index}:${i}`] : []) : []));
      }
      this.invalidateFrame();
      return true;
    }
    hudPads(pads) {
      if (this.keyboardPads(pads)) return true;
      const hud = this.keyboardHud();
      if (!hud?.callout && hud?.grid?.layout !== "sidebar") {
        this.hudPadHeld.clear();
        return false;
      }
      this.controls?.clear(true);
      const held = /* @__PURE__ */ new Set();
      for (const pad of pads) {
        if (!pad) continue;
        for (const button of [12, 13, 14, 15, 0, 1]) {
          if ((pad.buttons[button]?.value ?? 0) <= 0.5) continue;
          const id = `${pad.index}:${button}`;
          held.add(id);
          if (this.hudPadHeld.has(id)) continue;
          if (hud.callout) {
            const count = hud.callout.actions.length;
            if (button >= 12 && count) this.calloutFocus = (this.calloutFocus + (button === 12 || button === 14 ? -1 : 1) + count) % count;
            if (button === 0 && count) this.activate(hud.callout.actions[this.calloutFocus % count].action);
            if (button === 1 && count) this.activate(hud.callout.actions[count - 1].action);
          } else if (hud.grid) {
            if (button >= 12 && hud.grid.moveAction) this.activate(hud.grid.moveAction, [button === 12 || button === 14 ? -1 : 1]);
            if (button === 0) {
              const item = hud.grid.items.find((i) => i.selected && !i.disabled);
              if (item?.action) {
                if (hud.grid.closeOnActivate && hud.grid.dismissAction) this.activate(hud.grid.dismissAction);
                if (item.action === "host.fullscreen") this.uiFullscreen = true;
                else if (item.action === "host.mute") this.muted = !this.muted;
                else this.activate(item.action, item.args ?? []);
              }
            }
            if (button === 1 && hud.grid.dismissAction) this.activate(hud.grid.dismissAction);
          }
        }
      }
      this.hudPadHeld = held;
      if (this.keyboardHud()?.keyboard) {
        this.keyboard.sync(this.keyboardHud()?.keyboard);
        this.keyboard.seedController(held);
      }
      this.invalidateFrame();
      return true;
    }
    /** Hosts can reuse the last pixels between simulation ticks. */
    invalidateFrame() {
      this.frameRevision++;
    }
    /** Browser presentation may fit a wider screen without changing game rules. */
    resizeViewport(width, height, hudScale = 1) {
      if (this.raycaster.resize(width, height, hudScale)) this.invalidateFrame();
    }
    frameIfChanged() {
      return this.presentIfChanged(() => {
        this.frame();
      }) ? this.raycaster.buffer : null;
    }
    presentIfChanged(draw) {
      if (this.presentedRevision === this.frameRevision) return false;
      draw();
      this.presentedRevision = this.frameRevision;
      return true;
    }
    get paused() {
      return this._paused;
    }
    set paused(value) {
      if (value === this._paused) return;
      if (value) this.flushSave();
      this._paused = value;
      this.invalidateFrame();
      if (value) pauseMusic();
      setAudioMuted(this._muted || value);
      if (!value) resumeMusic();
    }
    get muted() {
      return this._muted;
    }
    set muted(value) {
      this._muted = value;
      setAudioMuted(value || this._paused);
    }
    get audioState() {
      return audioSync.getSnapshot();
    }
    /** The desktop host shares this renderer for features beyond its fixed-eye rasterizer. */
    get usesSharedRenderer() {
      if (this.config.tethers?.length) return true;
      const hud = this.config.ui ? this.app.state[this.config.ui] : void 0;
      if (hud?.map || hud?.countdown !== void 0 || hud?.theme || hud?.keyboard || hud?.buttons || hud?.callout || hud?.grid?.layout === "sidebar") return true;
      const pauseHud = this.config.pauseUi ? this.app.state[this.config.pauseUi] : void 0;
      if (pauseHud?.map || pauseHud?.theme || pauseHud?.keyboard || pauseHud?.buttons || pauseHud?.callout || pauseHud?.grid?.layout === "sidebar") return true;
      const map = this.config.maps?.[this.currentMapName] ?? this.config.map;
      if (map.sky?.below !== void 0) return true;
      if (this.config.world || this.config.cameraTrack || this.config.titleScene && this.app.state.status === "title" || this.config.fov !== void 0 && this.config.fov !== 66) return true;
      const camera = this.config.camera.split(".").reduce((v, key2) => v?.[key2], this.app.state);
      return !!camera && ((camera.height ?? 0.5) !== 0.5 || (camera.pitch ?? 0) !== 0);
    }
    get saveStatus() {
      return this.save?.status;
    }
    start() {
      this.invalidateFrame();
      stopMusic();
      this._paused = false;
      setAudioMuted(this._muted);
      this.ticks = 0;
      this.presentationTicks = 0;
      withContext(this.context, () => {
        this.app.invokeAction("start", []);
        this.app.computeDerived();
      });
      this.syncScene();
      this.persist();
    }
    step(input = {}) {
      if (input.start) {
        this.start();
        return;
      }
      if (this.paused) return;
      this.invalidateFrame();
      withContext(this.context, () => withEntityQueries(() => {
        this.app.invokeAction("tick", [input]);
        this.app.computeDerived();
      }));
      this.ticks++;
      this.syncScene();
      if (this.wasTitle) this.presentationTicks++;
      this.persist(false);
    }
    syncScene() {
      const state = this.app.state;
      const title = state.status === "title";
      if (title && !this.wasTitle) this.presentationTicks = 0;
      this.wasTitle = title;
      if (state.level_map && state.level_map !== this.currentMapName && this.config.maps?.[state.level_map]) {
        this.currentMapName = state.level_map;
        const newMap = this.config.maps[state.level_map];
        this.raycaster.setMap(newMap);
        setActiveMap({
          width: newMap.width,
          height: newMap.height,
          grid: newMap.grid
        });
      }
    }
    flushSave() {
      this.persist();
    }
    persist(immediate = true) {
      this.save?.persist(this.app.state, immediate);
    }
    hasAction(action) {
      return Boolean(this.context.actionDefinitions[action]);
    }
    invoke(action, args = []) {
      this.invalidateFrame();
      if (action === "host.mute") {
        this.muted = !this.muted;
        return;
      }
      if (action === "resume_game" || action === "host.resume" || action === "restart_current_stage") {
        this.paused = false;
      }
      if (action === this.config.restartAction) {
        if (this.app.state.status === "playing" && !this.paused) return;
        this.paused = false;
        this.ticks = 0;
      }
      if (action === "start") {
        this.start();
        return;
      }
      setAudioMuted(this._muted || this._paused);
      withContext(this.context, () => {
        this.app.invokeAction(action, args);
        this.app.computeDerived();
      });
      if (this._paused && this.app.state.status !== "playing") {
        this._paused = false;
        setAudioMuted(this._muted);
        resumeMusic();
      } else if (this._paused) {
        pauseMusic();
      }
      this.syncScene();
      this.persist();
    }
    activate(action, args = []) {
      if (this.config.menuSounds?.confirm) {
        playSound(this.config.menuSounds.confirm);
      }
      this.invoke(action, args);
    }
    pickThing(path, x, y) {
      if (!this.config.things?.includes(path)) throw new Error("data-pixel-pick must name a declared Scene things array");
      const value = path.split(".").reduce((v, key2) => v && typeof v === "object" ? Reflect.get(v, key2) : void 0, this.app.state);
      if (!Array.isArray(value)) throw new Error("data-pixel-pick must reference an array");
      const stats = this.renderState();
      this.frame();
      return this.raycaster.pickModels(stats.camera, value, x, y);
    }
    renderState() {
      const state = this.app.state;
      const titleScene = state.status === "title" ? this.config.titleScene : void 0;
      this.raycaster.config.world = !titleScene && this.config.world ? validateWorld(state[this.config.world]) : void 0;
      this.raycaster.setMap(titleScene?.map ?? (this.config.maps?.[this.currentMapName] || this.config.map));
      const authoredFov = titleScene?.fov ?? this.config.fov ?? 66;
      const aspectScale = this.raycaster.width * this.config.height / (this.raycaster.height * this.config.width);
      this.raycaster.fov = aspectScale === 1 ? authoredFov : Math.atan(Math.tan(authoredFov * Math.PI / 360) * aspectScale) * 360 / Math.PI;
      const presentationTime = this.presentationTicks / this.config.tickRate;
      const camVal = this.config.camera.split(".").reduce((v, k) => v?.[k], state);
      const track = titleScene?.camera ?? this.config.cameraTrack;
      const camera = track ? sampleCamera(track, titleScene ? presentationTime : this.ticks / this.config.tickRate) : camVal || { x: 2.5, y: 2.5, angle: 0 };
      let things = [];
      const radius = this.config.renderRadius ?? this.raycaster.config.world?.renderDistance;
      const origin = { x: camera.x, y: camera.y, z: camera.z ?? camera.height ?? 0 };
      const thingPaths = titleScene?.things ?? this.config.things;
      if (thingPaths) {
        for (const path of thingPaths) {
          const val = path.split(".").reduce((v, k) => v?.[k], state);
          if (Array.isArray(val)) {
            const local2 = radius === void 0 ? val : nearbyForRender(val, origin, radius + 2, this.modelRadius);
            for (const thing of local2) things.push(thing);
          } else if (val && typeof val === "object" && typeof val.x === "number" && typeof val.y === "number" && (typeof val.sprite === "string" || typeof val.model === "string")) {
            if (radius === void 0 || Math.hypot(val.x - origin.x, val.y - origin.y, (val.z ?? 0) - origin.z) <= radius + 2 + this.modelRadius * (val.scale ?? 1)) things.push(val);
          }
        }
      }
      for (const thing of things) {
        if (!titleScene && this.config.world && thing.sprite && thing.visible !== false) {
          throw new Error("Voxel world entities must use block models rather than billboard sprites");
        }
        if (!thing.model || thing.visible === false) continue;
        if (!this.config.models?.[thing.model]) throw new Error(`Unknown pixel-3d model: ${thing.model}`);
        if (thing.sprite) throw new Error("Pixel-3d things must use either model or sprite, not both");
        if (!Number.isFinite(thing.dissolve ?? 0) || (thing.dissolve ?? 0) < 0 || (thing.dissolve ?? 0) > 1) {
          throw new Error("Pixel-3d model dissolve must be between 0 and 1");
        }
        if (![thing.x, thing.y, thing.z ?? 0, thing.angle ?? 0, thing.pitch ?? 0, thing.scale ?? 1].every(Number.isFinite) || (thing.scale ?? 1) <= 0) throw new Error("Pixel-3d model position/angle must be finite and scale must be positive");
      }
      const tethers = [];
      const tetherPaths = titleScene ? titleScene.tethers : this.config.tethers;
      for (const path of tetherPaths ?? []) {
        const value = path.split(".").reduce((v, k) => v?.[k], state);
        for (const item of Array.isArray(value) ? value : [value]) {
          if (item === null || item === void 0) continue;
          if (tethers.length >= 64) throw new Error("Pixel-3d supports up to 64 tethers per frame");
          tethers.push(validateTether(item));
        }
      }
      let weapon = void 0;
      if (this.config.weapon) {
        weapon = this.config.weapon.split(".").reduce((v, k) => v?.[k], state);
      }
      const flash = Number(state.flash || 0);
      const status = String(state.status || "ready");
      const health = Number(state.health ?? 100);
      const ammo = Number(state.ammo ?? 24);
      const score = Number(state.score ?? 0);
      const kills = Number(state.kills ?? 0);
      const level = Number(state.level ?? 1);
      const level_map = state.level_map ? String(state.level_map) : void 0;
      const level_title = state.level_title ? String(state.level_title) : void 0;
      const story_title = state.story_title ? String(state.story_title) : void 0;
      const story_body = state.story_body ? String(state.story_body) : void 0;
      const message = state.message ? String(state.message) : void 0;
      const switch_activated = Boolean(state.switch_activated);
      const lights = titleScene ? titleScene.lights : this.config.lights;
      return {
        title_scene: titleScene,
        presentation_time: presentationTime,
        camera,
        things,
        tethers,
        lights: lights ? validatePointLights(state[lights]) : [],
        weapon: titleScene ? void 0 : weapon,
        flash: titleScene ? 0 : flash,
        status,
        health,
        ammo,
        score,
        kills,
        level,
        level_map,
        level_title,
        story_title,
        story_body,
        message,
        switch_activated,
        ui: this.paused && this.config.pauseUi && status === "playing" ? validateHud(state[this.config.pauseUi], this.config.sprites) : this.config.ui ? validateHud(state[this.config.ui], this.config.sprites) : void 0,
        paused: this.paused,
        time: this.ticks / this.config.tickRate,
        presentation: this.config.presentation,
        hud_text: this.app.derived.hud_text !== void 0 ? String(this.app.derived.hud_text) : state.hud_text ? String(state.hud_text) : void 0,
        wall_overrides: Array.isArray(state.wall_overrides) ? state.wall_overrides.flatMap((tile) => {
          const texture = Object.keys(this.config.textures).indexOf(tile.texture);
          return texture >= 0 ? [{ x: tile.x, y: tile.y, texture }] : [];
        }) : []
      };
    }
    frameHud(stats) {
      let ui = stats.ui;
      if (ui?.callout) {
        const point = this.raycaster.projectPoint(stats.camera, ui.callout.target);
        const scale = this.raycaster.hudScale;
        ui = { ...ui, callout: {
          ...ui.callout,
          selected: this.calloutFocus % Math.max(1, ui.callout.actions.length),
          screen: point ? { x: point.x / scale, y: point.y / scale } : void 0
        } };
      }
      if (ui?.buttons) ui = { ...ui, buttons: ui.buttons.map((b) => b.icon === "sound" ? { ...b, selected: this.muted } : b) };
      this.keyboard.sync(ui?.keyboard);
      return {
        keyboard: ui?.keyboard ? this.keyboard : void 0,
        titleScene: stats.title_scene,
        presentationTime: stats.presentation_time,
        status: stats.status,
        heading: stats.camera.angle,
        health: stats.health,
        ammo: stats.ammo,
        score: stats.score,
        kills: stats.kills,
        level: stats.level,
        levelTitle: stats.level_title,
        storyTitle: stats.story_title,
        storyBody: stats.story_body,
        message: stats.message,
        switchActivated: stats.switch_activated,
        ui,
        paused: stats.paused,
        presentation: stats.presentation,
        hudText: stats.hud_text
      };
    }
    frame(deferredLighting) {
      this.invalidateFrame();
      const stats = this.renderState();
      const world = this.raycaster.config.world;
      this.raycaster.render(
        stats.camera,
        stats.things,
        stats.weapon,
        stats.flash,
        this.frameHud(stats),
        stats.wall_overrides,
        stats.title_scene ? stats.presentation_time : stats.time,
        world && !stats.camera.terrainPose ? validatedVoxelChunks(world) : void 0,
        stats.tethers,
        stats.lights,
        deferredLighting
      );
      return this.raycaster.buffer;
    }
  };

  // src/pixel3d/touch.ts
  var STYLE = `
.rune-pixel3d-surface{position:relative;touch-action:none;isolation:isolate}
.rune-pixel3d-touch{position:absolute;pointer-events:none;display:none;z-index:5;user-select:none;-webkit-user-select:none;touch-action:none}
@media (pointer:coarse),(hover:none){.rune-pixel3d-touch{display:block}}
.rune-pixel3d-touch.is-touch{display:block}
.rune-pixel3d-touch button{pointer-events:auto;touch-action:none;box-sizing:border-box;color:#fff1ce;background:#142432bb;border:2px solid #f6cc4488;font:bold 11px ui-monospace,monospace;min-height:44px;padding:8px;box-shadow:0 2px 12px #0008;user-select:none;-webkit-user-select:none}
.rune-pixel3d-touch button:focus-visible{outline:3px solid #fff;outline-offset:2px}
.rune-pixel3d-touch [data-touch-play]{display:none}
.rune-pixel3d-touch[data-playing=true] [data-touch-play]{display:block}
.rune-pixel3d-touch .move-stick{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));width:clamp(72px,24vmin,112px);height:clamp(72px,24vmin,112px);border-radius:50%;padding:0;background:radial-gradient(circle,#28465788,#0d172588);opacity:.85}
.move-stick:before{content:'MOVE';position:absolute;left:0;right:0;top:8px;font-size:9px;letter-spacing:1px;color:#d1dce5}
.move-stick .stick-thumb{position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:#f6cc4499;border:2px solid #fff1b9;pointer-events:none;will-change:transform}
.rune-pixel3d-touch .touch-use{position:absolute;right:max(80px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));width:48px;height:48px;border-radius:50%;background:#455521bb}
.rune-pixel3d-touch .touch-fire{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));width:60px;height:60px;border-radius:50%;background:#8b302bbb;border-color:#ffa47c;font-size:12px}
.rune-pixel3d-touch .touch-top{position:absolute;right:max(8px,env(safe-area-inset-right));top:max(44px,env(safe-area-inset-top));display:flex;gap:6px;pointer-events:none}
.rune-pixel3d-touch .touch-top button{border-radius:6px;font-size:10px}
.rune-pixel3d-touch .rotate-hint{display:none;position:absolute;left:50%;bottom:calc(100% + 12px);transform:translateX(-50%);background:#0d1725dd;color:#fff1ce;border:1px solid #f6cc44;padding:10px;text-align:center;font:12px ui-monospace,monospace;max-width:70%}
.rune-pixel3d-expanded-page{overflow:hidden!important}
.rune-pixel3d-expanded{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;z-index:2147483646!important;margin:0!important;border:0!important}
.rune-pixel3d-surface:fullscreen,.rune-pixel3d-expanded{display:flex;align-items:center;justify-content:center;background:#060709}
.rune-pixel3d-surface:fullscreen canvas,.rune-pixel3d-expanded canvas{width:min(100vw,160dvh)!important;max-width:none!important;height:auto!important;max-height:100dvh!important;touch-action:none}
@media (orientation:portrait){.rune-pixel3d-touch[data-expanded=true] .rotate-hint{display:block}}
`;
  function mountTouch(canvas, surface, bindings) {
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);
    surface.classList.add("rune-pixel3d-surface");
    const overlay2 = document.createElement("div");
    overlay2.className = "rune-pixel3d-touch";
    overlay2.innerHTML = `<button class="move-stick" data-touch-play aria-label="Move joystick"><span class="stick-thumb"></span></button>
    <button class="touch-fire" data-touch-play aria-label="Fire weapon">FIRE</button>
    <button class="touch-use" data-touch-play aria-label="Use terminal or elevator">USE</button>
    <div class="touch-top"><button data-touch-play class="touch-pause" aria-label="Pause game">PAUSE</button><button class="touch-fullscreen" aria-label="Toggle fullscreen">FULL</button></div>
    <span class="rotate-hint">Rotate your device for landscape play</span>`;
    surface.appendChild(overlay2);
    const stick = overlay2.querySelector(".move-stick");
    const thumb = overlay2.querySelector(".stick-thumb");
    const use = overlay2.querySelector(".touch-use");
    const fire = overlay2.querySelector(".touch-fire");
    const full = overlay2.querySelector(".touch-fullscreen");
    const pause = overlay2.querySelector(".touch-pause");
    const abort = new AbortController();
    function listen(target, name2, handler) {
      target.addEventListener(name2, handler, { signal: abort.signal, passive: false });
    }
    let moveId = null, aimId = null, useId = null, fireId = null;
    let aimX = 0, fireX = 0;
    function capture(target, id) {
      try {
        target.setPointerCapture(id);
      } catch {
      }
    }
    function release(target, id) {
      if (id !== null) try {
        target.releasePointerCapture(id);
      } catch {
      }
    }
    function touch(event) {
      return event.pointerType === "touch" || event.pointerType === "pen";
    }
    function activate(event) {
      event.preventDefault();
      event.stopPropagation();
      overlay2.classList.add("is-touch");
      bindings.interact();
      canvas.focus({ preventScroll: true });
    }
    function moveStick(event) {
      const rect = stick.getBoundingClientRect(), radius = rect.width * 0.36;
      let x = (event.clientX - rect.left - rect.width / 2) / radius;
      let y = (event.clientY - rect.top - rect.height / 2) / radius;
      const length = Math.hypot(x, y);
      if (length < 0.15) {
        x = 0;
        y = 0;
      } else {
        const strength = Math.min(1, (length - 0.15) / 0.85);
        x = x / length * strength;
        y = y / length * strength;
      }
      bindings.move(x, -y);
      thumb.style.transform = `translate(${x * radius}px,${y * radius}px)`;
    }
    listen(stick, "pointerdown", (e) => {
      if (moveId !== null || !bindings.playing()) return;
      activate(e);
      moveId = e.pointerId;
      capture(stick, moveId);
      moveStick(e);
    });
    listen(use, "pointerdown", (e) => {
      if (useId !== null || !bindings.playing()) return;
      activate(e);
      useId = e.pointerId;
      capture(use, useId);
      bindings.use(true, true);
    });
    listen(fire, "pointerdown", (e) => {
      if (fireId !== null || !bindings.playing()) return;
      activate(e);
      if (bindings.paused()) {
        bindings.resume();
        return;
      }
      fireId = e.pointerId;
      fireX = e.clientX;
      capture(fire, fireId);
      bindings.fire(true, true);
    });
    listen(surface, "pointerdown", (e) => {
      if (!touch(e) || e.target.closest("button") || aimId !== null) return;
      activate(e);
      if (!bindings.playing()) {
        bindings.advance();
        return;
      }
      if (bindings.paused()) {
        bindings.resume();
        return;
      }
      aimId = e.pointerId;
      aimX = e.clientX;
      capture(surface, aimId);
    });
    listen(document, "pointermove", (e) => {
      if (e.pointerId === moveId) {
        e.preventDefault();
        moveStick(e);
      }
      if (e.pointerId === aimId) {
        e.preventDefault();
        bindings.look((e.clientX - aimX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width));
        aimX = e.clientX;
      }
      if (e.pointerId === fireId) {
        e.preventDefault();
        bindings.look((e.clientX - fireX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width));
        fireX = e.clientX;
      }
    });
    function end(e) {
      if (e.pointerId === moveId) {
        moveId = null;
        bindings.move(0, 0);
        thumb.style.transform = "";
      }
      if (e.pointerId === aimId) aimId = null;
      if (e.pointerId === fireId) {
        fireId = null;
        bindings.fire(false, false, e.type !== "pointerup");
      }
      if (e.pointerId === useId) {
        useId = null;
        bindings.use(false, false, e.type !== "pointerup");
      }
    }
    for (const name2 of ["pointerup", "pointercancel", "lostpointercapture"]) listen(document, name2, end);
    for (const [button, action] of [[full, bindings.fullscreen], [pause, bindings.pause]]) {
      listen(button, "pointerdown", (e) => {
        activate(e);
        action();
      });
      listen(button, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }
    function position() {
      const frame = canvas.getBoundingClientRect(), parent = surface.getBoundingClientRect();
      overlay2.style.left = `${frame.left - parent.left - surface.clientLeft}px`;
      overlay2.style.top = `${frame.top - parent.top - surface.clientTop}px`;
      overlay2.style.width = `${frame.width}px`;
      overlay2.style.height = `${frame.height}px`;
    }
    const resize = new ResizeObserver(position);
    resize.observe(canvas);
    resize.observe(surface);
    position();
    function reset() {
      const m = moveId, a = aimId, u = useId, f = fireId;
      moveId = aimId = useId = fireId = null;
      release(stick, m);
      release(surface, a);
      release(use, u);
      release(fire, f);
      thumb.style.transform = "";
      bindings.move(0, 0);
      bindings.fire(false);
      bindings.use(false);
    }
    return {
      reset,
      update() {
        overlay2.dataset.playing = String(bindings.playing());
        overlay2.dataset.expanded = String(bindings.expanded());
        const paused = bindings.paused();
        pause.textContent = paused ? "RESUME" : "PAUSE";
        pause.setAttribute("aria-label", paused ? "Resume game" : "Pause game");
        full.textContent = bindings.expanded() ? "EXIT" : "FULL";
      },
      dispose() {
        reset();
        abort.abort();
        resize.disconnect();
        overlay2.remove();
        style.remove();
        surface.classList.remove("rune-pixel3d-surface");
      }
    };
  }

  // src/pixel3d/fullscreen.ts
  function isStandaloneApp() {
    return Boolean(window.matchMedia?.("(display-mode: standalone)").matches || window.matchMedia?.("(display-mode: fullscreen)").matches || window.navigator?.standalone);
  }
  function createFullscreen(surface, changed) {
    const doc = surface.ownerDocument;
    const element = surface;
    const orientation = screen.orientation;
    let fallback = false, locked = false, busy = false, disposed = false, exitRequested = false;
    const expanded = () => fallback || doc.fullscreenElement === surface || doc.webkitFullscreenElement === surface;
    const notifyParent = (value) => {
      if (window.parent !== window) window.parent.postMessage({ type: "toggle_fullscreen", is_fullscreen: value }, "*");
    };
    const unlock = () => {
      if (locked) {
        try {
          orientation?.unlock?.();
        } catch {
        }
        locked = false;
      }
    };
    const fallbackMode = (value) => {
      fallback = value;
      surface.classList.toggle("rune-pixel3d-expanded", value);
      doc.documentElement.classList.toggle("rune-pixel3d-expanded-page", value);
      notifyParent(value);
    };
    const onChange = () => {
      if (!expanded()) unlock();
      changed();
    };
    doc.addEventListener("fullscreenchange", onChange);
    doc.addEventListener("webkitfullscreenchange", onChange);
    async function exit() {
      if (doc.pointerLockElement && surface.contains(doc.pointerLockElement)) doc.exitPointerLock?.();
      if (fallback) fallbackMode(false);
      if (doc.fullscreenElement === surface) await doc.exitFullscreen();
      else if (doc.webkitFullscreenElement === surface) await doc.webkitExitFullscreen?.();
      unlock();
      changed();
    }
    const onEscape = (event) => {
      if (event.code !== "Escape" || event.repeat || !expanded() && !busy) return;
      exitRequested = true;
      event.preventDefault();
      event.stopPropagation();
      void exit().catch(() => {
        unlock();
        changed();
      });
    };
    doc.addEventListener("keydown", onEscape, true);
    return {
      expanded,
      startStandalone() {
        if (disposed || expanded()) return;
        fallbackMode(true);
        changed();
      },
      async toggle() {
        if (busy || disposed) return;
        busy = true;
        exitRequested = false;
        try {
          if (expanded()) {
            await exit();
            return;
          }
          try {
            if (element.requestFullscreen) await element.requestFullscreen({ navigationUI: "hide" });
            else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen();
            else fallbackMode(true);
          } catch {
            if (!disposed && !exitRequested) fallbackMode(true);
          }
          if (disposed || exitRequested) {
            await exit();
            return;
          }
          try {
            if (orientation?.lock) {
              await orientation.lock("landscape");
              locked = true;
            }
          } catch {
          }
          if (!expanded()) unlock();
          if (disposed) await exit();
          changed();
        } finally {
          busy = false;
        }
      },
      dispose() {
        disposed = true;
        doc.removeEventListener("fullscreenchange", onChange);
        doc.removeEventListener("webkitfullscreenchange", onChange);
        doc.removeEventListener("keydown", onEscape, true);
        void exit().catch(() => {
          unlock();
          fallbackMode(false);
        });
      }
    };
  }

  // src/pixel3d/webgl.ts
  var TAU = 2 * Math.PI;
  var radians = (degrees) => degrees * Math.PI / 180;
  var blend = (from, to, t) => from + (to - from) * t;
  var blendAngle = (from, to, t) => from + (((to - from + 180) % 360 + 360) % 360 - 180) * t;
  var rgb = (value) => [(value & 255) / 255, (value >>> 8 & 255) / 255, (value >>> 16 & 255) / 255];
  var tetherRod = Symbol("tether rod");
  var tetherJoint = Symbol("tether joint");
  function mesh(model) {
    const data = [];
    for (const { from, size, color, shape } of model.blocks) {
      const [r, g, b] = rgb(color);
      const vertex2 = (p, shade3, normal = [0, 0, 0]) => {
        data.push(
          from[0] + p[0] * size[0],
          from[1] + p[1] * size[1],
          from[2] + p[2] * size[2],
          r,
          g,
          b,
          ...normal,
          shade3
        );
      };
      const quad = (a, b2, c, d, shade3) => {
        for (const p of [a, b2, c, a, c, d]) vertex2(p, shade3);
      };
      if (shape === "sphere") {
        const point = (row, col) => {
          const phi = Math.PI * row / 16, theta = TAU * col / 24;
          return [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
        };
        for (let row = 0; row < 16; row++) for (let col = 0; col < 24; col++) {
          const a = point(row, col), b2 = point(row + 1, col);
          const c = point(row + 1, col + 1), d = point(row, col + 1);
          for (const n of [a, b2, c, a, c, d]) vertex2([0.5 + n[0] / 2, 0.5 + n[1] / 2, 0.5 + n[2] / 2], 0, n);
        }
      } else if (shape === "cylinder") {
        for (let col = 0; col < 24; col++) {
          const a = TAU * col / 24, b2 = TAU * (col + 1) / 24;
          const n = [Math.cos(a), Math.sin(a), 0], m = [Math.cos(b2), Math.sin(b2), 0];
          const p = (v, z) => [0.5 + v[0] / 2, 0.5 + v[1] / 2, z];
          const a0 = p(n, 0), a1 = p(n, 1), b0 = p(m, 0), b1 = p(m, 1);
          vertex2(a0, 0, n);
          vertex2(b0, 0, m);
          vertex2(b1, 0, m);
          vertex2(a0, 0, n);
          vertex2(b1, 0, m);
          vertex2(a1, 0, n);
          for (const v of [a0, b0, [0.5, 0.5, 0]]) vertex2(v, 0.55);
          for (const v of [a1, b1, [0.5, 0.5, 1]]) vertex2(v, 0.8875);
        }
      } else {
        const a = [0, 0, 0], b2 = [1, 0, 0], c = [1, 1, 0], d = [0, 1, 0];
        const ramp = shape === "ramp", low = ramp ? 0 : 1;
        const e = [0, 0, low], f = [1, 0, 1], g2 = [1, 1, 1], h = [0, 1, low];
        quad(a, b2, c, d, 1);
        quad(e, f, g2, h, ramp ? 0.9 : 1);
        quad(b2, c, g2, f, 0.8);
        if (!ramp) quad(a, d, h, e, 0.8);
        quad(a, b2, f, e, 0.65);
        quad(d, c, g2, h, 0.65);
      }
    }
    return new Float32Array(data);
  }
  var header = "#version 300 es\nprecision highp float;\nprecision highp int;\n";
  var colorPass = `
uniform vec3 palette[16];
uniform int bands;
uniform float light;
uniform vec3 tint;
vec3 finishColor(vec3 color) {
  color = clamp(color + tint, 0.0, 1.0) * light;
  if (bands == 0) return color;
  float luma = dot(color, vec3(54.0, 183.0, 19.0)) / 256.0;
  return palette[min(bands - 1, int(luma * float(bands)))];
}
`;
  var skyVertex = `
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0, 1);
}
`;
  var skyFragment = `
uniform vec2 viewport, heading, tilt;
uniform float fov, drift;
uniform uint seed;
uniform vec3 horizon, zenith, cloud, below;
out vec4 painted;
float noise(ivec2 xy, uint salt) {
  uint n = uint(xy.x) * 374761393u + uint(xy.y) * 668265263u + salt;
  n = (n ^ (n >> 13u)) * 1274126177u;
  return float(n ^ (n >> 16u)) / 4294967295.0;
}
float density(vec2 p, uint salt, int mask) {
  ivec2 cell = ivec2(floor(p));
  vec2 f = smoothstep(0.0, 1.0, fract(p));
  int x = cell.x & mask, xx = (cell.x + 1) & mask;
  float a = mix(noise(ivec2(x, cell.y), salt), noise(ivec2(xx, cell.y), salt), f.x);
  float b = mix(noise(ivec2(x, cell.y+1), salt), noise(ivec2(xx, cell.y+1), salt), f.x);
  return clamp((mix(a, b, f.y) - 0.5) * 4.0, 0.0, 1.0);
}
void main() {
  vec2 p = gl_FragCoord.xy / viewport - 0.5;
  vec2 right = vec2(-heading.y, heading.x);
  vec2 dir = heading * (tilt.x - tilt.y * p.y) + right * (2.0 * fov * p.x);
  float u = atan(dir.y, dir.x) * (64.0 / 6.28318530718);
  float rz = tilt.y + tilt.x * p.y;
  vec3 color;
  if (rz < 0.0) {
    float depth = min(1.0, -rz);
    color = mix(horizon, below, floor(sqrt(depth) * 32.0) / 32.0);
    float farCloud = density(vec2(u + drift * 0.35, depth * 23.0), seed, 63);
    float nearCloud = density(vec2(u / 2.0 + drift, depth * 14.0 + 13.0), seed + 719u, 31);
    color = mix(color, cloud, (farCloud * 0.18 + nearCloud * 0.42) * min(1.0, depth * 7.0));
  } else {
    float h = min(1.0, rz * 2.0);
    color = mix(horizon, zenith, floor(h * 16.0) / 16.0);
    color = mix(color, cloud, density(vec2(u + drift, h * 12.0), seed, 63) * min(1.0, h * 5.0));
  }
  painted = vec4(finishColor(color), 1);
}
`;
  var modelVertex = `
layout(location=0) in vec3 point;
layout(location=1) in vec3 color;
layout(location=2) in vec4 shade;
layout(location=3) in vec4 positionScale;
layout(location=4) in vec3 rotationDissolve;
layout(location=5) in vec3 tiltStretch;
layout(location=6) in vec4 instanceColor;
uniform vec3 eye;
uniform vec2 heading, tilt;
uniform float fov;
out vec3 pigment;
out vec4 shading;
flat out float dissolve;
void main() {
  vec3 local = point * positionScale.w;
  local.z *= tiltStretch.z;
  local.xz = vec2(tiltStretch.x * local.x + tiltStretch.y * local.z,
    -tiltStretch.y * local.x + tiltStretch.x * local.z);
  vec2 rotation = rotationDissolve.xy;
  vec3 p = positionScale.xyz - eye + vec3(rotation.x*local.x - rotation.y*local.y,
    rotation.y*local.x + rotation.x*local.y, local.z);
  float forward = dot(p.xy, heading);
  float side = dot(p.xy, vec2(-heading.y, heading.x));
  float distance = forward*tilt.x + p.z*tilt.y;
  float up = p.z*tilt.x - forward*tilt.y;
  // Near 0.05 and far 1000, with perspective division by distance.
  gl_Position = vec4(side/fov, 2.0*up, 1.000100005*distance - 0.100005, distance);
  pigment = mix(color, instanceColor.rgb, instanceColor.a);
  shading = shade;
  dissolve = rotationDissolve.z;
}
`;
  var modelFragment = `
in vec3 pigment;
in vec4 shading;
flat in float dissolve;
uniform float height;
out vec4 painted;
void main() {
  if (dissolve > 0.0) {
    uvec2 p = uvec2(gl_FragCoord.x, height - gl_FragCoord.y) / 2u;
    uint hash = p.x * 73856093u ^ p.y * 19349663u;
    if (float((hash ^ (hash >> 13u)) * 1274126177u) / 4294967296.0 < dissolve) discard;
  }
  float shade = shading.w;
  if (shade == 0.0) shade = 0.55 + 0.45 * max(0.0, dot(normalize(shading.xyz), vec3(-0.4,-0.5,0.75)));
  painted = vec4(finishColor(floor(pigment * shade * 255.0) / 255.0), 1);
}
`;
  var silhouetteFragment = `
uniform highp sampler2D sceneColor, sceneDepth;
uniform int radius, diagonal;
uniform vec3 ink;
out vec4 painted;
float distanceAt(ivec2 pixel) {
  ivec2 limit = textureSize(sceneDepth, 0) - 1;
  float depth = texelFetch(sceneDepth, clamp(pixel, ivec2(0), limit), 0).r;
  return 50.0 / (1000.0 - 999.95 * depth);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 x = ivec2(radius, 0), y = ivec2(0, radius);
  float edge = min(min(distanceAt(p-x), distanceAt(p+x)), min(distanceAt(p-y), distanceAt(p+y)));
  if (diagonal > 0) {
    ivec2 a = ivec2(diagonal, diagonal), b = ivec2(diagonal, -diagonal);
    edge = min(edge, min(min(distanceAt(p-a), distanceAt(p+a)), min(distanceAt(p-b), distanceAt(p+b))));
  }
  if (distanceAt(p) - edge > max(0.12, edge * 0.025)) painted = vec4(ink, 1);
  else painted = texelFetch(sceneColor, p, 0);
}
`;
  function createWebGlRenderer(canvas, models = {}) {
    const context = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: true, failIfMajorPerformanceCaveat: true });
    if (!context) return void 0;
    const gl = context;
    gl.disable(gl.DITHER);
    const programs = [];
    const shaders = [];
    const batches = /* @__PURE__ */ new Map();
    const skyVao = gl.createVertexArray();
    let target;
    const clearTarget = () => {
      if (!target) return;
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.color);
      gl.deleteTexture(target.depth);
      target = void 0;
    };
    const dispose = () => {
      clearTarget();
      gl.deleteVertexArray(skyVao);
      for (const { vao, mesh: mesh2, instances } of batches.values()) {
        gl.deleteVertexArray(vao);
        gl.deleteBuffer(mesh2);
        gl.deleteBuffer(instances);
      }
      for (const p of programs) gl.deleteProgram(p);
      for (const s of shaders) gl.deleteShader(s);
    };
    const program = (vertex2, fragment, names) => {
      const handle = gl.createProgram();
      if (!handle) throw new Error("Could not allocate a WebGL program");
      programs.push(handle);
      for (const [type, source] of [[gl.VERTEX_SHADER, header + vertex2], [gl.FRAGMENT_SHADER, header + colorPass + fragment]]) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Could not allocate a WebGL shader");
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compile failed");
        gl.attachShader(handle, shader);
      }
      gl.linkProgram(handle);
      if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle) ?? "Program link failed");
      const loc = Object.fromEntries([...names, "bands", "palette[0]", "light", "tint"].map((name2) => [name2, gl.getUniformLocation(handle, name2)]));
      return { handle, loc };
    };
    try {
      let bindSilhouetteTarget2 = function() {
        const { width, height } = canvas;
        if (target?.width === width && target.height === height) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
          return target;
        }
        clearTarget();
        const framebuffer = gl.createFramebuffer(), color = gl.createTexture(), depth = gl.createTexture();
        if (!framebuffer || !color || !depth) {
          gl.deleteFramebuffer(framebuffer);
          gl.deleteTexture(color);
          gl.deleteTexture(depth);
          throw new Error("Could not allocate a WebGL silhouette target");
        }
        target = { framebuffer, color, depth, width, height };
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        for (const [texture, format, attachment] of [
          [color, gl.RGBA8, gl.COLOR_ATTACHMENT0],
          [depth, gl.DEPTH_COMPONENT24, gl.DEPTH_ATTACHMENT]
        ]) {
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);
        }
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error("WebGL silhouette target is incomplete");
        }
        return target;
      }, batchFor2 = function(name2) {
        const cached = batches.get(name2);
        if (cached) return cached;
        const vertices = mesh(typeof name2 === "symbol" ? tetherModel(name2 === tetherJoint) : models[name2]);
        const buffer = gl.createBuffer(), instances = gl.createBuffer(), vao = gl.createVertexArray();
        if (!buffer || !instances || !vao) {
          gl.deleteBuffer(buffer);
          gl.deleteBuffer(instances);
          gl.deleteVertexArray(vao);
          throw new Error("Could not allocate a WebGL mesh");
        }
        const batch = {
          vao,
          mesh: buffer,
          instances,
          vertices: vertices.length / 10,
          transforms: new Float32Array(floatsPerInstance * 8),
          count: 0,
          capacity: 0
        };
        batches.set(name2, batch);
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        [3, 3, 4].forEach((count, index2) => {
          gl.enableVertexAttribArray(index2);
          gl.vertexAttribPointer(index2, count, gl.FLOAT, false, 40, index2 * 12);
        });
        gl.bindBuffer(gl.ARRAY_BUFFER, instances);
        for (const [location2, count, offset] of [[3, 4, 0], [4, 3, 16], [5, 3, 28], [6, 4, 40]]) {
          gl.enableVertexAttribArray(location2);
          gl.vertexAttribPointer(location2, count, gl.FLOAT, false, floatsPerInstance * 4, offset);
          gl.vertexAttribDivisor(location2, 1);
        }
        return batch;
      }, queue2 = function(batch, instance, overrideColor) {
        const offset = batch.count++ * floatsPerInstance;
        if (offset === batch.transforms.length) {
          const resized = new Float32Array(batch.transforms.length * 2);
          resized.set(batch.transforms);
          batch.transforms = resized;
        }
        const data = batch.transforms, rotation = radians(instance.angle ?? 0);
        const tilt = instance.axisTilt ?? radians(instance.pitch ?? 0);
        data[offset] = instance.x;
        data[offset + 1] = instance.y;
        data[offset + 2] = instance.z ?? 0;
        data[offset + 3] = instance.scale ?? 1;
        data[offset + 4] = Math.cos(rotation);
        data[offset + 5] = Math.sin(rotation);
        data[offset + 6] = instance.dissolve ?? 0;
        data[offset + 7] = Math.cos(tilt);
        data[offset + 8] = Math.sin(tilt);
        data[offset + 9] = instance.axialScale ?? 1;
        data[offset + 10] = overrideColor?.[0] ?? 0;
        data[offset + 11] = overrideColor?.[1] ?? 0;
        data[offset + 12] = overrideColor?.[2] ?? 0;
        data[offset + 13] = overrideColor ? 1 : 0;
      };
      var bindSilhouetteTarget = bindSilhouetteTarget2, batchFor = batchFor2, queue = queue2;
      const skyProgram = program(skyVertex, skyFragment, ["viewport", "heading", "tilt", "fov", "drift", "seed", "horizon", "zenith", "cloud", "below"]);
      const modelProgram = program(modelVertex, modelFragment, ["eye", "heading", "tilt", "fov", "height"]);
      let silhouetteProgram;
      const floatsPerInstance = 14;
      let palette = [];
      const setPalette = (colors) => {
        palette = colors?.flatMap((c) => [(c >>> 16) / 255, (c >>> 8 & 255) / 255, (c & 255) / 255]) ?? [];
      };
      let captured, previous;
      const capture = (frame, sky, fov, interpolate2) => {
        const time = frame.title_scene ? frame.presentation_time : frame.time;
        const old = captured;
        previous = interpolate2 && old?.poses && old.sky === sky && old.frame.status === frame.status && old.frame.level === frame.level && time > old.time && time - old.time < 0.1 ? old : void 0;
        const poses = interpolate2 ? /* @__PURE__ */ new Map() : void 0;
        if (poses) for (const thing of frame.things) {
          if (thing.visible !== false && thing.model) {
            const { x, y, z, angle, pitch, scale, model } = thing;
            poses.set(thing, { x, y, z, angle, pitch, scale, model });
          }
        }
        const tethers = interpolate2 && frame.tethers.length ? /* @__PURE__ */ new Map() : void 0;
        if (tethers) for (const tether of frame.tethers) {
          if (tether.visible !== false) tethers.set(tether, { ...tether, points: tether.points.map((p) => [...p]) });
        }
        captured = { frame, camera: { ...frame.camera }, sky, fov, time, poses, tethers };
      };
      const resetInterpolation = () => {
        captured = previous = void 0;
      };
      const draw = (alpha = 1, outlineRadius = 0) => {
        if (gl.isContextLost()) throw new Error("WebGL context lost");
        if (!captured) throw new Error("WebGL frame has not been prepared");
        const { frame, sky, fov: fovDegrees } = captured;
        const { things } = frame;
        const target2 = captured.camera;
        const oldCamera = previous?.camera;
        const t = Math.max(0, Math.min(1, alpha));
        const camera = oldCamera && t < 1 && Math.hypot(target2.x - oldCamera.x, target2.y - oldCamera.y, (target2.height ?? 0.5) - (oldCamera.height ?? 0.5)) < 4 ? {
          x: blend(oldCamera.x, target2.x, t),
          y: blend(oldCamera.y, target2.y, t),
          height: blend(oldCamera.height ?? 0.5, target2.height ?? 0.5, t),
          angle: blendAngle(oldCamera.angle, target2.angle, t),
          pitch: blend(oldCamera.pitch ?? 0, target2.pitch ?? 0, t)
        } : target2;
        const yaw = radians(camera.angle), pitch = radians(camera.pitch ?? 0);
        const heading = [Math.cos(yaw), Math.sin(yaw)];
        const tilt = [Math.cos(pitch), Math.sin(pitch)];
        const fov = Math.tan(radians(fovDegrees) / 2);
        const light = Math.max(0, 1 - (frame.ui?.cinema?.fade ?? 0));
        const flash = Math.min(1, frame.flash * 0.12);
        const red = Math.floor(180 * flash) / 255, other = -Math.floor(50 * flash) / 255;
        const time = previous ? blend(previous.time, captured.time, t) : captured.time;
        const setup = ({ handle, loc }) => {
          gl.useProgram(handle);
          gl.uniform2f(loc.heading, ...heading);
          gl.uniform2f(loc.tilt, ...tilt);
          gl.uniform1f(loc.fov, fov);
          gl.uniform1f(loc.light, light);
          gl.uniform3f(loc.tint, red, other, other);
          gl.uniform1i(loc.bands, palette.length / 3);
          if (palette.length) gl.uniform3fv(loc["palette[0]"], palette);
          return loc;
        };
        const outlineTarget = outlineRadius ? bindSilhouetteTarget2() : void 0;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.disable(gl.DEPTH_TEST);
        const s = setup(skyProgram);
        gl.uniform2f(s.viewport, canvas.width, canvas.height);
        gl.uniform1f(s.drift, time * sky.speed);
        gl.uniform1ui(s.seed, sky.seed);
        gl.uniform3f(s.horizon, ...rgb(sky.horizon));
        gl.uniform3f(s.zenith, ...rgb(sky.zenith));
        gl.uniform3f(s.cloud, ...rgb(sky.cloud));
        gl.uniform3f(s.below, ...rgb(sky.below ?? sky.horizon));
        gl.bindVertexArray(skyVao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.enable(gl.DEPTH_TEST);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        const m = setup(modelProgram);
        gl.uniform3f(m.eye, camera.x, camera.y, camera.height ?? 0.5);
        gl.uniform1f(m.height, canvas.height);
        for (const batch of batches.values()) batch.count = 0;
        for (const thing of things) {
          if (!thing.model || thing.visible === false || thing.dissolve === 1) continue;
          let { x, y, z = 0, angle = 0, pitch: pitch2 = 0, scale = 1 } = thing;
          const old = t < 1 ? previous?.poses?.get(thing) : void 0;
          if (old && old.model === thing.model && Math.hypot(x - old.x, y - old.y, z - (old.z ?? 0)) < 4) {
            x = blend(old.x, x, t);
            y = blend(old.y, y, t);
            z = blend(old.z ?? 0, z, t);
            angle = blendAngle(old.angle ?? 0, angle, t);
            pitch2 = blendAngle(old.pitch ?? 0, pitch2, t);
            scale = blend(old.scale ?? 1, scale, t);
          }
          queue2(batchFor2(thing.model), { x, y, z, angle, pitch: pitch2, scale, dissolve: thing.dissolve });
        }
        for (const tether of frame.tethers) {
          if (tether.visible === false) continue;
          const old = t < 1 ? previous?.tethers?.get(tether) : void 0;
          const smooth = old && old.points.length === tether.points.length && tether.points.every((p, i) => Math.hypot(p[0] - old.points[i][0], p[1] - old.points[i][1], p[2] - old.points[i][2]) < 4);
          const pose = smooth ? {
            ...tether,
            slack: blend(old.slack ?? 0, tether.slack ?? 0, t),
            points: tether.points.map((p, i) => [
              blend(old.points[i][0], p[0], t),
              blend(old.points[i][1], p[1], t),
              blend(old.points[i][2], p[2], t)
            ])
          } : tether;
          const color = [(tether.color >>> 16) / 255, (tether.color >>> 8 & 255) / 255, (tether.color & 255) / 255];
          for (const piece of tetherPieces(pose)) queue2(batchFor2(piece.joint ? tetherJoint : tetherRod), piece, color);
        }
        for (const batch of batches.values()) {
          if (!batch.count) continue;
          gl.bindVertexArray(batch.vao);
          gl.bindBuffer(gl.ARRAY_BUFFER, batch.instances);
          if (batch.capacity !== batch.transforms.byteLength) {
            batch.capacity = batch.transforms.byteLength;
            gl.bufferData(gl.ARRAY_BUFFER, batch.capacity, gl.DYNAMIC_DRAW);
          }
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.transforms, 0, batch.count * floatsPerInstance);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, batch.vertices, batch.count);
        }
        if (outlineTarget) {
          silhouetteProgram ?? (silhouetteProgram = program(skyVertex, silhouetteFragment, ["sceneColor", "sceneDepth", "radius", "diagonal", "ink"]));
          const { handle, loc } = silhouetteProgram;
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.disable(gl.DEPTH_TEST);
          gl.useProgram(handle);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, outlineTarget.color);
          gl.uniform1i(loc.sceneColor, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, outlineTarget.depth);
          gl.uniform1i(loc.sceneDepth, 1);
          gl.uniform1i(loc.radius, outlineRadius);
          gl.uniform1i(loc.diagonal, Math.floor(outlineRadius / Math.SQRT2));
          gl.uniform3f(loc.ink, palette[0] ?? 0.02, palette[1] ?? 0.01, palette[2] ?? 0.05);
          gl.bindVertexArray(skyVao);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
      };
      return { capture, draw, resetInterpolation, setPalette, dispose };
    } catch (error) {
      dispose();
      throw error;
    }
  }

  // src/pixel3d/gpu_lighting.ts
  var vertex = `#version 300 es
void main() {
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  gl_Position=vec4(p*2.0-1.0,0,1);
}`;
  var header2 = `#version 300 es
precision highp float;
precision highp int;
out vec4 painted;
`;
  var blur2 = `${header2}
uniform sampler2D source;
uniform ivec2 direction;
vec3 sampleAt(ivec2 p) {
  ivec2 size=textureSize(source,0);
  if(any(lessThan(p,ivec2(0))) || any(greaterThanEqual(p,size))) return vec3(0);
  return floor(texelFetch(source,p,0).rgb*255.0+0.5);
}
void main() {
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec3 sum=sampleAt(p-direction*2)+sampleAt(p-direction)*2.0+
    sampleAt(p)*4.0+sampleAt(p+direction)*2.0+sampleAt(p+direction*2);
  painted=vec4(floor(sum/10.0)/255.0,1);
}`;
  var compose = `${header2}
uniform sampler2D scene, depths, glow, panes, sceneOverlay, hud, palette;
uniform vec2 viewport, heading, tilt;
uniform vec3 eye;
uniform float fov, rowOrigin, haze, flash, fade;
uniform vec3 horizon, outlineColor;
uniform int lightCount, shadowCount, outlineRadius, paletteEnabled, bloomEnabled;
uniform vec4 lightPose[8], lightColor[8], shadowPose[32], shadowSize[32];
vec3 rgbAt(sampler2D image,ivec2 p) {
  return floor(texelFetch(image,p,0).rgb*255.0+0.5);
}
float depthAt(ivec2 p) {
  p=clamp(p,ivec2(0),ivec2(viewport)-1);
  float d=texelFetch(depths,p,0).r;
  return d==0.0 ? 1e30 : d;
}
vec3 glowAt(ivec2 p) {
  return rgbAt(glow,clamp(p,ivec2(0),textureSize(glow,0)-1));
}
vec3 mixGlow(vec3 a,vec3 b,float weight) {
  return floor((a*(4.0-weight)+b*weight)/4.0);
}
void main() {
  ivec2 p=ivec2(int(gl_FragCoord.x),int(viewport.y)-1-int(gl_FragCoord.y));
  float d=depthAt(p), up=(rowOrigin-float(p.y)-0.5)/viewport.y;
  float side=(float(p.x)*2.0/viewport.x-1.0)*fov;
  vec3 color=rgbAt(scene,p);
  for(int i=0;i<8;i++) {
    if(i>=lightCount) break;
    vec4 pose=lightPose[i];
    if(d<pose.z-pose.w || d>pose.z+pose.w) continue;
    vec3 delta=vec3(d*side-pose.x,d*up-pose.y,d-pose.z);
    float edge=1.0-dot(delta,delta)/(pose.w*pose.w);
    if(edge>0.0) color=floor(min(vec3(255),color+lightColor[i].rgb*edge*edge));
  }
  for(int i=0;i<32;i++) {
    if(i>=shadowCount) break;
    vec4 pose=shadowPose[i], size=shadowSize[i];
    float distance=(pose.z-eye.z)/(tilt.y+tilt.x*up);
    if(distance<=0.10) continue;
    if(size.z>0.0 ? d<distance-0.02 : abs(d-distance)>0.055) continue;
    float forward=tilt.x-tilt.y*up;
    vec2 offset=(eye.xy-pose.xy+distance*(heading*forward+vec2(-heading.y,heading.x)*side))/size.xy;
    float strength=(1.0-dot(offset,offset))*pose.w;
    if(strength>0.0) color=floor(color+(vec3(11,9,16)-color)*strength);
  }
  ivec2 tile=p/4;
  vec2 pane=texelFetch(panes,tile,0).rg;
  if(haze>0.0 && d>22.0 && d<1e29)
    color=floor(color+(horizon-color)*haze*min(0.30,(d-22.0)*0.008));
  if(d>pane.x+0.00001 && pane.y>0.0)
    color=floor(color+(vec3(129,201,240)-color)*(pane.y/255.0));
  if(bloomEnabled>0) {
    float wx=float(p.x%4), wy=float(p.y%4);
    vec3 a=mixGlow(glowAt(tile),glowAt(tile+ivec2(0,1)),wy);
    vec3 b=mixGlow(glowAt(tile+ivec2(1,0)),glowAt(tile+ivec2(1,1)),wy);
    color=min(vec3(255),color+mixGlow(a,b,wx));
  }
  if(outlineRadius>0) {
    ivec2 x=ivec2(outlineRadius,0), y=ivec2(0,outlineRadius);
    float near=min(min(depthAt(p-x),depthAt(p+x)),min(depthAt(p-y),depthAt(p+y)));
    int diagonal=int(float(outlineRadius)/sqrt(2.0));
    if(diagonal>0) {
      ivec2 a=ivec2(diagonal,diagonal),b=ivec2(diagonal,-diagonal);
      near=min(near,min(min(depthAt(p-a),depthAt(p+a)),min(depthAt(p-b),depthAt(p+b))));
    }
    if(d-near>max(0.12,near*0.025)) color=outlineColor;
  }
  vec4 overlay=texelFetch(sceneOverlay,p,0);
  if(overlay.a>0.0) color=floor(overlay.rgb*255.0+0.5);
  if(flash>0.0) {
    float amount=min(1.0,flash*0.12);
    color=clamp(color+vec3(floor(180.0*amount),-floor(50.0*amount),-floor(50.0*amount)),0.0,255.0);
  }
  color=floor(color*(1.0-min(1.0,fade)));
  overlay=texelFetch(hud,p,0);
  if(overlay.a>0.0) color=floor(overlay.rgb*255.0+0.5);
  if(paletteEnabled>0) {
    int luma=int(dot(color,vec3(54,183,19))/256.0);
    color=rgbAt(palette,ivec2(luma,0));
  }
  painted=vec4(color/255.0,1);
}`;
  function createGpuLighting(canvas) {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, failIfMajorPerformanceCaveat: true });
    if (!gl) return void 0;
    const programs = [], shaders = [];
    const textures = [], framebuffers = [];
    const vao = gl.createVertexArray();
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      gl.deleteVertexArray(vao);
      textures.forEach((t) => gl.deleteTexture(t));
      framebuffers.forEach((f) => gl.deleteFramebuffer(f));
      programs.forEach((p) => gl.deleteProgram(p));
      shaders.forEach((s) => gl.deleteShader(s));
    };
    const program = (fragment, names) => {
      const handle = gl.createProgram();
      if (!handle) throw new Error("GPU lighting program allocation failed");
      programs.push(handle);
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("GPU lighting shader allocation failed");
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "GPU lighting shader failed");
        gl.attachShader(handle, shader);
      }
      gl.linkProgram(handle);
      if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle) ?? "GPU lighting link failed");
      return { handle, loc: Object.fromEntries(names.map((name2) => [name2, gl.getUniformLocation(handle, name2)])) };
    };
    const texture = () => {
      const t = gl.createTexture();
      if (!t) throw new Error("GPU lighting texture allocation failed");
      textures.push(t);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    try {
      if (!vao) throw new Error("GPU lighting vertex array allocation failed");
      gl.disable(gl.DITHER);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.bindVertexArray(vao);
      const blurProgram = program(blur2, ["source", "direction"]);
      const finalProgram = program(compose, [
        "scene",
        "depths",
        "glow",
        "panes",
        "sceneOverlay",
        "hud",
        "palette",
        "viewport",
        "heading",
        "tilt",
        "eye",
        "fov",
        "rowOrigin",
        "haze",
        "flash",
        "fade",
        "horizon",
        "outlineColor",
        "lightCount",
        "shadowCount",
        "outlineRadius",
        "paletteEnabled",
        "bloomEnabled",
        "lightPose[0]",
        "lightColor[0]",
        "shadowPose[0]",
        "shadowSize[0]"
      ]);
      const scene = texture(), depths = texture(), emission = texture(), pane = texture(), overlay2 = texture(), hud = texture(), palette = texture(), horizontal = texture(), vertical = texture();
      const targets = [horizontal, vertical].map((t) => {
        const framebuffer = gl.createFramebuffer();
        if (!framebuffer) throw new Error("GPU bloom framebuffer allocation failed");
        framebuffers.push(framebuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        return framebuffer;
      });
      const sizes = /* @__PURE__ */ new Map();
      const upload = (t, w, h, internal, format, type, data) => {
        gl.bindTexture(gl.TEXTURE_2D, t);
        const key2 = `${w}:${h}:${internal}`;
        if (sizes.get(t) !== key2) {
          gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
          sizes.set(t, key2);
        } else if (data) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, format, type, data);
      };
      let depthData = new Float32Array(0), paneData = new Float32Array(0), emissionData = new Uint32Array(0);
      const lightPose = new Float32Array(32), lightColor = new Float32Array(32), shadowPose = new Float32Array(128), shadowSize = new Float32Array(128);
      const bytes = (data) => new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const packedRgb = (color) => [color & 255, color >>> 8 & 255, color >>> 16 & 255];
      const draw = (frame) => {
        if (disposed || gl.isContextLost()) throw new Error("GPU lighting context unavailable");
        gl.disable(gl.DITHER);
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        const { width: w, height: h, enhancement: e } = frame;
        if ((e?.shadows.length ?? 0) > 32) throw new Error("GPU lighting supports up to 32 contact shadows; using CPU");
        const tw = e?.tileWidth ?? Math.ceil(w / 4), th = e?.tileHeight ?? Math.ceil(h / 4);
        if (depthData.length !== w * h) depthData = new Float32Array(w * h);
        if (paneData.length !== tw * th * 2) {
          paneData = new Float32Array(tw * th * 2);
          emissionData = new Uint32Array(tw * th);
        }
        for (let i = 0; i < depthData.length; i++) depthData[i] = Number.isFinite(frame.depth[i]) ? frame.depth[i] : 0;
        let bloomEnabled = false;
        for (let i = 0; i < emissionData.length; i++) {
          paneData[i * 2] = Number.isFinite(e?.paneDepth[i]) ? e.paneDepth[i] : 1e30;
          paneData[i * 2 + 1] = e?.paneAlpha[i] ?? 0;
          emissionData[i] = (4278190080 | (e?.emission.colors[i] ?? 0)) >>> 0;
          if (e?.emission.colors[i]) bloomEnabled = true;
        }
        gl.activeTexture(gl.TEXTURE0);
        upload(scene, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bytes(frame.color));
        upload(depths, w, h, gl.R32F, gl.RED, gl.FLOAT, depthData);
        upload(overlay2, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bytes(frame.sceneOverlay));
        upload(hud, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bytes(frame.hud));
        upload(pane, tw, th, gl.RG32F, gl.RG, gl.FLOAT, paneData);
        upload(emission, tw, th, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bytes(emissionData));
        if (frame.palette) upload(palette, 256, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bytes(frame.palette));
        else upload(palette, 1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        upload(horizontal, tw, th, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null);
        upload(vertical, tw, th, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindVertexArray(vao);
        gl.useProgram(blurProgram.handle);
        gl.viewport(0, 0, tw, th);
        gl.uniform1i(blurProgram.loc.source, 0);
        for (let i = 0; i < (bloomEnabled ? 2 : 0); i++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, targets[i]);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("GPU bloom target incomplete");
          gl.bindTexture(gl.TEXTURE_2D, i ? horizontal : emission);
          gl.uniform2i(blurProgram.loc.direction, i ? 0 : 1, i ? 1 : 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        gl.useProgram(finalProgram.handle);
        const l = finalProgram.loc;
        for (const [unit, name2, t] of [
          [0, "scene", scene],
          [1, "depths", depths],
          [2, "glow", bloomEnabled ? vertical : emission],
          [3, "panes", pane],
          [4, "sceneOverlay", overlay2],
          [5, "hud", hud],
          [6, "palette", palette]
        ]) {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.uniform1i(l[name2], unit);
        }
        const pitch = (frame.camera.pitch ?? 0) * Math.PI / 180, cp = Math.cos(pitch), sp = Math.sin(pitch);
        const eye = frame.camera.height ?? 0.5;
        frame.lights.forEach((light, i) => {
          const dx = light.x - frame.camera.x, dy = light.y - frame.camera.y, dz = light.z - eye;
          const forward = dx * frame.dirX + dy * frame.dirY;
          lightPose.set([-dx * frame.dirY + dy * frame.dirX, dz * cp - forward * sp, forward * cp + dz * sp, light.radius], i * 4);
          lightColor.set([
            (light.color >>> 16) * light.intensity,
            (light.color >>> 8 & 255) * light.intensity,
            (light.color & 255) * light.intensity,
            0
          ], i * 4);
        });
        e?.shadows.forEach((s, i) => {
          shadowPose.set([s.x, s.y, s.z, s.strength], i * 4);
          shadowSize.set([s.halfA, s.halfB, s.onGlass ? 1 : 0, 0], i * 4);
        });
        gl.uniform4fv(l["lightPose[0]"], lightPose);
        gl.uniform4fv(l["lightColor[0]"], lightColor);
        gl.uniform4fv(l["shadowPose[0]"], shadowPose);
        gl.uniform4fv(l["shadowSize[0]"], shadowSize);
        gl.uniform1i(l.lightCount, frame.lights.length);
        gl.uniform1i(l.shadowCount, e?.shadows.length ?? 0);
        gl.uniform2f(l.viewport, w, h);
        gl.uniform2f(l.heading, frame.dirX, frame.dirY);
        gl.uniform2f(l.tilt, cp, sp);
        gl.uniform3f(l.eye, frame.camera.x, frame.camera.y, eye);
        gl.uniform1f(l.fov, frame.fov);
        gl.uniform1f(l.rowOrigin, frame.rowOrigin);
        gl.uniform1f(l.haze, e?.haze ?? 0);
        gl.uniform3f(l.horizon, ...packedRgb(e?.horizon ?? 0));
        gl.uniform1f(l.flash, frame.flash);
        gl.uniform1f(l.fade, frame.fade);
        gl.uniform1i(l.outlineRadius, frame.outlineRadius);
        gl.uniform3f(l.outlineColor, ...packedRgb(frame.outlineColor));
        gl.uniform1i(l.paletteEnabled, frame.palette ? 1 : 0);
        gl.uniform1i(l.bloomEnabled, bloomEnabled ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw new Error(`GPU lighting failed (WebGL ${error})`);
      };
      return { draw, dispose };
    } catch (error) {
      dispose();
      throw error;
    }
  }

  // src/pixel3d/index.ts
  var settings;
  function configure(config) {
    settings = config;
  }
  function boot(options) {
    beginGameLoading();
    const game = new Pixel3DEngine(settings, options);
    Object.assign(globalThis, { __RunePixel3D: game, __RunePixel: game });
    if (typeof document !== "undefined") {
      let active2 = null;
      let dispose;
      const attach = () => {
        const canvas = document.querySelector(
          "canvas[data-rune-pixel-3d], canvas[data-rune-pixel]"
        );
        if (canvas === active2) return;
        dispose?.();
        active2 = canvas;
        dispose = canvas ? mount(game, canvas) : void 0;
      };
      attach();
      const observer = new MutationObserver(attach);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      window.addEventListener(
        "pagehide",
        () => {
          observer.disconnect();
          dispose?.();
        },
        { once: true }
      );
    }
    return game;
  }
  function mount(game, canvas) {
    const { width, height, tickRate } = game.config;
    const keys2 = game.config.keys || {
      KeyW: "forward",
      KeyS: "back",
      KeyA: "strafe_left",
      KeyD: "strafe_right",
      ArrowLeft: "turn_left",
      ArrowRight: "turn_right",
      Space: "fire",
      KeyE: "use"
    };
    game.resizeViewport(width, height);
    canvas.width = width;
    canvas.height = height;
    const gpuToggle = document.querySelector("input[data-pixel-gpu]");
    const fps = document.querySelector("[data-pixel-fps]");
    const frameRate = document.querySelector("select[data-pixel-frame-rate]");
    const context = canvas.getContext("2d", { alpha: gpuToggle !== null });
    if (!context) throw new Error("This game needs Canvas 2D support");
    context.imageSmoothingEnabled = false;
    let image = new ImageData(
      new Uint8ClampedArray(game.raycaster.buffer.buffer),
      width,
      height
    );
    let input = {};
    let mouseFire = false;
    let pendingFire = false;
    let pendingUse = false;
    let touchFire = false, touchUse = false, moveX = 0, moveY = 0;
    let lastTouchAt = 0;
    let touch;
    let mapped;
    let lookAccumX = 0;
    let lookAccumY = 0;
    let previous = 0;
    let accumulator = 0;
    let stopped = false;
    let frameId = 0;
    let ready = false;
    let menuOpen = false;
    let fpsStart = 0, drawnFrames = 0;
    let gpu;
    let gpuLighting;
    let modelOnlyFrame = false;
    let gpuCanvas;
    let paletteColors;
    const tickMs = 1e3 / tickRate;
    let nextRenderAt;
    let overlayKey;
    const abort = new AbortController();
    const listen = (element, name2, callback) => element.addEventListener(name2, callback, { signal: abort.signal });
    const clear = (keepCommands = false) => {
      input = {};
      mouseFire = false;
      pendingFire = false;
      pendingUse = false;
      lookAccumX = 0;
      lookAccumY = 0;
      touch?.reset();
      mapped?.clear(keepCommands);
    };
    const start = () => {
      unlockAudio();
      clear();
      game.activate("start");
      previous = 0;
      accumulator = 0;
      canvas.focus();
    };
    for (const button of Array.from(document.querySelectorAll("[data-pixel-start]"))) {
      listen(button, "click", () => {
        if (game.app.state.status === "playing" && button.dataset.pixelConfirm && !window.confirm(button.dataset.pixelConfirm)) return;
        start();
      });
    }
    for (const form of Array.from(document.querySelectorAll("form[data-pixel-action]"))) {
      listen(form, "submit", (event) => {
        event.preventDefault();
        unlockAudio();
        clear();
        const action = form.dataset.pixelAction;
        const previous2 = game.app.state.status;
        const fields = /* @__PURE__ */ Object.create(null);
        new FormData(form).forEach((value, name2) => {
          if (typeof value === "string") fields[name2] = value;
        });
        if (action) game.activate(action, [fields]);
        if (game.app.state.status !== previous2) canvas.focus({ preventScroll: true });
      });
    }
    for (const button of Array.from(document.querySelectorAll("[data-pixel-action]:not(form)"))) {
      const args = JSON.parse(button.dataset.pixelArgs || "[]");
      if (!Array.isArray(args)) throw new Error("data-pixel-args must be a JSON array");
      listen(button, "click", () => {
        unlockAudio();
        const action = button.dataset.pixelAction;
        clear();
        if (action) game.activate(action, args);
        canvas.focus({ preventScroll: true });
      });
    }
    for (const button of Array.from(document.querySelectorAll("[data-pixel-pause]"))) {
      listen(button, "click", () => {
        canvas.focus();
        clear(true);
        game.paused = !game.paused;
      });
    }
    for (const button of Array.from(document.querySelectorAll("[data-pixel-restart]"))) {
      const action = game.config.restartAction;
      if (!action) throw new Error("data-pixel-restart needs Scene restart_action");
      listen(button, "click", () => {
        unlockAudio();
        clear();
        game.invoke(action);
        canvas.focus({ preventScroll: true });
      });
    }
    for (const button of Array.from(document.querySelectorAll("[data-pixel-mute]"))) {
      listen(button, "click", () => {
        unlockAudio();
        clear(true);
        game.muted = !game.muted;
        canvas.focus({ preventScroll: true });
      });
    }
    const surface = canvas.parentElement || canvas;
    const resolution = document.querySelector("select[data-pixel-resolution]");
    const palette = document.querySelector("select[data-pixel-palette]");
    const lighting = document.querySelector("select[data-pixel-lighting]");
    const fullscreen = createFullscreen(surface, () => {
      fitViewport();
      clear(true);
      touch?.update();
      mapped?.update();
    });
    function fitViewport() {
      let renderWidth = width, renderHeight = height;
      if (resolution) {
        const size = /^(\d+)x(\d+)$/.exec(resolution.value);
        if (!size) throw new Error("Pixel-3d resolution options must use WIDTHxHEIGHT");
        renderWidth = Number(size[1]);
        renderHeight = Number(size[2]);
        if (renderWidth * height !== renderHeight * width) {
          throw new Error("Pixel-3d resolution options must match the app aspect ratio");
        }
      }
      const hudScale = renderWidth / width;
      if (canvas.dataset.pixelFit === "viewport" && fullscreen.expanded()) {
        const rect = surface.getBoundingClientRect();
        const aspect = Math.max(0.25, Math.min(4, rect.width / Math.max(1, rect.height)));
        renderWidth = Math.round(Math.sqrt(renderWidth * renderHeight * aspect) / 2) * 2;
        renderHeight = Math.round(renderWidth / aspect);
      }
      game.resizeViewport(renderWidth, renderHeight, hudScale);
      if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
        canvas.width = renderWidth;
        canvas.height = renderHeight;
        context.imageSmoothingEnabled = false;
        image = new ImageData(new Uint8ClampedArray(game.raycaster.buffer.buffer), renderWidth, renderHeight);
        overlayKey = void 0;
      }
      if (gpuCanvas) {
        if (gpuCanvas.width !== renderWidth) gpuCanvas.width = renderWidth;
        if (gpuCanvas.height !== renderHeight) gpuCanvas.height = renderHeight;
        gpuCanvas.style.left = `${canvas.offsetLeft}px`;
        gpuCanvas.style.top = `${canvas.offsetTop}px`;
      }
    }
    function applyPalette() {
      const value = palette?.value;
      paletteColors = value && value !== "original" ? value.split(",").map((hex) => {
        if (!/^[\da-f]{6}$/i.test(hex)) throw new Error("Pixel-3d palette options need six-digit hex colors");
        return Number.parseInt(hex, 16);
      }) : void 0;
      const paletteOutline = palette?.selectedOptions[0]?.dataset.pixelOutline === "true";
      game.raycaster.setPalette(paletteColors, paletteOutline);
      gpu?.setPalette(paletteColors);
      overlayKey = void 0;
      game.invalidateFrame();
    }
    if (resolution) {
      listen(resolution, "change", fitViewport);
      fitViewport();
    }
    if (palette) {
      listen(palette, "change", applyPalette);
      applyPalette();
    }
    function applyLighting() {
      game.raycaster.setEnhancedLighting(lighting?.value === "enhanced");
      gpu?.resetInterpolation();
      overlayKey = void 0;
      resetFps();
      game.invalidateFrame();
    }
    if (lighting) {
      const key2 = "rune-pixel-lighting-" + (game.config.persistence?.key ?? window.location.pathname);
      const saved = getStorageItem(key2);
      if (saved === "standard" || saved === "enhanced") lighting.value = saved;
      listen(lighting, "change", () => {
        applyLighting();
        setStorageItem(key2, lighting.value);
      });
      applyLighting();
    }
    function resetFps() {
      drawnFrames = 0;
      fpsStart = 0;
      nextRenderAt = void 0;
      if (fps) fps.textContent = `${gpuToggle?.checked ? "GPU" : "CPU"} \xB7 \u2014 FPS`;
    }
    if (frameRate) {
      listen(frameRate, "change", () => {
        resetFps();
        game.invalidateFrame();
      });
    }
    function cpuFallback(reason) {
      if (gpuToggle) {
        gpuToggle.checked = false;
        gpuToggle.disabled = true;
        gpuToggle.title = reason;
      }
      gpu?.dispose();
      gpuLighting?.dispose();
      gpuLighting = void 0;
      gpu = void 0;
      gpuCanvas?.remove();
      gpuCanvas = void 0;
      resetFps();
      game.invalidateFrame();
    }
    function toggleGpu() {
      if (gpuToggle?.checked && !gpu) {
        const layer = document.createElement("canvas");
        layer.dataset.pixelGpuSurface = "true";
        layer.setAttribute("aria-hidden", "true");
        layer.style.cssText = "position:absolute;pointer-events:none";
        layer.hidden = true;
        try {
          gpu = createWebGlRenderer(layer, game.config.models);
          if (gpu) gpuLighting = createGpuLighting(layer);
        } catch (error) {
          console.warn("Pixel 3D WebGL setup failed", error);
        }
        if (!gpu || !gpuLighting) {
          cpuFallback("Accelerated WebGL 2 is unavailable. Using the CPU renderer.");
          return;
        }
        gpuCanvas = layer;
        gpu.setPalette(paletteColors);
        surface.prepend(layer);
        fitViewport();
        listen(layer, "webglcontextlost", () => cpuFallback("WebGL context lost. Using the CPU renderer."));
      }
      if (gpuCanvas && !gpuToggle?.checked) gpuCanvas.hidden = true;
      overlayKey = void 0;
      gpu?.resetInterpolation();
      resetFps();
      game.invalidateFrame();
    }
    if (gpuToggle) {
      listen(gpuToggle, "change", toggleGpu);
      toggleGpu();
    }
    function drawFrame(extraFrames) {
      if (gpu && gpuLighting && gpuCanvas && gpuToggle?.checked) {
        try {
          const changed = game.presentIfChanged(() => {
            const stats = game.renderState();
            const { map, world } = game.raycaster.config;
            modelOnlyFrame = !game.raycaster.enhancedLighting && !!map.sky && map.sky.below !== void 0 && !world && !stats.lights.length && !map.grid.some(Boolean) && !stats.weapon && !stats.things.some((thing) => thing.sprite || thing.title);
            if (!modelOnlyFrame) {
              game.frame((frame2) => gpuLighting.draw(frame2));
              context.clearRect(0, 0, canvas.width, canvas.height);
              overlayKey = void 0;
              return;
            }
            if (!map.sky) throw new Error("Model rendering needs a sky");
            gpu.capture(stats, map.sky, game.raycaster.fov, extraFrames);
            const hud = game.frameHud(stats);
            const key2 = JSON.stringify([hud, Array.from(game.keyboard.pressed)]);
            if (overlayKey !== key2) {
              game.raycaster.renderOverlay(hud);
              context.putImageData(image, 0, 0);
              overlayKey = key2;
            }
          });
          if (!changed && (!extraFrames || !modelOnlyFrame)) return false;
          if (modelOnlyFrame) gpu.draw(extraFrames ? accumulator / tickMs : 1, game.raycaster.outlineRadius);
          gpuCanvas.hidden = false;
          return true;
        } catch (error) {
          console.warn("Pixel 3D WebGL frame failed", error);
          cpuFallback("This scene could not use WebGL. Using the CPU renderer.");
        }
      }
      if (gpuCanvas) gpuCanvas.hidden = true;
      if (!game.frameIfChanged()) {
        if (!extraFrames) return false;
        game.frame();
      }
      context.putImageData(image, 0, 0);
      return true;
    }
    const viewportResize = new ResizeObserver(fitViewport);
    viewportResize.observe(surface);
    for (const button of Array.from(document.querySelectorAll("[data-pixel-fullscreen]"))) {
      listen(button, "click", () => {
        void fullscreen.toggle().catch(() => {
        });
      });
    }
    let pointerLockUnavailable = false;
    const activeHud = () => game.paused && game.config.pauseUi && game.app.state.status === "playing" ? game.app.state[game.config.pauseUi] : game.config.ui ? game.app.state[game.config.ui] : void 0;
    const activateHudAction = (action, args = []) => {
      unlockAudio();
      clear(true);
      if (action === "host.keyboard") {
        game.keyboard.sync(activeHud()?.keyboard);
        game.keyboard.activate(String(args[0]), (a, values) => game.activate(a, values));
        game.invalidateFrame();
        canvas.focus({ preventScroll: true });
        return;
      }
      const grid = activeHud()?.grid;
      if (grid?.closeOnActivate && grid.dismissAction && action !== grid.moveAction && action !== grid.dismissAction) {
        game.activate(grid.dismissAction);
      }
      if (action === "host.mute") {
        game.muted = !game.muted;
      } else if (action === "host.fullscreen") {
        void fullscreen.toggle().catch((error) => console.error("Pixel 3D fullscreen failed", error));
      } else {
        game.activate(action, args);
      }
      canvas.focus({ preventScroll: true });
    };
    canvas.addEventListener("keydown", (event) => {
      if (activeHud()?.keyboard) {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        game.keyboardKey(event.key, true, event.repeat);
        unlockAudio();
        clear(true);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (game.hudKey(event.code, true, event.repeat)) {
        unlockAudio();
        clear(true);
        if (game.consumeUiFullscreen()) void fullscreen.toggle().catch((error) => console.error("Pixel 3D fullscreen failed", error));
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const grid = activeHud()?.grid;
      if (grid?.layout !== "sidebar") return;
      let action, args = [];
      if (grid.moveAction && ["ArrowUp", "ArrowDown"].includes(event.code)) {
        action = grid.moveAction;
        args = [event.code === "ArrowUp" ? -1 : 1];
      } else if (grid.moveAction && ["Enter", "Space"].includes(event.code)) {
        const item = grid.items.find((item2) => item2.selected);
        if (item && !item.disabled) {
          action = item.action;
          args = item.args ?? [];
        }
      } else if (grid.dismissAction && ["Escape", "Backspace"].includes(event.code)) {
        action = grid.dismissAction;
      } else return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (action && (!event.repeat || ["ArrowUp", "ArrowDown"].includes(event.code))) activateHudAction(action, args);
    }, { capture: true, signal: abort.signal });
    document.addEventListener("keyup", (event) => {
      if (activeHud()?.keyboard) {
        game.keyboardKey(event.key, false);
        event.stopImmediatePropagation();
      }
    }, { capture: true, signal: abort.signal });
    const handleMenuKey = (code) => {
      const p = activeHud()?.panel;
      if (!p?.choiceActions?.length) return false;
      if ((code === "ArrowUp" || code === "KeyW") && game.hasAction("menu_move")) {
        game.invoke("menu_move", [-1]);
        return true;
      }
      if ((code === "ArrowDown" || code === "KeyS") && game.hasAction("menu_move")) {
        game.invoke("menu_move", [1]);
        return true;
      }
      if (game.paused && (code === "Enter" || code === "Space")) {
        const ca = p.choiceActions[p.selected ?? 0];
        if (ca) {
          clear(true);
          game.activate(ca.action, ca.args ?? []);
          return true;
        }
      }
      return false;
    };
    mapped = game.controls ? mountControls(canvas, game.controls, {
      state: () => game.app.state,
      playing: () => game.app.state.status === "playing",
      paused: () => game.paused,
      resume: () => {
        clear(true);
        game.paused = false;
      },
      advance: () => {
        clear();
        if (["title", "story", "escape_retry", "gameover", "won"].includes(String(game.app.state.status))) game.invoke("advance");
        else start();
      },
      fullscreen: () => {
        void fullscreen.toggle().catch(() => {
        });
      },
      interact: unlockAudio,
      lockedMouse: true,
      unlockedCanvasLook: () => pointerLockUnavailable,
      advanceInputs: ["fire", "use"],
      expanded: fullscreen.expanded,
      menuKey: handleMenuKey,
      tapToAdvance: game.config.clickToStart
    }) : void 0;
    const mappedStyle = mapped ? document.createElement("style") : void 0;
    if (mappedStyle) {
      mappedStyle.textContent = STYLE;
      document.head.append(mappedStyle);
      surface.classList.add("rune-pixel3d-surface");
    }
    touch = mapped ? void 0 : mountTouch(canvas, surface, {
      playing: () => game.app.state.status === "playing",
      paused: () => game.paused,
      interact: () => {
        lastTouchAt = Date.now();
        unlockAudio();
      },
      advance: () => {
        if (game.config.clickToStart === false && game.app.state.status !== "playing") return;
        clear();
        if (["title", "story", "escape_retry", "gameover", "won"].includes(String(game.app.state.status))) game.invoke("advance");
        else start();
      },
      resume: () => {
        clear(true);
        game.paused = false;
      },
      move: (x, y) => {
        moveX = x;
        moveY = y;
      },
      look: (delta) => {
        lookAccumX += delta;
      },
      fire: (held, pulse, cancel) => {
        touchFire = held;
        if (pulse) pendingFire = true;
        if (cancel) pendingFire = false;
      },
      use: (held, pulse, cancel) => {
        touchUse = held;
        if (pulse) pendingUse = true;
        if (cancel) pendingUse = false;
      },
      fullscreen: () => {
        void fullscreen.toggle().catch(() => {
        });
      },
      expanded: fullscreen.expanded,
      pause: () => {
        clear(true);
        game.paused = !game.paused;
      }
    });
    listen(canvas, "mousedown", ((event) => {
      if (mapped) return;
      if (Date.now() - lastTouchAt < 700 || event.button !== 0 || game.app.state.status !== "playing") return;
      unlockAudio();
      canvas.focus();
      mouseFire = true;
      pendingFire = true;
    }));
    listen(document, "mouseup", ((event) => {
      if (event.button === 0) mouseFire = false;
    }));
    listen(document, "pointerlockerror", () => {
      if (document.activeElement === canvas && game.config.mouseLook !== false) pointerLockUnavailable = true;
    });
    listen(document, "pointerlockchange", () => {
      if (document.pointerLockElement === canvas) pointerLockUnavailable = false;
      if (!game.paused && document.pointerLockElement !== canvas) {
        mouseFire = false;
        pendingFire = false;
        lookAccumX = 0;
        lookAccumY = 0;
      }
    });
    const activateHudAt = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const scale = resolution ? Number(resolution.value.split("x")[0]) / width : 1;
      const hudWidth = Math.floor(canvas.width / scale), hudHeight = Math.floor(canvas.height / scale);
      const cx = (clientX - rect.left) * hudWidth / rect.width;
      const cy = (clientY - rect.top) * hudHeight / rect.height;
      game.keyboard.sync(activeHud()?.keyboard);
      const regions = activeHud()?.keyboard ? game.keyboard.hits(hudWidth, hudHeight) : collectHudHitRegions(hudWidth, hudHeight, activeHud(), String(game.app.state.status ?? "playing"), game.paused);
      const hit = regions.find((r) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h);
      if (!hit) {
        if (activeHud()?.keyboard || activeHud()?.callout || activeHud()?.grid?.layout === "sidebar") return true;
        const path = canvas.dataset.pixelPick;
        if (path) {
          const index2 = game.pickThing(
            path,
            (clientX - rect.left) * canvas.width / rect.width,
            (clientY - rect.top) * canvas.height / rect.height
          );
          if (index2 >= 0) {
            activateHudAction(canvas.dataset.pixelPickAction, [index2]);
            return true;
          }
        }
        return false;
      }
      activateHudAction(hit.action, hit.args);
      return true;
    };
    if (canvas.dataset.pixelPick && (!canvas.dataset.pixelPickAction || !game.hasAction(canvas.dataset.pixelPickAction))) {
      throw new Error("data-pixel-pick requires a valid data-pixel-pick-action");
    }
    const dragAction = canvas.dataset.pixelDragAction;
    if (dragAction && !game.hasAction(dragAction)) throw new Error("data-pixel-drag-action requires a valid action");
    let drag;
    let suppressDragClick = false;
    let hudTouch;
    const consumesHudPointer = (clientX, clientY) => {
      const hud = activeHud();
      if (hud?.keyboard || hud?.callout || hud?.grid?.layout === "sidebar") return true;
      const rect = canvas.getBoundingClientRect(), scale = game.raycaster.hudScale;
      if (rect.width <= 0 || rect.height <= 0) return false;
      return hudButtonAt(
        hud,
        Math.floor(canvas.width / scale),
        Math.floor(canvas.height / scale),
        (clientX - rect.left) * canvas.width / scale / rect.width,
        (clientY - rect.top) * canvas.height / scale / rect.height
      );
    };
    canvas.addEventListener("mousedown", (event) => {
      if (consumesHudPointer(event.clientX, event.clientY)) event.stopImmediatePropagation();
    }, { capture: true, signal: abort.signal });
    canvas.addEventListener("pointerdown", (event) => {
      const sidebar = consumesHudPointer(event.clientX, event.clientY);
      if (dragAction && !sidebar && !game.paused && event.button === 0 && !drag) {
        drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, moved: false };
        suppressDragClick = false;
        canvas.setPointerCapture(event.pointerId);
      }
      if (event.pointerType === "touch") hudTouch = { id: event.pointerId, x: event.clientX, y: event.clientY, sidebar };
      if (sidebar) {
        unlockAudio();
        clear(true);
        canvas.focus({ preventScroll: true });
        event.stopImmediatePropagation();
      }
    }, { capture: true, signal: abort.signal });
    listen(canvas, "pointermove", ((event) => {
      if (!drag || drag.id !== event.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8) drag.moved = true;
      if (!drag.moved) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && !game.paused && !consumesHudPointer(event.clientX, event.clientY)) {
        game.invoke(dragAction, [(event.clientX - drag.lastX) * 180 / rect.width]);
      }
      drag.lastX = event.clientX;
      event.preventDefault();
    }));
    listen(canvas, "pointercancel", () => {
      hudTouch = void 0;
      drag = void 0;
      suppressDragClick = false;
    });
    canvas.addEventListener("pointerup", (event) => {
      if (drag?.id === event.pointerId) {
        suppressDragClick = drag.moved;
        drag = void 0;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (suppressDragClick) {
          hudTouch = void 0;
          if (event.pointerType === "touch") lastTouchAt = Date.now();
          event.stopImmediatePropagation();
          return;
        }
      }
      const touch2 = hudTouch;
      hudTouch = void 0;
      if (touch2?.sidebar) event.stopImmediatePropagation();
      if (event.pointerType !== "touch" || touch2?.id !== event.pointerId || Math.hypot(event.clientX - touch2.x, event.clientY - touch2.y) > 12) return;
      lastTouchAt = Date.now();
      activateHudAt(event.clientX, event.clientY);
    }, { capture: true, signal: abort.signal });
    listen(canvas, "click", ((event) => {
      if (suppressDragClick) {
        suppressDragClick = false;
        return;
      }
      if (Date.now() - lastTouchAt < 700 || mapped?.recentTouch()) return;
      unlockAudio();
      canvas.focus();
      if (activateHudAt(event.clientX, event.clientY)) return;
      if (game.app.state.status !== "playing") {
        if (game.config.clickToStart === false) return;
        if (game.app.state.status === "title" || game.app.state.status === "story" || game.app.state.status === "select" || game.app.state.status === "stage_clear" || game.app.state.status === "boss_victory") {
          const panel = activeHud()?.panel;
          if (panel?.choiceActions && panel.choiceActions.length > 1) return;
          game.invoke("advance");
          return;
        }
        start();
        return;
      }
      if (game.config.mouseLook !== false && document.pointerLockElement !== canvas) {
        if (!canvas.requestPointerLock) {
          pointerLockUnavailable = true;
          return;
        }
        try {
          canvas.requestPointerLock()?.catch(() => {
            pointerLockUnavailable = true;
          });
        } catch {
          pointerLockUnavailable = true;
        }
      }
    }));
    listen(document, "mousemove", ((event) => {
      if (mapped) return;
      if (document.pointerLockElement === canvas) {
        lookAccumX += event.movementX;
        lookAccumY += event.movementY;
      }
    }));
    listen(canvas, "keydown", ((event) => {
      if (mapped && event.code !== "Escape") return;
      if (event.code === "Escape" && !event.repeat) {
        const menu = document.querySelector("[data-pixel-menu]:not([hidden])");
        if (menu?.dataset.pixelMenuClose) {
          event.preventDefault();
          clear();
          game.activate(menu.dataset.pixelMenuClose);
          return;
        }
        if (document.pointerLockElement === canvas) {
          event.preventDefault();
          document.exitPointerLock?.();
          clear();
          return;
        }
        if (isPausableStatus(game.app.state.status) && (game.config.pauseUi || document.querySelector("[data-pixel-paused]"))) {
          event.preventDefault();
          clear(true);
          game.paused = !game.paused;
          return;
        }
        if (game.app.state.status !== "playing") {
          if (game.hasAction("back")) {
            event.preventDefault();
            clear(true);
            game.activate("back");
            return;
          }
          if (game.app.state.status !== "title" && game.config.restartAction) {
            event.preventDefault();
            clear(true);
            game.activate(game.config.restartAction);
            return;
          }
        }
      }
      unlockAudio();
      if (keys2[event.code] || ["Enter", "KeyP", "KeyM", "Space"].includes(event.code)) {
        event.preventDefault();
      }
      if (game.app.state.status !== "playing" && (event.code === "Enter" || keys2[event.code] === "fire" || keys2[event.code] === "use")) {
        if (!event.repeat) {
          clear();
          game.invoke("advance");
        }
        return;
      }
      if (keys2[event.code]) input[keys2[event.code]] = true;
      if (keys2[event.code] === "use" && !event.repeat) pendingUse = true;
      if (!event.repeat && event.code === "Escape" && document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
        clear();
      }
      if (!event.repeat && event.code === "KeyP") {
        game.paused = !game.paused;
      }
      if (!event.repeat && event.code === "KeyM") {
        game.muted = !game.muted;
      }
    }));
    listen(document, "keyup", ((event) => {
      if (mapped) return;
      if (keys2[event.code]) {
        input[keys2[event.code]] = false;
      }
    }));
    listen(window, "blur", () => {
      game.flushSave();
      clear();
      game.paused = true;
    });
    listen(document, "visibilitychange", () => {
      if (document.hidden) {
        game.flushSave();
        clear();
        game.paused = true;
      }
    });
    listen(window, "focus", () => {
      if (game.app.state.status !== "playing") game.paused = false;
    });
    const frame = (now) => {
      if (stopped) return;
      if (previous) accumulator += Math.min(now - previous, tickMs * 5);
      previous = now;
      const keyboardOpen = Boolean(activeHud()?.keyboard || activeHud()?.callout || activeHud()?.grid?.layout === "sidebar");
      if (keyboardOpen) {
        clear(true);
        if (document.hasFocus() && document.activeElement === canvas && navigator.getGamepads) {
          game.hudPads(Array.from(navigator.getGamepads()));
          if (game.consumeUiFullscreen()) void fullscreen.toggle().catch((error) => console.error("Pixel 3D fullscreen failed", error));
        }
      }
      while (accumulator >= tickMs) {
        const controls = {
          ...input,
          fire: Boolean(input.fire || mouseFire || touchFire || pendingFire),
          use: Boolean(input.use || touchUse || pendingUse),
          move_x: moveX,
          move_y: moveY
        };
        pendingFire = false;
        pendingUse = false;
        controls.look_x = lookAccumX;
        controls.look_y = lookAccumY;
        lookAccumX = 0;
        lookAccumY = 0;
        game.step(keyboardOpen ? {} : mapped ? mapped.sample(1 / tickRate) : controls);
        if (game.app.state.status !== "playing") clear(true);
        accumulator -= tickMs;
      }
      touch?.update();
      mapped?.update();
      const capped = frameRate?.value === "60";
      const extraFrames = !game.paused && (capped || frameRate?.value === "display");
      const renderDue = !capped || nextRenderAt === void 0 || now + 0.5 >= nextRenderAt;
      if (capped && renderDue) {
        const deadline = nextRenderAt ?? now;
        const interval = 1e3 / 60;
        nextRenderAt = deadline + Math.max(1, Math.floor((now - deadline) / interval) + 1) * interval;
      }
      if (renderDue && drawFrame(extraFrames)) {
        drawnFrames++;
        if (!ready) {
          ready = true;
          markGameReady();
        }
      }
      if (fps) {
        if (!fpsStart) fpsStart = now;
        const seconds = (now - fpsStart) / 1e3;
        if (seconds >= 0.5) {
          const renderer = gpuCanvas && !gpuCanvas.hidden ? "GPU" : "CPU";
          fps.textContent = `${renderer} \xB7 ${game.paused ? "Paused" : `${Math.round(drawnFrames / seconds)} FPS`}`;
          fpsStart = now;
          drawnFrames = 0;
        }
      }
      const state = game.app.state;
      for (const button of Array.from(document.querySelectorAll("[data-pixel-mute]"))) {
        button.setAttribute("aria-pressed", String(game.muted));
      }
      for (const element of Array.from(document.querySelectorAll("[data-pixel-paused]"))) {
        element.hidden = !game.paused || !isPausableStatus(state.status);
      }
      for (const button of Array.from(document.querySelectorAll("[data-pixel-pause]"))) {
        button.textContent = game.paused ? "Resume / P" : "Pause / P";
      }
      for (const element of Array.from(document.querySelectorAll("[data-pixel-text], [data-pixel-disabled], [data-pixel-selected], [data-pixel-hidden]"))) {
        const resolve2 = (path) => path.split(".").reduce((v, key2) => v?.[key2], state);
        if (element.dataset.pixelText) {
          const value = resolve2(element.dataset.pixelText);
          if (value === void 0) throw new Error(`Unknown data-pixel-text state: ${element.dataset.pixelText}`);
          const text = String(value);
          if (element.textContent !== text) element.textContent = text;
        }
        if (element.dataset.pixelDisabled && element instanceof HTMLButtonElement) {
          const value = resolve2(element.dataset.pixelDisabled);
          if (typeof value !== "boolean") throw new Error("data-pixel-disabled must reference boolean state");
          element.disabled = value;
        }
        if (element.dataset.pixelSelected) {
          const value = resolve2(element.dataset.pixelSelected);
          if (typeof value !== "boolean") throw new Error("data-pixel-selected must reference boolean state");
          element.setAttribute("aria-pressed", String(value));
        }
        if (element.dataset.pixelHidden) {
          const value = resolve2(element.dataset.pixelHidden);
          if (typeof value !== "boolean") throw new Error("data-pixel-hidden must reference boolean state");
          element.hidden = value;
        }
      }
      const nextMenuOpen = document.querySelector("[data-pixel-menu]:not([hidden])") !== null;
      if (nextMenuOpen !== menuOpen) {
        clear(true);
        menuOpen = nextMenuOpen;
        if (!menuOpen) canvas.focus({ preventScroll: true });
      }
      const announce = document.querySelector("[data-pixel-status]");
      if (announce) {
        const status = game.paused ? "Paused \u2014 tap Resume or press P" : game.config.presentation ? `${game.config.presentation.title} \u2014 ${game.config.ui ? state[game.config.ui].prompt : state.message || game.config.presentation.objective}${game.saveStatus ? ` \u2014 Progress: ${game.saveStatus}` : ""}` : state.status === "title" ? "Vect Breach \u2014 Tap/click the game or press Enter/Space to commence mission." : state.status === "story" ? "Incoming Transmission \u2014 Tap/click the game or press Enter/Space to engage." : state.status === "won" ? "Mission Accomplished! All Sectors Cleared. Tap the game, or press Space/Enter to replay." : state.status === "gameover" ? "Agent Terminated! Tap the game, or press Space/Enter to restart." : state.status === "ready" ? "Click canvas or press Enter to begin mission." : navigator.maxTouchPoints > 0 ? "Left stick: move. Drag the game: aim. FIRE: shoot. USE: terminal / elevator." : "Click canvas to lock mouse look. WASD to move, left click / Space to fire, E to use switch.";
        if (announce.textContent !== status) {
          announce.textContent = status;
        }
      }
      if ((state.status !== "playing" || game.paused || menuOpen) && document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
      }
      frameId = requestAnimationFrame(frame);
    };
    if (canvas.dataset.pixelAppFullscreen === "true" && isStandaloneApp()) fullscreen.startStandalone();
    frame(performance.now());
    const dispose = () => {
      game.flushSave();
      stopped = true;
      game.paused = true;
      cancelAnimationFrame(frameId);
      fullscreen.dispose();
      gpu?.dispose();
      gpuLighting?.dispose();
      gpuCanvas?.remove();
      viewportResize.disconnect();
      touch?.dispose();
      mapped?.dispose();
      mappedStyle?.remove();
      if (mapped) surface.classList.remove("rune-pixel3d-surface");
      abort.abort();
      clear();
    };
    listen(window, "pagehide", dispose);
    return dispose;
  }
  return __toCommonJS(index_exports);
})();
