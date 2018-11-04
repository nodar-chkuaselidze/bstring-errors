/*!
 * cashaddr.js - cashaddr for bcash
 *
 * This is modified version of bstring/cashaddr.
 * When decoding cashaddr, this will report data and checksum
 *
 * Copyright (c) 2018, Chkuaselidze Nodari (MIT License).
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 *
 * Implementation of CashAddr
 * https://github.com/bitcoincashorg/spec/blob/master/cashaddr.md
 *
 * Parts of this software are based on "bitcoin-abc".
 * https://github.com/Bitcoin-ABC/bitcoin-abc
 *
 * Parts of this software are based on "bech32".
 * https://github.com/sipa/bech32
 *
 * Copyright (c) 2017 Pieter Wuille
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

'use strict';

const assert = require('bsert');
const {U64} = require('n64');

/**
 * Constants
 */

const POOL105 = Buffer.allocUnsafe(105);
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

const TABLE = [
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  15, -1, 10, 17, 21, 20, 26, 30,  7,  5, -1, -1, -1, -1, -1, -1,
  -1, 29, -1, 24, 13, 25,  9,  8, 23, -1, 18, 22, 31, 27, 19, -1,
   1,  0,  3, 16, 11, 28, 12, 14,  6,  4,  2, -1, -1, -1, -1, -1,
  -1, 29, -1, 24, 13, 25,  9,  8, 23, -1, 18, 22, 31, 27, 19, -1,
   1,  0,  3, 16, 11, 28, 12, 14,  6,  4,  2, -1, -1, -1, -1, -1
];

const CHECKSUM_MASK = U64.fromNumber(0x07ffffffff);

const GENERATOR = [
  U64.fromNumber(0x98f2bc8e61),
  U64.fromNumber(0x79b76d99e2),
  U64.fromNumber(0xf33e5fb3c4),
  U64.fromNumber(0xae2eabe2a8),
  U64.fromNumber(0x1e4f43e470)
];

/**
 * Update checksum
 * @ignore
 * @param {U64} chk
 * @returns {U64} -- new checksum
 */

function polymodStep(pre) {
  const c = pre.clone();
  const b = c.ushrn(35).lo;

  c.iand(CHECKSUM_MASK).ishln(5);

  for (let i = 0; i < GENERATOR.length; i++) {
    if ((b >>> i) & 1)
      c.ixor(GENERATOR[i]);
  }

  return c;
}

/**
 * Calculate checksum
 * @ignore
 * @param {Buffer} data - 5 bit encoded
 * @returns {U64}
 */

function polymod(data) {
  const c = U64.fromNumber(1);

  for (let i = 0; i < data.length; i++) {
    const b = c.ushrn(35).lo;
    c.iand(CHECKSUM_MASK).ishln(5);

    for (let i = 0; i < GENERATOR.length; i++) {
      if ((b >>> i) & 1)
        c.ixor(GENERATOR[i]);
    }

    c.ixorn(data[i]);
  }

  return c.ixorn(1);
}

/**
 * Serialize data to cashaddr.
 * @param {String} prefix
 * @param {Buffer} data - 5bit serialized
 * @returns {String}
 */

function serialize(prefix, data) {
  assert(typeof prefix === 'string');
  assert(Buffer.isBuffer(data));

  let chk = U64.fromNumber(1);
  let str = '';

  let upper = false;
  let lower = false;

  for (let i = 0; i < prefix.length; i++) {
    let ch = prefix.charCodeAt(i);

    if ((ch & 0xff00) || (ch >>> 5) === 0)
      throw new Error('Invalid cashaddr character.');

    if (ch >= 0x61 && ch <= 0x7a) {
      lower = true;
    } else if (ch >= 0x41 && ch <= 0x5a) {
      upper = true;
      ch = (ch - 0x41) + 0x61;
    } else if (ch >= 0x30 && ch <= 0x39) {
      throw new Error('Invalid cashaddr prefix.');
    }

    chk = polymodStep(chk).ixorn(ch & 0x1f);
    str += String.fromCharCode(ch);
  }

  if (lower && upper)
    throw new Error('Invalid cashaddr prefix.');

  chk = polymodStep(chk);
  str += ':';

  for (let i = 0; i < data.length; i++) {
    const ch = data[i];

    if ((ch >>> 5) !== 0)
      throw new Error('Invalid cashaddr value.');

    chk = polymodStep(chk).ixorn(ch);
    str += CHARSET[ch];
  }

  for (let i = 0; i < 8; i++)
    chk = polymodStep(chk);

  chk.ixorn(1);

  for (let i = 0; i < 8; i++) {
    const v = chk.shrn((7 - i) * 5).lo & 0x1f;

    str += CHARSET[v];
  }

  return str;
}

/**
 * Decode CashAddr string.
 * @param {String} str
 * @param {String} defaultPrefix (lowercase and w/o numbers)
 * @returns {Array} [prefix, data]
 */

function deserialize(str, defaultPrefix) {
  assert(typeof str === 'string');

  if (str.length < 8 || str.length > 196) // 83 + 1 + 112
    throw new Error('Invalid cashaddr data length.');

  let lower = false;
  let upper = false;
  let number = false;
  let plen = 0;

  // process lower/upper, make sure we have prefix
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);

    if (ch >= 0x61 && ch <= 0x7a) {
      lower = true;
      continue;
    }

    if (ch >= 0x41 && ch <= 0x5a) {
      upper = true;
      continue;
    }

    if (ch >= 0x30 && ch <= 0x39) {
      number = true;
      continue;
    }

    if (ch === 0x3a) { // :
      if (number || i === 0 || i > 83)
        throw new Error('Invalid cashaddr prefix.');

      if (plen !== 0)
        throw new Error('Invalid cashaddr separators.');

      plen = i;

      continue;
    }

    throw new Error('Invalid cashaddr character.');
  }

  if (upper && lower)
    throw new Error('Invalid cashaddr casing.');

  // process checksum
  let chk = U64.fromNumber(1);
  let prefix;

  if (plen === 0) {
    prefix = defaultPrefix.toLowerCase();
  } else {
    prefix = str.substring(0, plen).toLowerCase();
    plen += 1;
  }

  if (prefix !== defaultPrefix)
    throw new Error('Invalid cashaddr prefix.');

  const data = Buffer.allocUnsafe(str.length);

  // process prefix
  for (let i = 0; i < prefix.length; i++) {
    const ch = prefix.charCodeAt(i);
    const v = (ch | 0x20) & 0x1f;

    data[i] = v;
    chk = polymodStep(chk).ixorn(v);
  }

  data[prefix.length] = 0;
  chk = polymodStep(chk);

  const dlen = str.length - plen;

  if (dlen <= 8 || dlen > 112)
    throw new Error('Invalid cashaddr data length.');

  for (let i = plen; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    const v = (ch & 0xff80) ? -1 : TABLE[ch];

    if (v === -1)
      throw new Error('Invalid cashaddr character.');

    chk = polymodStep(chk).ixorn(v);

    data[i] = v;
  }

  chk.ixorn(1);

  if (!chk.eqn(0))
    throw new ChecksumError(data, chk);

  return [prefix, data.slice(plen, -8)];
}

/**
 * Convert serialized data to another base.
 * @param {Buffer} input
 * @param {Number} i
 * @param {Buffer} output
 * @param {Number} j
 * @param {Number} frombits
 * @param {Number} tobits
 * @param {Boolean} pad
 * @returns {Buffer}
 */

function convert(input, i, output, j, frombits, tobits, pad) {
  assert(Buffer.isBuffer(input));
  assert((i >>> 0) === i);
  assert(Buffer.isBuffer(output));
  assert((j >>> 0) === j);
  assert((frombits & 0xff) === frombits);
  assert((tobits & 0xff) === tobits);
  assert(typeof pad === 'boolean');

  const maxv = (1 << tobits) - 1;

  let acc = 0;
  let bits = 0;

  for (; i < input.length; i++) {
    const value = input[i];

    if ((value >>> frombits) !== 0)
      throw new Error('Invalid bits.');

    acc = (acc << frombits) | value;
    bits += frombits;

    while (bits >= tobits) {
      bits -= tobits;
      output[j++] = (acc >>> bits) & maxv;
    }
  }

  if (pad) {
    if (bits)
      output[j++] = (acc << (tobits - bits)) & maxv;
  } else {
    if (bits >= frombits || ((acc << (tobits - bits)) & maxv))
      throw new Error('Invalid bits.');
  }

  assert(j <= output.length);

  return output.slice(0, j);
}

/**
 * Calculate size required for bit conversion.
 * @param {Number} len
 * @param {Number} frombits
 * @param {Number} tobits
 * @param {Boolean} pad
 * @returns {Number}
 */

function convertSize(len, frombits, tobits, pad) {
  assert((len >>> 0) === len);
  assert((frombits & 0xff) === frombits);
  assert((tobits & 0xff) === tobits);
  assert(typeof pad === 'boolean');
  assert(tobits !== 0);

  let size = (len * frombits + (tobits - 1)) / tobits;

  size >>>= 0;

  if (pad)
    size += 1;

  return size;
}

/**
 * Convert serialized data to another base.
 * @param {Buffer} data
 * @param {Number} frombits
 * @param {Number} tobits
 * @param {Boolean} pad
 * @returns {Buffer}
 */

function convertBits(data, frombits, tobits, pad) {
  assert(Buffer.isBuffer(data));
  assert((frombits & 0xff) === frombits);
  assert((tobits & 0xff) === tobits);
  assert(typeof pad === 'boolean');

  const size = convertSize(data.length, frombits, tobits, pad);
  const out = Buffer.allocUnsafe(size);

  return convert(data, 0, out, 0, frombits, tobits, pad);
}

/**
 * Get cashaddr encoded size.
 * @param {Number} size
 * @returns {Number}
 */

function encodedSize(size) {
  assert((size >>> 0) === size);

  switch (size) {
    case 20:
      return 0;
    case 24:
      return 1;
    case 28:
      return 2;
    case 32:
      return 3;
    case 40:
      return 4;
    case 48:
      return 5;
    case 56:
      return 6;
    case 64:
      return 7;
    default:
      throw new Error('Non standard length.');
  }
}

/**
 * Serialize data to cashaddr
 * @param {String} prefix
 * @param {Number} type - (0 = P2PKH, 1 = P2SH)
 * @param {Buffer} hash
 * @returns {String}
 */

function encode(prefix, type, hash) {
  assert(typeof prefix === 'string');
  // There are 4 bits available for the version (2 ^ 4 = 16)
  assert((type & 0x0f) === type, 'Invalid cashaddr type.');
  assert(Buffer.isBuffer(hash));

  if (prefix.length === 0 || prefix.length > 83)
    throw new Error('Invalid cashaddr prefix.');

  const size = encodedSize(hash.length);
  const data = Buffer.allocUnsafe(hash.length + 1);
  data[0] = (type << 3) | size;
  hash.copy(data, 1);

  const output = POOL105;
  const converted = convert(data, 0, output, 0, 8, 5, true);

  return serialize(prefix, converted);
}

/**
 * Deserialize data from CashAddr address.
 * @param {String} str
 * @param {String} defaultPrefix (lowercase and w/o numbers)
 * @returns {Object}
 */

function decode(str, defaultPrefix = 'bitcoincash') {
  assert(typeof str === 'string');
  assert(typeof defaultPrefix === 'string');

  const [prefix, data] = deserialize(str, defaultPrefix);
  const extrabits = (data.length * 5) & 7;

  if (extrabits >= 5)
    throw new Error('Invalid padding in data.');

  const last = data[data.length - 1];
  const mask = (1 << extrabits) - 1;

  if (last & mask)
    throw new Error('Non zero padding.');

  const output = data;
  const converted = convert(data, 0, output, 0, 5, 8, false);

  const type = (converted[0] >>> 3) & 0x1f;
  const hash = converted.slice(1);

  let size = 20 + 4 * (converted[0] & 0x03);

  if (converted[0] & 0x04)
    size *= 2;

  if (size !== hash.length)
    throw new Error('Invalid cashaddr data length.');

  return new AddrResult(prefix, type, hash);
}

/**
 * Test whether a string is a cashaddr string.
 * @param {String} str
 * @param {String} defaultPrefix (lowercase and w/o numbers)
 * @returns {Boolean}
 */

function test(str, defaultPrefix = 'bitcoincash') {
  try {
    decode(str, defaultPrefix);
  } catch (e) {
    return false;
  }
  return true;
}

/**
 * AddrResult
 * @private
 * @property {String} prefix
 * @property {Number} type (0 = P2PKH, 1 = P2SH)
 * @property {Buffer} hash
 */

class AddrResult {
  constructor(prefix, type, hash) {
    this.prefix = prefix;
    this.type = type;
    this.hash = hash;
  }
}

/**
 * ChecksumError
 * @property {Buffer} data
 * @property {U64} checksum
 */

class ChecksumError extends Error {
  constructor(data, checksum) {
    super();

    assert(Buffer.isBuffer(data));
    assert(U64.isU64(checksum));

    this.data = data;
    this.checksum = checksum;
  }
}

/*
 * Expose
 */

exports.convertBits = convertBits;
exports.serialize = serialize;
exports.deserialize = deserialize;
exports.encode = encode;
exports.decode = decode;
exports.test = test;
exports.ChecksumError = ChecksumError;
exports.polymod = polymod;
