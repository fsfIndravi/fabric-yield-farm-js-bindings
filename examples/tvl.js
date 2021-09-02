const anchor = require("@project-serum/anchor");
const stakingClient = require('../classes/stakingClient');

const pools = [
  {
    poolName: "FAB-USDC-LP",
    stakingToken: "FAB-USDC LP",
    rewardToken: "FAB",
    ammId: "7eM9KWYiJmNfDfeztMoEZE1KPyWD54LRxM9GmRY9ske6",
    stakingProgramId: "3wVH3KtApRpUAAZVEGtNNrzJ7AsBRpudzBcLQdwQRhpk",
    rewardTokenMint: "EdAhkbj5nF9sRM7XN7ewuW8C9XEUMs8P7cnoQ57SYE96",
    stakingTokenMint: "5rTCvZq6BcApsC3VV1EEUuTJfaVd8uYhcGjwTy1By6P8"  
  },
  {
    poolName: "APEX-USDC-LP",
    stakingToken: "APEX-USDC LP",
    rewardToken: "APEX",
    ammId: "43UHp4TuwQ7BYsaULN1qfpktmg7GWs9GpR8TDb8ovu9c",
    stakingProgramId: "5UHStU4uguDLuDt7xzU5fU28H1F2CVJbZD6EdKEdrWz8",
    rewardTokenMint: "51tMb3zBKDiQhNwGqpgwbavaGH54mk8fXFzxTc1xnasg",
    stakingTokenMint: "444cVqYyDxJNo6FqiMb9qQWFUd7tYzFRdDuJRFrSAGnU"
    }
]

const dummyWallet = {
  signTransaction(tx) {
    return new Promise<Transaction>(resolve => resolve(tx))
  },
  signAllTransactions(txs) {
    return new Promise<any>(resolve => resolve(txs))
  },
  publicKey: new anchor.web3.PublicKey(
    '11111111111111111111111111111111'
  )
}

const provider = new anchor.Provider(
  new anchor.web3.Connection('https://api.mainnet-beta.solana.com'),
  dummyWallet,
  anchor.Provider.defaultOptions()
);
anchor.setProvider(provider);

  (async () => {
    try {
      for (const pool of pools) {
        // Get LP price data from Raydium
        const priceData = await stakingClient.getPoolPriceData(pool.ammId, pool.stakingTokenMint);
        const lpPrice = priceData.lpTokenPrice;
        const tokenPrice = priceData.tokenPrice;
  
        // Get staking pool information using RPC
        const stakingPoolInfo = await stakingClient.getStakingPoolInformation(
          provider.connection, 
          new anchor.web3.PublicKey(pool.stakingProgramId), 
          tokenPrice, 
          lpPrice
        );  
              
        console.log(pool.stakingToken, ' pool info: ', stakingPoolInfo);
      }

    } catch (e) {
      console.error("Error getting pool data:", e);
    }
  })();