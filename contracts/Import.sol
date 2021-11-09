pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

// Note: src/testUtil.ts is using ERC1967Proxy to make a fake proxy contract of smock.
//       You need to import ERC1967Proxy to this project to generate an artifact of it in this project.
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
