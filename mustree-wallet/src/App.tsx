import { useEffect, useMemo, useState } from "react";
import { JsonRpcProvider, Wallet } from "ethers";
import { WalletSetup } from "./components/WalletSetup";
import { NetworkManager } from "./components/NetworkManager";
import { WalletDashboard } from "./components/WalletDashboard";

export interface NetworkConfig {
  id: string;
  name: string;
  rpcUrl: string;
  chainId: number;
  symbol: string;
}

export interface StoredWallet {
  address: string;
  encryptedJson: string;
}

const LS_WALLET_KEY = "MUSTREE_WALLET";
const LS_NETWORKS_KEY = "MUSTREE_NETWORKS";
const LS_ACTIVE_NETWORK_KEY = "MUSTREE_ACTIVE_NETWORK";

function loadStoredWallet(): StoredWallet | null {
  try {
    const raw = localStorage.getItem(LS_WALLET_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredWallet;
  } catch {
    return null;
  }
}

function saveStoredWallet(wallet: StoredWallet | null) {
  if (!wallet) {
    localStorage.removeItem(LS_WALLET_KEY);
  } else {
    localStorage.setItem(LS_WALLET_KEY, JSON.stringify(wallet));
  }
}

function loadNetworks(): NetworkConfig[] {
  try {
    const raw = localStorage.getItem(LS_NETWORKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as NetworkConfig[];
  } catch {
    return [];
  }
}

function saveNetworks(networks: NetworkConfig[]) {
  localStorage.setItem(LS_NETWORKS_KEY, JSON.stringify(networks));
}

function loadActiveNetworkId(): string | null {
  return localStorage.getItem(LS_ACTIVE_NETWORK_KEY);
}

function saveActiveNetworkId(id: string | null) {
  if (!id) {
    localStorage.removeItem(LS_ACTIVE_NETWORK_KEY);
  } else {
    localStorage.setItem(LS_ACTIVE_NETWORK_KEY, id);
  }
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

function App() {
  const [storedWallet, setStoredWallet] = useState<StoredWallet | null>(() =>
    loadStoredWallet()
  );
  const [wallet, setWallet] = useState<Wallet | null>(null);

  const [networks, setNetworks] = useState<NetworkConfig[]>(() => loadNetworks());
  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(() => {
    const saved = loadActiveNetworkId();
    return saved || null;
  });

  useEffect(() => {
    if (networks.length > 0 && !activeNetworkId) {
      setActiveNetworkId(networks[0].id);
    }
  }, [networks, activeNetworkId]);

  const activeNetwork = useMemo(
    () => networks.find((n) => n.id === activeNetworkId) || null,
    [networks, activeNetworkId]
  );

  const provider = useMemo(() => {
    if (!activeNetwork) return null;
    return new JsonRpcProvider(activeNetwork.rpcUrl, {
      chainId: activeNetwork.chainId,
      name: activeNetwork.name,
    });
  }, [activeNetwork]);

  const [signer, setSigner] = useState<Wallet | null>(null);

  useEffect(() => {
    if (wallet && provider) {
      setSigner(wallet.connect(provider));
    } else {
      setSigner(null);
    }
  }, [wallet, provider]);

  const handleWalletCreated = (w: StoredWallet, walletObj: Wallet) => {
    setStoredWallet(w);
    saveStoredWallet(w);
    setWallet(walletObj);
  };

  const handleWalletUnlocked = (walletObj: Wallet) => {
    setWallet(walletObj);
  };

  const handleAddNetwork = (input: {
    name: string;
    rpcUrl: string;
    chainId: number;
    symbol: string;
  }) => {
    const newNetwork: NetworkConfig = {
      id: createId(),
      ...input,
    };
    const next = [...networks, newNetwork];
    setNetworks(next);
    saveNetworks(next);
    if (!activeNetworkId) {
      setActiveNetworkId(newNetwork.id);
      saveActiveNetworkId(newNetwork.id);
    }
  };

  const handleSelectNetwork = (id: string) => {
    setActiveNetworkId(id);
    saveActiveNetworkId(id);
  };

  const handleResetWallet = () => {
    if (!window.confirm("저장된 지갑을 삭제할까요? (복구 불가)")) return;
    setStoredWallet(null);
    saveStoredWallet(null);
    setWallet(null);
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <div>
          <h1>Mustree Wallet</h1>
          <p className="subtitle">
            머스트리 전용 네트워크용 디지털 지갑 (PoC)
          </p>
        </div>
        <div className="warning">
          ⚠️ 테스트/개발용입니다. 실제 자산 보관 금지!
        </div>
      </header>

      <main className="app-main">
        <section className="card">
          <h2>1. 지갑 설정</h2>
          <WalletSetup
            storedWallet={storedWallet}
            onWalletCreated={handleWalletCreated}
            onWalletUnlocked={handleWalletUnlocked}
            onResetWallet={handleResetWallet}
          />
        </section>

        <section className="card">
          <h2>2. 네트워크 설정</h2>
          <NetworkManager
            networks={networks}
            activeNetworkId={activeNetworkId}
            onAddNetwork={handleAddNetwork}
            onSelectNetwork={handleSelectNetwork}
          />
        </section>

        <section className="card">
          <h2>3. 지갑 대시보드</h2>
          <WalletDashboard
            signer={signer}
            activeNetwork={activeNetwork}
          />
        </section>
      </main>

      <footer className="app-footer">
        Made by <strong>머스트리(Mustree)</strong> · custom PoA / geth network wallet
      </footer>
    </div>
  );
}

export default App;
