// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title WalkMe
/// @notice Move-to-earn demo: a verifier attests steps, the contract mints WALK.
contract WalkMe is ERC20, EIP712, Ownable {
    bytes32 private constant STEP_PROOF_TYPEHASH =
        keccak256("StepProof(address user,uint256 day,uint256 steps)");

    uint256 public constant MAX_SUPPLY = 21_000_000 ether;

    /// @notice Address allowed to sign step attestations.
    address public verifier;

    /// @notice WALK minted per 1,000 verified steps.
    uint256 public rewardPerKilo = 10 ether;

    /// @notice Steps counted per user per day (extra steps are recorded but not rewarded).
    uint256 public dailyStepCap = 20_000;

    mapping(address user => mapping(uint256 day => uint256 steps)) public stepsByDay;
    mapping(address user => uint256 steps) public totalSteps;
    uint256 public totalGlobalSteps;

    error InvalidSignature();
    error DayNotToday();
    error AlreadySubmitted();
    error ZeroSteps();
    error ZeroAddress();

    event StepsRecorded(address indexed user, uint256 indexed day, uint256 steps, uint256 reward);
    event VerifierUpdated(address indexed verifier);
    event RewardRateUpdated(uint256 rewardPerKilo);

    constructor(address initialVerifier) ERC20("WalkMe", "WALK") EIP712("WalkMe", "1") Ownable(msg.sender) {
        if (initialVerifier == address(0)) revert ZeroAddress();
        verifier = initialVerifier;
    }

    /// @notice Record today's steps and mint the reward. One call per user per day.
    /// @param steps Steps reported by the activity source.
    /// @param day UTC day number (block.timestamp / 1 days).
    /// @param signature EIP-712 StepProof signature from `verifier`.
    function submitSteps(uint256 steps, uint256 day, bytes calldata signature) external {
        if (steps == 0) revert ZeroSteps();
        if (day != block.timestamp / 1 days) revert DayNotToday();
        if (stepsByDay[msg.sender][day] != 0) revert AlreadySubmitted();

        bytes32 structHash = keccak256(abi.encode(STEP_PROOF_TYPEHASH, msg.sender, day, steps));
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(_hashTypedDataV4(structHash), signature);
        if (err != ECDSA.RecoverError.NoError || signer != verifier) revert InvalidSignature();

        stepsByDay[msg.sender][day] = steps;
        totalSteps[msg.sender] += steps;
        totalGlobalSteps += steps;

        uint256 counted = steps > dailyStepCap ? dailyStepCap : steps;
        uint256 reward = (counted * rewardPerKilo) / 1000;

        uint256 remaining = MAX_SUPPLY - totalSupply();
        if (reward > remaining) reward = remaining;
        if (reward > 0) _mint(msg.sender, reward);

        emit StepsRecorded(msg.sender, day, steps, reward);
    }

    /// @notice Current UTC day number, matching the value `submitSteps` expects.
    function today() external view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function setVerifier(address newVerifier) external onlyOwner {
        if (newVerifier == address(0)) revert ZeroAddress();
        verifier = newVerifier;
        emit VerifierUpdated(newVerifier);
    }

    function setRewardRate(uint256 newRewardPerKilo) external onlyOwner {
        rewardPerKilo = newRewardPerKilo;
        emit RewardRateUpdated(newRewardPerKilo);
    }
}
