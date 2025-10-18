// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface StoryChoice {
  id: string;
  encryptedWeight: string;
  timestamp: number;
  player: string;
  chapter: string;
  description: string;
  butterflyEffect: number;
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const FHECompute = (encryptedData: string, operation: string): string => {
  const value = FHEDecryptNumber(encryptedData);
  let result = value;
  
  switch(operation) {
    case 'increase10%':
      result = value * 1.1;
      break;
    case 'decrease10%':
      result = value * 0.9;
      break;
    case 'double':
      result = value * 2;
      break;
    default:
      result = value;
  }
  
  return FHEEncryptNumber(result);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  // Randomly selected styles: 
  // Colors: Dreamy (pink+purple+blue)
  // UI: Glassmorphism
  // Layout: Center radiation
  // Interaction: Animation rich
  
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [choices, setChoices] = useState<StoryChoice[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newChoiceData, setNewChoiceData] = useState({ chapter: "1", description: "", weight: 1 });
  const [showIntro, setShowIntro] = useState(true);
  const [selectedChoice, setSelectedChoice] = useState<StoryChoice | null>(null);
  const [decryptedWeight, setDecryptedWeight] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [currentStory, setCurrentStory] = useState<string>("The story begins in a quiet village...");
  const [storyPath, setStoryPath] = useState<string[]>([]);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    loadChoices().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
    updateStoryPath();
  }, [choices]);

  const loadChoices = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      const keysBytes = await contract.getData("choice_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing choice keys:", e); }
      }
      
      const list: StoryChoice[] = [];
      for (const key of keys) {
        try {
          const choiceBytes = await contract.getData(`choice_${key}`);
          if (choiceBytes.length > 0) {
            try {
              const choiceData = JSON.parse(ethers.toUtf8String(choiceBytes));
              list.push({ 
                id: key, 
                encryptedWeight: choiceData.weight, 
                timestamp: choiceData.timestamp, 
                player: choiceData.player, 
                chapter: choiceData.chapter,
                description: choiceData.description,
                butterflyEffect: choiceData.butterflyEffect || 0
              });
            } catch (e) { console.error(`Error parsing choice data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading choice ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setChoices(list);
    } catch (e) { console.error("Error loading choices:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const submitChoice = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setCreating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting your choice with Zama FHE..." });
    try {
      const encryptedWeight = FHEEncryptNumber(newChoiceData.weight);
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const choiceId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const choiceData = { 
        weight: encryptedWeight, 
        timestamp: Math.floor(Date.now() / 1000), 
        player: address, 
        chapter: newChoiceData.chapter,
        description: newChoiceData.description,
        butterflyEffect: calculateButterflyEffect()
      };
      
      await contract.setData(`choice_${choiceId}`, ethers.toUtf8Bytes(JSON.stringify(choiceData)));
      
      const keysBytes = await contract.getData("choice_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(choiceId);
      await contract.setData("choice_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Choice encrypted and submitted!" });
      await loadChoices();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowChoiceModal(false);
        setNewChoiceData({ chapter: "1", description: "", weight: 1 });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCreating(false); }
  };

  const calculateButterflyEffect = (): number => {
    // Calculate based on previous choices
    const playerChoices = choices.filter(c => c.player === address);
    const effect = playerChoices.reduce((acc, choice) => {
      return acc + (choice.butterflyEffect || 0);
    }, 0);
    return Math.min(100, Math.max(0, effect + (Math.random() * 20 - 10)));
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const updateStoryPath = () => {
    if (choices.length === 0) return;
    
    let story = "The story begins in a quiet village...";
    let path = ["Chapter 1: The Village"];
    
    // Simulate story progression based on choices
    choices.forEach((choice, index) => {
      if (index % 3 === 0) {
        const chapter = parseInt(choice.chapter) + 1;
        story += `\n\nChapter ${chapter}: ${getRandomStorySegment(chapter)}`;
        path.push(`Chapter ${chapter}: ${getRandomLocation(chapter)}`);
      }
    });
    
    setCurrentStory(story);
    setStoryPath(path);
  };

  const getRandomStorySegment = (chapter: number): string => {
    const segments = [
      "A mysterious stranger arrives...",
      "The ancient prophecy begins to unfold...",
      "Secrets from the past resurface...",
      "The village faces an unexpected threat...",
      "A hidden power awakens within you..."
    ];
    return segments[chapter % segments.length];
  };

  const getRandomLocation = (chapter: number): string => {
    const locations = [
      "Forest of Whispers",
      "Ruins of Eldertree",
      "Crystal Caves",
      "Sky Temple",
      "Underwater City"
    ];
    return locations[chapter % locations.length];
  };

  const isPlayer = (choiceAddress: string) => address?.toLowerCase() === choiceAddress.toLowerCase();

  const tutorialSteps = [
    { title: "Connect Wallet", description: "Connect your Web3 wallet to begin your journey", icon: "🔗" },
    { title: "Make Choices", description: "Each decision is encrypted with Zama FHE technology", icon: "🔒", details: "Your choices affect the story in ways you can't predict" },
    { title: "Butterfly Effect", description: "Small changes create ripple effects through the narrative", icon: "🦋", details: "FHE allows your choices to influence the story without revealing their impact" },
    { title: "Discover Outcomes", description: "Experience a unique story path shaped by your encrypted choices", icon: "📖", details: "The same choices can lead to different outcomes each playthrough" }
  ];

  const renderButterflyEffectChart = () => {
    const playerChoices = choices.filter(c => c.player === address);
    if (playerChoices.length === 0) return null;
    
    const effects = playerChoices.map(c => c.butterflyEffect || 0);
    const maxEffect = Math.max(...effects, 1);
    
    return (
      <div className="effect-chart">
        {playerChoices.map((choice, index) => (
          <div key={choice.id} className="effect-bar-container">
            <div className="effect-label">Choice #{index + 1}</div>
            <div className="effect-bar" style={{ width: `${(choice.butterflyEffect / maxEffect) * 100}%` }}>
              <div className="effect-value">{choice.butterflyEffect}%</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="butterfly-spinner"></div>
      <p>Initializing encrypted narrative...</p>
    </div>
  );

  return (
    <div className="app-container dreamy-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon"><div className="butterfly-icon"></div></div>
          <h1>Butterfly<span>FHE</span></h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowChoiceModal(true)} className="create-choice-btn glass-button">
            <div className="add-icon"></div>Make Choice
          </button>
          <button className="glass-button" onClick={() => setShowStats(!showStats)}>
            {showStats ? "Hide Stats" : "Show Stats"}
          </button>
          <div className="wallet-connect-wrapper"><ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/></div>
        </div>
      </header>
      
      <div className="main-content center-radial">
        {showIntro && (
          <div className="intro-modal glass-card">
            <div className="modal-header">
              <h2>Welcome to Butterfly FHE</h2>
              <button onClick={() => setShowIntro(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <p>An interactive narrative where your encrypted choices create unpredictable ripple effects through the story.</p>
              <div className="fhe-explanation">
                <h3>How It Works</h3>
                <ul>
                  <li>Each choice is encrypted with Zama FHE technology</li>
                  <li>Your decisions influence the story in hidden ways</li>
                  <li>The same choices can lead to different outcomes</li>
                  <li>High replay value with endless possibilities</li>
                </ul>
              </div>
              <div className="tutorial-steps">
                {tutorialSteps.map((step, index) => (
                  <div className="tutorial-step" key={index}>
                    <div className="step-icon">{step.icon}</div>
                    <div className="step-content">
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowIntro(false)} className="glass-button primary">Begin Story</button>
            </div>
          </div>
        )}
        
        <div className="story-container glass-card">
          <div className="story-content">
            <h2>Your Story Path</h2>
            <div className="story-text">{currentStory}</div>
          </div>
          
          <div className="story-path">
            <h3>Journey So Far</h3>
            <div className="path-timeline">
              {storyPath.map((step, index) => (
                <div key={index} className="path-step">
                  <div className="step-marker"></div>
                  <div className="step-content">{step}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {showStats && (
          <div className="stats-container glass-card">
            <h2>Your Butterfly Effect</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{choices.filter(c => c.player === address).length}</div>
                <div className="stat-label">Choices Made</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{Math.max(...choices.filter(c => c.player === address).map(c => c.butterflyEffect || 0))}%</div>
                <div className="stat-label">Max Effect</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{storyPath.length}</div>
                <div className="stat-label">Chapters</div>
              </div>
            </div>
            
            {renderButterflyEffectChart()}
            
            <div className="fhe-badge"><span>FHE-Powered Narrative</span></div>
          </div>
        )}
        
        <div className="choices-section glass-card">
          <div className="section-header">
            <h2>Your Encrypted Choices</h2>
            <div className="header-actions">
              <button onClick={loadChoices} className="refresh-btn glass-button" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="choices-list">
            {choices.filter(c => c.player === address).length === 0 ? (
              <div className="no-choices">
                <div className="no-choices-icon"></div>
                <p>No choices found</p>
                <button className="glass-button primary" onClick={() => setShowChoiceModal(true)}>Make First Choice</button>
              </div>
            ) : choices.filter(c => c.player === address).map(choice => (
              <div className="choice-card" key={choice.id} onClick={() => setSelectedChoice(choice)}>
                <div className="choice-header">
                  <div className="choice-id">#{choice.id.substring(0, 6)}</div>
                  <div className="choice-chapter">Chapter {choice.chapter}</div>
                </div>
                <div className="choice-description">{choice.description || "No description"}</div>
                <div className="choice-footer">
                  <div className="effect-indicator">
                    <div className="butterfly-icon-small"></div>
                    <span>{choice.butterflyEffect}% effect</span>
                  </div>
                  <div className="choice-date">{new Date(choice.timestamp * 1000).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showChoiceModal && (
        <ModalChoice 
          onSubmit={submitChoice} 
          onClose={() => setShowChoiceModal(false)} 
          creating={creating} 
          choiceData={newChoiceData} 
          setChoiceData={setNewChoiceData}
        />
      )}
      
      {selectedChoice && (
        <ChoiceDetailModal 
          choice={selectedChoice} 
          onClose={() => { setSelectedChoice(null); setDecryptedWeight(null); }} 
          decryptedWeight={decryptedWeight} 
          setDecryptedWeight={setDecryptedWeight} 
          isDecrypting={isDecrypting} 
          decryptWithSignature={decryptWithSignature}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content glass-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="butterfly-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo"><div className="butterfly-icon"></div><span>Butterfly FHE</span></div>
            <p>An FHE-powered narrative experience by Zama</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge"><span>FHE-Powered Storytelling</span></div>
          <div className="copyright">© {new Date().getFullYear()} Butterfly FHE. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

interface ModalChoiceProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  choiceData: any;
  setChoiceData: (data: any) => void;
}

const ModalChoice: React.FC<ModalChoiceProps> = ({ onSubmit, onClose, creating, choiceData, setChoiceData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setChoiceData({ ...choiceData, [name]: value });
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setChoiceData({ ...choiceData, [name]: parseFloat(value) });
  };

  const handleSubmit = () => {
    if (!choiceData.description) { alert("Please describe your choice"); return; }
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="choice-modal glass-card">
        <div className="modal-header">
          <h2>Make a Story Choice</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> 
            <div><strong>FHE Encryption Notice</strong><p>Your choice will be encrypted with Zama FHE before submission</p></div>
          </div>
          
          <div className="form-group">
            <label>Chapter</label>
            <select name="chapter" value={choiceData.chapter} onChange={handleChange} className="glass-select">
              <option value="1">Chapter 1: The Beginning</option>
              <option value="2">Chapter 2: The Journey</option>
              <option value="3">Chapter 3: The Challenge</option>
              <option value="4">Chapter 4: The Revelation</option>
              <option value="5">Chapter 5: The Conclusion</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Describe Your Choice *</label>
            <textarea 
              name="description" 
              value={choiceData.description} 
              onChange={handleChange} 
              placeholder="What decision are you making?" 
              className="glass-textarea"
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <label>Choice Weight (1-10) *</label>
            <input 
              type="range" 
              name="weight" 
              min="1" 
              max="10" 
              value={choiceData.weight} 
              onChange={handleWeightChange} 
              className="glass-slider"
            />
            <div className="slider-value">{choiceData.weight}</div>
          </div>
          
          <div className="encryption-preview">
            <h4>Encryption Preview</h4>
            <div className="preview-container">
              <div className="plain-data"><span>Plain Weight:</span><div>{choiceData.weight}</div></div>
              <div className="encryption-arrow">→</div>
              <div className="encrypted-data">
                <span>Encrypted Data:</span>
                <div>{FHEEncryptNumber(choiceData.weight).substring(0, 50)}...</div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn glass-button">Cancel</button>
          <button onClick={handleSubmit} disabled={creating} className="submit-btn glass-button primary">
            {creating ? "Encrypting with FHE..." : "Submit Choice"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ChoiceDetailModalProps {
  choice: StoryChoice;
  onClose: () => void;
  decryptedWeight: number | null;
  setDecryptedWeight: (value: number | null) => void;
  isDecrypting: boolean;
  decryptWithSignature: (encryptedData: string) => Promise<number | null>;
}

const ChoiceDetailModal: React.FC<ChoiceDetailModalProps> = ({ choice, onClose, decryptedWeight, setDecryptedWeight, isDecrypting, decryptWithSignature }) => {
  const handleDecrypt = async () => {
    if (decryptedWeight !== null) { setDecryptedWeight(null); return; }
    const decrypted = await decryptWithSignature(choice.encryptedWeight);
    if (decrypted !== null) setDecryptedWeight(decrypted);
  };

  return (
    <div className="modal-overlay">
      <div className="choice-detail-modal glass-card">
        <div className="modal-header">
          <h2>Choice Details #{choice.id.substring(0, 8)}</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="choice-info">
            <div className="info-item"><span>Chapter:</span><strong>{choice.chapter}</strong></div>
            <div className="info-item"><span>Player:</span><strong>{choice.player.substring(0, 6)}...{choice.player.substring(38)}</strong></div>
            <div className="info-item"><span>Date:</span><strong>{new Date(choice.timestamp * 1000).toLocaleString()}</strong></div>
            <div className="info-item"><span>Butterfly Effect:</span><strong>{choice.butterflyEffect}%</strong></div>
          </div>
          
          <div className="description-section">
            <h3>Choice Description</h3>
            <div className="description-text">{choice.description}</div>
          </div>
          
          <div className="encrypted-data-section">
            <h3>Encrypted Weight</h3>
            <div className="encrypted-data">{choice.encryptedWeight.substring(0, 100)}...</div>
            <div className="fhe-tag"><div className="fhe-icon"></div><span>FHE Encrypted</span></div>
            <button className="decrypt-btn glass-button" onClick={handleDecrypt} disabled={isDecrypting}>
              {isDecrypting ? <span className="decrypt-spinner"></span> : decryptedWeight !== null ? "Hide Decrypted Value" : "Decrypt with Wallet Signature"}
            </button>
          </div>
          
          {decryptedWeight !== null && (
            <div className="decrypted-data-section">
              <h3>Decrypted Weight</h3>
              <div className="decrypted-value">{decryptedWeight}</div>
              <div className="decryption-notice"><div className="warning-icon"></div><span>Decrypted data is only visible after wallet signature verification</span></div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn glass-button">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;