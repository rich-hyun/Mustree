const express = require('express');
const Web3 = require('web3');
const cors = require('cors');

const app = express();
app.use(cors());

// ===== 1. 네트워크 RPC 설정 =====
const RPC_URL = "http://203.252.147.197:8545";  // ← 네트워크 RPC 주소로 수정
const web3 = new Web3(RPC_URL);

// ===== 2. 추적할 지갑 주소 집합 =====
const WALLETS = [
  { label: "초기 팀 (12.5%)", address: "0x6d93f35603783fb9c1ac061b1349bed7a31386c4" },
  { label: "머스트리 재단 (12.5%)", address: "0x299e421dec65933ed64e38ce16f536fe2271a2ac" },
  { label: "협력사 (40%)", address: "0xc5462ae75997214fe1f7490857ffd5b8e09580b5" },
  { label: "스테이킹 (25%)", address: "0x403ebbf2e97caff8567e36cba3f8d3ca27e37970" },
  { label: "커뮤니티 (10%)", address: "0x4e951d513959e42c6ea30a92927a6237e63304f5" },
];

// ===== 3. 잔액 조회 함수 =====
async function fetchBalances() {
  const results = [];

  for (const w of WALLETS) {
    const wei = await web3.eth.getBalance(w.address);
    const mst = Number(web3.utils.fromWei(wei, "ether"));

    results.push({
      label: w.label,
      address: w.address,
      balance: mst
    });
  }

  return results;
}

// ===== 4. API 엔드포인트 =====
app.get('/api/balances', async (req, res) => {
  try {
    const data = await fetchBalances();
    res.json({ updated: new Date(), data });
  } catch (err) {
    console.error("Balance fetch error:", err);
    res.status(500).json({ error: "balance fetch failed" });
  }
});

// ===== 5. 서버 시작 =====
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`MST dashboard API running at http://localhost:${PORT}`);
});
