# Butterfly Effect: An FHE-Powered Narrative Game

**Butterfly Effect** is an innovative, narrative-driven game that intricately weaves together player choices using **Zama's Fully Homomorphic Encryption technology**. Players embark on an interactive cinematic journey where even the smallest decision can have significant, unforeseen consequences—akin to the fabled butterfly effect. With each choice encrypted and weighted, the game presents a truly immersive storytelling experience that emphasizes the power of individual agency.

## The Challenge of Choice

In many narrative games, player choices often feel superficial, leading to predictable outcomes and a lack of genuine engagement. Players desire a deeper level of interaction where their decisions impact the story meaningfully. Furthermore, concerns around data privacy and transparency in digital environments can undermine trust and enjoyment. Traditional methods of tracking player choices can compromise these values and limit the potential for a more engaging narrative experience.

## The FHE Solution: A New Paradigm

**Butterfly Effect** addresses these challenges head-on through the implementation of **Fully Homomorphic Encryption (FHE)**. By utilizing Zama's open-source libraries—such as **Concrete**, **TFHE-rs**, and the **zama-fhe SDK**—the game encrypts player decisions while still enabling the game engine to compute and alter the narrative in real-time based on these choices. This approach not only guarantees that players' choices remain private and secure but also facilitates the creation of a dynamic and unpredictable storyline that evolves seamlessly.

### Key Features

- **Encrypted Decision-Making**: Each player choice is encrypted, allowing for a unique narrative experience that is both confidential and mathematically computable.
- **Dynamic Storytelling**: The storyline adapts based on aggregated and encrypted choices, creating a profound narrative that surprises and engages players.
- **High Replay Value**: With a multitude of paths and outcomes, players are encouraged to replay the game to explore different decision avenues and their consequences.
- **Immersive Cinematic Experience**: Leveraging a combination of narrative-driven storytelling and cinematic visuals, players are drawn into a world of intrigue and suspense.

## Technology Stack

- **Zama FHE Libraries**: Leveraging **Concrete**, **TFHE-rs**, and the **zama-fhe SDK** for encryption and computation.
- **Node.js**: Facilitating server-side scripting and runtime.
- **Hardhat/Foundry**: For smart contract deployment and testing.
- **Web3.js**: To interact with the Ethereum blockchain.

## Directory Structure

Below is the directory structure of the **Butterfly Effect** project, showcasing its organization:

```
Butterfly_FHE/
├── contracts/
│   └── Butterfly_FHE.sol
├── src/
│   ├── index.js
│   └── gameLogic.js
├── tests/
│   └── butterflyEffect.test.js
├── package.json
└── README.md
```

## Installation Guide

To set up the **Butterfly Effect** game, follow these steps after downloading the project:

1. Ensure you have **Node.js** installed. If not, download it from the official site.
2. Install **Hardhat** or **Foundry**, depending on your preference for Solidity development.
3. Navigate to the project root directory in your terminal.
4. Run `npm install` to install the necessary dependencies, including Zama's FHE libraries.

*Note: Please do not use `git clone` or any URLs to download this project; ensure you have acquired the files directly.*

## How to Build & Run

After setting up your environment, you can compile, test, and run the project with the following commands:

1. **Compile the smart contracts**:
   ```bash
   npx hardhat compile
   ```

2. **Run the tests**:
   ```bash
   npx hardhat test
   ```

3. **Start the game** (assuming you have a server setup):
   ```bash
   node src/index.js
   ```

## Code Example

Here's a code snippet demonstrating how player choices are encrypted and processed in the game:

```javascript
const { encryptChoice, computeNarrative } = require('zama-fhe-sdk');

function playerMakesChoice(choice) {
    const encryptedChoice = encryptChoice(choice);
    const narrativeOutcome = computeNarrative(encryptedChoice);
    return narrativeOutcome;
}

// Example usage
const playerChoice = "Save the village";
const outcome = playerMakesChoice(playerChoice);
console.log(`Narrative Outcome: ${outcome}`);
```

In this example, we illustrate how a player’s decision is encrypted using the Zama SDK before determining its impact on the game narrative.

## Acknowledgements

### Powered by Zama

We extend our heartfelt gratitude to the Zama team for their pioneering work in Fully Homomorphic Encryption and their outstanding open-source tools. These resources empower developers to create confidential and secure blockchain applications, which are beautifully realized in projects like **Butterfly Effect**. Thank you for making such groundbreaking technology accessible! 

Dive into the world of **Butterfly Effect**, where your choices lead to unexpected journeys woven into an encrypted fabric of narrative possibilities! 🦋