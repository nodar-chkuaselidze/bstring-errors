/*!
 * helpers.js - helpers
 *
 * Copyright (c) 2018, Chkuaselidze Nodari (MIT License)
 */
'use strict';

exports.errorLine = (address, positions) => {
  const ERROR_SYMBOL = 0x5e; // ^
  const errors = Buffer.alloc(address.length, 0x20);

  for (const pos of positions)
    errors[pos] = ERROR_SYMBOL;

  return errors.toString();
};
