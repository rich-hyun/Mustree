# mst_sbt_mint/mint.py

from web3 import Web3
from .networks import NETWORKS
from .abi.sbt_vault_abi import SBT_VAULT_ABI


def mint_sbt(
    priv_key: str,
    to: str,
    label: str,
    guardian: str,
    unlock_time: int,
    metadata: str,
    network: str = "MUSTREE",
) -> dict:
    """
    Mustree Network에서 SBT(Soulbound Token)를 발행하는 함수.

    Args:
        priv_key: 민트 트랜잭션을 보낼 계정의 PRIVATE KEY (0x...)
        to: SBT를 받을 지갑 주소
        label: SBT 라벨 (ex: "KYC_SBT", "VIP_BADGE")
        guardian: 복구/관리 담당 지갑 주소
        unlock_time: UNIX timestamp (0이면 즉시 unlock)
        metadata: tokenURI로 사용할 문자열 (ipfs://... 또는 https://...json)
        network: "MUSTREE" (또는 추후 확장 네트워크 이름)

    Returns:
        {
            "tx_hash": str,
            "token_id": int,
            "owner": str,
            "contract_address": str,
        }
    """

    if network not in NETWORKS:
        raise ValueError(f"Unsupported network: {network}")

    net = NETWORKS[network]

    # 1) Web3 provider 연결
    w3 = Web3(Web3.HTTPProvider(net["rpc_url"]))
    from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

    if not w3.is_connected():
        raise ConnectionError(f"Failed to connect to RPC: {net['rpc_url']}")

    # 2) 계정 설정
    account = w3.eth.account.from_key(priv_key)
    from_address = account.address

    # 3) 컨트랙트 인스턴스
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(net["sbt_contract_address"]),
        abi=SBT_VAULT_ABI,
    )

    # 4) 트랜잭션 빌드
    nonce = w3.eth.get_transaction_count(from_address)

    tx = contract.functions.mintSBT(
        Web3.to_checksum_address(to),
        label,
        Web3.to_checksum_address(guardian),
        int(unlock_time),
        metadata,
    ).build_transaction(
        {
            "from": from_address,
            "nonce": nonce,
            "chainId": net["chain_id"],
            "gas": 500_000,  # 필요 시 조정
            "gasPrice": w3.eth.gas_price,
        }
    )

    # 5) 서명 + 전송
    signed = w3.eth.account.sign_transaction(tx, private_key=priv_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

    # 6) 트랜잭션 결과 대기
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    # 7) Minted 이벤트에서 tokenId 파싱
    token_id = None
    try:
        logs = contract.events.Minted().process_receipt(receipt)
        if len(logs) > 0:
            token_id = logs[0]["args"]["tokenId"]
    except:
        pass

    if token_id is None:
        raise RuntimeError("Failed to parse tokenId from Minted event")
    # 8) owner 조회
    owner = contract.functions.ownerOf(token_id).call()

    return {
        "tx_hash": tx_hash.hex(),
        "token_id": token_id,
        "owner": owner,
        "contract_address": net["sbt_contract_address"],
    }
