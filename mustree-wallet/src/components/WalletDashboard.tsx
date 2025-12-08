import { useEffect, useState } from "react";
import { Wallet, formatEther, parseEther } from "ethers";
import type { NetworkConfig } from "../App";

interface WalletDashboardProps {
  signer: Wallet | null;
  activeNetwork: NetworkConfig | null;
}

export function WalletDashboard({ signer, activeNetwork }: WalletDashboardProps) {
  const [balance, setBalance] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const address = signer?.address;

  const loadBalance = async () => {
    if (!signer || !activeNetwork) return;
    setRefreshing(true);
    setError(null);
    try {
      // ethers v6 스타일: provider에서 balance 가져오기
      const provider = (signer as any).provider;
      if (!provider) {
        throw new Error("Provider not attached to signer");
      }
      const value = await provider.getBalance(address);
      setBalance(formatEther(value));
    } catch (e: any) {
      console.error(e);
      setError("잔액 조회 실패: RPC 또는 네트워크 설정을 확인하세요.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (signer && activeNetwork) {
      loadBalance();
    } else {
      setBalance(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer, activeNetwork?.id]);

  const handleSend = async () => {
    if (!signer || !activeNetwork) {
      setError("지갑과 네트워크를 먼저 설정해 주세요.");
      return;
    }
    if (!to.trim() || !amount.trim()) {
      setError("받는 주소와 보낼 양을 입력해 주세요.");
      return;
    }

    setError(null);
    setSending(true);
    try {
      const value = parseEther(amount);
      const tx = await signer.sendTransaction({
        to: to.trim(),
        value,
      });
      setTxHash(tx.hash);
      setAmount("");
      await tx.wait();
      await loadBalance();
    } catch (e: any) {
      console.error(e);
      setError(e?.reason || e?.message || "트랜잭션 전송 실패");
    } finally {
      setSending(false);
    }
  };

  if (!signer) {
    return (
      <p className="hint">
        먼저 지갑을 생성하거나 잠금을 해제한 뒤 네트워크를 선택해 주세요.
      </p>
    );
  }

  if (!activeNetwork) {
    return <p className="hint">네트워크를 하나 이상 추가하고 선택해 주세요.</p>;
  }

  return (
    <div className="wallet-dashboard">
      <div className="wallet-summary">
        <div>
          <span>주소</span>
          <code>{address}</code>
        </div>
        <div>
          <span>
            잔액 ({activeNetwork.symbol}){" "}
            <button onClick={loadBalance} disabled={refreshing}>
              {refreshing ? "새로고침 중..." : "⟳"}
            </button>
          </span>
          <strong>
            {balance ?? "-"} {balance !== null && activeNetwork.symbol}
          </strong>
        </div>
        <div>
          <span>네트워크</span>
          <span>
            {activeNetwork.name} (chainId: {activeNetwork.chainId})
          </span>
        </div>
      </div>

      <div className="send-form">
        <h3>코인 전송</h3>
        <label>
          받는 주소 (to)
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="0x로 시작하는 주소"
          />
        </label>
        <label>
          보낼 양 ({activeNetwork.symbol})
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="예: 0.1"
          />
        </label>
        <button onClick={handleSend} disabled={sending}>
          {sending ? "전송 중..." : "전송"}
        </button>
        {txHash && (
          <div className="tx-hash">
            <span>최근 트랜잭션 해시</span>
            <code>{txHash}</code>
          </div>
        )}
      </div>

      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
