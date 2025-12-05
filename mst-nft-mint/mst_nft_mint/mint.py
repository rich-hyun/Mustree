# mst_nft_mint/mint.py

from web3 import Web3
import json
from .networks import NETWORKS
from .abi import NFT_ABI


class MintError(Exception):
    """민팅 실패시 사용할 커스텀 예외"""
    pass


def mint_nft(
    network: str,
    private_key: str,
    to: str,
    label: str,
    metadata: dict,
):
    """
    Mustree NFT Vault를 통해 NFT를 민팅하는 함수

    :param network: "Mustree", "NABIZAM" 등 NETWORKS에 정의된 이름
    :param private_key: 0x로 시작하는 64자리 hex 개인키
    :param to: NFT 수령 지갑 주소
    :param label: NFT 이름/라벨
    :param metadata: dict 형태의 메타데이터 (자동으로 JSON 문자열로 변환됨)
    :return: dict (tx_hash, token_id, owner, contract)
    """

    if network not in NETWORKS:
        raise ValueError(f"Unknown network: {network}")

    net = NETWORKS[network]

    if not private_key.startswith("0x") or len(private_key) != 66:
        raise ValueError("private_key must be '0x' + 64 hex characters")

    w3 = Web3(Web3.HTTPProvider(net["rpc"]))
    acct = w3.eth.account.from_key(private_key)

    # checksum 주소 변환
    to_checksum = Web3.to_checksum_address(to)

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(net["contract"]),
        abi=NFT_ABI,
    )

    metadata_json = json.dumps(metadata, ensure_ascii=False)

    # 1) 트랜잭션 build
    tx = contract.functions.mintNFT(
        to_checksum,
        label,
        metadata_json,
    ).build_transaction({
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address),
        "gas": 600000,
        "gasPrice": w3.eth.gas_price,
        "chainId": net["chain_id"],
    })

    # 2) 서명 & 전송
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

    # 3) Receipt 대기
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    if receipt.status != 1:
        raise MintError("Transaction reverted on-chain")

    # 4) tokenId 추출 (이벤트 or nextTokenId() - 1)
    try:
        log0 = receipt["logs"][0]
        token_id = int(log0["data"], 16)
    except Exception:
        # fallback: nextTokenId() - 1
        token_id = contract.functions.nextTokenId().call() - 1

    owner = contract.functions.ownerOf(token_id).call()

    return {
        "network": network,
        "tx_hash": tx_hash.hex(),
        "token_id": token_id,
        "owner": owner,
        "contract": net["contract"],
    }
