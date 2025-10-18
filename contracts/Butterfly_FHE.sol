pragma solidity ^0.8.24;
import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract ButterflyEffectFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    error NotOwner();
    error NotProvider();
    error Paused();
    error InvalidState();
    error RateLimited();
    error BatchClosed();
    error BatchNotOpen();
    error InvalidBatch();
    error StaleWrite();
    error InvalidCiphertext();
    error InvalidRequest();

    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event Paused();
    event Unpaused();
    event CooldownUpdated(uint256 newCooldown);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event ChoiceSubmitted(address indexed player, uint256 indexed batchId, bytes32 indexed choiceId);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId, bytes32 stateHash);
    event DecryptionComplete(uint256 indexed requestId, uint256 indexed batchId, uint256 narrativeScore);
    event NarrativeUpdated(uint256 indexed batchId, uint256 narrativeScore);

    bool public paused;
    uint256 public cooldownSeconds;
    uint256 public currentBatchId;
    uint256 public modelVersion;

    mapping(address => bool) public isProvider;
    mapping(address => uint256) public lastActionAt;
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => DecryptionContext) public decryptionContexts;
    mapping(uint256 => mapping(address => uint256)) public playerChoiceCount;

    struct EncryptedChoice {
        euint32 encryptedWeight;
        euint32 encryptedImpact;
    }

    struct Batch {
        bool isOpen;
        uint256 totalChoices;
        euint32 narrativeAccumulator;
        mapping(bytes32 => EncryptedChoice) choices;
    }

    struct DecryptionContext {
        uint256 batchId;
        uint256 modelVersion;
        bytes32 stateHash;
        bool processed;
    }

    modifier onlyOwner() {
        if (owner() != msg.sender) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier rateLimited() {
        if (block.timestamp < lastActionAt[msg.sender] + cooldownSeconds) {
            revert RateLimited();
        }
        lastActionAt[msg.sender] = block.timestamp;
        _;
    }

    constructor() {
        cooldownSeconds = 30;
        modelVersion = 1;
        _openNewBatch(1);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    function setCooldown(uint256 newCooldown) external onlyOwner {
        cooldownSeconds = newCooldown;
        emit CooldownUpdated(newCooldown);
    }

    function addProvider(address provider) external onlyOwner {
        isProvider[provider] = true;
        emit ProviderAdded(provider);
    }

    function removeProvider(address provider) external onlyOwner {
        isProvider[provider] = false;
        emit ProviderRemoved(provider);
    }

    function openNewBatch() external onlyOwner {
        currentBatchId++;
        _openNewBatch(currentBatchId);
    }

    function closeBatch(uint256 batchId) external onlyOwner {
        Batch storage batch = batches[batchId];
        if (!batch.isOpen) revert BatchClosed();
        batch.isOpen = false;
        emit BatchClosed(batchId);
    }

    function submitChoice(
        uint256 batchId,
        bytes32 choiceId,
        euint32 encryptedWeight,
        euint32 encryptedImpact
    ) external onlyProvider whenNotPaused rateLimited {
        Batch storage batch = batches[batchId];
        if (!batch.isOpen) revert BatchClosed();

        _requireInitialized(encryptedWeight, "weight");
        _requireInitialized(encryptedImpact, "impact");

        batch.choices[choiceId] = EncryptedChoice(encryptedWeight, encryptedImpact);
        batch.totalChoices++;
        playerChoiceCount[batchId][msg.sender]++;

        emit ChoiceSubmitted(msg.sender, batchId, choiceId);
    }

    function aggregateChoices(uint256 batchId) external onlyProvider whenNotPaused rateLimited {
        Batch storage batch = batches[batchId];
        if (!batch.isOpen) revert BatchClosed();

        euint32 memory acc = _initIfNeeded(batch.narrativeAccumulator);
        uint256 count = 0;

        bytes32[] memory choiceIds = new bytes32[](batch.totalChoices);
        uint256 idx;
        for (uint256 i = 0; i < batch.totalChoices; i++) {
            // Simplified iteration; in practice, maintain an array of choiceIds
            // For demonstration, we assume sequential choiceIds
            bytes32 choiceId = bytes32(i);
            EncryptedChoice storage choice = batch.choices[choiceId];
            if (FHE.isInitialized(choice.encryptedWeight) && FHE.isInitialized(choice.encryptedImpact)) {
                acc = FHE.add(acc, FHE.mul(choice.encryptedWeight, choice.encryptedImpact));
                choiceIds[idx] = choiceId;
                idx++;
                count++;
            }
        }

        if (count > 0) {
            batch.narrativeAccumulator = acc;
            bytes32 stateHash = _hashCiphertexts(batchId, acc);
            uint256 requestId = FHE.requestDecryption(
                new bytes32[](0), // Placeholder - actual ciphertexts would be included
                this.onDecryptionComplete.selector
            );
            decryptionContexts[requestId] = DecryptionContext(batchId, modelVersion, stateHash, false);
            emit DecryptionRequested(requestId, batchId, stateHash);
        }
    }

    function onDecryptionComplete(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        DecryptionContext storage context = decryptionContexts[requestId];
        if (context.processed) revert InvalidRequest();
        if (context.modelVersion != modelVersion) revert StaleWrite();

        Batch storage batch = batches[context.batchId];
        bytes32 currHash = _hashCiphertexts(context.batchId, batch.narrativeAccumulator);
        if (currHash != context.stateHash) revert InvalidState();

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint256 narrativeScore = abi.decode(cleartexts, (uint256));
        context.processed = true;

        emit DecryptionComplete(requestId, context.batchId, narrativeScore);
        emit NarrativeUpdated(context.batchId, narrativeScore);
    }

    function _openNewBatch(uint256 batchId) private {
        Batch storage batch = batches[batchId];
        batch.isOpen = true;
        batch.narrativeAccumulator = FHE.asEuint32(0);
        emit BatchOpened(batchId);
    }

    function _hashCiphertexts(uint256 batchId, euint32 acc) private view returns (bytes32) {
        // In a real implementation, include all relevant ciphertexts
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(acc);
        return keccak256(abi.encode(cts, address(this), batchId));
    }

    function _initIfNeeded(euint32 x) private view returns (euint32 memory) {
        if (FHE.isInitialized(x)) {
            return x;
        }
        return FHE.asEuint32(0);
    }

    function _requireInitialized(euint32 x, string memory tag) private pure {
        if (!FHE.isInitialized(x)) {
            revert InvalidCiphertext();
        }
    }
}