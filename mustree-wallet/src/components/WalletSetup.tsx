import { useState } from "react";
import { Wallet } from "ethers";
import type { StoredWallet } from "../App";

interface WalletSetupProps {
  storedWallet: StoredWallet | null;
  onWalletCreated: (stored: StoredWallet, walletObj: Wallet) => void;
  onWalletUnlocked: (walletObj: Wallet) => void;
  onResetWallet: () => void;
}

type Mode = "idle" | "create" | "unlock" | "import";

export function WalletSetup(props: WalletSetupProps) {
  const { storedWallet, onWalletCreated, onWalletUnlocked, onResetWallet } = props;
  const [mode, setMode] = useState<Mode>("idle");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasStoredWallet = !!storedWallet;

  const resetLocalState = () => {
    setPassword("");
    setConfirmPassword("");
    setMnemonic("");
    setPrivateKey("");
    setGeneratedMnemonic(null);
    setError(null);
  };

  const handleGenerateWallet = async () => {
    if (!password || password.length < 6) {
      setError("비밀번호는 6자 이상으로 설정하세요.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // v6: HDNodeWallet이지만 여기서는 any로 사용
      const wallet = Wallet.createRandom() as any;
      const encryptedJson = await wallet.encrypt(password);
      const stored: StoredWallet = {
        address: wallet.address,
        encryptedJson,
      };
      setGeneratedMnemonic(wallet.mnemonic?.phrase ?? null);
      onWalletCreated(stored, wallet);
    } catch (e: any) {
      setError(e?.message || "지갑 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!storedWallet) return;
    if (!password) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const wallet = (await Wallet.fromEncryptedJson(
        storedWallet.encryptedJson,
        password
      )) as any;
      onWalletUnlocked(wallet);
      setMode("idle");
    } catch (e: any) {
      setError("복호화 실패: 비밀번호를 다시 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromMnemonic = async () => {
    if (!password || password.length < 6) {
      setError("비밀번호는 6자 이상으로 설정하세요.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!mnemonic.trim()) {
      setError("니모닉(단어 구문)을 입력해 주세요.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const wallet = Wallet.fromPhrase(mnemonic.trim()) as any;
      const encryptedJson = await wallet.encrypt(password);
      const stored: StoredWallet = {
        address: wallet.address,
        encryptedJson,
      };
      onWalletCreated(stored, wallet);
      setMode("idle");
      setGeneratedMnemonic(null);
    } catch (e: any) {
      setError("니모닉 가져오기 실패: 형식을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromPrivateKey = async () => {
    if (!password || password.length < 6) {
      setError("비밀번호는 6자 이상으로 설정하세요.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!privateKey.trim()) {
      setError("프라이빗 키를 입력해 주세요.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const normalizedKey = privateKey.trim().startsWith("0x")
        ? privateKey.trim()
        : "0x" + privateKey.trim();
      const wallet = new Wallet(normalizedKey) as any;
      const encryptedJson = await wallet.encrypt(password);
      const stored: StoredWallet = {
        address: wallet.address,
        encryptedJson,
      };
      onWalletCreated(stored, wallet);
      setMode("idle");
    } catch (e: any) {
      setError("프라이빗 키 가져오기 실패: 형식을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wallet-setup">
      {hasStoredWallet ? (
        <div className="wallet-info">
          <div className="wallet-address">
            <span>현재 저장된 주소</span>
            <code>{storedWallet?.address}</code>
          </div>
          <div className="wallet-actions">
            <button
              onClick={() => {
                resetLocalState();
                setMode("unlock");
              }}
            >
              🔓 지갑 잠금 해제
            </button>
            <button className="danger" onClick={onResetWallet}>
              🗑 저장된 지갑 삭제
            </button>
          </div>
        </div>
      ) : (
        <p className="hint">
          아직 저장된 지갑이 없습니다. 새로 생성하거나, 니모닉/프라이빗 키로 가져올 수 있습니다.
        </p>
      )}

      {mode === "idle" && (
        <div className="wallet-mode-buttons">
          <button
            onClick={() => {
              resetLocalState();
              setMode("create");
            }}
          >
            ✨ 새 지갑 생성
          </button>
          <button
            onClick={() => {
              resetLocalState();
              setMode("import");
            }}
          >
            📥 기존 지갑 가져오기
          </button>
          {hasStoredWallet && (
            <button
              onClick={() => {
                resetLocalState();
                setMode("unlock");
              }}
            >
              🔓 비밀번호로 잠금 해제
            </button>
          )}
        </div>
      )}

      {mode === "create" && (
        <div className="wallet-form">
          <h3>새 지갑 생성</h3>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
            />
          </label>
          <label>
            비밀번호 확인
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>

          <button onClick={handleGenerateWallet} disabled={loading}>
            {loading ? "생성 중..." : "지갑 생성 & 저장"}
          </button>

          {generatedMnemonic && (
            <div className="mnemonic-box">
              <strong>⚠ 니모닉(복구 구문)을 꼭 백업해 두세요:</strong>
              <p>{generatedMnemonic}</p>
            </div>
          )}
        </div>
      )}

      {mode === "unlock" && storedWallet && (
        <div className="wallet-form">
          <h3>지갑 잠금 해제</h3>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="지갑 생성 시 사용한 비밀번호"
            />
          </label>
          <button onClick={handleUnlock} disabled={loading}>
            {loading ? "복호화 중..." : "잠금 해제"}
          </button>
        </div>
      )}

      {mode === "import" && (
        <div className="wallet-form">
          <h3>기존 지갑 가져오기</h3>

          <details open>
            <summary>니모닉으로 가져오기</summary>
            <label>
              니모닉 (단어 구문)
              <textarea
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                placeholder="예: apple banana ... (12/24 단어)"
              />
            </label>
            <label>
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
              />
            </label>
            <label>
              비밀번호 확인
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            <button onClick={handleImportFromMnemonic} disabled={loading}>
              {loading ? "가져오는 중..." : "니모닉으로 지갑 가져오기"}
            </button>
          </details>

          <details>
            <summary>프라이빗 키로 가져오기</summary>
            <label>
              프라이빗 키 (0x...)
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="0x로 시작하는 64자리 16진수"
              />
            </label>
            <label>
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
              />
            </label>
            <label>
              비밀번호 확인
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            <button onClick={handleImportFromPrivateKey} disabled={loading}>
              {loading ? "가져오는 중..." : "프라이빗 키로 지갑 가져오기"}
            </button>
          </details>
        </div>
      )}

      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
