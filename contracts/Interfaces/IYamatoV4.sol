pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2024 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./IYamato.sol";

interface IYamatoV4 {
    function setPledges(IYamato.Pledge[] memory _pledges) external;

    function collFloor() external view returns (uint256);

    function maxRedeemableCount() external view returns (uint256);

    function CHECKPOINT_BUFFER() external view returns (uint256);

    function scoreRegistry() external view returns (address);

    function getTotalDebt() external view returns (uint256);
}
