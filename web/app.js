// ===== 환경 설정 =====
let CONTRACT_ADDRESS = "0xb20889790a26efce880d7e01d57d1dca18ee2626";

const CHAIN_ID_DEC = 7707;
const CHAIN_ID_HEX = "0x1e1b"; // 7707
const STORAGE_KEY_ADDR = "FCSBT_ADDR";

let provider, signer, account, network, contract, abi;

// 간단 로거
const log = (elId, msg) => document.getElementById(elId).textContent = msg;

async function connect() {
  if (!window.ethereum) { alert("MetaMask가 필요합니다."); return; }
  await window.ethereum.request({ method: "eth_requestAccounts" });

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  account = await signer.getAddress();
  network = await provider.getNetwork();

  log("acc", account);
  log("netName", network.name || "custom");
  log("cid", Number(network.chainId));

  // ABI 로드
  const res = await fetch("./abi/FrozenClockSBT.json", { cache: "no-cache" });
  abi = await res.json();
}

async function switchToJkk() {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (e) {
    if (e.code === 4902 || (e.data && e.data.originalError && e.data.originalError.code === 4902)) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_ID_HEX,
          chainName: "JKK-TMZ",
          nativeCurrency: { name: "TMZ", symbol: "TMZ", decimals: 18 },
          rpcUrls: ["https://jkk.mst2.site"],
          blockExplorerUrls: []
        }]
      });
    } else {
      console.error(e);
      alert("네트워크 전환 실패: " + e.message);
    }
  }
}

async function ensureNetwork() {
  const n = await provider.getNetwork();
  if (Number(n.chainId) !== CHAIN_ID_DEC) {
    alert("현재 체인이 JKK‑TMZ(7707)가 아닙니다. 전환 버튼을 눌러주세요.");
    return false;
  }
  return true;
}

// ✅ loadContract 한 번만 정의
async function loadContract() {
  if (!abi) await connect();

  const addrInput = document.getElementById("contractAddress");
  const addr = (addrInput.value || CONTRACT_ADDRESS).trim();
  if (!addr) { alert("컨트랙트 주소를 입력하세요."); return; }

  // 화면 표시 + 로컬 저장
  document.getElementById("loadedAddr").value = addr;
  localStorage.setItem(STORAGE_KEY_ADDR, addr);

  CONTRACT_ADDRESS = addr;
  contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

  const owner = await contract.owner();
  document.getElementById("owner").textContent = owner;
  document.getElementById("ownerWarn").style.display =
    owner.toLowerCase() !== account.toLowerCase() ? "block" : "none";

  alert("컨트랙트 로드 완료");
}

async function mint() {
  if (!(await ensureNetwork())) return;
  if (!contract) { alert("먼저 컨트랙트를 로드하세요."); return; }

  const to    = document.getElementById("to").value.trim();
  const extId = document.getElementById("extId").value.trim();
  const name  = document.getElementById("holderName").value.trim();
  const date  = document.getElementById("dateStr").value.trim();
  if (!to || !extId || !name || !date) { alert("모든 필드를 입력하세요."); return; }

  try {
    // 민팅 전 staticCall 로 tokenId 예측
    const predicted = await contract.mint.staticCall(to, extId, name, date);
    const tx = await contract.mint(to, extId, name, date); // 필요 시 { gasPrice: 0 }
    await tx.wait();

    const tokenIdStr = predicted.toString();        // ✅ 정의!
    document.getElementById("mintResult").textContent =
      `✅ Minted! Token ID: ${tokenIdStr}`;

    // ▼ 토큰 ID 복사용 칸 표시/채우기
    const copyBox = document.getElementById("mintIdCopy");
    const copyInput = document.getElementById("mintedTokenId");
    if (copyBox && copyInput) {
      copyInput.value = tokenIdStr;
      copyBox.style.display = "block";
    }
  } catch (e) {
    console.error(e);
    alert("민팅 실패: " + (e && e.message ? e.message : e));
  }
}

async function viewToken() {
  if (!contract) { alert("먼저 컨트랙트를 로드하세요."); return; }
  const id = BigInt(document.getElementById("viewTokenId").value || "1");
  try {
    const uri = await contract.tokenURI(id);
    const b64 = uri.split(",")[1];
    const json = JSON.parse(atob(b64));
    document.getElementById("jsonOut").textContent = JSON.stringify(json, null, 2);
    document.getElementById("imgOut").src = json.image;
  } catch (e) {
    console.error(e);
    alert("조회 실패: " + e.message);
  }
}

// 페이지 로드시 저장된 주소를 입력/표시에 채우기 + 토큰ID 복사 핸들러 등록
window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem(STORAGE_KEY_ADDR);
  if (saved) {
    const inAddr = document.getElementById("contractAddress");
    const outAddr = document.getElementById("loadedAddr");
    if (inAddr) inAddr.value = saved;
    if (outAddr) outAddr.value = saved;
  }

  const mintedTokenInput = document.getElementById("mintedTokenId");
  if (mintedTokenInput) {
    mintedTokenInput.addEventListener("click", async () => {
      const v = mintedTokenInput.value.trim();
      if (!v) return;
      try {
        await navigator.clipboard.writeText(v);
      } catch (e) {
        mintedTokenInput.select();
        document.execCommand("copy");
      }
      mintedTokenInput.classList.add("copied");
      setTimeout(() => mintedTokenInput.classList.remove("copied"), 600);
    });
  }
});

// 복사 버튼(로드된 컨트랙트 주소)
async function copyLoadedAddr() {
  const value = (document.getElementById("loadedAddr").value ||
                 document.getElementById("contractAddress").value || "").trim();
  if (!value) { alert("복사할 주소가 없습니다."); return; }
  try {
    await navigator.clipboard.writeText(value);
    alert("컨트랙트 주소가 복사되었습니다.");
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    alert("컨트랙트 주소가 복사되었습니다.");
  }
}

// UI 바인딩
document.getElementById("btnConnect").addEventListener("click", connect);
document.getElementById("btnSwitch").addEventListener("click", switchToJkk);
document.getElementById("btnLoadContract").addEventListener("click", loadContract);
document.getElementById("btnMint").addEventListener("click", mint);
document.getElementById("btnView").addEventListener("click", viewToken);
document.getElementById("btnCopyAddr").addEventListener("click", copyLoadedAddr);
