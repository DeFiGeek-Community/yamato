// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IGaugeController.sol";
import "./interfaces/ICRV.sol";
import "./interfaces/IMinter.sol";
import "./interfaces/IVotingEscrow.sol";

interface IERC20Extended {
    function symbol() external view returns (string memory);
}

contract LiquidityGaugeV6 is ReentrancyGuard {
    event Deposit(address indexed provider, uint256 value);
    event Withdraw(address indexed provider, uint256 value);
    event UpdateLiquidityLimit(
        address user,
        uint256 originalBalance,
        uint256 originalSupply,
        uint256 workingBalance,
        uint256 workingSupply
    );
    event CommitOwnership(address indexed admin);
    event ApplyOwnership(address indexed admin);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    struct Reward {
        address token;
        address distributor;
        uint256 periodFinish;
        uint256 rate;
        uint256 lastUpdate;
        uint256 integral;
    }

    // to avoid "stack too deep"
    struct CheckPointParameters {
        int128 period;
        uint256 periodTime;
        uint256 integrateInvSupply;
        uint256 inflationParams;
        uint256 rate;
        uint256 newRate;
        uint256 prevFutureEpoch;
        uint256 workingBalance;
        uint256 workingSupply;
    }

    // to avoid "stack too deep"
    struct RewardParameters {
        uint256 userBalance;
        address receiver;
        uint256 rewardCount;
        address token;
        uint256 integral;
        uint256 lastUpdate;
        uint256 duration;
        uint256 integralFor;
        uint256 newClaimable;
        uint256 claimData;
        uint256 totalClaimable;
        uint256 totalClaimed;
    }

    // Constants
    uint256 public constant MAX_REWARDS = 8;
    uint256 public constant TOKENLESS_PRODUCTION = 40;
    uint256 public constant WEEK = 604800;
    string public constant VERSION = "v6.0.0"; // <- updated from v5.0.0 (adds `create_from_blueprint` pattern)

    bytes32 public constant EIP712_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 public constant EIP2612_TYPEHASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
    bytes32 public constant VERSION_HASH = keccak256(abi.encodePacked(VERSION));

    // Immutable Variables
    bytes32 public immutable NAME_HASH;
    uint256 public immutable CACHED_CHAIN_ID;
    bytes32 public immutable salt;
    bytes32 public immutable CACHED_DOMAIN_SEPARATOR;

    // ERC20
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;
    mapping(address => mapping(address => uint256)) public allowance;

    string public name;
    string public symbol;

    // ERC2612
    mapping(address => uint256) public nonces;

    // Gauge
    address public admin;
    address public lpToken;

    address public token;
    address public votingEscrow;
    address public minter;
    address public gaugeController;

    bool public isKilled;

    // [future_epoch_time uint40][inflation_rate uint216]
    uint256 public futureEpochTime;
    uint256 public inflationRate;

    // For tracking external rewards
    uint256 public rewardCount;
    mapping(address => Reward) public rewardData; // Assuming you've already defined a 'Reward' struct

    // claimant -> default reward receiver
    mapping(address => address) public rewardsReceiver;

    // reward token -> claiming address -> integral
    mapping(address => mapping(address => uint256)) public rewardIntegralFor;

    // user -> [uint128 claimable amount][uint128 claimed amount]
    mapping(address => mapping(address => uint256)) public claimData;

    mapping(address => uint256) public workingBalances;
    uint256 public workingSupply;

    // 1e18 * ∫(rate(t) / totalSupply(t) dt) from (last_action) till checkpoint
    mapping(address => uint256) public integrateInvSupplyOf;
    mapping(address => uint256) public integrateCheckpointOf;

    // ∫(balance * rate(t) / totalSupply(t) dt) from 0 till checkpoint
    mapping(address => uint256) public integrateFraction;

    // The goal is to be able to calculate ∫(rate * balance / totalSupply dt) from 0 till checkpoint
    int128 public period;

    // array of reward tokens
    address[MAX_REWARDS] public rewardTokens; // Assuming MAX_REWARDS is a constant already defined

    // Using dynamic array instead of fixed 100000000000000000000000000000 array to avoid warning about collisions
    uint256[100000000000000000000000000000] public periodTimestamp;
    uint256[100000000000000000000000000000] public integrateInvSupply;

    constructor(address lpToken_, address minter_) {
        require(lpToken == address(0));

        lpToken = lpToken_;
        minter = minter_;
        token = IMinter(minter).token();
        gaugeController = IMinter(minter).controller();
        votingEscrow = IGaugeController(gaugeController).votingEscrow();

        string memory _symbol = IERC20Extended(lpToken_).symbol();
        name = string(abi.encodePacked("Curve.fi ", _symbol, " Gauge Deposit"));
        symbol = string(abi.encodePacked(_symbol, "-gauge"));

        periodTimestamp[0] = block.timestamp;
        admin = msg.sender;

        // Assuming you have the CRV20 interface defined somewhere for the following line
        inflationRate = ICRV(token).rate();
        futureEpochTime = ICRV(token).futureEpochTimeWrite();

        NAME_HASH = keccak256(abi.encodePacked(name));
        salt = blockhash(block.number - 1);
        CACHED_CHAIN_ID = block.chainid;
        CACHED_DOMAIN_SEPARATOR = keccak256(
            abi.encodePacked(
                EIP712_TYPEHASH,
                NAME_HASH,
                VERSION_HASH,
                CACHED_CHAIN_ID,
                address(this),
                salt
            )
        );
    }

    function _domainSeparator() internal view returns (bytes32) {
        if (block.chainid != CACHED_CHAIN_ID) {
            return
                keccak256(
                    abi.encode(
                        EIP712_TYPEHASH,
                        NAME_HASH,
                        VERSION_HASH,
                        block.chainid,
                        address(this),
                        salt
                    )
                );
        }
        return CACHED_DOMAIN_SEPARATOR;
    }

    function _checkpoint(address addr) internal {
        CheckPointParameters memory _st;

        _st.period = period;
        _st.periodTime = periodTimestamp[uint256(uint128(_st.period))];
        _st.integrateInvSupply = integrateInvSupply[
            uint256(uint128(_st.period))
        ];

        _st.rate = inflationRate;
        _st.prevFutureEpoch = futureEpochTime;
        _st.newRate = _st.rate;

        if (_st.prevFutureEpoch >= _st.periodTime) {
            futureEpochTime = ICRV(token).futureEpochTimeWrite();
            _st.newRate = ICRV(token).rate();
            inflationRate = _st.newRate;
        }

        if (isKilled) {
            _st.rate = 0;
            _st.newRate = 0;
        }

        if (block.timestamp > _st.periodTime) {
            uint256 _workingSupply = workingSupply;
            IGaugeController(gaugeController).checkpointGauge(address(this));
            uint256 _prevWeekTime = _st.periodTime;
            uint256 _weekTime = min(
                ((_st.periodTime + WEEK) / WEEK) * WEEK,
                block.timestamp
            );

            for (uint256 i = 0; i < 500; ) {
                uint256 dt = _weekTime - _prevWeekTime;
                uint256 w = IGaugeController(gaugeController)
                    .gaugeRelativeWeight(
                        address(this),
                        (_prevWeekTime / WEEK) * WEEK
                    );

                if (_workingSupply > 0) {
                    if (
                        _st.prevFutureEpoch >= _prevWeekTime &&
                        _st.prevFutureEpoch < _weekTime
                    ) {
                        _st.integrateInvSupply +=
                            (_st.rate *
                                w *
                                (_st.prevFutureEpoch - _prevWeekTime)) /
                            _workingSupply;
                        _st.rate = _st.newRate;
                        _st.integrateInvSupply +=
                            (_st.rate * w * (_weekTime - _st.prevFutureEpoch)) /
                            _workingSupply;
                    } else {
                        _st.integrateInvSupply +=
                            (_st.rate * w * dt) /
                            _workingSupply;
                    }
                }

                if (_weekTime == block.timestamp) {
                    break;
                }
                _prevWeekTime = _weekTime;
                _weekTime = min(_weekTime + WEEK, block.timestamp);
                unchecked {
                    ++i;
                }
            }
        }

        _st.period += 1;
        period = _st.period;
        periodTimestamp[uint256(uint128(_st.period))] = block.timestamp;
        integrateInvSupply[uint256(uint128(_st.period))] = _st
            .integrateInvSupply;

        uint256 _workingBalance = workingBalances[addr];
        integrateFraction[addr] +=
            (_workingBalance *
                (_st.integrateInvSupply - integrateInvSupplyOf[addr])) /
            10 ** 18;
        integrateInvSupplyOf[addr] = _st.integrateInvSupply;
        integrateCheckpointOf[addr] = block.timestamp;
    }

    function _checkpointRewards(
        address user_,
        uint256 totalSupply_,
        bool claim_,
        address receiver_
    ) internal {
        RewardParameters memory _rp;
        _rp.userBalance = 0;
        _rp.receiver = receiver_;
        if (user_ != address(0)) {
            _rp.userBalance = balanceOf[user_];
            if (claim_ && receiver_ == address(0)) {
                _rp.receiver = rewardsReceiver[user_];
                if (_rp.receiver == address(0)) {
                    _rp.receiver = user_;
                }
            }
        }

        _rp.rewardCount = rewardCount;
        for (uint256 i = 0; i < MAX_REWARDS; i++) {
            if (i == _rp.rewardCount) {
                break;
            }
            _rp.token = rewardTokens[i];

            _rp.integral = rewardData[_rp.token].integral;
            _rp.lastUpdate = min(
                block.timestamp,
                rewardData[_rp.token].periodFinish
            );
            _rp.duration = _rp.lastUpdate - rewardData[_rp.token].lastUpdate;
            if (_rp.duration != 0) {
                rewardData[_rp.token].lastUpdate = _rp.lastUpdate;
                if (totalSupply_ != 0) {
                    _rp.integral +=
                        (_rp.duration * rewardData[_rp.token].rate * 10 ** 18) /
                        totalSupply_;
                    rewardData[_rp.token].integral = _rp.integral;
                }
            }

            if (user_ != address(0)) {
                _rp.integralFor = rewardIntegralFor[_rp.token][user_];
                _rp.newClaimable = 0;

                if (_rp.integralFor < _rp.integral) {
                    rewardIntegralFor[_rp.token][user_] = _rp.integral;
                    _rp.newClaimable =
                        (_rp.userBalance * (_rp.integral - _rp.integralFor)) /
                        10 ** 18;
                }

                _rp.claimData = claimData[user_][_rp.token];
                _rp.totalClaimable = (_rp.claimData >> 128) + _rp.newClaimable;
                if (_rp.totalClaimable > 0) {
                    _rp.totalClaimed = _rp.claimData & ((1 << 128) - 1);
                    if (claim_) {
                        bytes memory data = abi.encodeWithSignature(
                            "transfer(address,uint256)",
                            _rp.receiver,
                            _rp.totalClaimable
                        );
                        (bool success, bytes memory response) = _rp.token.call(
                            data
                        );
                        require(
                            success &&
                                (response.length == 0 ||
                                    abi.decode(response, (bool))),
                            "Transfer failed"
                        );
                        claimData[user_][_rp.token] =
                            _rp.totalClaimed +
                            _rp.totalClaimable;
                    } else if (_rp.newClaimable > 0) {
                        claimData[user_][_rp.token] =
                            _rp.totalClaimed +
                            (_rp.totalClaimable << 128);
                    }
                }
            }
        }
    }

    function _updateLiquidityLimit(
        address addr_,
        uint256 l_,
        uint256 L_
    ) internal {
        uint256 _votingBalance = IVotingEscrow(votingEscrow).balanceOf(addr_);
        uint256 _votingTotal = IERC20(votingEscrow).totalSupply();

        uint256 _lim = (l_ * TOKENLESS_PRODUCTION) / 100;
        if (_votingTotal > 0) {
            _lim +=
                (((L_ * _votingBalance) / _votingTotal) *
                    (100 - TOKENLESS_PRODUCTION)) /
                100;
        }

        _lim = min(l_, _lim);
        uint256 _oldBal = workingBalances[addr_];
        workingBalances[addr_] = _lim;
        uint256 _workingSupply = workingSupply + _lim - _oldBal;
        workingSupply = _workingSupply;

        emit UpdateLiquidityLimit(addr_, l_, L_, _lim, _workingSupply);
    }

    function _transfer(address from_, address to_, uint256 value_) internal {
        _checkpoint(from_);
        _checkpoint(to_);

        if (value_ != 0) {
            uint256 _totalSupply = totalSupply;
            bool _isRewards = rewardCount != 0;
            if (_isRewards) {
                _checkpointRewards(from_, _totalSupply, false, address(0));
            }
            uint256 _newBalance = balanceOf[from_] - value_;
            balanceOf[from_] = _newBalance;
            _updateLiquidityLimit(from_, _newBalance, _totalSupply);

            if (_isRewards) {
                _checkpointRewards(to_, _totalSupply, false, address(0));
            }
            _newBalance = balanceOf[to_] + value_;
            balanceOf[to_] = _newBalance;
            _updateLiquidityLimit(to_, _newBalance, _totalSupply);
        }

        emit Transfer(from_, to_, value_);
    }

    // TODO initial value
    // addr_ = msg.sender
    // claimRewards_ = false
    function deposit(
        uint256 value_,
        address addr_,
        bool claimRewards_
    ) external nonReentrant {
        _checkpoint(addr_);

        if (value_ != 0) {
            bool _isRewards = rewardCount != 0;
            uint256 _totalSupply = totalSupply;
            if (_isRewards) {
                _checkpointRewards(
                    addr_,
                    _totalSupply,
                    claimRewards_,
                    address(0)
                );
            }

            _totalSupply += value_;
            uint256 _newBalance = balanceOf[addr_] + value_;
            balanceOf[addr_] = _newBalance;
            totalSupply = _totalSupply;

            _updateLiquidityLimit(addr_, _newBalance, _totalSupply);

            IERC20(lpToken).transferFrom(msg.sender, address(this), value_);
        }

        emit Deposit(addr_, value_);
        emit Transfer(address(0), addr_, value_);
    }

    // TODO initial value
    // claimRewards_ = false
    function withdraw(
        uint256 value_,
        bool claimRewards_
    ) external nonReentrant {
        _checkpoint(msg.sender);

        if (value_ != 0) {
            bool _isRewards = rewardCount != 0;
            uint256 _totalSupply = totalSupply;
            if (_isRewards) {
                _checkpointRewards(
                    msg.sender,
                    _totalSupply,
                    claimRewards_,
                    address(0)
                );
            }

            _totalSupply -= value_;
            uint256 _newBalance = balanceOf[msg.sender] - value_;
            balanceOf[msg.sender] = _newBalance;
            totalSupply = _totalSupply;

            _updateLiquidityLimit(msg.sender, _newBalance, _totalSupply);

            IERC20(lpToken).transfer(msg.sender, value_);
        }

        emit Withdraw(msg.sender, value_);
        emit Transfer(msg.sender, address(0), value_);
    }

    // TODO
    // addr_ = msg.sender, address receiver_ = address(0)
    function claimRewards(
        address addr_,
        address receiver_
    ) external nonReentrant {
        if (receiver_ != address(0)) {
            require(addr_ == msg.sender);
        }
        _checkpointRewards(addr_, totalSupply, true, receiver_);
    }

    function transferFrom(
        address from_,
        address to_,
        uint256 value_
    ) external nonReentrant returns (bool) {
        uint256 _allowance = allowance[from_][msg.sender];
        if (_allowance != type(uint256).max) {
            allowance[from_][msg.sender] = _allowance - value_;
        }
        _transfer(from_, to_, value_);
        return true;
    }

    function transfer(
        address to_,
        uint256 value_
    ) external nonReentrant returns (bool) {
        _transfer(msg.sender, to_, value_);
        return true;
    }

    function approve(address spender_, uint256 value_) external returns (bool) {
        allowance[msg.sender][spender_] = value_;
        emit Approval(msg.sender, spender_, value_);
        return true;
    }

    function permit(
        address owner_,
        address spender_,
        uint256 value_,
        uint256 deadline_,
        uint8 v_,
        bytes32 r_,
        bytes32 s_
    ) external returns (bool) {
        require(owner_ != address(0));
        require(block.timestamp <= deadline_, "Expired");

        uint256 _nonce = nonces[owner_];
        bytes32 _digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _domainSeparator(),
                keccak256(
                    abi.encode(
                        EIP2612_TYPEHASH,
                        owner_,
                        spender_,
                        value_,
                        _nonce,
                        deadline_
                    )
                )
            )
        );
        require(ecrecover(_digest, v_, r_, s_) == owner_, "Invalid sig");

        allowance[owner_][spender_] = value_;
        nonces[owner_] = _nonce + 1;

        emit Approval(owner_, spender_, value_);
        return true;
    }

    function increaseAllowance(
        address spender_,
        uint256 addedValue_
    ) external returns (bool) {
        uint256 _currentAllowance = allowance[msg.sender][spender_];
        uint256 _newAllowance = _currentAllowance + addedValue_;
        allowance[msg.sender][spender_] = _newAllowance;
        emit Approval(msg.sender, spender_, _newAllowance);
        return true;
    }

    function decreaseAllowance(
        address spender_,
        uint256 subtractedValue_
    ) external returns (bool) {
        uint256 _currentAllowance = allowance[msg.sender][spender_];
        uint256 _newAllowance = _currentAllowance - subtractedValue_;
        allowance[msg.sender][spender_] = _newAllowance;
        emit Approval(msg.sender, spender_, _newAllowance);
        return true;
    }

    function userCheckpoint(address addr_) external returns (bool) {
        require(
            msg.sender == addr_ || msg.sender == minter,
            "dev: unauthorized"
        );
        _checkpoint(addr_);
        _updateLiquidityLimit(addr_, balanceOf[addr_], totalSupply);
        return true;
    }

    function setRewardsReceiver(address receiver_) external {
        rewardsReceiver[msg.sender] = receiver_;
    }

    function kick(address addr_) external {
        uint256 _tLast = integrateCheckpointOf[addr_];
        uint256 _tVe = IVotingEscrow(votingEscrow).userPointHistoryTs(
            addr_,
            IVotingEscrow(votingEscrow).userPointEpoch(addr_)
        );
        uint256 _balance = balanceOf[addr_];

        require(
            ERC20(votingEscrow).balanceOf(addr_) == 0 || _tVe > _tLast,
            "Not allowed"
        );
        require(
            workingBalances[addr_] > (_balance * TOKENLESS_PRODUCTION) / 100,
            "Not needed"
        );

        _checkpoint(addr_);
        _updateLiquidityLimit(addr_, balanceOf[addr_], totalSupply);
    }

    function depositRewardToken(
        address rewardToken_,
        uint256 amount_
    ) external nonReentrant {
        require(
            msg.sender == rewardData[rewardToken_].distributor,
            "Invalid dist"
        );

        _checkpointRewards(address(0), totalSupply, false, address(0));

        bytes memory _data = abi.encodeWithSignature(
            "transferFrom(address,address,uint256)",
            msg.sender,
            address(this),
            amount_
        );
        (bool success, bytes memory response) = rewardToken_.call(_data);
        require(success);
        require(response.length == 0 || abi.decode(response, (bool)));

        uint256 _periodFinish = rewardData[rewardToken_].periodFinish;
        if (block.timestamp >= _periodFinish) {
            rewardData[rewardToken_].rate = amount_ / WEEK;
        } else {
            uint256 remaining = _periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardData[rewardToken_].rate;
            rewardData[rewardToken_].rate = (amount_ + leftover) / WEEK;
        }

        rewardData[rewardToken_].lastUpdate = block.timestamp;
        rewardData[rewardToken_].periodFinish = block.timestamp + WEEK;
    }

    function addReward(
        address rewardToken_,
        address distributor_
    ) external onlyAdmin {
        require(rewardCount < MAX_REWARDS, "Max");
        require(rewardData[rewardToken_].distributor == address(0), "Has dist");

        rewardData[rewardToken_].distributor = distributor_;
        rewardTokens[rewardCount] = rewardToken_;
        ++rewardCount;
    }

    function setRewardDistributor(
        address rewardToken_,
        address distributor_
    ) external {
        address currentDistributor = rewardData[rewardToken_].distributor;
        require(msg.sender == currentDistributor || msg.sender == admin);
        require(currentDistributor != address(0));
        require(distributor_ != address(0));

        rewardData[rewardToken_].distributor = distributor_;
    }

    function setKilled(bool isKilled_) external onlyAdmin {
        isKilled = isKilled_;
    }

    function claimedReward(
        address addr_,
        address token_
    ) external view returns (uint256) {
        return claimData[addr_][token_] % 2 ** 128;
    }

    function claimableReward(
        address user_,
        address rewardToken_
    ) external view returns (uint256) {
        uint256 integral = rewardData[rewardToken_].integral;
        uint256 totalSupply_ = totalSupply;
        if (totalSupply_ != 0) {
            uint256 lastUpdate = block.timestamp <
                rewardData[rewardToken_].periodFinish
                ? block.timestamp
                : rewardData[rewardToken_].periodFinish;
            uint256 duration = lastUpdate - rewardData[rewardToken_].lastUpdate;
            integral +=
                (duration * rewardData[rewardToken_].rate * 10 ** 18) /
                totalSupply_;
        }
        uint256 integralFor = rewardIntegralFor[rewardToken_][user_];
        uint256 newClaimable = (balanceOf[user_] * (integral - integralFor)) /
            10 ** 18;

        return (claimData[user_][rewardToken_] >> 128) + newClaimable;
    }

    function claimableTokens(address addr_) external returns (uint256) {
        _checkpoint(addr_);
        return
            integrateFraction[addr_] -
            IMinter(minter).minted(addr_, address(this));
    }

    function integrateCheckpoint() external view returns (uint256) {
        return periodTimestamp[uint256(uint128(period))];
    }

    function decimals() external pure returns (uint256) {
        return 18;
    }

    function version() external pure returns (string memory) {
        return VERSION;
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparator();
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin);
        _;
    }
}
