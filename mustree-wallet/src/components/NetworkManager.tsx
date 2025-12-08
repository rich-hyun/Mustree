import { useState } from "react";
import type { NetworkConfig } from "../App";

interface NetworkManagerProps {
  networks: NetworkConfig[];
  activeNetworkId: string | null;
  onAddNetwork: (input: {
    name: string;
    rpcUrl: string;
    chainId: number;
    symbol: string;
  }) => void;
  onSelectNetwork: (id: string) => void;
}

export function NetworkManager(props: NetworkManagerProps) {
  const { networks, activeNetworkId, onAddNetwork, onSelectNetwork } = props;

  const [name, setName] = useState("Mustree Local");
  const [rpcUrl, setRpcUrl] = useState("http://localhost:8545");
  const [chainId, setChainId] = useState("1337");
  const [symbol, setSymbol] = useState("MST");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!name.trim() || !rpcUrl.trim() || !chainId.trim()) {
      setError("네트워크 이름, RPC URL, Chain ID는 필수입니다.");
      return;
    }
    const parsedChainId = Number(chainId);
    if (!Number.isInteger(parsedChainId) || parsedChainId <= 0) {
      setError("Chain ID는 양의 정수여야 합니다.");
      return;
    }

    onAddNetwork({
      name: name.trim(),
      rpcUrl: rpcUrl.trim(),
      chainId: parsedChainId,
      symbol: symbol.trim() || "MST",
    });

    setError(null);
  };

  return (
    <div className="network-manager">
      <div className="network-list">
        <label>
          현재 네트워크 선택
          <select
            value={activeNetworkId || ""}
            onChange={(e) => onSelectNetwork(e.target.value)}
          >
            <option value="" disabled>
              네트워크를 선택하세요
            </option>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} (chainId: {n.chainId}, {n.symbol})
              </option>
            ))}
          </select>
        </label>
        {networks.length === 0 && (
          <p className="hint">
            아직 등록된 네트워크가 없습니다. 아래에서 네트워크를 추가하세요.
          </p>
        )}
      </div>

      <div className="network-form">
        <h3>새 네트워크 추가</h3>
        <div className="grid">
          <label>
            네트워크 이름
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: Mustree PoA"
            />
          </label>
          <label>
            RPC URL
            <input
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              placeholder="http://localhost:8545"
            />
          </label>
        </div>
        <div className="grid">
          <label>
            Chain ID
            <input
              value={chainId}
              onChange={(e) => setChainId(e.target.value)}
              placeholder="예: 1337"
            />
          </label>
          <label>
            기본 단위 심볼
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="예: MST, ETH 등"
            />
          </label>
        </div>
        <button onClick={handleAdd}>➕ 네트워크 추가</button>
        {error && <div className="error-text">{error}</div>}
      </div>
    </div>
  );
}
