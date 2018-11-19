# bstring-errors

This is a tool to detect errors in bech32 and cashaddr addresses (up to 2 errors).
This will only return error positions and wont attempt to fix the address, because
it might lead to incorrect fixes in some cases.

## Installation
You can install using `npm`.

For usage as a library `npm i bstring-errors`
or  
For binaries `npm i -g bstring-errors`

## bin usage
This repo comes with two binaries: `bech32-errors` and `bcashaddr-errors`.

### `bech32-errors` usage
```
bech32-errors:
  Usage:
    bech32-errors addresses...
    bech32-errors address0 address1...

  Options:
    -h  Show this message
```

### `bcashaddr-errors` usage
```
cashaddr-errors:
  Usage:
    cashaddr-errors addresses...
    cashaddr-errors address0 address1...

  Options:
    -h  Show this message
    --prefix    Default prefix[bitcoincash]
```

## lib usage

```js
const {bech32, cashaddr} = require('bstring-errors');

// Bech32 
// correct
const bech1 = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
// with error
const bech2 = 'bc1qw500d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
// can't detect
const bech3 = 'bc13333336qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

// returns empty array
console.log(bech32.locateErrors(bech1));

// [ 7 ]
console.log(bech32.locateErrors(bech2));

// Throws "Invalid Address, Could not locate errors."
console.log(bech32.locateErrors(bech3));

// CashAddr

const prefix = 'bitcoincash';
// correct
const cashaddr1 = 'bitcoincash:qpzry9x8gf2tvdw0s3jn54khce6mua7lcw20ayyn';
// with error
const cashaddr2 = 'bitcoincash:qpzry988gf2tvdw0s3jn54khce6mua7lcw20ayyn';
// no recovery
const cashaddr3 = 'bitcoincash:999999x8gf2tvdw0s3jn54khce6mua7lcw20ayyn';

// returns empty array
console.log(cashaddr.locateErrors(cashaddr1, prefix));

// [ 18 ]
console.log(cashaddr.locateErrors(cashaddr2, prefix));

// Throws "Invalid Address, Could not locate errors."
console.log(cashaddr.locateErrors(cashaddr3, prefix));
```
